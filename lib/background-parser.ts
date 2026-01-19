/**
 * Background Parser
 * Фоновый парсинг для каналов с включенным AI
 * Работает при запуске сервера через next start
 */

import { createClient } from '@supabase/supabase-js';
import { createAIProcessor } from './ai/processor';

type BackgroundParserState = {
  isRunning: boolean;
  intervalId: NodeJS.Timeout | null;
  cycleInProgress: boolean;
  startedAt: number | null;
};

function getState(): BackgroundParserState {
  const g = globalThis as any;
  if (!g.__backgroundParserState) {
    g.__backgroundParserState = {
      isRunning: false,
      intervalId: null,
      cycleInProgress: false,
      startedAt: null,
    } satisfies BackgroundParserState;
  }
  return g.__backgroundParserState as BackgroundParserState;
}

// Интервал парсинга (2 минуты)
const PARSE_INTERVAL = 2 * 60 * 1000;

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
  console.log('[BackgroundParser] Started - will parse every 2 minutes');

  // Запускаем первый парсинг через 30 секунд после старта
  setTimeout(() => {
    runParsingCycle();
  }, 30 * 1000);

  // Затем каждые 2 минуты
  state.intervalId = setInterval(() => {
    runParsingCycle();
  }, PARSE_INTERVAL);
}

/**
 * Остановка фонового парсера
 */
export function stopBackgroundParser() {
  const state = getState();
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.isRunning = false;
  state.cycleInProgress = false;
  state.startedAt = null;
  console.log('[BackgroundParser] Stopped');
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

  try {
    // Проверяем есть ли каналы с включенным AI
    const { data: channels, error } = await supabase
      .from('channels')
      .select('id, name, ai_enabled')
      .eq('ai_enabled', true);

    if (error) {
      console.error('[BackgroundParser] Error fetching channels:', error.message);
      return;
    }

    if (!channels || channels.length === 0) {
      console.log('[BackgroundParser] No AI-enabled channels found');
      return;
    }

    console.log(`[BackgroundParser] Processing ${channels.length} AI-enabled channel(s)...`);

    // Создаем процессор и обрабатываем все каналы
    const processor = createAIProcessor();
    const results = await processor.processAllChannels();

    // Логируем результаты
    const totalParsed = results.reduce((sum, r) => sum + r.contentParsed, 0);
    const totalPosts = results.reduce((sum, r) => sum + r.postsGenerated, 0);
    const errors = results.flatMap(r => r.errors).filter(Boolean);

    console.log(`[BackgroundParser] Completed - Parsed: ${totalParsed}, Posts: ${totalPosts}`);

    if (errors.length > 0) {
      console.warn('[BackgroundParser] Errors:', errors.join('; '));
    }

  } catch (error) {
    console.error('[BackgroundParser] Error in parsing cycle:', error);
  } finally {
    state.cycleInProgress = false;
  }
}

/**
 * Проверка статуса парсера
 */
export function isParserRunning(): boolean {
  return getState().isRunning;
}
