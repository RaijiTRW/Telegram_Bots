import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/channels/[id]/ai/status
 * Получение статуса AI для канала
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;

    // Проверка аутентификации
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Проверяем существование канала (базовые поля)
    const { data: basicChannel, error: basicError } = await supabase
      .from('channels')
      .select('id, name')
      .eq('id', channelId)
      .single();

    if (basicError || !basicChannel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Пытаемся получить AI поля (могут не существовать если миграция не выполнена)
    let aiEnabled = false;
    let aiStatus = 'stopped';
    let aiLastRunAt = null;
    let aiErrorMessage = null;

    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('ai_enabled, ai_status, ai_last_run_at, ai_error_message')
      .eq('id', channelId)
      .single();

    if (!channelError && channel) {
      aiEnabled = channel.ai_enabled ?? false;
      aiStatus = channel.ai_status ?? 'stopped';
      aiLastRunAt = channel.ai_last_run_at;
      aiErrorMessage = channel.ai_error_message;
    } else if (channelError) {
      console.log('AI fields not available:', channelError.message);
    }

    // Получаем количество активных источников
    const { count: activeSourcesCount } = await supabase
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .eq('is_active', true);

    // Пытаемся получить статистику через SQL функцию (может не существовать)
    let statsData = {
      total_posts_generated: 0,
      total_tokens_used: 0,
      total_cost_usd: 0,
      last_generation: null,
    };

    const { data: stats, error: statsError } = await supabase.rpc(
      'get_channel_ai_stats',
      { channel_uuid: channelId }
    );

    if (!statsError && stats?.[0]) {
      statsData = stats[0];
    } else if (statsError) {
      console.log('Stats function not available:', statsError.message);
    }

    return NextResponse.json({
      enabled: aiEnabled,
      status: aiStatus as 'stopped' | 'running' | 'error',
      last_run_at: aiLastRunAt,
      error_message: aiErrorMessage,
      active_sources_count: activeSourcesCount || 0,
      posts_generated_count: statsData.total_posts_generated || 0,
      total_tokens_used: statsData.total_tokens_used || 0,
      total_cost_usd: parseFloat(String(statsData.total_cost_usd || '0')),
      last_generation: statsData.last_generation,
    });
  } catch (error) {
    console.error('Error getting AI status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
