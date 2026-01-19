'use client';

interface Channel {
  id: string;
  name: string;
  subscribers: number;
  gained: number;
  lost: number;
  posts: number;
}

interface ChannelStatsProps {
  channels: Channel[];
  isLoading?: boolean;
}

export function ChannelStats({ channels, isLoading }: ChannelStatsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  if (isLoading) {
    return (
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            height: '20px',
            width: '120px',
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
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{
              height: '16px',
              width: '150px',
              backgroundColor: 'var(--surface-hover)',
              borderRadius: '4px',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }} />
            <div style={{ display: 'flex', gap: '32px' }}>
              {[1, 2, 3, 4].map((j) => (
                <div
                  key={j}
                  style={{
                    height: '16px',
                    width: '60px',
                    backgroundColor: 'var(--surface-hover)',
                    borderRadius: '4px',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '48px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: 'var(--surface-hover)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <span style={{ fontSize: '24px' }}>📊</span>
        </div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--foreground)',
          marginBottom: '8px',
        }}>
          Нет данных
        </h3>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
        }}>
          Добавьте каналы и синхронизируйте статистику
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
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
          Статистика по каналам
        </h3>
        <span style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          {channels.length} каналов
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}>
          <thead>
            <tr style={{
              backgroundColor: 'var(--surface-hover)',
            }}>
              <th style={{
                padding: '12px 24px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Канал
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'right',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Подписчики
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'right',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Пришло
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'right',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Ушло
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'right',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Постов
              </th>
            </tr>
          </thead>
          <tbody>
            {channels.map((channel, index) => (
              <tr
                key={channel.id}
                style={{
                  borderBottom: index < channels.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <td style={{
                  padding: '16px 24px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      fontWeight: '600',
                      fontSize: '14px',
                    }}>
                      {channel.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--foreground)',
                    }}>
                      {channel.name}
                    </span>
                  </div>
                </td>
                <td style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--foreground)',
                }}>
                  {formatNumber(channel.subscribers)}
                </td>
                <td style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--success)',
                }}>
                  +{formatNumber(channel.gained)}
                </td>
                <td style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--error)',
                }}>
                  -{formatNumber(channel.lost)}
                </td>
                <td style={{
                  padding: '16px 24px',
                  textAlign: 'right',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                }}>
                  {channel.posts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
