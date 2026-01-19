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

    // Получаем параметры фильтрации из URL
    const searchParams = request.nextUrl.searchParams;
    const channelId = searchParams.get('channel_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Начинаем запрос
    let query = (supabaseAdmin
      .from('posts') as any)
      .select('*, channels(id, name, topic)', { count: 'exact' });

    // Применяем фильтры
    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('plain_text', `%${search}%`);
    }

    // Сортировка
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Пагинация
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Ошибка получения постов:', error);
      return NextResponse.json(
        { error: 'Ошибка получения постов' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      posts: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Ошибка API постов:', error);
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
    const { channel_id, title, content, plain_text, status } = body;

    if (!channel_id || !content || !plain_text) {
      return NextResponse.json(
        { error: 'Обязательные поля: channel_id, content, plain_text' },
        { status: 400 }
      );
    }

    const { data: post, error } = await (supabaseAdmin
      .from('posts') as any)
      .insert({
        channel_id,
        title,
        content,
        plain_text,
        status: status || 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Ошибка создания поста:', error);
      return NextResponse.json(
        { error: 'Ошибка создания поста' },
        { status: 500 }
      );
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Ошибка API создания поста:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
