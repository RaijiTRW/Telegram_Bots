'use client';

interface StatsCardsProps {
  totalSubscribers: number;
  subscribersGained: number;
  subscribersLost: number;
  totalViews: number;
  totalPosts: number;
  isLoading?: boolean;
}

export function StatsCards({
  totalSubscribers,
  subscribersGained,
  subscribersLost,
  totalViews,
  totalPosts,
  isLoading,
}: StatsCardsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const cards = [
    {
      title: 'Подписчики',
      value: formatNumber(totalSubscribers),
      gained: subscribersGained,
      lost: subscribersLost,
      color: 'var(--primary)',
      bgColor: 'rgba(37, 99, 235, 0.1)',
    },
    {
      title: 'Просмотры',
      value: formatNumber(totalViews),
      gained: 0,
      lost: 0,
      color: 'var(--success)',
      bgColor: 'rgba(34, 197, 94, 0.1)',
    },
    {
      title: 'Постов',
      value: formatNumber(totalPosts),
      gained: 0,
      lost: 0,
      color: 'var(--warning)',
      bgColor: 'rgba(234, 179, 8, 0.1)',
    },
  ];

  if (isLoading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '24px',
      }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              padding: '24px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            <div style={{
              height: '16px',
              width: '60%',
              backgroundColor: 'var(--surface-hover)',
              borderRadius: '4px',
              marginBottom: '12px',
            }} />
            <div style={{
              height: '32px',
              width: '80%',
              backgroundColor: 'var(--surface-hover)',
              borderRadius: '4px',
            }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '24px',
    }}>
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            padding: '24px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: card.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ color: card.color, fontSize: '18px' }}>
                {card.title === 'Подписчики' && '👥'}
                {card.title === 'Просмотры' && '👁'}
                {card.title === 'Постов' && '📝'}
              </span>
            </div>
            <span style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              fontWeight: '500',
            }}>
              {card.title}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '12px',
          }}>
            <span style={{
              fontSize: '32px',
              fontWeight: '700',
              color: 'var(--foreground)',
            }}>
              {card.value}
            </span>
            {card.title === 'Подписчики' && (
              <span style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--success)',
                }}>
                  +{formatNumber(card.gained)}
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--error)',
                }}>
                  -{formatNumber(card.lost)}
                </span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
