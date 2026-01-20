import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabaseAdmin } from '@/lib/supabase/server';

// Telegram API credentials (получить на my.telegram.org)
const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const apiHash = process.env.TELEGRAM_API_HASH || '';

const CONNECT_TIMEOUT_MS = 25_000;
const AUTH_TIMEOUT_MS = 25_000;

type ClientState = {
  client: TelegramClient | null;
  isConnecting: boolean;
  sessionString: string | null;
};

const clientStates = new Map<string, ClientState>();

function stateKey(userId?: string | null): string {
  return userId ? `user:${userId}` : 'global';
}

function getState(userId?: string | null): ClientState {
  const key = stateKey(userId);
  let st = clientStates.get(key);
  if (!st) {
    st = { client: null, isConnecting: false, sessionString: null };
    clientStates.set(key, st);
  }
  return st;
}

function timeoutError(label: string, ms: number): Error {
  return new Error(`${label} timeout after ${ms}ms`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError(label, ms)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function getActiveSession(userId?: string | null): Promise<string | null> {
  try {
    let query = (supabaseAdmin.from('telegram_sessions') as any)
      .select('session_string')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      const msg = String(error.message || error);
      // Backward-compatible: migration with telegram_sessions.user_id may not be applied yet.
      if (userId && msg.toLowerCase().includes('user_id') && msg.toLowerCase().includes('column')) {
        return await getActiveSession(null);
      }
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row?.session_string) {
      if (userId) {
        // If user has no session yet but a legacy active session exists (user_id is NULL),
        // try to "adopt" it for this user to keep the app working after migration.
        const adopted = await adoptLegacyActiveSessionForUser(userId);
        if (adopted) return adopted;
        return null;
      }
      return process.env.TELEGRAM_SESSION || null;
    }

    return row.session_string;
  } catch {
    // Backward-compatible: if user_id column doesn't exist, fall back to global session.
    if (userId) {
      try {
        return await getActiveSession(null);
      } catch {
        // ignore
      }
    }
    return userId ? null : (process.env.TELEGRAM_SESSION || null);
  }
}

async function adoptLegacyActiveSessionForUser(userId: string): Promise<string | null> {
  if (!userId) return null;

  try {
    // Only adopt if user does not already have an active session.
    const { data: existing } = await (supabaseAdmin.from('telegram_sessions') as any)
      .select('id')
      .eq('is_active', true)
      .eq('user_id', userId)
      .limit(1);

    if (Array.isArray(existing) && existing.length > 0) return null;

    const { data: legacyRows, error: legacyError } = await (supabaseAdmin.from('telegram_sessions') as any)
      .select('id, session_string')
      .eq('is_active', true)
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (legacyError) {
      const msg = String(legacyError.message || legacyError);
      if (msg.toLowerCase().includes('user_id') && msg.toLowerCase().includes('column')) {
        // No user_id column (old schema) => nothing to adopt.
        return process.env.TELEGRAM_SESSION || null;
      }
      return null;
    }

    const legacy = Array.isArray(legacyRows) ? legacyRows[0] : null;
    if (!legacy?.session_string) return null;

    // Bind the legacy session to this user (best-effort).
    await (supabaseAdmin.from('telegram_sessions') as any)
      .update({ user_id: userId })
      .eq('id', legacy.id);

    return legacy.session_string;
  } catch {
    return null;
  }
}

function isAuthKeyDuplicatedError(error: any): boolean {
  const msg = String(error?.errorMessage || error?.message || error || '');
  return msg.includes('AUTH_KEY_DUPLICATED') || msg.includes('406');
}

export async function saveSession(
  sessionString: string,
  phoneNumber: string | undefined,
  userId: string
): Promise<void> {
  // Preferred: per-user sessions
  const { error: deactivateError } = await (supabaseAdmin.from('telegram_sessions') as any)
    .update({ is_active: false })
    .eq('is_active', true)
    .eq('user_id', userId);

  if (deactivateError) {
    const msg = String(deactivateError.message || deactivateError);
    if (msg.toLowerCase().includes('user_id') && msg.toLowerCase().includes('column')) {
      // Backward-compatible: old schema without user_id (global session)
      await (supabaseAdmin.from('telegram_sessions') as any)
        .update({ is_active: false })
        .eq('is_active', true);

      await (supabaseAdmin.from('telegram_sessions') as any).insert({
        session_string: sessionString,
        phone_number: phoneNumber,
        is_active: true,
      });
      return;
    }
    throw deactivateError;
  }

  const { error: insertError } = await (supabaseAdmin.from('telegram_sessions') as any).insert({
    session_string: sessionString,
    phone_number: phoneNumber,
    user_id: userId,
    is_active: true,
  });

  if (insertError) {
    const msg = String(insertError.message || insertError);
    if (msg.toLowerCase().includes('user_id') && msg.toLowerCase().includes('column')) {
      await (supabaseAdmin.from('telegram_sessions') as any).insert({
        session_string: sessionString,
        phone_number: phoneNumber,
        is_active: true,
      });
      return;
    }
    throw insertError;
  }
}

export async function getTelegramClient(userId?: string): Promise<TelegramClient> {
  if (!apiId || !apiHash) {
    throw new Error('TELEGRAM_API_ID и TELEGRAM_API_HASH не настроены');
  }

  const st = getState(userId);
  const activeSessionString = await getActiveSession(userId);

  if (st.client?.connected) {
    if (st.sessionString && activeSessionString && st.sessionString !== activeSessionString) {
      try {
        await st.client.disconnect();
      } catch {
        // ignore
      }
      st.client = null;
    } else {
      return st.client;
    }
  }

  if (st.isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (st.client?.connected) return st.client;
  }

  st.isConnecting = true;

  try {
    const session = new StringSession(activeSessionString || '');
    st.client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
    });

    try {
      await withTimeout(st.client.connect(), CONNECT_TIMEOUT_MS, 'Telegram connect');
    } catch (e) {
      if (isAuthKeyDuplicatedError(e)) {
        // This usually means the same auth key is being used elsewhere.
        // Deactivate session so user can reconnect and generate a fresh key.
        if (userId) {
          try {
            await deactivateTelegramSessionForUser(userId);
          } catch {
            // ignore
          }
        }
        throw new Error('Telegram сессия недействительна (AUTH_KEY_DUPLICATED). Отвяжите и подключите Telegram заново.');
      }
      try {
        await st.client.disconnect();
      } catch {
        // ignore
      }
      st.client = null;
      throw e;
    }
    st.sessionString = activeSessionString || null;

    return st.client;
  } finally {
    st.isConnecting = false;
  }
}

