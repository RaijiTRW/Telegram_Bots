import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_SECONDS = 120;
const MIN_SECONDS = 5;
const MAX_SECONDS = 365 * 24 * 60 * 60;

function clampSeconds(seconds: number): number {
  const s = Math.round(seconds);
  if (!Number.isFinite(s)) return DEFAULT_SECONDS;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, s));
}

async function readIntervalSeconds(): Promise<{ seconds: number; needsMigration: boolean }> {
  const { data, error } = await (supabaseAdmin
    .from('app_settings') as any)
    .select('value')
    .eq('key', 'parser_interval_seconds')
    .maybeSingle();

  if (error) {
    const msg = String(error.message || error).toLowerCase();
    if (msg.includes('app_settings') || msg.includes('relation') || msg.includes('does not exist')) {
      return { seconds: DEFAULT_SECONDS, needsMigration: true };
    }
    return { seconds: DEFAULT_SECONDS, needsMigration: false };
  }

  const seconds = Number(data?.value?.seconds);
  return { seconds: clampSeconds(Number.isFinite(seconds) ? seconds : DEFAULT_SECONDS), needsMigration: false };
}

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { seconds, needsMigration } = await readIntervalSeconds();
  const res = NextResponse.json({ intervalSeconds: seconds, needsMigration });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const direct = Number(body?.intervalSeconds);
  const value = Number(body?.value);
  const unit = String(body?.unit || 'seconds');

  let seconds = Number.isFinite(direct) ? direct : NaN;
  if (!Number.isFinite(seconds)) {
    const multiplier =
      unit === 'days' ? 86400 :
      unit === 'hours' ? 3600 :
      unit === 'minutes' ? 60 :
      1;
    seconds = value * multiplier;
  }

  seconds = clampSeconds(seconds);

  const { error } = await (supabaseAdmin
    .from('app_settings') as any)
    .upsert(
      { key: 'parser_interval_seconds', value: { seconds } },
      { onConflict: 'key' }
    );

  if (error) {
    const msg = String(error.message || error).toLowerCase();
    if (msg.includes('app_settings') || msg.includes('relation') || msg.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Не применена миграция app_settings', hint: 'Примените supabase/migrations/011_parser_schedule.sql' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Ошибка сохранения настройки' }, { status: 500 });
  }

  const res = NextResponse.json({ success: true, intervalSeconds: seconds });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

