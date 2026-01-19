import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET - получение настроек всех AI агентов
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { data, error } = await (supabaseAdmin
      .from('ai_agent_settings') as any)
      .select('*')
      .order('agent_name');

    if (error) {
      console.error('Ошибка получения настроек AI:', error);
      return NextResponse.json({ error: 'Ошибка получения настроек' }, { status: 500 });
    }

    return NextResponse.json({ agents: data });
  } catch (error) {
    console.error('Ошибка получения настроек AI:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
