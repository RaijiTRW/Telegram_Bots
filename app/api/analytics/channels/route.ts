import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAllChannelsStats, syncAllChannelsStats } from '@/lib/analytics/telegram-stats';
import { isAuthorized } from '@/lib/telegram/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPeriodRangeUtc(period: string): { startDate: Date; endDate: Date; startDay: string; endDay: string } {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      break;
    case 'week':
      startDate.setUTCDate(startDate.getUTCDate() - 6);
      break;
    case 'month':
      startDate.setUTCMonth(startDate.getUTCMonth() - 1);
      break;
    case 'year':
      startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
      break;
    default:
      startDate.setUTCDate(startDate.getUTCDate() - 6);
  }

  return {
    startDate,
    endDate,
    startDay: toUtcDateString(startDate),
    endDay: toUtcDateString(endDate),
  };
}

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

    const range = getPeriodRangeUtc(period);

    let syncInfo: any = null;
    if (sync) {
      const authorized = await isAuthorized(userId);
      if (authorized) {
        syncInfo = await syncAllChannelsStats(userId);
      } else {
        syncInfo = { synced: 0, failed: 0, errors: ['Telegram не подключен'] };
      }
    }

    const stats = await getAllChannelsStats(
      userId,
      range.startDay,
      range.endDay,
      { granularity: period === 'today' ? 'intraday' : 'day' }
    );

    const response = NextResponse.json({
      period,
      startDate: range.startDay,
      endDate: range.endDay,
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
