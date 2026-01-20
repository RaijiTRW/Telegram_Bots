import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { SourcesList } from './components/SourcesList';

export default async function SourcesPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    redirect('/auth/login');
  }

  // Получаем данные пользователя
  const { data: userData } = await (supabaseAdmin
    .from('users') as any)
    .select('email')
    .eq('id', userId)
    .single();

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={userData ? { email: userData.email } : undefined} />

      {/* Main Content Area */}
      <main style={{ marginLeft: 'var(--sidebar-offset)' }} className="flex-1">
        {/* Page Header */}
        <div style={{
          padding: 'var(--page-padding-y) var(--page-padding-x)',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--background)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div>
              <h1 style={{
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: '700',
                color: 'var(--foreground)',
                marginBottom: '16px',
                lineHeight: '1.2'
              }}>
                Источники
              </h1>
              <p style={{
                fontSize: '18px',
                color: 'var(--text-secondary)',
                lineHeight: '1.6'
              }}>
                Управляйте источниками контента для ваших каналов
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 'var(--content-padding)' }}>
          <SourcesList />
        </div>
      </main>
    </div>
  );
}
