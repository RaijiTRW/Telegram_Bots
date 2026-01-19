'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorToolbar } from './EditorToolbar';
import { useState, useEffect, useRef, useCallback } from 'react';

interface RichEditorProps {
  content: any;
  onChange: (content: any, plainText: string) => void;
  onTextSelect: (selection: { text: string; from: number; to: number } | null) => void;
}

export function RichEditor({ content, onChange, onTextSelect }: RichEditorProps) {
  const [isMounted, setIsMounted] = useState(false);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced selection handler - ждёт 500ms после завершения выделения
  const handleSelectionUpdate = useCallback(({ editor }: { editor: any }) => {
    // Очищаем предыдущий таймаут
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');

    // Минимум 5 символов для показа модалки
    if (text.trim().length >= 5 && from !== to) {
      // Задержка 500ms перед показом модалки
      selectionTimeoutRef.current = setTimeout(() => {
        onTextSelect({ text, from, to });
      }, 500);
    } else {
      onTextSelect(null);
    }
  }, [onTextSelect]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Начните писать ваш пост...',
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const text = editor.getText();
      onChange(json, text);
    },
    onSelectionUpdate: handleSelectionUpdate,
  });

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !editor) {
    return (
      <div className="border border-border rounded-lg bg-surface">
        <div className="p-4 text-text-secondary">Загрузка редактора...</div>
      </div>
    );
  }

  return (
    <div className="border pl-16 border-border rounded-lg overflow-hidden bg-surface">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
