'use client';

import { useState, useEffect } from 'react';
import { SourceCard } from './SourceCard';
import { AddSourceModal } from './AddSourceModal';

interface Source {
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
}

export function SourcesList() {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources');
      const data = await response.json();

      if (response.ok) {
        setSources(data.sources);
      }
    } catch (error) {
      console.error('Ошибка загрузки источников:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleSourceAdded = () => {
    fetchSources();
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            padding: '32px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            height: '200px',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  height: '28px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '6px',
                  width: '40%',
                  marginBottom: '16px'
                }} />
                <div style={{
                  height: '20px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '6px',
                  width: '30%'
                }} />
              </div>
            </div>
            <div style={{
              height: '60px',
              backgroundColor: 'var(--surface-hover)',
              borderRadius: '6px',
              width: '100%'
            }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      {/* Header with Add Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <p style={{
          fontSize: '15px',
          fontWeight: '600',
          color: 'var(--text-secondary)'
        }}>
          Всего источников: <span style={{ color: 'var(--primary)' }}>{sources.length}</span>
        </p>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '16px 32px',
            borderRadius: '12px',
            backgroundColor: 'var(--primary)',
            color: 'white',
            fontWeight: '600',
            fontSize: '16px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
          }}
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить источник
        </button>
      </div>

      {/* Sources List */}
      {sources.length === 0 ? (
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--foreground)',
              marginBottom: '16px'
            }}>
              Нет добавленных источников
            </h3>
            <p style={{
              fontSize: '17px',
              color: 'var(--text-secondary)',
              marginBottom: '40px',
              lineHeight: '1.6'
            }}>
              Добавьте первый источник контента для ваших каналов
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
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
              Добавить первый источник
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
          gap: '32px'
        }}>
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} onUpdate={fetchSources} />
          ))}
        </div>
      )}

      {/* Add Source Modal */}
      <AddSourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSourceAdded}
      />
    </div>
  );
}
