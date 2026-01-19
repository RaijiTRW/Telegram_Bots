'use client';

import { useState, useEffect } from 'react';
import AgentSettingsCard from './AgentSettingsCard';

interface AgentSettings {
  id: string;
  agent_name: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
}

export default function AISettingsContent() {
  const [agents, setAgents] = useState<AgentSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/settings');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки настроек');
      }

      setAgents(data.agents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              height: '400px',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            <div
              style={{
                height: '40px',
                backgroundColor: 'var(--surface-hover)',
                borderRadius: '8px',
                width: '40%',
                marginBottom: '20px',
              }}
            />
            <div
              style={{
                height: '200px',
                backgroundColor: 'var(--surface-hover)',
                borderRadius: '8px',
                marginBottom: '20px',
              }}
            />
            <div style={{ display: 'flex', gap: '20px' }}>
              <div
                style={{
                  height: '60px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '8px',
                  flex: 1,
                }}
              />
              <div
                style={{
                  height: '60px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: '8px',
                  flex: 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '20px',
          color: 'rgb(239, 68, 68)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, marginBottom: '12px' }}>{error}</p>
        <button
          onClick={loadSettings}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid rgb(239, 68, 68)',
            backgroundColor: 'transparent',
            color: 'rgb(239, 68, 68)',
            cursor: 'pointer',
          }}
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '48px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0 }}>
          Настройки агентов не найдены. Выполните миграцию базы данных.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Description */}
      <div
        style={{
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
        }}
      >
        <p style={{ margin: 0, color: 'var(--foreground)', fontSize: '14px' }}>
          <strong>Настройки AI Агентов</strong> — здесь вы можете изменить системные промпты и параметры
          для каждого агента. Изменения применяются ко всем каналам.
        </p>
      </div>

      {/* Agent Cards */}
      {agents.map((agent) => (
        <AgentSettingsCard key={agent.id} agent={agent} onSave={loadSettings} />
      ))}
    </div>
  );
}
