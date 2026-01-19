import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthCode } from '@/lib/telegram/client';

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
    const { phoneNumber, phoneCode, phoneCodeHash, password } = body;

    if (!phoneNumber || !phoneCode || !phoneCodeHash) {
      return NextResponse.json(
        { error: 'Все поля обязательны' },
        { status: 400 }
      );
    }

    // Проверить код
    const result = await verifyAuthCode(
      phoneNumber,
      phoneCode,
      phoneCodeHash,
      password,
      userId
    );

    if (result.needPassword) {
      return NextResponse.json({
        success: false,
        needPassword: true,
        message: 'Требуется двухфакторная аутентификация',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram успешно подключен',
    });
  } catch (error: any) {
    console.error('Ошибка верификации:', error);

    // Обработка специфичных ошибок
    if (error.errorMessage === 'PHONE_CODE_INVALID') {
      return NextResponse.json(
        { error: 'Неверный код подтверждения' },
        { status: 400 }
      );
    }

    if (error.errorMessage === 'PHONE_CODE_EXPIRED') {
      return NextResponse.json(
        { error: 'Код подтверждения истек. Запросите новый' },
        { status: 400 }
      );
    }

    if (error.errorMessage === 'PASSWORD_HASH_INVALID') {
      return NextResponse.json(
        { error: 'Неверный пароль двухфакторной аутентификации' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ошибка верификации кода' },
      { status: 500 }
    );
  }
}
