'use client';

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'year', label: 'Год' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '4px',
    }}>
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: value === period.value ? 'var(--primary)' : 'transparent',
            color: value === period.value ? 'white' : 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
