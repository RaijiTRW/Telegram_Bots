import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET - получение одного канала
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await (supabaseAdmin
      .from('channels') as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Ошибка получения канала:', error);
      return NextResponse.json({ error: 'Канал не найден' }, { status: 404 });
    }

    return NextResponse.json({ channel: data });
  } catch (error) {
    console.error('Ошибка получения канала:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// PATCH - обновление канала
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await (supabaseAdmin
      .from('channels') as any)
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления канала:', error);
      return NextResponse.json({ error: 'Ошибка обновления канала' }, { status: 500 });
    }

    return NextResponse.json({ channel: data });
  } catch (error) {
    console.error('Ошибка обновления канала:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// DELETE - удаление канала
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id } = await params;

    const { error } = await (supabaseAdmin
      .from('channels') as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления канала:', error);
      return NextResponse.json({ error: 'Ошибка удаления канала' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления канала:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
