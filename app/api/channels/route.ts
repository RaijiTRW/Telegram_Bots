import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    const { data: channels, error } = await supabaseAdmin
      .from('channels')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения каналов:', error);
      return NextResponse.json(
        { error: 'Ошибка получения каналов' },
        { status: 500 }
      );
    }

    return NextResponse.json({ channels: channels || [] });
  } catch (error) {
    console.error('Ошибка API каналов:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const { name, telegram_link, telegram_chat_id, topic, description } = body;

    // Валидация обязательных полей
    if (!name || !telegram_link || !topic) {
      return NextResponse.json(
        { error: 'Все поля кроме описания обязательны для заполнения' },
        { status: 400 }
      );
    }

    // Базовая валидация формата токена бота
    if (!telegram_link.includes(':') || telegram_link.length < 20) {
      return NextResponse.json(
        { error: 'Неверный формат API токена. Токен должен быть от @BotFather' },
        { status: 400 }
      );
    }

    const { data: channel, error } = await (supabaseAdmin
      .from('channels') as any)
      .insert({
        name,
        telegram_link,
        telegram_chat_id: telegram_chat_id || null,
        topic,
        description: description || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Ошибка создания канала:', error);
      return NextResponse.json(
        { error: 'Ошибка создания канала' },
        { status: 500 }
      );
    }

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    console.error('Ошибка API создания канала:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
