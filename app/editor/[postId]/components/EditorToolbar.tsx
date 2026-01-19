'use client';

import { Editor } from '@tiptap/react';
import { useState } from 'react';

interface EditorToolbarProps {
  editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const ToolbarButton = ({
    id,
    onClick,
    isActive,
    children,
    title,
  }: {
    id: string;
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => {
    const isHovered = hoveredButton === id;

    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        onMouseEnter={() => setHoveredButton(id)}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isActive
            ? 'rgba(37, 99, 235, 0.15)'
            : isHovered
              ? 'var(--surface-hover)'
              : 'transparent',
          color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </button>
    );
  };

  const Divider = () => (
    <div
      style={{
        width: '1px',
        height: '24px',
        backgroundColor: 'var(--border)',
        margin: '0 8px',
      }}
    />
  );

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        padding: '12px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {/* Форматирование текста */}
      <ToolbarButton
        id="bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Жирный (Ctrl+B)"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        id="italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Курсив (Ctrl+I)"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4M14 20h4M15 4l-5 16" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        id="strike"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Зачеркнутый"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5c-1.6 0-3 .5-3 2 0 2.5 6 2 6 4.5 0 1.5-1.4 2.5-3 2.5" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Заголовки */}
      <ToolbarButton
        id="h1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Заголовок 1"
      >
        <span style={{ fontWeight: 700, fontSize: '14px' }}>H1</span>
      </ToolbarButton>

      <ToolbarButton
        id="h2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Заголовок 2"
      >
        <span style={{ fontWeight: 700, fontSize: '14px' }}>H2</span>
      </ToolbarButton>

      <ToolbarButton
        id="h3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Заголовок 3"
      >
        <span style={{ fontWeight: 700, fontSize: '14px' }}>H3</span>
      </ToolbarButton>

      <Divider />

      {/* Списки */}
      <ToolbarButton
        id="bullet"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Маркированный список"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        id="ordered"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Нумерованный список"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
          <text x="2" y="7" fontSize="7" fill="currentColor" fontWeight="bold">1</text>
          <text x="2" y="13" fontSize="7" fill="currentColor" fontWeight="bold">2</text>
          <text x="2" y="19" fontSize="7" fill="currentColor" fontWeight="bold">3</text>
        </svg>
      </ToolbarButton>

      <ToolbarButton
        id="blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Цитата"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Отмена/Повтор */}
      <ToolbarButton
        id="undo"
        onClick={() => editor.chain().focus().undo().run()}
        title="Отменить (Ctrl+Z)"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        id="redo"
        onClick={() => editor.chain().focus().redo().run()}
        title="Повторить (Ctrl+Y)"
      >
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
        </svg>
      </ToolbarButton>
    </div>
  );
}
