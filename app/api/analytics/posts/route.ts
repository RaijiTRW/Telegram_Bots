import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { syncPostsAnalyticsByPostIds } from '@/lib/analytics/telegram-stats';
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

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'week';
    const sync = searchParams.get('sync') === '1' || searchParams.get('sync')?.toLowerCase() === 'true';
    const syncLimit = Math.max(1, Math.min(50, parseInt(searchParams.get('syncLimit') || '20', 10) || 20));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '100', 10) || 100));

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

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const { data: posts, error } = await (supabaseAdmin
      .from('posts') as any)
      .select('id, title, published_at, channel_id, channels(name)')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .gte('published_at', startIso)
      .lte('published_at', endIso)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Ошибка получения постов:', error);
      return NextResponse.json({ error: 'Ошибка получения постов' }, { status: 500 });
    }

    const postIds = (posts || []).map((p: any) => p.id).filter(Boolean);
    let analyticsByPostId: Record<string, any> = {};

    let syncInfo: any = null;
    if (sync && postIds.length > 0) {
      const authorized = await isAuthorized();
      if (authorized) {
        syncInfo = await syncPostsAnalyticsByPostIds(postIds, syncLimit);
      } else {
        syncInfo = { synced: 0, failed: 0, errors: ['Telegram не авторизован'] };
      }
    }

    if (postIds.length > 0) {
      const { data: analytics, error: analyticsError } = await (supabaseAdmin
        .from('post_analytics') as any)
        .select('post_id, telegram_message_id, views_count, reactions_count, forwards_count, shares_count, reactions_breakdown, updated_at')
        .in('post_id', postIds);

      if (analyticsError) {
        const details = analyticsError.message || String(analyticsError);

        // Backward-compatible: reactions_breakdown column may not exist (migration 009 not applied).
        if (details.toLowerCase().includes('reactions_breakdown') || details.toLowerCase().includes('column')) {
          const { data: analyticsFallback, error: analyticsFallbackError } = await (supabaseAdmin
            .from('post_analytics') as any)
            .select('post_id, telegram_message_id, views_count, reactions_count, forwards_count, shares_count, updated_at')
            .in('post_id', postIds);

          if (analyticsFallbackError) {
            const d2 = analyticsFallbackError.message || String(analyticsFallbackError);
            return NextResponse.json(
              {
                error: 'Ошибка чтения post_analytics',
                hint: 'Проверьте, что применена миграция supabase/migrations/006_analytics.sql',
                message: process.env.NODE_ENV === 'production' ? undefined : d2,
              },
              { status: 500 }
            );
          }

          analyticsByPostId = Object.fromEntries((analyticsFallback || []).map((a: any) => [a.post_id, { ...a, reactions_breakdown: null }]));
        } else {
          return NextResponse.json(
            {
              error: 'Ошибка чтения post_analytics',
              hint: 'Проверьте, что применена миграция supabase/migrations/006_analytics.sql',
              message: process.env.NODE_ENV === 'production' ? undefined : details,
            },
            { status: 500 }
          );
        }
      } else {
        analyticsByPostId = Object.fromEntries((analytics || []).map((a: any) => [a.post_id, a]));
      }

      // analyticsByPostId set above
    }

    const items = (posts || []).map((p: any) => {
      const a = analyticsByPostId[p.id] || null;
      return {
        id: p.id,
        title: p.title,
        published_at: p.published_at,
        channel: {
          id: p.channel_id,
          name: p.channels?.name || '—',
        },
        analytics: a ? {
          telegram_message_id: a.telegram_message_id,
          views_count: a.views_count || 0,
          reactions_count: a.reactions_count || 0,
          forwards_count: a.forwards_count || 0,
          shares_count: a.shares_count || 0,
          reactions_breakdown: a.reactions_breakdown || null,
          updated_at: a.updated_at,
        } : null,
      };
    });

    const response = NextResponse.json({
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      posts: items,
      live: sync ? 'requested' : 'off',
      syncInfo,
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    console.error('Ошибка получения аналитики постов:', error);
    return NextResponse.json(
      { error: 'Ошибка получения аналитики постов' },
      { status: 500 }
    );
  }
}