export async function isAuthorized(userId?: string): Promise<boolean> {
  try {
    const client = await getTelegramClient(userId);
    return await client.isUserAuthorized();
  } catch {
    return false;
  }
}

export async function disconnectClient(userId?: string): Promise<void> {
  const st = getState(userId);
  if (st.client) {
    await st.client.disconnect();
    st.client = null;
  }
  st.sessionString = null;
  st.isConnecting = false;
}

export async function deactivateTelegramSessionForUser(userId: string): Promise<void> {
  if (!userId) throw new Error('userId is required');

  try {
    const { error } = await (supabaseAdmin.from('telegram_sessions') as any)
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('user_id', userId);

    if (error) {
      const msg = String(error.message || error);
      // Backward-compatible: old schema without user_id.
      if (msg.toLowerCase().includes('user_id') && msg.toLowerCase().includes('column')) {
        await (supabaseAdmin.from('telegram_sessions') as any)
          .update({ is_active: false })
          .eq('is_active', true);
      } else {
        throw error;
      }
    }
  } finally {
    try {
      await disconnectClient(userId);
    } catch {
      // ignore
    }
  }
}

export async function sendAuthCode(
  phoneNumber: string,
  userId: string
): Promise<{ phoneCodeHash: string }> {
  const client = await getTelegramClient(userId);

  let result: { phoneCodeHash: string };
  try {
    result = await withTimeout(
      client.sendCode(
        {
          apiId,
          apiHash,
        },
        phoneNumber
      ),
      AUTH_TIMEOUT_MS,
      'Telegram sendCode'
    );
  } catch (e) {
    // Reset stuck client so next attempt can retry cleanly
    try {
      await disconnectClient(userId);
    } catch {
      // ignore
    }
    throw e;
  }

  return {
    phoneCodeHash: result.phoneCodeHash,
  };
}

export async function verifyAuthCode(
  phoneNumber: string,
  phoneCode: string,
  phoneCodeHash: string,
  password: string | undefined,
  userId: string
): Promise<{ success: boolean; needPassword?: boolean }> {
  const client = await getTelegramClient(userId);

  try {
    await client.invoke(
      new (await import('telegram/tl')).Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode,
      })
    );

    const sessionString = (client.session as StringSession).save();
    await saveSession(sessionString, phoneNumber, userId);

    return { success: true };
  } catch (error: any) {
    if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      if (password) {
        await client.signInWithPassword(
          {
            apiId,
            apiHash,
          },
          {
            password: async () => password,
            onError: (err) => {
              throw err;
            },
          }
        );

        const sessionString = (client.session as StringSession).save();
        await saveSession(sessionString, phoneNumber, userId);

        return { success: true };
      }

      return { success: false, needPassword: true };
    }

    throw error;
  }
}

export async function getConnectionStatusForUser(userId: string): Promise<{
  connected: boolean;
  authorized: boolean;
  hasSession: boolean;
  phoneNumber?: string;
}> {
  try {
    const query = (supabaseAdmin.from('telegram_sessions') as any)
      .select('phone_number, session_string')
      .eq('is_active', true)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: sessions, error } = await query;
    if (error) {
      const msg = String(error.message || error);
      if (msg.toLowerCase().includes('user_id') && msg.toLowerCase().includes('column')) {
        return await getConnectionStatus();
      }
    }

    const session = Array.isArray(sessions) ? sessions[0] : null;
    const hasSession = !!(session?.session_string && String(session.session_string).length > 0);

    let authorized = false;
    if (hasSession) {
      authorized = await isAuthorized(userId);
    }
    const st = getState(userId);

    return {
      connected: !!st.client?.connected,
      authorized,
      hasSession,
      phoneNumber: session?.phone_number,
    };
  } catch {
    // Backward-compatible: old schema without user_id or unexpected error.
    return await getConnectionStatus();
  }
}

// Backward-compatible: legacy callers without userId
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  authorized: boolean;
  hasSession: boolean;
  phoneNumber?: string;
}> {
  try {
    const { data: sessions } = await (supabaseAdmin.from('telegram_sessions') as any)
      .select('phone_number, session_string')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const session = Array.isArray(sessions) ? sessions[0] : null;
    const hasSession = !!(session?.session_string && String(session.session_string).length > 0);

    const authorized = hasSession ? await isAuthorized() : false;
    const st = getState(null);

    return {
      connected: !!st.client?.connected,
      authorized,
      hasSession,
      phoneNumber: session?.phone_number,
    };
  } catch {
    return {
      connected: false,
      authorized: false,
      hasSession: false,
    };
  }
}
