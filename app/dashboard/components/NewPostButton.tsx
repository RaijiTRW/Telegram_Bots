'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select } from '@/components/ui';

interface Channel {
  id: string;
  name: string;
  topic: string;
}

export function NewPostButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    channel_id: '',
    title: '',
    content: '',
  });

  // Загружаем каналы при открытии модалки
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
        // Выбираем первый канал по умолчанию
        if (data.channels.length > 0 && !formData.channel_id) {
          setFormData(prev => ({ ...prev, channel_id: data.channels[0].id }));
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки каналов:', err);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.channel_id) {
      setError('Выберите канал');
      return;
    }

    if (!formData.content.trim()) {
      setError('Введите текст поста');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: formData.channel_id,
          title: formData.title || null,
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: formData.content }] }] },
          plain_text: formData.content,
          status: 'draft',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsOpen(false);
        setFormData({ channel_id: '', title: '', content: '' });
        // Переходим в редактор нового поста
        router.push(`/editor/${data.post.id}`);
      } else {
        setError(data.error || 'Ошибка создания поста');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      setError('Произошла ошибка при создании поста');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setError('');
      setFormData({ channel_id: '', title: '', content: '' });
    }
  };

  return (
    <>
      {/* Кнопка */}
      <button
        onClick={() => setIsOpen(true)}
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
          transition: 'all 0.2s',
        }}
      >
        <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Новый пост
      </button>

      {/* Модальное окно */}
      {isOpen && (
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
            maxWidth: '700px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 1001,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
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
                  Новый пост
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
                Создайте новый пост для публикации в канале
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Канал */}
                <div>
                  <Select
                    label="Канал"
                    options={channels.map(ch => ({ value: ch.id, label: `${ch.name} (${ch.topic})` }))}
                    value={formData.channel_id}
                    onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                  {channels.length === 0 && (
                    <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--warning)' }}>
                      Сначала создайте канал в разделе "Каналы"
                    </p>
                  )}
                </div>

                {/* Заголовок */}
                <div>
                  <Input
                    label="Заголовок (опционально)"
                    type="text"
                    placeholder="Введите заголовок поста"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Контент */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--foreground)',
                    marginBottom: '8px'
                  }}>
                    Текст поста
                  </label>
                  <textarea
                    placeholder="Введите текст поста..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    disabled={isSubmitting}
                    required
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      fontSize: '15px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: '1.6',
                    }}
                  />
                  <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    После создания вы сможете отредактировать пост в редакторе
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
                <div style={{ display: 'flex', gap: '16px', paddingTop: '16px' }}>
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
                    }}
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || channels.length === 0}
                    style={{
                      flex: 1,
                      padding: '16px 32px',
                      borderRadius: '12px',
                      backgroundColor: (isSubmitting || channels.length === 0) ? 'var(--border)' : 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: (isSubmitting || channels.length === 0) ? 'not-allowed' : 'pointer',
                      boxShadow: (isSubmitting || channels.length === 0) ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)',
                    }}
                  >
                    {isSubmitting ? 'Создание...' : 'Создать пост'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
