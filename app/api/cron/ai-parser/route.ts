import { NextRequest, NextResponse } from 'next/server';
import { createAIProcessor } from '@/lib/ai/processor';

/**
 * GET /api/cron/ai-parser
 * Cron job для автоматического парсинга и генерации контента
 * Запускается каждые 15 минут через Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка CRON_SECRET для защиты endpoint
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET is not configured');
      return NextResponse.json(
        { error: 'Cron secret is not configured' },
        { status: 500 }
      );
    }

    // Проверяем Bearer токен
    const expectedAuth = `Bearer ${cronSecret}`;

    if (authHeader !== expectedAuth) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting AI parser cron job...');

    // Создаем AI процессор
    const processor = createAIProcessor();

    // Обрабатываем все AI-enabled каналы
    const results = await processor.processAllChannels();

    // Подсчитываем статистику
    const stats = {
      totalChannelsProcessed: results.length,
      successfulChannels: results.filter((r) => r.success).length,
      failedChannels: results.filter((r) => !r.success).length,
      totalPostsGenerated: results.reduce((sum, r) => sum + r.postsGenerated, 0),
      totalContentParsed: results.reduce((sum, r) => sum + r.contentParsed, 0),
      errors: results.flatMap((r) => r.errors).filter(Boolean),
    };

    console.log('AI parser cron job completed:', stats);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      results: results.map((r) => ({
        channelId: r.channelId,
        success: r.success,
        postsGenerated: r.postsGenerated,
        contentParsed: r.contentParsed,
        errors: r.errors,
      })),
    });
  } catch (error) {
    console.error('Error in AI parser cron job:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Альтернативно можно использовать POST метод
export async function POST(request: NextRequest) {
  return GET(request);
}
