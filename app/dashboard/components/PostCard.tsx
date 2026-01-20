'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatRelativeTime } from '@/lib/utils/dateFormat';
import { truncateText } from '@/lib/utils/textHelpers';

interface PostCardProps {
  post: {
    id: string;
    title: string | null;
    plain_text: string;
    status: 'pending' | 'published' | 'rejected' | 'draft' | 'archived';
    created_at: string;
    updated_at: string;
    source?: {
      name: string;
      url: string | null;
    };
    channels?: {
      name: string;
      topic: string;
    };
  };
  onUpdate?: () => void;
}

export function PostCard({ post, onUpdate }: PostCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRepublishing, setIsRepublishing] = useState(false);

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Переместить пост в архив?')) return;

    setIsArchiving(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (!response.ok) {
        throw new Error('Ошибка архивации');
      }

      onUpdate?.();
    } catch (error) {
      alert('Не удалось архивировать пост');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Вы уверены, что хотите удалить этот пост? Это действие нельзя отменить.')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Ошибка удаления');
      }

      onUpdate?.();
    } catch (error) {
      alert('Не удалось удалить пост');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRepublish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (post.status !== 'published') return;
    if (!confirm('Переопубликовать этот пост в Telegram ещё раз?')) return;

    setIsRepublishing(true);
    try {
      const response = await fetch(`/api/posts/${post.id}/publish?republish=1`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка переопубликации');
      }
      onUpdate?.();
    } catch (error) {
      alert('Не удалось переопубликовать пост');
    } finally {
      setIsRepublishing(false);
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Открыть пост: ${post.title || 'Без заголовка'}`}
      onClick={() => router.push(`/editor/${post.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/editor/${post.id}`);
        }
      }}
      style={{
        padding: '32px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
        {/* Статус и канал */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '16px'
        }}>
          {post.channels && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '14px',
              flex: 1,
              minWidth: 0
            }}>
              <span style={{
                padding: '6px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary)',
                fontWeight: '600',
                fontSize: '13px',
                whiteSpace: 'nowrap'
              }}>
                {post.channels.name}
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>•</span>
              <span style={{
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {post.channels.topic}
              </span>
              {post.source?.name && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                  {post.source.url ? (
                    <a
                      href={post.source.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={post.source.name}
                      style={{
                        color: 'var(--text-tertiary)',
                        textDecoration: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '220px',
                      }}
                    >
                      Источник: {post.source.name}
                    </a>
                  ) : (
                    <span
                      title={post.source.name}
                      style={{
                        color: 'var(--text-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '220px',
                      }}
                    >
                      Источник: {post.source.name}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          <StatusBadge status={post.status} size="sm" />
        </div>

        {/* Заголовок */}
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: 'var(--foreground)',
          marginBottom: '16px',
          lineHeight: '1.4',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {post.title || 'Без заголовка'}
        </h3>

        {/* Контент */}
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '15px',
          marginBottom: '24px',
          flex: 1,
          lineHeight: '1.6',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {truncateText(post.plain_text, 180)}
        </p>

        {/* Даты и действия */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          paddingTop: '20px',
          borderTop: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatRelativeTime(post.created_at)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>{formatDate(post.updated_at, 'dd.MM.yyyy')}</span>
            </div>
          </div>

          {/* Action buttons */}
          {post.status !== 'archived' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: isArchiving ? 'not-allowed' : 'pointer',
                  opacity: isArchiving ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isArchiving) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title="В архив"
              >
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {isArchiving ? '...' : 'Архив'}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'transparent',
                  color: 'rgb(239, 68, 68)',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Удалить"
              >
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isDeleting ? '...' : 'Удалить'}
              </button>
            </div>
          )}
        </div>
    </div>
  );
}
