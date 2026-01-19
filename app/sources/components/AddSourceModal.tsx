'use client';

import { useState, FormEvent, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Channel {
  id: string;
  name: string;
}

export function AddSourceModal({ isOpen, onClose, onSuccess }: AddSourceModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'website',
    url: '',
    channel_id: '',
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchChannels();
    }
  }, [isOpen]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setFormData({ name: '', type: 'website', url: '', channel_id: '' });
        onSuccess();
      } else {
        setError(data.error || 'Ошибка при создании источника');
      }
    } catch (error) {
      console.error('Ошибка создания источника:', error);
      setError('Произошла ошибка при создании источника');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({ name: '', type: 'website', url: '', channel_id: '' });
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'var(--surface)',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        zIndex: 1001,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: 'var(--foreground)'
            }}>
              Добавить источник
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6'
          }}>
            Добавьте источник контента для парсинга и генерации постов
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {/* Name */}
            <div>
              <Input
                label="Название источника"
                type="text"
                placeholder="Например: TechCrunch"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Type */}
            <div>
              <Select
                label="Тип источника"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                disabled={isSubmitting}
              >
                <option value="website">Веб-сайт</option>
                <option value="telegram">Telegram канал</option>
                <option value="rss">RSS лента</option>
              </Select>
            </div>

            {/* URL */}
            <div>
              <Input
                label="Ссылка на источник"
                type="url"
                placeholder={
                  formData.type === 'telegram'
                    ? 'https://t.me/channelname'
                    : formData.type === 'rss'
                    ? 'https://example.com/feed.xml'
                    : 'https://example.com'
                }
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
                disabled={isSubmitting}
                helperText={
                  formData.type === 'telegram'
                    ? 'Введите ссылку на Telegram канал'
                    : formData.type === 'rss'
                    ? 'Введите ссылку на RSS ленту'
                    : 'Введите URL веб-сайта'
                }
              />
            </div>

            {/* Channel */}
            <div>
              <Select
                label="Канал"
                value={formData.channel_id}
                onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                required
                disabled={isSubmitting}
                helperText="Выберите канал, к которому относится источник"
              >
                <option value="">Выберите канал</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                padding: '16px',
                backgroundColor: 'var(--error-bg)',
                border: '1px solid var(--error)',
                borderRadius: '12px',
                color: 'var(--error)',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '16px',
              paddingTop: '16px'
            }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '16px 32px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-hover)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  fontWeight: '600',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'var(--border)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                }}
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '16px 32px',
                  borderRadius: '12px',
                  backgroundColor: isSubmitting ? 'var(--border)' : 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '16px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
                  }
                }}
              >
                {isSubmitting ? 'Создание...' : 'Создать источник'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
