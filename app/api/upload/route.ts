import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_BUCKET =
  process.env.SUPABASE_IMAGES_BUCKET ||
  process.env.SUPABASE_STORAGE_BUCKET ||
  'images';

let ensureBucketOnce: Promise<void> | null = null;
async function ensureImageBucketExists() {
  if (ensureBucketOnce) return ensureBucketOnce;

  ensureBucketOnce = (async () => {
    const { data: bucket, error } = await supabaseAdmin.storage.getBucket(IMAGE_BUCKET);

    if (!error) {
      if (bucket && bucket.public === false) {
        const { error: updateError } = await supabaseAdmin.storage.updateBucket(IMAGE_BUCKET, {
          public: true,
          allowedMimeTypes: ALLOWED_TYPES,
          fileSizeLimit: MAX_FILE_SIZE,
        });
        if (updateError) {
          throw updateError;
        }
      }
      return;
    }

    const status = (error as any).status ?? Number((error as any).statusCode);
    const message = (error as any).message ?? '';
    const isNotFound = status === 404 || /not found/i.test(message);
    if (!isNotFound) {
      throw error;
    }

    const { error: createError } = await supabaseAdmin.storage.createBucket(IMAGE_BUCKET, {
      public: true,
      allowedMimeTypes: ALLOWED_TYPES,
      fileSizeLimit: MAX_FILE_SIZE,
    });
    if (createError) {
      throw createError;
    }
  })();

  return ensureBucketOnce;
}

function formatStorageError(prefix: string, error: unknown) {
  if (process.env.NODE_ENV === 'production') return prefix;
  const details = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${details}`;
}

// POST - загрузка файла
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const postId = formData.get('postId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
    }

    // Проверяем тип файла
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат файла. Разрешены: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Проверяем размер
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Файл слишком большой. Максимум 10MB' },
        { status: 400 }
      );
    }

    // Генерируем уникальное имя файла
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${nanoid()}.${ext}`;
    const storagePath = `post-images/${postId || 'temp'}/${fileName}`;

    // Получаем ArrayBuffer файла
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await ensureImageBucketExists();

    // Загружаем в Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json(
        { error: formatStorageError('Ошибка загрузки файла в хранилище', error) },
        { status: 500 }
      );
    }

    // Получаем публичный URL
    const { data: urlData } = supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      storagePath,
      fileName,
      mimeType: file.type,
      fileSize: file.size,
      bucket: IMAGE_BUCKET,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: formatStorageError('Внутренняя ошибка сервера', error) },
      { status: 500 }
    );
  }
}

// DELETE - удаление файла из хранилища
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get('path');

    if (!storagePath) {
      return NextResponse.json({ error: 'Путь к файлу обязателен' }, { status: 400 });
    }

    await ensureImageBucketExists();

    const { error } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return NextResponse.json(
        { error: formatStorageError('Ошибка удаления файла', error) },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: formatStorageError('Внутренняя ошибка сервера', error) },
      { status: 500 }
    );
  }
}
