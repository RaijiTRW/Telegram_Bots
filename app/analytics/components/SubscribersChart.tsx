'use client';

type TimelinePoint = {
  date: string;
  subscribers: number;
  gained: number;
  lost: number;
};

interface SubscribersChartProps {
  timeline: TimelinePoint[];
  isLoading?: boolean;
}

export function SubscribersChart({ timeline, isLoading }: SubscribersChartProps) {
  if (isLoading) {
    return (
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px 24px',
      }}>
        <div style={{
          height: '20px',
          width: '180px',
          backgroundColor: 'var(--surface-hover)',
          borderRadius: '4px',
          marginBottom: '12px',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }} />
        <div style={{
          height: '180px',
          width: '100%',
          backgroundColor: 'var(--surface-hover)',
          borderRadius: '12px',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }} />
      </div>
    );
  }

  const points = (timeline || []).filter(p => p && typeof p.date === 'string');
  const last = points.length > 0 ? points[points.length - 1] : null;
  const isHourly = points.some(p => typeof p.date === 'string' && p.date.includes('T'));
  const totals = points.reduce(
    (acc, p) => ({
      gained: acc.gained + Number(p?.gained || 0),
      lost: acc.lost + Number(p?.lost || 0),
    }),
    { gained: 0, lost: 0 }
  );

  if (points.length < 2) {
    return (
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px 24px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--foreground)',
          }}>
            {isHourly ? 'Подписчики по часам' : 'Подписчики по дням'}
          </h3>
          {last && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>+{totals.gained}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--error)' }}>-{totals.lost}</span>
            </div>
          )}
        </div>
        <div style={{
          padding: '24px',
          backgroundColor: 'var(--surface-hover)',
          borderRadius: '12px',
          color: 'var(--text-secondary)',
          fontSize: '14px',
        }}>
          {isHourly
            ? 'Пока мало данных для графика по часам. Нажмите «Синхронизировать» и подождите накопления данных за сегодня.'
            : 'Пока мало данных для графика. Нажмите «Синхронизировать» и подождите накопления дневной статистики.'}
        </div>
      </div>
    );
  }

  const values = points.map(p => Number(p.subscribers || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, Math.round((max - min) * 0.1));
  const yMin = Math.max(0, min - pad);
  const yMax = max + pad;

  const width = 720;
  const height = 180;
  const left = 12;
  const top = 10;
  const right = 12;
  const bottom = 24;

  const plotW = width - left - right;
  const plotH = height - top - bottom;

  const toX = (idx: number) => left + (idx / (points.length - 1)) * plotW;
  const toY = (v: number) => {
    if (yMax === yMin) return top + plotH / 2;
    const t = (v - yMin) / (yMax - yMin);
    return top + (1 - t) * plotH;
  };

  const d = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx).toFixed(2)} ${toY(Number(p.subscribers || 0)).toFixed(2)}`)
    .join(' ');

  const areaD = [
    d,
    `L ${toX(points.length - 1).toFixed(2)} ${(top + plotH).toFixed(2)}`,
    `L ${toX(0).toFixed(2)} ${(top + plotH).toFixed(2)}`,
    'Z',
  ].join(' ');

  const formatLabel = (v: string) => {
    if (!v) return '';
    if (v.includes('T')) {
      const d = new Date(v);
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return v.slice(5);
  };

  const startLabel = formatLabel(points[0]?.date || '');
  const midLabel = formatLabel(points[Math.floor(points.length / 2)]?.date || '');
  const endLabel = formatLabel(points[points.length - 1]?.date || '');

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '20px 24px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--foreground)',
        }}>
          {isHourly ? 'Подписчики по часам' : 'Подписчики по дням'}
        </h3>
        {last && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>+{totals.gained}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--error)' }}>-{totals.lost}</span>
          </div>
        )}
      </div>

      {isHourly && (
        <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          Изменения отображаются по времени следующей синхронизации.
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block' }}
        role="img"
        aria-label={isHourly ? 'График подписчиков по часам' : 'График подписчиков по дням'}
      >
        <defs>
          <linearGradient id="subsArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.25)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0.02)" />
          </linearGradient>
        </defs>

        <path d={areaD} fill="url(#subsArea)" />
        <path d={d} fill="none" stroke="rgb(37, 99, 235)" strokeWidth="2.5" />

        {/* Mark subscriber changes */}
        {points
          .map((p, idx) => ({ p, idx }))
          .filter(({ p, idx }) => idx > 0 && (Number(p.gained || 0) > 0 || Number(p.lost || 0) > 0))
          .slice(0, 50)
          .map(({ p, idx }) => {
            const gained = Number(p.gained || 0);
            const lost = Number(p.lost || 0);
            const color = gained > 0 ? 'var(--success)' : 'var(--error)';
            return (
              <circle
                key={`${p.date}-${idx}`}
                cx={toX(idx)}
                cy={toY(Number(p.subscribers || 0))}
                r="3"
                fill={color}
                opacity="0.9"
              />
            );
          })}

        <circle
          cx={toX(points.length - 1)}
          cy={toY(Number(points[points.length - 1].subscribers || 0))}
          r="4"
          fill="rgb(37, 99, 235)"
        />

        <text x={left} y={height - 8} fontSize="11" style={{ fill: 'var(--text-secondary)' }}>{startLabel}</text>
        <text x={width / 2} y={height - 8} textAnchor="middle" fontSize="11" style={{ fill: 'var(--text-secondary)' }}>{midLabel}</text>
        <text x={width - right} y={height - 8} textAnchor="end" fontSize="11" style={{ fill: 'var(--text-secondary)' }}>{endLabel}</text>

        <text x={left} y={12} fontSize="11" style={{ fill: 'var(--text-secondary)' }}>{yMax}</text>
        <text x={left} y={top + plotH} fontSize="11" style={{ fill: 'var(--text-secondary)' }}>{yMin}</text>
      </svg>
    </div>
  );
}
