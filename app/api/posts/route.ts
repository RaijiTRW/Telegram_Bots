import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
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

    const list = (posts || []) as any[];

    // Attach source label for AI-generated posts (based on parsed_content -> sources)
    const allContentIds = Array.from(
      new Set(
        list
          .flatMap((p) => (Array.isArray(p?.source_content_ids) ? p.source_content_ids : []))
          .filter((id: any) => typeof id === 'string' && id.length > 0)
      )
    );

    const parsedById = new Map<string, any>();
    if (allContentIds.length > 0) {
      const { data: parsedRows, error: parsedError } = await (supabaseAdmin
        .from('parsed_content') as any)
        .select('id, url, sources(name, url, type)')
        .in('id', allContentIds)
        .limit(5000);

      if (!parsedError && Array.isArray(parsedRows)) {
        for (const row of parsedRows) {
          if (row?.id) parsedById.set(String(row.id), row);
        }
      }
    }

    const postsWithSource = list.map((p) => {
      const contentIds = Array.isArray(p?.source_content_ids) ? (p.source_content_ids as any[]) : [];
      const primaryContentId = contentIds.length > 0 ? String(contentIds[0]) : null;
      const parsed = primaryContentId ? parsedById.get(primaryContentId) : null;
      const sourceRel = parsed?.sources;
      const sourceObj = Array.isArray(sourceRel) ? sourceRel[0] : sourceRel;
      const sourceUrl = typeof sourceObj?.url === 'string' ? sourceObj.url : null;
      const sourceNameRaw = typeof sourceObj?.name === 'string' ? sourceObj.name : null;

      const display =
        (sourceNameRaw && sourceNameRaw.length > 0 ? sourceNameRaw : null) ||
        (sourceUrl ? safeHostname(sourceUrl) : null);

      const itemUrl = typeof parsed?.url === 'string' && parsed.url.length > 0 ? parsed.url : null;

      const source =
        display
          ? { name: display, url: itemUrl || sourceUrl }
          : p?.ai_generated
            ? { name: 'AI (источник неизвестен)', url: null }
            : { name: 'Ручной', url: null };

      return {
        ...p,
        source,
      };
    });

    return NextResponse.json({
      posts: postsWithSource,
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
