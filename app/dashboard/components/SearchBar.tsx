'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Поиск по постам...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const onSearchRef = useRef(onSearch);
  const isFirstRender = useRef(true);

  // Обновляем ref при изменении onSearch
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Debounce поиска - используем ref чтобы избежать бесконечного цикла
  useEffect(() => {
    // Пропускаем первый рендер чтобы не вызывать лишний запрос
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      onSearchRef.current(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ paddingLeft: '48px' }}
      />
      <svg
        style={{
          position: 'absolute',
          left: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '20px',
          height: '20px',
          color: 'var(--text-tertiary)',
          pointerEvents: 'none'
        }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
}
