'use client';

import { useState, useEffect } from 'react';
import { ChannelCard } from './ChannelCard';
import { AddChannelModal } from './AddChannelModal';
import { EditChannelModal } from './EditChannelModal';

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

export function ChannelsList() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/channels');
      const data = await response.json();

      if (response.ok) {
        setChannels(data.channels);
      }
    } catch (error) {
      console.error('Ошибка загрузки каналов:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleChannelAdded = () => {
    fetchChannels();
    setIsModalOpen(false);
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setIsEditModalOpen(true);
  };

  const handleChannelUpdated = () => {
    fetchChannels();
    setIsEditModalOpen(false);
    setEditingChannel(null);
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
          Всего каналов: <span style={{ color: 'var(--primary)' }}>{channels.length}</span>
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
          Добавить канал
        </button>
      </div>

      {/* Channels List */}
      {channels.length === 0 ? (
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--foreground)',
              marginBottom: '16px'
            }}>
              Нет добавленных каналов
            </h3>
            <p style={{
              fontSize: '17px',
              color: 'var(--text-secondary)',
              marginBottom: '40px',
              lineHeight: '1.6'
            }}>
              Добавьте ваш первый Telegram канал для начала работы
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
              Добавить первый канал
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
          gap: '32px'
        }}>
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onUpdate={fetchChannels}
              onEdit={handleEditChannel}
            />
          ))}
        </div>
      )}

      {/* Add Channel Modal */}
      <AddChannelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleChannelAdded}
      />

      {/* Edit Channel Modal */}
      <EditChannelModal
        isOpen={isEditModalOpen}
        channel={editingChannel}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingChannel(null);
        }}
        onSuccess={handleChannelUpdated}
      />
    </div>
  );
}
