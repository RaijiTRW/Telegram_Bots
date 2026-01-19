'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useState } from 'react';

interface HeaderProps {
  user?: {
    email: string;
  };
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Ошибка выхода:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-16 py-8 max-w-[1600px]">
        <div className="flex items-center justify-between">
          {/* Лого */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground leading-tight">
                  Telegram Bots
                </h1>
                <p className="text-sm text-text-tertiary mt-1">
                  Управление контентом
                </p>
              </div>
            </div>
          </div>

          {/* Навигация и пользователь */}
          <div className="flex items-center gap-8">
            {user && (
              <div className="flex items-center gap-4 px-5 py-3 bg-surface-hover rounded-xl">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-base font-semibold text-primary">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-base font-medium text-text-secondary">
                  {user.email}
                </span>
              </div>
            )}

            <Button
              variant="ghost"
              size="md"
              onClick={handleLogout}
              isLoading={isLoggingOut}
            >
              Выйти
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
