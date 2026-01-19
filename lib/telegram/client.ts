import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { supabaseAdmin } from '@/lib/supabase/server';

// Telegram API credentials (получить на my.telegram.org)
const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const apiHash = process.env.TELEGRAM_API_HASH || '';

// Singleton для клиента
let clientInstance: TelegramClient | null = null;
let isConnecting = false;

/**
 * Получить активную сессию из БД
 */
async function getActiveSession(): Promise<string | null> {
  try {
    const { data, error } = await (supabaseAdmin
      .from('telegram_sessions') as any)
      .select('session_string')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return process.env.TELEGRAM_SESSION || null;
    }

    return data.session_string;
  } catch {
    return process.env.TELEGRAM_SESSION || null;
  }
}

/**
 * Сохранить сессию в БД
 */
export async function saveSession(sessionString: string, phoneNumber?: string): Promise<void> {
  // Деактивировать старые сессии
  await (supabaseAdmin
    .from('telegram_sessions') as any)
    .update({ is_active: false })
    .eq('is_active', true);

  // Создать новую сессию
  await (supabaseAdmin
    .from('telegram_sessions') as any)
    .insert({
      session_string: sessionString,
      phone_number: phoneNumber,
      is_active: true,
    });
}

/**
 * Получить или создать Telegram клиент
 */
export async function getTelegramClient(): Promise<TelegramClient> {
  if (!apiId || !apiHash) {
    throw new Error('TELEGRAM_API_ID и TELEGRAM_API_HASH не настроены');
  }

  // Вернуть существующий клиент если он подключен
  if (clientInstance?.connected) {
    return clientInstance;
  }

  // Предотвращение параллельных подключений
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (clientInstance?.connected) {
      return clientInstance;
    }
  }

  isConnecting = true;

  try {
    // Загрузить сессию из БД
    const sessionString = await getActiveSession();
    const session = new StringSession(sessionString || '');

    // Создать клиент
    clientInstance = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
    });

    // Подключиться
    await clientInstance.connect();

    return clientInstance;
  } finally {
    isConnecting = false;
  }
}

/**
 * Проверить авторизован ли клиент
 */
export async function isAuthorized(): Promise<boolean> {
  try {
    const client = await getTelegramClient();
    return await client.isUserAuthorized();
  } catch {
    return false;
  }
}

/**
 * Отключить клиент
 */
export async function disconnectClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.disconnect();
    clientInstance = null;
  }
}

/**
 * Начать процесс авторизации - отправить код
 */
export async function sendAuthCode(phoneNumber: string): Promise<{ phoneCodeHash: string }> {
  const client = await getTelegramClient();

  const result = await client.sendCode(
    {
      apiId,
      apiHash,
    },
    phoneNumber
  );

  return {
    phoneCodeHash: result.phoneCodeHash,
  };
}

/**
 * Подтвердить код авторизации
 */
export async function verifyAuthCode(
  phoneNumber: string,
  phoneCode: string,
  phoneCodeHash: string,
  password?: string
): Promise<{ success: boolean; needPassword?: boolean }> {
  const client = await getTelegramClient();

  try {
    await client.invoke(
      new (await import('telegram/tl')).Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode,
      })
    );

    // Сохранить сессию
    const sessionString = (client.session as StringSession).save();
    await saveSession(sessionString, phoneNumber);

    return { success: true };
  } catch (error: any) {
    // Требуется 2FA пароль
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
        await saveSession(sessionString, phoneNumber);

        return { success: true };
      }

      return { success: false, needPassword: true };
    }

    throw error;
  }
}

/**
 * Получить статус подключения
 */
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  authorized: boolean;
  phoneNumber?: string;
}> {
  try {
    const { data: session } = await (supabaseAdmin
      .from('telegram_sessions') as any)
      .select('phone_number')
      .eq('is_active', true)
      .single();

    const authorized = await isAuthorized();

    return {
      connected: !!clientInstance?.connected,
      authorized,
      phoneNumber: session?.phone_number,
    };
  } catch {
    return {
      connected: false,
      authorized: false,
    };
  }
}
