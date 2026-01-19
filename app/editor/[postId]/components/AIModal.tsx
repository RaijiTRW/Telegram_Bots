'use client';

import { useState, useEffect, useRef } from 'react';

interface AIModalProps {
  selection: { text: string; from: number; to: number; coords?: { top: number; left: number } } | null;
  onApply: (instruction: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function AIModal({ selection, onApply, isLoading = false, error = null }: AIModalProps) {
  const [instruction, setInstruction] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selection) {
      if (selection.coords) {
        setPosition(selection.coords);
        return;
      }

      // Fallback for older selection payloads
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setPosition({
          top: rect.bottom + 12,
          left: Math.max(20, rect.left - 50),
        });
      }
    } else {
      setPosition(null);
      setInstruction('');
    }
  }, [selection]);

  // Важно: не автофокусим input, иначе браузер снимает выделение в редакторе
  // и пользователю кажется, что выделение "сбрасывается".

  // Закрытие при клике вне модалки
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setPosition(null);
      }
    };

    if (position) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [position]);

  // Закрытие по ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPosition(null);
      }
    };

    if (position) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [position]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (instruction.trim() && !isLoading) {
      onApply(instruction);
      setInstruction('');
    }
  };

  if (!position || !selection) return null;

  return (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        zIndex: 1000,
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: '420px',
        minWidth: '320px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        animation: 'modalIn 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--foreground)',
            }}>
              AI Редактирование
            </p>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              marginTop: '2px',
            }}>
              Выделено: {selection.text.length} символов
            </p>
          </div>
        </div>
      </div>

      {/* Selected text preview */}
      <div style={{
        padding: '12px 20px',
        backgroundColor: 'rgba(139, 92, 246, 0.05)',
        borderBottom: '1px solid var(--border)',
      }}>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          lineHeight: '1.5',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          "{selection.text}"
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Что изменить? (сделай эмоциональнее, сократи, добавь факты...)"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: '14px',
              color: 'var(--foreground)',
              backgroundColor: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#8b5cf6';
              e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {error && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '10px',
        }}>
          <button
            type="button"
            onClick={() => setPosition(null)}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!instruction.trim() || isLoading}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              background: (!instruction.trim() || isLoading)
                ? 'var(--text-tertiary)'
                : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: (!instruction.trim() || isLoading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: (!instruction.trim() || isLoading)
                ? 'none'
                : '0 4px 12px rgba(139, 92, 246, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Обработка...
              </>
            ) : (
              <>
                <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Применить
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
