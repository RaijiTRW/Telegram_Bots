import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import EditorContent from './components/EditorContent';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ postId: string }>;
}

export default async function EditorPage({ params }: PageProps) {
  const { postId } = await params;
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

  // Получаем данные поста
  const { data: post, error } = await (supabaseAdmin
    .from('posts') as any)
    .select('*, channels(id, name, topic, telegram_link)')
    .eq('id', postId)
    .single();

  if (error || !post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={userEmail ? { email: userEmail } : undefined} />

      {/* Main Content Area */}
      <main style={{ marginLeft: '288px' }} className="flex-1">
        {/* Page Header */}
        <div style={{
          padding: '32px 64px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--background)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* Кнопка назад */}
            <Link
              href="/dashboard"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: '32px',
                fontWeight: '700',
                color: 'var(--foreground)',
                marginBottom: '8px',
                lineHeight: '1.2'
              }}>
                Редактор поста
              </h1>
              {post.channels && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '15px',
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Канал:</span>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary)',
                    fontWeight: '600',
                  }}>
                    {post.channels.name}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{post.channels.topic}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div style={{ padding: '48px 64px', maxWidth: '1000px' }}>
          <EditorContent post={post} />
        </div>
      </main>
    </div>
  );
}
