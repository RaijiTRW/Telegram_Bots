import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/channels/[id]/ai
 * Включение/выключение AI для канала
 */
export async function POST(
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

    // Парсим body
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: enabled must be a boolean' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Если включаем AI, проверяем наличие активных источников
    if (enabled) {
      const { data: sources, error: sourcesError } = await supabase
        .from('sources')
        .select('id')
        .eq('channel_id', channelId)
        .eq('is_active', true);

      if (sourcesError) {
        return NextResponse.json(
          { error: 'Failed to check sources' },
          { status: 500 }
        );
      }

      if (!sources || sources.length === 0) {
        return NextResponse.json(
          {
            error: 'Cannot enable AI: no active sources found',
            message: 'Подключите сайт или Telegram канал для поиска',
          },
          { status: 400 }
        );
      }
    }

    // Обновляем канал
    const { data: channel, error: updateError } = await supabase
      .from('channels')
      .update({
        ai_enabled: enabled,
        ai_status: enabled ? 'stopped' : 'stopped',
        ai_error_message: null,
      })
      .eq('id', channelId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        ai_enabled: channel.ai_enabled,
        ai_status: channel.ai_status,
      },
    });
  } catch (error) {
    console.error('Error toggling AI:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
