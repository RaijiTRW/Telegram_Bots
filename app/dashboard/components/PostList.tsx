'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PostCard } from './PostCard';
import { Filters } from './Filters';
import { SearchBar } from './SearchBar';

interface Post {
  id: string;
  title: string | null;
  plain_text: string;
  status: 'pending' | 'published' | 'rejected' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
  channels?: {
    name: string;
    topic: string;
  };
}

interface Channel {
  id: string;
  name: string;
}

export function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isFirstLoad = useRef(true);

  const [filters, setFilters] = useState({
    channel: '',
    status: '',
    search: '',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  const fetchPosts = useCallback(async () => {
    // Для первой загрузки показываем полный loader, для остальных - фоновая загрузка
    if (isFirstLoad.current) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      if (filters.channel) params.set('channel_id', filters.channel);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      params.set('sort_order', filters.sortOrder);

      const response = await fetch(`/api/posts?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Ошибка загрузки постов:', error);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
      isFirstLoad.current = false;
    }
  }, [filters]);

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/channels');
      const data = await response.json();

      if (response.ok) {
        setChannels(data.channels);
      }
    } catch (error) {
      console.error('Ошибка загрузки каналов:', error);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Skeleton loader для первой загрузки
  if (isInitialLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        {/* Skeleton для поиска и фильтров */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{
            height: '48px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '24px'
          }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: '48px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }} />
            ))}
          </div>
        </div>

        {/* Skeleton для карточек */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '32px'
        }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              padding: '32px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              height: '320px',
              display: 'flex',
              flexDirection: 'column',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: '20px',
                    backgroundColor: 'var(--surface-hover)',
                    borderRadius: '6px',
                    width: '66%',
                    marginBottom: '12px'
                  }} />
                  <div style={{
                    height: '16px',
                    backgroundColor: 'var(--surface-hover)',
                    borderRadius: '6px',
                    width: '50%'
                  }} />
                </div>
                <div style={{
                  height: '28px',
                  width: '80px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '10px'
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', flex: 1 }}>
                <div style={{
                  height: '16px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '6px',
                  width: '100%'
                }} />
                <div style={{
                  height: '16px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '6px',
                  width: '100%'
                }} />
                <div style={{
                  height: '16px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '6px',
                  width: '75%'
                }} />
              </div>
              <div style={{
                display: 'flex',
                gap: '24px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border)'
              }}>
                <div style={{
                  height: '14px',
                  width: '100px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '6px'
                }} />
                <div style={{
                  height: '14px',
                  width: '100px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '6px'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      {/* Индикатор фоновой загрузки */}
      {isRefreshing && (
        <div style={{
          position: 'fixed',
          top: '32px',
          right: '32px',
          zIndex: 50,
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid rgba(37, 99, 235, 0.3)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: '15px', fontWeight: '600' }}>Обновление...</span>
        </div>
      )}

      {/* Поиск и фильтры с большими отступами */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Поиск */}
        <div>
          <SearchBar
            onSearch={(query) => setFilters((prev) => ({ ...prev, search: query }))}
          />
        </div>

        {/* Фильтры */}
        <div>
          <Filters
            channels={channels}
            selectedChannel={filters.channel}
            selectedStatus={filters.status}
            sortOrder={filters.sortOrder}
            onChannelChange={(channel) =>
              setFilters((prev) => ({ ...prev, channel }))
            }
            onStatusChange={(status) => setFilters((prev) => ({ ...prev, status }))}
            onSortChange={(sortOrder) =>
              setFilters((prev) => ({ ...prev, sortOrder }))
            }
          />
        </div>
      </div>

      {/* Список постов */}
      {posts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '120px 64px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px'
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{
              width: '96px',
              height: '96px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px'
            }}>
              <svg style={{ width: '48px', height: '48px', color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--foreground)',
              marginBottom: '16px'
            }}>
              Постов не найдено
            </h3>
            <p style={{
              fontSize: '17px',
              color: 'var(--text-secondary)',
              marginBottom: '40px',
              lineHeight: '1.6'
            }}>
              Попробуйте изменить параметры фильтрации
            </p>
            <button
              onClick={() => setFilters({ channel: '', status: '', search: '', sortOrder: 'desc' })}
              style={{
                padding: '16px 32px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Заголовок списка */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Всего постов: <span style={{ color: 'var(--primary)' }}>{posts.length}</span>
            </p>
            <button
              onClick={fetchPosts}
              disabled={isRefreshing}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                transition: 'all 0.2s',
                opacity: isRefreshing ? 0.5 : 1,
              }}
              title="Обновить"
            >
              <svg
                style={{
                  width: '20px',
                  height: '20px',
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          {/* Грид с постами */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '32px'
          }}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onUpdate={fetchPosts} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
