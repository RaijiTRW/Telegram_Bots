import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Токен обязателен' },
        { status: 400 }
      );
    }

    // Проверяем токен в базе данных
    const { data: tokenData, error } = await supabaseAdmin
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !tokenData) {
      return NextResponse.json(
        { error: 'Неверный или истекший токен' },
        { status: 401 }
      );
    }

    const tokenRecord = tokenData as { token: string };

    return NextResponse.json({
      valid: true,
      token: tokenRecord.token,
    });
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
