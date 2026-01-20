'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RichEditor } from './RichEditor';
import { AIModal } from './AIModal';
import { EditingOverlay } from './EditingOverlay';
import { ImageUploader } from './ImageUploader';

interface Post {
  id: string;
  title: string | null;
  content: any;
  plain_text: string;
  status: 'pending' | 'published' | 'rejected' | 'draft';
  ai_generated?: boolean;
  source?: { name: string; url: string | null } | null;
  created_at: string;
  channels?: {
    id: string;
    name: string;
    topic: string;
    telegram_link: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'На проверке', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  published: { label: 'Опубликован', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  rejected: { label: 'Отклонен', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  draft: { label: 'Черновик', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
};

export default function EditorContent({ post: initialPost }: { post: Post }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPost.title || '');
  const [content, setContent] = useState<any>(initialPost.content);
  const [plainText, setPlainText] = useState(initialPost.plain_text);
  const contentRef = useRef<any>(initialPost.content);
  const plainTextRef = useRef<string>(initialPost.plain_text);
  const [status, setStatus] = useState(initialPost.status);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAIEditing, setIsAIEditing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ text: string; from: number; to: number; coords?: { top: number; left: number } } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch(`/api/posts/${initialPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: contentRef.current, plain_text: plainTextRef.current }),
      });

      if (!response.ok) throw new Error('Ошибка сохранения');
      setSaveMessage('Сохранено');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      setSaveMessage('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (opts?: { republish?: boolean }) => {
    const republish = opts?.republish === true;
    if (republish) {
      const ok = window.confirm('Переопубликовать этот пост в Telegram ещё раз?');
      if (!ok) return;
    }

    await handleSave();
    setIsPublishing(true);
    setPublishError(null);

    try {
      const url = republish
        ? `/api/posts/${initialPost.id}/publish?republish=1`
        : `/api/posts/${initialPost.id}/publish`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.hint || 'Ошибка публикации');
      }

      setStatus('published');
      setSaveMessage(republish ? 'Переопубликовано в Telegram!' : 'Опубликовано в Telegram!');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (error: any) {
      console.error('Ошибка публикации:', error);
      setPublishError(error.message || 'Ошибка публикации');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRegenerate = async () => {
    const instruction = prompt('Введите инструкцию для пересоздания (опционально):');
    setIsAIEditing(true);
    setAiError(null);

    try {
      const response = await fetch(`/api/posts/${initialPost.id}/ai-regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instruction || undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Ошибка');

      setContent(data.post.content);
      setPlainText(data.post.plain_text);
      contentRef.current = data.post.content;
      plainTextRef.current = data.post.plain_text;
    } catch (error: any) {
      setAiError(error.message);
    } finally {
      setIsAIEditing(false);
    }
  };

  const handleAIApply = async (instruction: string) => {
    if (!selection) return;
    setIsAIEditing(true);
    setAiError(null);

    try {
      const response = await fetch(`/api/posts/${initialPost.id}/ai-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_text: selection.text, instruction }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Ошибка');

      setContent(data.post.content);
      setPlainText(data.post.plain_text);
      contentRef.current = data.post.content;
      plainTextRef.current = data.post.plain_text;
      setSelection(null);
    } catch (error: any) {
      setAiError(error.message);
    } finally {
      setIsAIEditing(false);
    }
  };

  return (
    <div>
      <EditingOverlay isEditing={isAIEditing} />

      {/* Status Badge и AI Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <span style={{
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 600,
          color: statusConfig.color,
          backgroundColor: statusConfig.bg,
        }}>
          {statusConfig.label}
        </span>
        {initialPost.ai_generated && (
          <span style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI сгенерировано
          </span>
        )}
      </div>

      {/* Заголовок */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Заголовок поста (опционально)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: '100%',
            padding: '16px 20px',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--foreground)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
      </div>

      {/* Изображения */}
      <ImageUploader postId={initialPost.id} />

      {/* Редактор */}
      <div style={{
        marginBottom: '24px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {content && (
          <RichEditor
            content={content}
            onChange={(newContent, newPlainText) => {
              // Не делаем редактор "controlled" — иначе TipTap сбрасывает selection.
              // Контент храним в refs и сохраняем по кнопке.
              contentRef.current = newContent;
              plainTextRef.current = newPlainText;
              setPlainText(newPlainText);
            }}
            onTextSelect={setSelection}
          />
        )}
      </div>

      {/* AI Модалка */}
      <AIModal
        selection={selection}
        onApply={handleAIApply}
        isLoading={isAIEditing}
        error={aiError}
      />

      {/* Кнопки действий */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Сохранить */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--foreground)',
              backgroundColor: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              cursor: isSaving ? 'wait' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {isSaving ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            Сохранить
          </button>

          {/* Пересоздать */}
          <button
            onClick={handleRegenerate}
            disabled={isAIEditing || isSaving}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '10px',
              cursor: (isAIEditing || isSaving) ? 'not-allowed' : 'pointer',
              opacity: (isAIEditing || isSaving) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Пересоздать AI
          </button>

          {/* Сообщение о сохранении */}
          {saveMessage && (
            <span style={{
              fontSize: '13px',
              color: saveMessage.includes('Ошибка') ? '#ef4444' : '#22c55e',
              fontWeight: 500,
            }}>
              {saveMessage}
            </span>
          )}
        </div>

        {/* Опубликовать / Переопубликовать */}
        {status !== 'published' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => handlePublish()}
              disabled={isSaving || isPublishing}
              style={{
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                backgroundColor: '#22c55e',
                border: 'none',
                borderRadius: '10px',
                cursor: (isSaving || isPublishing) ? 'wait' : 'pointer',
                opacity: (isSaving || isPublishing) ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                transition: 'all 0.2s',
              }}
            >
              {isPublishing ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Публикация...
                </>
              ) : (
                <>
                  <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Опубликовать в Telegram
                </>
              )}
            </button>
            {publishError && (
              <span style={{
                fontSize: '12px',
                color: '#ef4444',
                maxWidth: '300px',
                textAlign: 'right',
              }}>
                {publishError}
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => handlePublish({ republish: true })}
              disabled={isSaving || isPublishing}
              style={{
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                backgroundColor: 'var(--primary)',
                border: 'none',
                borderRadius: '10px',
                cursor: (isSaving || isPublishing) ? 'wait' : 'pointer',
                opacity: (isSaving || isPublishing) ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.2s',
              }}
            >
              {isPublishing ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Публикация...
                </>
              ) : (
                <>
                  <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Переопубликовать
                </>
              )}
            </button>
            {publishError && (
              <span style={{
                fontSize: '12px',
                color: '#ef4444',
                maxWidth: '300px',
                textAlign: 'right',
              }}>
                {publishError}
              </span>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input:focus {
          border-color: var(--primary);
        }
        button:hover:not(:disabled) {
          filter: brightness(1.05);
        }
      `}</style>
    </div>
  );
}
