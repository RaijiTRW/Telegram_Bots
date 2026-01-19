import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllChannelsStats, syncAllChannelsStats } from '@/lib/analytics/telegram-stats';
import { isAuthorized } from '@/lib/telegram/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Получить параметры периода
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'week';
    const sync = searchParams.get('sync') === '1' || searchParams.get('sync')?.toLowerCase() === 'true';

    // Вычислить даты
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    let syncInfo: any = null;
    if (sync) {
      const authorized = await isAuthorized();
      if (authorized) {
        syncInfo = await syncAllChannelsStats();
      } else {
        syncInfo = { synced: 0, failed: 0, errors: ['Telegram не подключен'] };
      }
    }

    const stats = await getAllChannelsStats(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const response = NextResponse.json({
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      syncInfo,
      ...stats,
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    console.error('Ошибка получения аналитики:', error);
    return NextResponse.json(
      { error: 'Ошибка получения аналитики' },
      { status: 500 }
    );
  }
}
