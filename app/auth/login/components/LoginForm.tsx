'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<'token' | 'credentials'>(token ? 'credentials' : 'token');
  const [tokenInput, setTokenInput] = useState(token || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка проверки токена');
      }

      setStep('credentials');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка входа');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'token') {
    return (
      <form onSubmit={handleVerifyToken} className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Вход в Админ Панель
          </h2>
          <p className="text-text-secondary">
            Введите инвайт-токен для продолжения
          </p>
        </div>

        <Input
          type="text"
          label="Инвайт-токен"
          placeholder="Вставьте токен"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          error={error}
          disabled={isLoading}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          disabled={!tokenInput.trim()}
        >
          Продолжить
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Вход в систему
        </h2>
        <p className="text-text-secondary">Введите ваши учетные данные</p>
      </div>

      <Input
        type="email"
        label="Email"
        placeholder="admin@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
        required
      />

      <Input
        type="password"
        label="Пароль"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
        disabled={isLoading}
        required
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={isLoading}
        disabled={!email || !password}
      >
        Войти
      </Button>

      <button
        type="button"
        onClick={() => setStep('token')}
        className="text-sm text-text-secondary hover:text-foreground transition-colors w-full text-center"
      >
        Изменить токен
      </button>
    </form>
  );
}
