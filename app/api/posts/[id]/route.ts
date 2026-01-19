import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { data: post, error } = await (supabaseAdmin
      .from('posts') as any)
      .select('*, channels(id, name, topic, telegram_link)')
      .eq('id', id)
      .single();

    if (error || !post) {
      return NextResponse.json(
        { error: 'Пост не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Ошибка получения поста:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const { data: post, error } = await (supabaseAdmin
      .from('posts') as any)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления поста:', error);
      return NextResponse.json(
        { error: 'Ошибка обновления поста' },
        { status: 500 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Ошибка API обновления поста:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { error } = await (supabaseAdmin
      .from('posts') as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления поста:', error);
      return NextResponse.json(
        { error: 'Ошибка удаления поста' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ошибка API удаления поста:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
