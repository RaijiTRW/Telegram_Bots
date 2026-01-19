'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Input } from '@/components/ui/Input';

interface Channel {
  id: string;
  name: string;
  telegram_link: string;
  telegram_chat_id?: string;
  topic: string;
  description: string | null;
  is_active: boolean;
}

interface EditChannelModalProps {
  isOpen: boolean;
  channel: Channel | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditChannelModal({ isOpen, channel, onClose, onSuccess }: EditChannelModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    telegram_link: '',
    telegram_chat_id: '',
    topic: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Заполняем форму данными канала при открытии
  useEffect(() => {
    if (channel && isOpen) {
      setFormData({
        name: channel.name || '',
        telegram_link: channel.telegram_link || '',
        telegram_chat_id: channel.telegram_chat_id || '',
        topic: channel.topic || '',
        description: channel.description || '',
      });
      setError('');
    }
  }, [channel, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!channel) return;

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Ошибка при обновлении канала');
      }
    } catch (error) {
      console.error('Ошибка обновления канала:', error);
      setError('Произошла ошибка при обновлении канала');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError('');
      onClose();
    }
  };

  if (!isOpen || !channel) return null;

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
              Редактировать канал
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
            Измените настройки канала
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
                label="Название канала"
                type="text"
                placeholder="Например: Новости технологий"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* API Token */}
            <div>
              <Input
                label="API токен бота"
                type="text"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={formData.telegram_link}
                onChange={(e) => setFormData({ ...formData, telegram_link: e.target.value })}
                required
                disabled={isSubmitting}
                helperText="Получите токен у @BotFather в Telegram"
              />
            </div>

            {/* Channel Chat ID */}
            <div>
              <Input
                label="ID или @username канала"
                type="text"
                placeholder="@mychannel или -1001234567890"
                value={formData.telegram_chat_id}
                onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                required
                disabled={isSubmitting}
                helperText="@username для публичных каналов или числовой ID для приватных"
              />
            </div>

            {/* Topic */}
            <div>
              <Input
                label="Тематика"
                type="text"
                placeholder="Например: Технологии, AI, Стартапы"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                required
                disabled={isSubmitting}
                helperText="ИИ будет использовать тематику для генерации контента"
              />
            </div>

            {/* Description */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--foreground)',
                marginBottom: '8px'
              }}>
                Описание (опционально)
              </label>
              <textarea
                placeholder="Дополнительная информация о канале, целевая аудитория, стиль контента..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={4}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  fontSize: '15px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  transition: 'all 0.2s',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.6'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--primary)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p style={{
                marginTop: '8px',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                ИИ использует описание для лучшего понимания контекста канала
              </p>
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
                {isSubmitting ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
