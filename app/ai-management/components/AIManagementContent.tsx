'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ChannelAICard from './ChannelAICard';

interface Channel {
  id: string;
  name: string;
  topic: string;
  ai_enabled: boolean;
  ai_status: 'stopped' | 'running' | 'error';
  ai_last_run_at?: string;
}

// Интервал серверного парсинга в секундах
const SERVER_PARSE_INTERVAL = 120;

export default function AIManagementContent() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<string | null>(null);
  const [serverCountdown, setServerCountdown] = useState<number | null>(null);
  const serverCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const channelsRef = useRef<Channel[]>([]);

  // Храним актуальные каналы в ref
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  // Countdown до следующего фонового цикла (только отображение)
  useEffect(() => {
    if (serverCountdownRef.current) {
      clearInterval(serverCountdownRef.current);
      serverCountdownRef.current = null;
    }

    const computeNextRunSeconds = (channelsList: Channel[]) => {
      const enabled = channelsList.filter(c => c.ai_enabled && c.ai_last_run_at);
      if (enabled.length === 0) return null;

      const lastRunTimes = enabled
        .map(c => new Date(c.ai_last_run_at!).getTime())
        .filter(t => !isNaN(t));

      if (lastRunTimes.length === 0) return null;

      const mostRecentRun = Math.max(...lastRunTimes);
      const nextRun = mostRecentRun + SERVER_PARSE_INTERVAL * 1000;
      const now = Date.now();
      return Math.max(0, Math.ceil((nextRun - now) / 1000));
    };

    setServerCountdown(computeNextRunSeconds(channels));

    serverCountdownRef.current = setInterval(() => {
      const secs = computeNextRunSeconds(channelsRef.current);
      setServerCountdown(secs);
    }, 1000);

    return () => {
      if (serverCountdownRef.current) {
        clearInterval(serverCountdownRef.current);
        serverCountdownRef.current = null;
      }
    };
  }, [channels]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/channels');

      if (!response.ok) {
        throw new Error('Failed to load channels');
      }

      const data = await response.json();
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Error loading channels:', err);
      setError('Не удалось загрузить каналы');
    } finally {
      setLoading(false);
    }
  };

  // Загружаем каналы при монтировании
  useEffect(() => {
    loadChannels();
  }, []);

  const runParsing = useCallback(async () => {
    const currentChannels = channelsRef.current;
    const enabledChannels = currentChannels.filter(c => c.ai_enabled);

    if (enabledChannels.length === 0) {
      setParseResult('Нет каналов с включенным AI');
      return;
    }

    setIsParsing(true);
    setParseResult(null);

    let totalParsed = 0;
    let totalPosts = 0;
    const errors: string[] = [];

    for (const channel of enabledChannels) {
      try {
        const response = await fetch('/api/ai/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channel.id }),
        });

        const data = await response.json();

        if (data.success) {
          totalParsed += data.contentParsed || 0;
          totalPosts += data.postsGenerated || 0;
        } else {
          errors.push(`${channel.name}: ${data.errors?.join(', ') || data.error || 'Ошибка'}`);
        }
      } catch (err) {
        errors.push(`${channel.name}: ${err instanceof Error ? err.message : 'Ошибка'}`);
      }
    }

    // Перезагружаем каналы
    try {
      const response = await fetch('/api/channels');
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      }
    } catch {
      // ignore
    }

    if (errors.length > 0) {
      setParseResult(`Спарсено: ${totalParsed}, Постов: ${totalPosts}. Ошибки: ${errors.join('; ')}`);
    } else {
      setParseResult(`Спарсено: ${totalParsed} записей, Создано постов: ${totalPosts}`);
    }

    setIsParsing(false);
  }, []);

  const handleToggleAI = async (channelId: string, enabled: boolean) => {
    const response = await fetch(`/api/channels/${channelId}/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.error || 'Failed to toggle AI');
    }

    await loadChannels();
  };

  // Форматирование countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Загрузка каналов...
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '16px', fontWeight: 500 }}>{error}</p>
          <button
            onClick={loadChannels}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #ef4444',
              backgroundColor: 'transparent',
              color: '#ef4444',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 16px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              style={{ width: '40px', height: '40px', color: 'var(--text-tertiary)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--foreground)',
              marginBottom: '8px',
            }}
          >
            Нет каналов
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Создайте канал, чтобы начать использовать AI
          </p>
          <a
            href="/channels"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Добавить канал
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Панель управления парсингом */}
      <div
        style={{
          marginBottom: '24px',
          padding: '20px',
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Кнопка ручного запуска */}
          <button
            onClick={runParsing}
            disabled={isParsing}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isParsing ? 'wait' : 'pointer',
              opacity: isParsing ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isParsing ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Парсинг...
              </>
            ) : (
              <>
                <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Запустить парсинг
              </>
            )}
          </button>
        </div>

        {/* Информация о серверном парсинге */}
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            fontSize: '13px',
            color: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <span>Фоновый парсинг запускается на сервере каждые 2 минуты (если AI включён)</span>
          </div>
          {serverCountdown !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span>Следующий: {formatCountdown(serverCountdown)}</span>
            </div>
          )}
        </div>

        {/* Результат парсинга */}
        {parseResult && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: parseResult.includes('Ошибки') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              color: parseResult.includes('Ошибки') ? '#ef4444' : '#22c55e',
              fontSize: '13px',
            }}
          >
            {parseResult}
          </div>
        )}
      </div>

      {/* Карточки каналов */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px',
        }}
      >
        {channels.map((channel) => (
          <ChannelAICard
            key={channel.id}
            channel={channel}
            onToggleAI={handleToggleAI}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
