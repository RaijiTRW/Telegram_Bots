'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatsCards } from './components/StatsCards';
import { ChannelStats } from './components/ChannelStats';
import { PeriodSelector } from './components/PeriodSelector';
import { PostStats } from './components/PostStats';
import { SubscribersChart } from './components/SubscribersChart';

interface AnalyticsData {
  totalSubscribers: number;
  subscribersGained: number;
  subscribersLost: number;
  totalViews: number;
  totalPosts: number;
  subscribersTimeline: Array<{
    date: string;
    subscribers: number;
    gained: number;
    lost: number;
  }>;
  channels: Array<{
    id: string;
    name: string;
    subscribers: number;
    gained: number;
    lost: number;
    posts: number;
  }>;
}

interface PostsAnalyticsData {
  posts: Array<{
    id: string;
    title: string | null;
    published_at: string;
    channel: { id: string; name: string };
    analytics: {
      telegram_message_id?: number;
      views_count: number;
      reactions_count: number;
      forwards_count: number;
      shares_count: number;
      reactions_breakdown?: Array<{ reaction: string; count: number }> | null;
      updated_at?: string;
    } | null;
  }>;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [postsData, setPostsData] = useState<PostsAnalyticsData | null>(null);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null); // has saved session
  const [telegramAuthorized, setTelegramAuthorized] = useState<boolean | null>(null); // can authorize now
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const live = telegramAuthorized === true;
      const response = await fetch(
        `/api/analytics/channels?period=${period}${live ? '&sync=1' : ''}`,
        { cache: 'no-store' }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка загрузки');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [period, telegramConnected]);

  const fetchPostsAnalytics = useCallback(async (opts?: { live?: boolean }) => {
    setIsPostsLoading(true);
    setError(null);

    try {
      const live = opts?.live && telegramAuthorized === true;
      const response = await fetch(
        `/api/analytics/posts?period=${period}${live ? '&sync=1&syncLimit=20' : ''}`,
        { cache: 'no-store' }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка загрузки');
      }

      setPostsData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPostsLoading(false);
    }
  }, [period, telegramConnected]);

  const checkTelegramStatus = async () => {
    try {
      const response = await fetch('/api/telegram/status');
      const result = await response.json();
      setTelegramConnected(!!result.hasSession);
      setTelegramAuthorized(!!result.authorized);
    } catch {
      setTelegramConnected(false);
      setTelegramAuthorized(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/sync', {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка синхронизации');
      }

      // Перезагрузить данные после синхронизации
      await fetchAnalytics();
      await fetchPostsAnalytics({ live: true });

      alert(result.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    checkTelegramStatus();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchPostsAnalytics();
  }, [fetchPostsAnalytics]);

  // Live refresh posts stats (near real-time) while analytics page is open
  useEffect(() => {
    if (telegramAuthorized !== true) return;

    const id = setInterval(() => {
      fetchPostsAnalytics({ live: true });
      fetchAnalytics();
    }, 30000);

    return () => clearInterval(id);
  }, [telegramAuthorized, fetchPostsAnalytics, fetchAnalytics]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />

      <main style={{
        flex: 1,
        marginLeft: 'var(--sidebar-offset)',
        padding: 'var(--page-padding-y) var(--page-padding-x)',
        backgroundColor: 'var(--background)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '48px',
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: 'var(--foreground)',
              marginBottom: '8px',
            }}>
              Аналитика
            </h1>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
            }}>
              Статистика ваших Telegram каналов
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <PeriodSelector value={period} onChange={setPeriod} />

            <button
              onClick={handleSync}
              disabled={isSyncing || telegramAuthorized !== true}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: telegramAuthorized ? 'var(--primary)' : 'var(--surface)',
                color: telegramAuthorized ? 'white' : 'var(--text-secondary)',
                border: telegramAuthorized ? 'none' : '1px solid var(--border)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isSyncing || telegramAuthorized !== true ? 'not-allowed' : 'pointer',
                opacity: isSyncing ? 0.7 : 1,
              }}
            >
              {isSyncing ? (
                <>
                  <svg
                    style={{
                      width: '16px',
                      height: '16px',
                      animation: 'spin 1s linear infinite',
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Синхронизация...
                </>
              ) : (
                <>
                  <svg
                    style={{ width: '16px', height: '16px' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Синхронизировать
                </>
              )}
            </button>
          </div>
        </div>

        {/* Telegram not connected warning */}
        {telegramConnected === false && (
          <div style={{
            padding: '20px 24px',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(234, 179, 8, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{
                fontSize: '15px',
                fontWeight: '600',
                color: 'var(--foreground)',
                marginBottom: '4px',
              }}>
                Telegram не подключен
              </h4>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                Для получения статистики необходимо авторизоваться в Telegram
              </p>
            </div>
            <a
              href="/settings/telegram"
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                color: 'rgb(202, 138, 4)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              Подключить
            </a>
          </div>
        )}

        {/* Telegram session exists but cannot authorize right now */}
        {telegramConnected === true && telegramAuthorized === false && (
          <div style={{
            padding: '20px 24px',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(234, 179, 8, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{
                fontSize: '15px',
                fontWeight: '600',
                color: 'var(--foreground)',
                marginBottom: '4px',
              }}>
                Telegram сессия сохранена, но недоступна
              </h4>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                Проверьте интернет/лимиты Telegram или переподключите аккаунт.
              </p>
            </div>
            <a
              href="/settings/telegram"
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                color: 'rgb(202, 138, 4)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              Проверить
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
            color: 'rgb(239, 68, 68)',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div style={{ marginBottom: '32px' }}>
          <StatsCards
            totalSubscribers={data?.totalSubscribers || 0}
            subscribersGained={data?.subscribersGained || 0}
            subscribersLost={data?.subscribersLost || 0}
            totalViews={data?.totalViews || 0}
            totalPosts={data?.totalPosts || 0}
            isLoading={isLoading}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <SubscribersChart
            timeline={data?.subscribersTimeline || []}
            isLoading={isLoading}
          />
        </div>

        {/* Channel Stats */}
        <ChannelStats
          channels={data?.channels || []}
          isLoading={isLoading}
        />

        <PostStats
          posts={postsData?.posts || []}
          isLoading={isPostsLoading}
        />
      </main>
    </div>
  );
}
