import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET - получение списка источников
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { data: sources, error } = await (supabaseAdmin
      .from('sources') as any)
      .select(`
        *,
        channels (
          name,
          topic
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения источников:', error);
      return NextResponse.json({ error: 'Ошибка получения источников' }, { status: 500 });
    }

    return NextResponse.json({ sources: sources || [] });
  } catch (error) {
    console.error('Ошибка API источников:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// POST - создание нового источника
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, url, channel_id } = body;

    // Валидация обязательных полей
    if (!name || !type || !url || !channel_id) {
      return NextResponse.json(
        { error: 'Все поля обязательны для заполнения' },
        { status: 400 }
      );
    }

    // Валидация типа источника
    if (!['telegram', 'website', 'rss'].includes(type)) {
      return NextResponse.json(
        { error: 'Неверный тип источника' },
        { status: 400 }
      );
    }

    // Базовая валидация URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Неверный формат URL' },
        { status: 400 }
      );
    }

    const { data: source, error } = await (supabaseAdmin
      .from('sources') as any)
      .insert({
        name,
        type,
        url,
        channel_id,
        is_active: true,
      })
      .select(`
        *,
        channels (
          name,
          topic
        )
      `)
      .single();

    if (error) {
      console.error('Ошибка создания источника:', error);
      return NextResponse.json({ error: 'Ошибка создания источника' }, { status: 500 });
    }

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    console.error('Ошибка API создания источника:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
