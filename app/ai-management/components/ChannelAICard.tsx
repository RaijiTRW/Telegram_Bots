'use client';

import { useState, useEffect } from 'react';
import AIStatusBadge from './AIStatusBadge';
import NoSourcesWarning from './NoSourcesWarning';
import { format } from 'date-fns';

interface ChannelAICardProps {
  channel: {
    id: string;
    name: string;
    topic: string;
    ai_enabled: boolean;
    ai_status: 'stopped' | 'running' | 'error';
  };
  onToggleAI: (channelId: string, enabled: boolean) => Promise<void>;
}

export default function ChannelAICard({ channel, onToggleAI }: ChannelAICardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, [channel.id]);

  const loadStatus = async () => {
    try {
      const response = await fetch(`/api/channels/${channel.id}/ai/status`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Error loading AI status:', data.error);
        // Используем значения по умолчанию при ошибке
        setStatus({
          enabled: false,
          status: 'stopped',
          active_sources_count: 0,
          posts_generated_count: 0,
          total_tokens_used: 0,
        });
        return;
      }

      setStatus(data);
    } catch (err) {
      console.error('Error loading AI status:', err);
      // Используем значения по умолчанию при ошибке
      setStatus({
        enabled: false,
        status: 'stopped',
        active_sources_count: 0,
        posts_generated_count: 0,
        total_tokens_used: 0,
      });
    }
  };

  const handleToggle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onToggleAI(channel.id, !channel.ai_enabled);
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const hasNoSources = status && status.active_sources_count === 0;
  const cannotEnable = !channel.ai_enabled && hasNoSources;

  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--foreground)',
              marginBottom: '4px',
            }}
          >
            {channel.name}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {channel.topic}
          </p>
        </div>

        <AIStatusBadge status={channel.ai_status} />
      </div>

      {/* Stats */}
      {status && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            padding: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              Источники
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)' }}>
              {status.active_sources_count}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              Посты
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)' }}>
              {status.posts_generated_count}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              Токены
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)' }}>
              {status.total_tokens_used ? status.total_tokens_used.toLocaleString() : '0'}
            </div>
          </div>
        </div>
      )}

      {/* Warning */}
      {cannotEnable && <NoSourcesWarning />}

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Last Run */}
      {status && status.last_run_at && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          Последний запуск: {format(new Date(status.last_run_at), 'dd.MM.yyyy HH:mm')}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        disabled={isLoading || cannotEnable}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          fontSize: '14px',
          fontWeight: 600,
          cursor: cannotEnable ? 'not-allowed' : isLoading ? 'wait' : 'pointer',
          backgroundColor: channel.ai_enabled ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary)',
          color: channel.ai_enabled ? '#ef4444' : 'white',
          opacity: cannotEnable || isLoading ? 0.5 : 1,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!cannotEnable && !isLoading) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          if (!cannotEnable && !isLoading) {
            e.currentTarget.style.opacity = '1';
          }
        }}
      >
        {isLoading ? 'Обработка...' : channel.ai_enabled ? 'Остановить AI' : 'Запустить AI'}
      </button>
    </div>
  );
}
