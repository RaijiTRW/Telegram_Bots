'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

type AuthStep = 'phone' | 'code' | 'password' | 'connected';
const REQUEST_TIMEOUT_MS = 30_000;

export default function TelegramSettingsPage() {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/telegram/status');
      const data = await response.json();

      if (data.authorized) {
        setStep('connected');
        setConnectedPhone(data.phoneNumber);
      }
    } catch {
      // Ignore errors
    }
  };

  const handleSendCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
        signal: controller.signal,
      });
      clearTimeout(id);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки кода');
      }

      setPhoneCodeHash(data.phoneCodeHash);
      setStep('code');
    } catch (err: any) {
      const msg =
        err?.name === 'AbortError'
          ? 'Telegram не отвечает. Попробуйте ещё раз через 10–20 секунд.'
          : err?.message;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch('/api/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          phoneCode,
          phoneCodeHash,
          password: password || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(id);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка верификации');
      }

      if (data.needPassword) {
        setStep('password');
        return;
      }

      setStep('connected');
      setConnectedPhone(phoneNumber);
    } catch (err: any) {
      const msg =
        err?.name === 'AbortError'
          ? 'Telegram не отвечает. Попробуйте ещё раз через 10–20 секунд.'
          : err?.message;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitPassword = async () => {
    await handleVerifyCode();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />

      <main style={{
        flex: 1,
        marginLeft: '288px',
        padding: '48px 64px',
        backgroundColor: 'var(--background)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: 'var(--foreground)',
            marginBottom: '8px',
          }}>
            Подключение Telegram
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-secondary)',
          }}>
            Авторизуйтесь для получения статистики каналов
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          maxWidth: '500px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '40px',
        }}>
          {/* Connected State */}
          {step === 'connected' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <svg
                  style={{ width: '40px', height: '40px', color: 'var(--success)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'var(--foreground)',
                marginBottom: '12px',
              }}>
                Telegram подключен
              </h2>

              <p style={{
                fontSize: '15px',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}>
                Аккаунт успешно авторизован
              </p>

              {connectedPhone && (
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-tertiary)',
                  marginBottom: '32px',
                }}>
                  {connectedPhone}
                </p>
              )}

              <a
                href="/analytics"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 28px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                Перейти к аналитике
                <svg
                  style={{ width: '16px', height: '16px' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
            </div>
          )}

          {/* Phone Step */}
          {step === 'phone' && (
            <>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
              }}>
                <span style={{ fontSize: '28px' }}>📱</span>
              </div>

              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--foreground)',
                marginBottom: '8px',
              }}>
                Введите номер телефона
              </h2>

              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '24px',
              }}>
                Используйте номер, привязанный к вашему Telegram аккаунту
              </p>

              {error && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  color: 'rgb(239, 68, 68)',
                  fontSize: '14px',
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--foreground)',
                  marginBottom: '8px',
                }}>
                  Номер телефона
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+7 999 123 45 67"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontSize: '16px',
                    color: 'var(--foreground)',
                    outline: 'none',
                  }}
                />
                <p style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  marginTop: '8px',
                }}>
                  Формат: +79991234567
                </p>
              </div>

              <button
                onClick={handleSendCode}
                disabled={isLoading || !phoneNumber}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isLoading || !phoneNumber ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !phoneNumber ? 0.6 : 1,
                }}
              >
                {isLoading ? 'Отправка...' : 'Отправить код'}
              </button>
            </>
          )}

          {/* Code Step */}
          {step === 'code' && (
            <>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
              }}>
                <span style={{ fontSize: '28px' }}>🔐</span>
              </div>

              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--foreground)',
                marginBottom: '8px',
              }}>
                Введите код
              </h2>

              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '24px',
              }}>
                Код отправлен на {phoneNumber}
              </p>

              {error && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  color: 'rgb(239, 68, 68)',
                  fontSize: '14px',
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--foreground)',
                  marginBottom: '8px',
                }}>
                  Код подтверждения
                </label>
                <input
                  type="text"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="12345"
                  maxLength={5}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontSize: '24px',
                    fontWeight: '600',
                    color: 'var(--foreground)',
                    textAlign: 'center',
                    letterSpacing: '8px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Назад
                </button>
                <button
                  onClick={handleVerifyCode}
                  disabled={isLoading || phoneCode.length < 5}
                  style={{
                    flex: 2,
                    padding: '14px',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: isLoading || phoneCode.length < 5 ? 'not-allowed' : 'pointer',
                    opacity: isLoading || phoneCode.length < 5 ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Проверка...' : 'Подтвердить'}
                </button>
              </div>
            </>
          )}

          {/* Password Step (2FA) */}
          {step === 'password' && (
            <>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
              }}>
                <span style={{ fontSize: '28px' }}>🔒</span>
              </div>

              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--foreground)',
                marginBottom: '8px',
              }}>
                Двухфакторная аутентификация
              </h2>

              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '24px',
              }}>
                Введите пароль от вашего Telegram аккаунта
              </p>

              {error && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  color: 'rgb(239, 68, 68)',
                  fontSize: '14px',
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--foreground)',
                  marginBottom: '8px',
                }}>
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontSize: '16px',
                    color: 'var(--foreground)',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                onClick={handleSubmitPassword}
                disabled={isLoading || !password}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isLoading || !password ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !password ? 0.6 : 1,
                }}
              >
                {isLoading ? 'Проверка...' : 'Войти'}
              </button>
            </>
          )}
        </div>

        {/* Info */}
        {step !== 'connected' && (
          <div style={{
            maxWidth: '500px',
            marginTop: '24px',
            padding: '20px 24px',
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.1)',
            borderRadius: '12px',
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--foreground)',
              marginBottom: '8px',
            }}>
              Зачем это нужно?
            </h4>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
            }}>
              Для получения детальной статистики каналов (просмотры, репосты, реакции)
              необходим доступ через User API. Ваши данные безопасно хранятся и
              используются только для получения статистики.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
