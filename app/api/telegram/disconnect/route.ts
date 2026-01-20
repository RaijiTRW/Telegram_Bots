import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deactivateTelegramSessionForUser } from '@/lib/telegram/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    await deactivateTelegramSessionForUser(userId);

    const response = NextResponse.json({ success: true });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    const message = error?.message || 'Ошибка отключения Telegram';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

