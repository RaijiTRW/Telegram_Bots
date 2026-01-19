import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

const VALID_AGENTS = ['planner', 'writer', 'image'];

// GET - получение настроек конкретного агента
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { agent } = await params;

    if (!VALID_AGENTS.includes(agent)) {
      return NextResponse.json({ error: 'Неверное имя агента' }, { status: 400 });
    }

    const { data, error } = await (supabaseAdmin
      .from('ai_agent_settings') as any)
      .select('*')
      .eq('agent_name', agent)
      .single();

    if (error) {
      console.error('Ошибка получения настроек агента:', error);
      return NextResponse.json({ error: 'Агент не найден' }, { status: 404 });
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    console.error('Ошибка получения настроек агента:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// PATCH - обновление настроек агента
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { agent } = await params;

    if (!VALID_AGENTS.includes(agent)) {
      return NextResponse.json({ error: 'Неверное имя агента' }, { status: 400 });
    }

    const body = await request.json();
    const {
      system_prompt,
      max_tokens,
      temperature,
      length_variation_enabled,
      min_length,
      max_length,
      length_weights,
    } = body;

    // Валидация
    if (max_tokens !== undefined && (max_tokens < 100 || max_tokens > 16000)) {
      return NextResponse.json(
        { error: 'max_tokens должен быть от 100 до 16000' },
        { status: 400 }
      );
    }

    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { error: 'temperature должен быть от 0 до 2' },
        { status: 400 }
      );
    }

    // Валидация длины постов (только для writer)
    const validLengths = ['short', 'medium', 'long'];
    if (min_length !== undefined && !validLengths.includes(min_length)) {
      return NextResponse.json(
        { error: 'min_length должен быть short, medium или long' },
        { status: 400 }
      );
    }
    if (max_length !== undefined && !validLengths.includes(max_length)) {
      return NextResponse.json(
        { error: 'max_length должен быть short, medium или long' },
        { status: 400 }
      );
    }

    // Формируем объект обновления
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (system_prompt !== undefined) {
      updateData.system_prompt = system_prompt;
    }
    if (max_tokens !== undefined) {
      updateData.max_tokens = max_tokens;
    }
    if (temperature !== undefined) {
      updateData.temperature = temperature;
    }

    // Length variation fields (only for writer agent)
    if (agent === 'writer') {
      if (length_variation_enabled !== undefined) {
        updateData.length_variation_enabled = length_variation_enabled;
      }
      if (min_length !== undefined) {
        updateData.min_length = min_length;
      }
      if (max_length !== undefined) {
        updateData.max_length = max_length;
      }
      if (length_weights !== undefined) {
        updateData.length_weights = length_weights;
      }
    }

    const { data, error } = await (supabaseAdmin
      .from('ai_agent_settings') as any)
      .update(updateData)
      .eq('agent_name', agent)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления настроек агента:', error);
      return NextResponse.json({ error: 'Ошибка обновления настроек' }, { status: 500 });
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    console.error('Ошибка обновления настроек агента:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
