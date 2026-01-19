import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Все поля обязательны' },
        { status: 400 }
      );
    }

    // 1. Проверяем токен
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Неверный или истекший токен' },
        { status: 401 }
      );
    }

    // 2. Проверяем пользователя
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    const user = userData as { id: string; email: string; password_hash: string; role: string };

    // 3. Проверяем пароль
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // 4. Помечаем токен как использованный
    await (supabaseAdmin
      .from('invite_tokens') as any)
      .update({
        used: true,
        used_by: user.id,
      })
      .eq('token', token);

    // 5. Создаем сессию (простая - через куку с user id)
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });

    // Устанавливаем куку с ID пользователя (httpOnly для безопасности)
    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 дней
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Ошибка логина:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
