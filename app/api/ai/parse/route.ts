import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAIProcessor } from '@/lib/ai/processor';

/**
 * POST /api/ai/parse
 * Ручной запуск парсинга для канала
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка аутентификации
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Парсим body
    const body = await request.json();
    const { channel_id } = body;

    if (!channel_id) {
      return NextResponse.json(
        { error: 'channel_id is required' },
        { status: 400 }
      );
    }

    // Создаем AI процессор
    const processor = createAIProcessor();

    // Запускаем обработку канала
    const result = await processor.processChannel(channel_id);

    return NextResponse.json({
      success: result.success,
      channelId: result.channelId,
      postsGenerated: result.postsGenerated,
      contentParsed: result.contentParsed,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error parsing channel:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
