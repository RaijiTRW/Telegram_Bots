/**
 * Background Parser
 * Фоновый парсинг для каналов с включенным AI
 * Работает при запуске сервера через next start
 */

import { createClient } from '@supabase/supabase-js';
import { createAIProcessor } from './ai/processor';

type BackgroundParserState = {
  isRunning: boolean;
  timerId: NodeJS.Timeout | null;
  cycleInProgress: boolean;
  startedAt: number | null;
  lastAttemptAtByChannelId: Map<string, number>;
};

function getState(): BackgroundParserState {
  const g = globalThis as any;
  if (!g.__backgroundParserState) {
    g.__backgroundParserState = {
      isRunning: false,
      timerId: null,
      cycleInProgress: false,
      startedAt: null,
      lastAttemptAtByChannelId: new Map<string, number>(),
    } satisfies BackgroundParserState;
  }
  return g.__backgroundParserState as BackgroundParserState;
}

const DEFAULT_INTERVAL_SECONDS = 120;
const MIN_INTERVAL_SECONDS = 5;
const MAX_INTERVAL_SECONDS = 365 * 24 * 60 * 60;

function clampIntervalSeconds(seconds: number): number {
  const s = Math.round(seconds);
  if (!Number.isFinite(s)) return DEFAULT_INTERVAL_SECONDS;
  return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, s));
}

async function getIntervalSeconds(supabase: any): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'parser_interval_seconds')
      .maybeSingle();

    if (error) return DEFAULT_INTERVAL_SECONDS;

    const seconds = Number(data?.value?.seconds);
    return clampIntervalSeconds(Number.isFinite(seconds) ? seconds : DEFAULT_INTERVAL_SECONDS);
  } catch {
    return DEFAULT_INTERVAL_SECONDS;
  }
}

/**
 * Запуск фонового парсера
 */
export function startBackgroundParser() {
  const state = getState();

  if (state.isRunning) {
    console.log('[BackgroundParser] Already running');
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[BackgroundParser] Supabase credentials not configured');
    return;
  }

  state.isRunning = true;
  state.startedAt = Date.now();
  console.log('[BackgroundParser] Started');

  // Первый тик почти сразу (чтобы инициализироваться и подтянуть интервал)
  scheduleNextTick(1000);
}

/**
 * Остановка фонового парсера
 */
export function stopBackgroundParser() {
  const state = getState();
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
  state.isRunning = false;
  state.cycleInProgress = false;
  state.startedAt = null;
  console.log('[BackgroundParser] Stopped');
}

function scheduleNextTick(delayMs: number) {
  const state = getState();
  if (!state.isRunning) return;
  if (state.timerId) {
    clearTimeout(state.timerId);
  }
  const safeDelay = Math.max(250, Math.round(delayMs));
  state.timerId = setTimeout(() => {
    runParsingCycle();
  }, safeDelay);
}

/**
 * Цикл парсинга
 */
async function runParsingCycle() {
  const state = getState();

  if (state.cycleInProgress) {
    console.log('[BackgroundParser] Previous cycle still running, skipping');
    return;
  }

  state.cycleInProgress = true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const intervalSeconds = await getIntervalSeconds(supabase);
  const intervalMs = intervalSeconds * 1000;
  let channels: any[] | null = null;

  try {
    // Проверяем есть ли каналы с включенным AI
    const { data, error } = await supabase
      .from('channels')
      .select('id, name, ai_enabled, ai_last_run_at, ai_status')
      .eq('ai_enabled', true);

    if (error) {
      console.error('[BackgroundParser] Error fetching channels:', error.message);
      return;
    }

    channels = data || null;

    if (!channels || channels.length === 0) {
      console.log('[BackgroundParser] No AI-enabled channels found');
      return;
    }

    const now = Date.now();
    const dueChannels = (channels || []).filter((c: any) => {
      if (!c?.ai_enabled) return false;
      if (c?.ai_status === 'running') return false;
      const lastRun = c.ai_last_run_at ? new Date(c.ai_last_run_at).getTime() : null;
      const lastAttempt = state.lastAttemptAtByChannelId.get(String(c.id)) ?? null;
      const last = Number.isFinite(lastRun as any) ? (lastRun as number) : (Number.isFinite(lastAttempt as any) ? (lastAttempt as number) : null);
      if (!last || isNaN(last)) return true;
      return now - last >= intervalMs;
    });

    if (dueChannels.length === 0) {
      const nextDueMs = Math.min(
        ...((channels || []).map((c: any) => {
          const lastRun = c.ai_last_run_at ? new Date(c.ai_last_run_at).getTime() : null;
          const lastAttempt = state.lastAttemptAtByChannelId.get(String(c.id)) ?? null;
          const last = Number.isFinite(lastRun as any) ? (lastRun as number) : (Number.isFinite(lastAttempt as any) ? (lastAttempt as number) : null);
          if (!last || isNaN(last)) return 0;
          return Math.max(0, last + intervalMs - now);
        }))
      );
      scheduleNextTick(Number.isFinite(nextDueMs) ? nextDueMs : intervalMs);
      return;
    }

    console.log(`[BackgroundParser] Processing ${dueChannels.length}/${channels.length} due channel(s) (interval=${intervalSeconds}s)...`);

    const processor = createAIProcessor();
    const results = [];
    for (const c of dueChannels) {
      state.lastAttemptAtByChannelId.set(String(c.id), Date.now());
      results.push(await processor.processChannel(c.id));
    }

    const totalParsed = results.reduce((sum, r: any) => sum + (r.contentParsed || 0), 0);
    const totalPosts = results.reduce((sum, r: any) => sum + (r.postsGenerated || 0), 0);
    const errors = results.flatMap((r: any) => r.errors || []).filter(Boolean);

    console.log(`[BackgroundParser] Completed - Parsed: ${totalParsed}, Posts: ${totalPosts}`);
    if (errors.length > 0) console.warn('[BackgroundParser] Errors:', errors.join('; '));

  } catch (error) {
    console.error('[BackgroundParser] Error in parsing cycle:', error);
  } finally {
    state.cycleInProgress = false;

    // Планируем следующий тик по ближайшему "due" времени, учитывая что часть каналов только что запускалась.
    const now = Date.now();
    const idSet = new Set<string>((channels || []).map((c: any) => String(c.id)));
    // cleanup attempts map from removed channels
    for (const key of state.lastAttemptAtByChannelId.keys()) {
      if (!idSet.has(key)) state.lastAttemptAtByChannelId.delete(key);
    }

    const nextDueMs = Math.min(
      ...((channels || []).map((c: any) => {
        const lastRun = c.ai_last_run_at ? new Date(c.ai_last_run_at).getTime() : null;
        const lastAttempt = state.lastAttemptAtByChannelId.get(String(c.id)) ?? null;
        const last = Number.isFinite(lastRun as any) ? (lastRun as number) : (Number.isFinite(lastAttempt as any) ? (lastAttempt as number) : null);
        if (!last || isNaN(last)) return intervalMs;
        return Math.max(0, last + intervalMs - now);
      }))
    );

    scheduleNextTick(Number.isFinite(nextDueMs) ? nextDueMs : intervalMs);
  }
}

/**
 * Проверка статуса парсера
 */
export function isParserRunning(): boolean {
  return getState().isRunning;
}
