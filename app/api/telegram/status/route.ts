import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConnectionStatus } from '@/lib/telegram/client';

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

    const status = await getConnectionStatus();

    return NextResponse.json({
      connected: status.connected,
      authorized: status.authorized,
      phoneNumber: status.phoneNumber,
    });
  } catch (error) {
    console.error('Ошибка получения статуса:', error);

    return NextResponse.json({
      connected: false,
      authorized: false,
    });
  }
}
