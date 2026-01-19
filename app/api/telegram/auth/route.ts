import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendAuthCode } from '@/lib/telegram/client';

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Telegram timeout')), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
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
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Номер телефона обязателен' },
        { status: 400 }
      );
    }

    // Проверить формат номера
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    if (!/^\+\d{10,15}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Неверный формат номера телефона. Используйте формат: +79991234567' },
        { status: 400 }
      );
    }

    // Отправить код авторизации
    const result = await withTimeout(sendAuthCode(cleanPhone, userId), 30_000);

    return NextResponse.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      message: 'Код отправлен на указанный номер',
    });
  } catch (error: any) {
    console.error('Ошибка отправки кода:', error);

    // Проверка настройки API credentials
    if (error.message?.includes('TELEGRAM_API_ID') || error.message?.includes('TELEGRAM_API_HASH')) {
      return NextResponse.json(
        { error: 'Telegram API не настроен. Добавьте TELEGRAM_API_ID и TELEGRAM_API_HASH в .env.local' },
        { status: 500 }
      );
    }

    // Обработка специфичных ошибок Telegram
    if (error.errorMessage === 'PHONE_NUMBER_INVALID') {
      return NextResponse.json(
        { error: 'Неверный номер телефона' },
        { status: 400 }
      );
    }

    if (error.errorMessage === 'PHONE_NUMBER_FLOOD') {
      return NextResponse.json(
        { error: 'Слишком много попыток. Попробуйте позже' },
        { status: 429 }
      );
    }

    if (error.errorMessage === 'PHONE_NUMBER_BANNED') {
      return NextResponse.json(
        { error: 'Номер телефона заблокирован в Telegram' },
        { status: 400 }
      );
    }

    if (error.errorMessage === 'API_ID_INVALID') {
      return NextResponse.json(
        { error: 'Неверный TELEGRAM_API_ID. Проверьте настройки в .env.local' },
        { status: 500 }
      );
    }

    if (String(error?.message || '').toLowerCase().includes('timeout')) {
      return NextResponse.json(
        { error: 'Telegram не отвечает. Попробуйте ещё раз через 10–20 секунд.' },
        { status: 504 }
      );
    }

    // Ошибка подключения
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'Не удалось подключиться к Telegram. Проверьте интернет соединение' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Ошибка отправки кода авторизации' },
      { status: 500 }
    );
  }
}
