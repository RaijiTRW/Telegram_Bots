'use client';

interface ReactionBreakdownItem {
  reaction: string;
  count: number;
}

interface PostAnalytics {
  telegram_message_id?: number;
  views_count: number;
  reactions_count: number;
  forwards_count: number;
  shares_count: number;
  reactions_breakdown?: ReactionBreakdownItem[] | null;
  updated_at?: string;
}

interface PostItem {
  id: string;
  title: string | null;
  published_at: string;
  channel: {
    id: string;
    name: string;
  };
  analytics: PostAnalytics | null;
}

interface PostStatsProps {
  posts: PostItem[];
  isLoading?: boolean;
}

export function PostStats({ posts, isLoading }: PostStatsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ru-RU');
    } catch {
      return iso;
    }
  };

  const formatReactions = (analytics: PostAnalytics | null) => {
    const breakdown = analytics?.reactions_breakdown;
    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return formatNumber(analytics?.reactions_count || 0);
    }

    return breakdown
      .slice(0, 4)
      .map(r => `${String(r.reaction).startsWith('custom:') ? '⭐' : r.reaction} ${r.count}`)
      .join(' • ');
  };

  if (isLoading) {
    return (
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        marginTop: '24px',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            height: '20px',
            width: '180px',
            backgroundColor: 'var(--surface-hover)',
            borderRadius: '4px',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }} />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              padding: '16px 24px',
              borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div style={{
              height: '16px',
              width: '70%',
              backgroundColor: 'var(--surface-hover)',
              borderRadius: '4px',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
      marginTop: '24px',
    }}>
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--foreground)',
        }}>
          Статистика по постам
        </h3>
        <span style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          {posts.length} постов
        </span>
      </div>

      {posts.length === 0 ? (
        <div style={{
          padding: '32px 24px',
          color: 'var(--text-secondary)',
          fontSize: '14px',
        }}>
          Нет опубликованных постов за выбранный период
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Дата
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Канал / Заголовок
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Просмотры
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Реакции
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Репосты
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => (
                <tr
                  key={post.id}
                  style={{
                    borderBottom: index < posts.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(post.published_at)}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                      {post.channel.name}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--foreground)' }}>
                      {post.title || 'Без заголовка'}
                    </div>
                    {!post.analytics?.telegram_message_id && (
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Нет `telegram_message_id` (появится для новых публикаций)
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                    {formatNumber(post.analytics?.views_count || 0)}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '13px', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                    {formatReactions(post.analytics)}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                    {formatNumber(post.analytics?.forwards_count || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

