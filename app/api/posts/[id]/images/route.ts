import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET - получение изображений поста
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

    const { id: postId } = await params;

    const { data: images, error } = await (supabaseAdmin
      .from('post_images') as any)
      .select('*')
      .eq('post_id', postId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching post images:', error);
      return NextResponse.json({ error: 'Ошибка загрузки изображений' }, { status: 500 });
    }

    return NextResponse.json({ images: images || [] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// POST - добавление изображения к посту
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id: postId } = await params;
    const body = await request.json();

    const {
      url,
      storage_path,
      alt_text,
      source_type = 'manual',
      source_url,
      position,
      width,
      height,
      file_size,
      mime_type,
    } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL изображения обязателен' }, { status: 400 });
    }

    // Получаем текущую максимальную позицию
    const { data: existingImages } = await (supabaseAdmin
      .from('post_images') as any)
      .select('position')
      .eq('post_id', postId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = position ?? ((existingImages?.[0]?.position ?? -1) + 1);

    const { data: image, error } = await (supabaseAdmin
      .from('post_images') as any)
      .insert({
        post_id: postId,
        url,
        storage_path,
        alt_text,
        source_type,
        source_url,
        position: nextPosition,
        width,
        height,
        file_size,
        mime_type,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding image:', error);
      return NextResponse.json({ error: 'Ошибка добавления изображения' }, { status: 500 });
    }

    return NextResponse.json({ image });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// DELETE - удаление изображения
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

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json({ error: 'ID изображения обязателен' }, { status: 400 });
    }

    const { error } = await (supabaseAdmin
      .from('post_images') as any)
      .delete()
      .eq('id', imageId);

    if (error) {
      console.error('Error deleting image:', error);
      return NextResponse.json({ error: 'Ошибка удаления изображения' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// PATCH - обновление порядка/данных изображения
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

    const body = await request.json();
    const { imageId, position, alt_text } = body;

    if (!imageId) {
      return NextResponse.json({ error: 'ID изображения обязателен' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (position !== undefined) updateData.position = position;
    if (alt_text !== undefined) updateData.alt_text = alt_text;

    const { data: image, error } = await (supabaseAdmin
      .from('post_images') as any)
      .update(updateData)
      .eq('id', imageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating image:', error);
      return NextResponse.json({ error: 'Ошибка обновления изображения' }, { status: 500 });
    }

    return NextResponse.json({ image });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
