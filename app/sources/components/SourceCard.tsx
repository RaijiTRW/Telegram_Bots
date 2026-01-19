'use client';

import { useState } from 'react';

interface SourceCardProps {
  source: {
    id: string;
    channel_id: string;
    name: string;
    type: string;
    url: string;
    is_active: boolean;
    last_parsed_at: string | null;
    created_at: string;
    channels?: {
      name: string;
      topic: string;
    };
  };
  onUpdate: () => void;
}

const typeLabels: Record<string, string> = {
  telegram: 'Telegram канал',
  website: 'Веб-сайт',
  rss: 'RSS лента',
};

const typeColors: Record<string, { bg: string; text: string }> = {
  telegram: { bg: 'rgba(37, 99, 235, 0.1)', text: 'var(--primary)' },
  website: { bg: 'rgba(124, 58, 237, 0.1)', text: 'var(--accent)' },
  rss: { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning)' },
};

export function SourceCard({ source, onUpdate }: SourceCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Вы уверены, что хотите удалить источник "${source.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/sources/${source.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onUpdate();
      } else {
        alert('Ошибка при удалении источника');
      }
    } catch (error) {
      console.error('Ошибка удаления источника:', error);
      alert('Ошибка при удалении источника');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleActive = async () => {
    try {
      const response = await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !source.is_active,
        }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Ошибка обновления статуса источника:', error);
    }
  };

  const typeColor = typeColors[source.type] || typeColors.website;

  return (
    <div style={{
      padding: '32px',
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      transition: 'all 0.2s',
      opacity: isDeleting ? 0.5 : 1
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '24px',
        gap: '16px'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--foreground)',
            marginBottom: '8px'
          }}>
            {source.name}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: typeColor.bg,
              color: typeColor.text,
              fontWeight: '600',
              fontSize: '13px'
            }}>
              {typeLabels[source.type] || source.type}
            </div>
            {source.channels && (
              <div style={{
                display: 'inline-block',
                padding: '6px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                color: 'var(--accent)',
                fontWeight: '600',
                fontSize: '13px'
              }}>
                {source.channels.name}
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          padding: '8px 16px',
          borderRadius: '10px',
          backgroundColor: source.is_active ? 'rgba(5, 150, 105, 0.1)' : 'rgba(161, 161, 170, 0.1)',
          color: source.is_active ? 'var(--success)' : 'var(--text-tertiary)',
          fontWeight: '600',
          fontSize: '13px',
          whiteSpace: 'nowrap'
        }}>
          {source.is_active ? 'Активен' : 'Неактивен'}
        </div>
      </div>

      {/* URL */}
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--surface-hover)',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          marginBottom: '8px',
          fontWeight: '600'
        }}>
          Ссылка
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <code style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'monospace',
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {source.url}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(source.url);
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'inherit';
            }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Last Parsed */}
      {source.last_parsed_at && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(5, 150, 105, 0.05)',
          borderRadius: '10px',
          marginBottom: '24px'
        }}>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)'
          }}>
            Последний парсинг: <span style={{ fontWeight: '600', color: 'var(--foreground)' }}>
              {new Date(source.last_parsed_at).toLocaleString('ru-RU')}
            </span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: '12px',
        paddingTop: '24px',
        borderTop: '1px solid var(--border)'
      }}>
        <button
          onClick={toggleActive}
          disabled={isDeleting}
          style={{
            flex: 1,
            padding: '12px 24px',
            borderRadius: '10px',
            backgroundColor: source.is_active ? 'var(--surface-hover)' : 'var(--success)',
            color: source.is_active ? 'var(--foreground)' : 'white',
            border: source.is_active ? '1px solid var(--border)' : 'none',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!source.is_active) {
              e.currentTarget.style.backgroundColor = '#047857';
            } else {
              e.currentTarget.style.backgroundColor = 'var(--border)';
            }
          }}
          onMouseLeave={(e) => {
            if (!source.is_active) {
              e.currentTarget.style.backgroundColor = 'var(--success)';
            } else {
              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            }
          }}
        >
          {source.is_active ? 'Деактивировать' : 'Активировать'}
        </button>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          style={{
            padding: '12px 24px',
            borderRadius: '10px',
            backgroundColor: 'var(--surface-hover)',
            color: 'var(--error)',
            border: '1px solid var(--border)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--error)';
            e.currentTarget.style.borderColor = 'var(--error)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--error)';
          }}
        >
          {isDeleting ? 'Удаление...' : 'Удалить'}
        </button>
      </div>
    </div>
  );
}
