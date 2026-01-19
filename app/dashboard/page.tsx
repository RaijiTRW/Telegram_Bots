import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { PostList } from './components/PostList';
import { NewPostButton } from './components/NewPostButton';

export default async function DashboardPage() {
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

  const userEmail = (userData as { email: string } | null)?.email;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={userEmail ? { email: userEmail } : undefined} />

      {/* Main Content Area */}
      <main style={{ marginLeft: '288px' }} className="flex-1">
        {/* Page Header with massive padding */}
        <div style={{
          padding: '48px 64px',
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
                fontSize: '42px',
                fontWeight: '700',
                color: 'var(--foreground)',
                marginBottom: '16px',
                lineHeight: '1.2'
              }}>
                История Постов
              </h1>
              <p style={{
                fontSize: '18px',
                color: 'var(--text-secondary)',
                lineHeight: '1.6'
              }}>
                Управляйте контентом ваших Telegram каналов
              </p>
            </div>

            {/* Quick Action Button */}
            <NewPostButton />
          </div>
        </div>

        {/* Main Content with massive padding */}
        <div style={{ padding: '64px' }}>
          <PostList />
        </div>
      </main>
    </div>
  );
}
