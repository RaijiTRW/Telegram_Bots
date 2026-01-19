'use client';

import { useState, useEffect } from 'react';

interface LengthWeights {
  short: number;
  medium: number;
  long: number;
}

interface AgentSettings {
  id: string;
  agent_name: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  length_variation_enabled?: boolean;
  min_length?: 'short' | 'medium' | 'long';
  max_length?: 'short' | 'medium' | 'long';
  length_weights?: LengthWeights;
}

interface AgentSettingsCardProps {
  agent: AgentSettings;
  onSave: () => void;
}

const AGENT_INFO = {
  planner: {
    title: 'Planner Agent',
    icon: '🧠',
    description: 'Анализирует контент и создает план поста',
  },
  writer: {
    title: 'Writer Agent',
    icon: '✍️',
    description: 'Создает посты на основе плана',
  },
  image: {
    title: 'Image Agent',
    icon: '🖼️',
    description: 'Подбирает изображения для постов',
  },
};

const DEFAULT_LENGTH_WEIGHTS: LengthWeights = { short: 30, medium: 50, long: 20 };

export default function AgentSettingsCard({ agent, onSave }: AgentSettingsCardProps) {
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [maxTokens, setMaxTokens] = useState(agent.max_tokens);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Length variation settings (only for writer agent)
  const [lengthVariationEnabled, setLengthVariationEnabled] = useState(agent.length_variation_enabled ?? false);
  const [minLength, setMinLength] = useState<'short' | 'medium' | 'long'>(agent.min_length ?? 'short');
  const [maxLength, setMaxLength] = useState<'short' | 'medium' | 'long'>(agent.max_length ?? 'long');
  const [lengthWeights, setLengthWeights] = useState<LengthWeights>(agent.length_weights ?? DEFAULT_LENGTH_WEIGHTS);

  const info = AGENT_INFO[agent.agent_name as keyof typeof AGENT_INFO];
  const isWriterAgent = agent.agent_name === 'writer';

  useEffect(() => {
    let changed =
      systemPrompt !== agent.system_prompt ||
      maxTokens !== agent.max_tokens ||
      temperature !== agent.temperature;

    // Check length variation changes for writer agent
    if (isWriterAgent) {
      changed = changed ||
        lengthVariationEnabled !== (agent.length_variation_enabled ?? false) ||
        minLength !== (agent.min_length ?? 'short') ||
        maxLength !== (agent.max_length ?? 'long') ||
        JSON.stringify(lengthWeights) !== JSON.stringify(agent.length_weights ?? DEFAULT_LENGTH_WEIGHTS);
    }

    setHasChanges(changed);
  }, [systemPrompt, maxTokens, temperature, lengthVariationEnabled, minLength, maxLength, lengthWeights, agent, isWriterAgent]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const requestBody: Record<string, unknown> = {
        system_prompt: systemPrompt,
        max_tokens: maxTokens,
        temperature: temperature,
      };

      // Add length variation fields for writer agent
      if (isWriterAgent) {
        requestBody.length_variation_enabled = lengthVariationEnabled;
        requestBody.min_length = minLength;
        requestBody.max_length = maxLength;
        requestBody.length_weights = lengthWeights;
      }

      const response = await fetch(`/api/ai/settings/${agent.agent_name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка сохранения');
      }

      setSaveMessage({ type: 'success', text: 'Настройки сохранены' });
      setHasChanges(false);
      onSave();

      // Убираем сообщение через 3 секунды
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Ошибка сохранения',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSystemPrompt(agent.system_prompt);
    setMaxTokens(agent.max_tokens);
    setTemperature(agent.temperature);
    if (isWriterAgent) {
      setLengthVariationEnabled(agent.length_variation_enabled ?? false);
      setMinLength(agent.min_length ?? 'short');
      setMaxLength(agent.max_length ?? 'long');
      setLengthWeights(agent.length_weights ?? DEFAULT_LENGTH_WEIGHTS);
    }
  };

  // Helper to update a single weight while keeping total manageable
  const updateWeight = (key: keyof LengthWeights, value: number) => {
    setLengthWeights(prev => ({ ...prev, [key]: value }));
  };

  // Get length order for validation
  const lengthOrder = { short: 0, medium: 1, long: 2 };

  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '28px' }}>{info?.icon}</span>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--foreground)', margin: 0 }}>
            {info?.title}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            {info?.description}
          </p>
        </div>
      </div>

      {/* System Prompt */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--foreground)',
            marginBottom: '8px',
          }}
        >
          Системный промпт
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--background)',
            color: 'var(--foreground)',
            fontSize: '14px',
            fontFamily: 'monospace',
            resize: 'vertical',
            outline: 'none',
          }}
          placeholder="Введите системный промпт для агента..."
        />
      </div>

      {/* Parameters Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Max Tokens */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--foreground)',
              marginBottom: '8px',
            }}
          >
            Max Tokens
          </label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
            min={100}
            max={16000}
            step={100}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            100 - 16000
          </p>
        </div>

        {/* Temperature */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--foreground)',
              marginBottom: '8px',
            }}
          >
            Temperature: {temperature.toFixed(1)}
          </label>
          <input
            type="range"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            min={0}
            max={2}
            step={0.1}
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              cursor: 'pointer',
              accentColor: 'var(--primary)',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              marginTop: '4px',
            }}
          >
            <span>0 (точный)</span>
            <span>2 (креативный)</span>
          </div>
        </div>
      </div>

      {/* Length Variation Settings - Only for Writer Agent */}
      {isWriterAgent && (
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--background)',
            borderRadius: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--foreground)', margin: 0 }}>
                Вариативность длины постов
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                AI будет создавать посты разной длины
              </p>
            </div>
            <button
              onClick={() => setLengthVariationEnabled(!lengthVariationEnabled)}
              style={{
                width: '48px',
                height: '26px',
                borderRadius: '13px',
                border: 'none',
                backgroundColor: lengthVariationEnabled ? 'var(--primary)' : 'var(--border)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: lengthVariationEnabled ? '25px' : '3px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>

          {lengthVariationEnabled && (
            <>
              {/* Min/Max Length */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', marginBottom: '6px' }}>
                    Минимальная длина
                  </label>
                  <select
                    value={minLength}
                    onChange={(e) => {
                      const newMin = e.target.value as 'short' | 'medium' | 'long';
                      setMinLength(newMin);
                      // Ensure max is not less than min
                      if (lengthOrder[newMin] > lengthOrder[maxLength]) {
                        setMaxLength(newMin);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--foreground)',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="short">Короткий (до 500 симв.)</option>
                    <option value="medium">Средний (500-1500 симв.)</option>
                    <option value="long">Длинный (1500+ симв.)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', marginBottom: '6px' }}>
                    Максимальная длина
                  </label>
                  <select
                    value={maxLength}
                    onChange={(e) => {
                      const newMax = e.target.value as 'short' | 'medium' | 'long';
                      setMaxLength(newMax);
                      // Ensure min is not greater than max
                      if (lengthOrder[newMax] < lengthOrder[minLength]) {
                        setMinLength(newMax);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--foreground)',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="short">Короткий (до 500 симв.)</option>
                    <option value="medium">Средний (500-1500 симв.)</option>
                    <option value="long">Длинный (1500+ симв.)</option>
                  </select>
                </div>
              </div>

              {/* Length Weights */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', marginBottom: '12px' }}>
                  Веса для выбора длины (вероятность)
                </label>

                {/* Short */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Короткий</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: '500' }}>{lengthWeights.short}%</span>
                  </div>
                  <input
                    type="range"
                    value={lengthWeights.short}
                    onChange={(e) => updateWeight('short', parseInt(e.target.value))}
                    min={0}
                    max={100}
                    disabled={lengthOrder.short < lengthOrder[minLength] || lengthOrder.short > lengthOrder[maxLength]}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      accentColor: 'var(--primary)',
                      opacity: lengthOrder.short < lengthOrder[minLength] || lengthOrder.short > lengthOrder[maxLength] ? 0.3 : 1,
                    }}
                  />
                </div>

                {/* Medium */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Средний</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: '500' }}>{lengthWeights.medium}%</span>
                  </div>
                  <input
                    type="range"
                    value={lengthWeights.medium}
                    onChange={(e) => updateWeight('medium', parseInt(e.target.value))}
                    min={0}
                    max={100}
                    disabled={lengthOrder.medium < lengthOrder[minLength] || lengthOrder.medium > lengthOrder[maxLength]}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      accentColor: 'var(--primary)',
                      opacity: lengthOrder.medium < lengthOrder[minLength] || lengthOrder.medium > lengthOrder[maxLength] ? 0.3 : 1,
                    }}
                  />
                </div>

                {/* Long */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Длинный</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: '500' }}>{lengthWeights.long}%</span>
                  </div>
                  <input
                    type="range"
                    value={lengthWeights.long}
                    onChange={(e) => updateWeight('long', parseInt(e.target.value))}
                    min={0}
                    max={100}
                    disabled={lengthOrder.long < lengthOrder[minLength] || lengthOrder.long > lengthOrder[maxLength]}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      accentColor: 'var(--primary)',
                      opacity: lengthOrder.long < lengthOrder[minLength] || lengthOrder.long > lengthOrder[maxLength] ? 0.3 : 1,
                    }}
                  />
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                  Суммарный вес: {lengthWeights.short + lengthWeights.medium + lengthWeights.long}% (не обязательно 100%)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            backgroundColor: saveMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: saveMessage.type === 'success' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
            fontSize: '14px',
          }}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          onClick={handleReset}
          disabled={!hasChanges || isSaving}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: hasChanges ? 'var(--foreground)' : 'var(--text-tertiary)',
            fontSize: '14px',
            fontWeight: '500',
            cursor: hasChanges ? 'pointer' : 'not-allowed',
            opacity: hasChanges ? 1 : 0.5,
          }}
        >
          Сбросить
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: hasChanges ? 'var(--primary)' : 'var(--surface-hover)',
            color: hasChanges ? 'white' : 'var(--text-tertiary)',
            fontSize: '14px',
            fontWeight: '500',
            cursor: hasChanges ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {isSaving ? (
            <>
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Сохранение...
            </>
          ) : (
            'Сохранить'
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
