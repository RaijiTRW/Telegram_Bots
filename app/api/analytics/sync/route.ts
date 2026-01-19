import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { syncAllChannelsStats } from '@/lib/analytics/telegram-stats';
import { isAuthorized } from '@/lib/telegram/client';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Проверить что Telegram подключен
    const authorized = await isAuthorized();
    if (!authorized) {
      return NextResponse.json(
        { error: 'Telegram не подключен. Перейдите в настройки для авторизации.' },
        { status: 400 }
      );
    }

    // Синхронизировать статистику
    const result = await syncAllChannelsStats();

    return NextResponse.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      postsSynced: result.postsSynced,
      postsFailed: result.postsFailed,
      telegramPostsSynced: result.telegramPostsSynced,
      telegramPostsFailed: result.telegramPostsFailed,
      errors: result.errors,
      message: `Синхронизировано ${result.synced} каналов, TG-постов: ${result.telegramPostsSynced}, постов приложения: ${result.postsSynced}${result.failed > 0 || result.postsFailed > 0 || result.telegramPostsFailed > 0 ? `, ошибок: ${result.failed + result.postsFailed + result.telegramPostsFailed}` : ''}`,
    });
  } catch (error) {
    console.error('Ошибка синхронизации:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Ошибка синхронизации статистики',
        message: process.env.NODE_ENV === 'production' ? undefined : details,
      },
      { status: 500 }
    );
  }
}
