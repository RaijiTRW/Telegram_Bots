'use client';

import { useState } from 'react';

interface Channel {
  id: string;
  name: string;
  telegram_link: string;
  telegram_chat_id?: string;
  topic: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface ChannelCardProps {
  channel: Channel;
  onUpdate: () => void;
  onEdit: (channel: Channel) => void;
}

export function ChannelCard({ channel, onUpdate, onEdit }: ChannelCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Вы уверены, что хотите удалить канал "${channel.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/channels/${channel.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onUpdate();
      } else {
        alert('Ошибка при удалении канала');
      }
    } catch (error) {
      console.error('Ошибка удаления канала:', error);
      alert('Ошибка при удалении канала');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleActive = async () => {
    try {
      const response = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !channel.is_active,
        }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Ошибка обновления статуса канала:', error);
    }
  };

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
            {channel.name}
          </h3>
          <div style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            color: 'var(--accent)',
            fontWeight: '600',
            fontSize: '13px'
          }}>
            {channel.topic}
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          padding: '8px 16px',
          borderRadius: '10px',
          backgroundColor: channel.is_active ? 'rgba(5, 150, 105, 0.1)' : 'rgba(161, 161, 170, 0.1)',
          color: channel.is_active ? 'var(--success)' : 'var(--text-tertiary)',
          fontWeight: '600',
          fontSize: '13px',
          whiteSpace: 'nowrap'
        }}>
          {channel.is_active ? 'Активен' : 'Неактивен'}
        </div>
      </div>

      {/* Description */}
      {channel.description && (
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '15px',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          {channel.description}
        </p>
      )}

      {/* Telegram Link */}
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
          API Токен
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
            {channel.telegram_link}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(channel.telegram_link);
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

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: '12px',
        paddingTop: '24px',
        borderTop: '1px solid var(--border)'
      }}>
        {/* Edit Button */}
        <button
          onClick={() => onEdit(channel)}
          disabled={isDeleting}
          style={{
            padding: '12px 24px',
            borderRadius: '10px',
            backgroundColor: 'var(--surface-hover)',
            color: 'var(--primary)',
            border: '1px solid var(--border)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--primary)';
          }}
        >
          <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Редактировать
        </button>

        <button
          onClick={toggleActive}
          disabled={isDeleting}
          style={{
            flex: 1,
            padding: '12px 24px',
            borderRadius: '10px',
            backgroundColor: channel.is_active ? 'var(--surface-hover)' : 'var(--success)',
            color: channel.is_active ? 'var(--foreground)' : 'white',
            border: channel.is_active ? '1px solid var(--border)' : 'none',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!channel.is_active) {
              e.currentTarget.style.backgroundColor = '#047857';
            } else {
              e.currentTarget.style.backgroundColor = 'var(--border)';
            }
          }}
          onMouseLeave={(e) => {
            if (!channel.is_active) {
              e.currentTarget.style.backgroundColor = 'var(--success)';
            } else {
              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            }
          }}
        >
          {channel.is_active ? 'Деактивировать' : 'Активировать'}
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
