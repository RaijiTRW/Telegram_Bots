/**
 * Next.js Instrumentation
 * Запускает фоновые задачи при старте сервера
 */

export async function register() {
  // Запускаем только на сервере (не в edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const enabledFromEnv = process.env.ENABLE_BACKGROUND_PARSER;
    const enabled =
      enabledFromEnv !== undefined
        ? enabledFromEnv === '1' || enabledFromEnv.toLowerCase() === 'true'
        : !process.env.VERCEL; // on Vercel prefer `vercel.json` cron

    if (!enabled) {
      console.log('[BackgroundParser] Disabled (set ENABLE_BACKGROUND_PARSER=1 to enable)');
      return;
    }

    const { startBackgroundParser } = await import('./lib/background-parser');
    startBackgroundParser();
  }
}
