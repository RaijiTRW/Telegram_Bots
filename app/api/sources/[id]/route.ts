import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

// PATCH - обновление источника
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
      .from('sources') as any)
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        channels (
          name,
          topic
        )
      `)
      .single();

    if (error) {
      console.error('Ошибка обновления источника:', error);
      return NextResponse.json({ error: 'Ошибка обновления источника' }, { status: 500 });
    }

    return NextResponse.json({ source: data });
  } catch (error) {
    console.error('Ошибка обновления источника:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// DELETE - удаление источника
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
      .from('sources') as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления источника:', error);
      return NextResponse.json({ error: 'Ошибка удаления источника' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления источника:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
