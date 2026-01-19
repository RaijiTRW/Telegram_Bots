'use client';

interface AIStatusBadgeProps {
  status: 'stopped' | 'running' | 'error';
}

export default function AIStatusBadge({ status }: AIStatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return {
          bg: 'rgba(34, 197, 94, 0.1)',
          text: '#22c55e',
          label: 'Работает',
        };
      case 'error':
        return {
          bg: 'rgba(239, 68, 68, 0.1)',
          text: '#ef4444',
          label: 'Ошибка',
        };
      case 'stopped':
      default:
        return {
          bg: 'rgba(156, 163, 175, 0.1)',
          text: '#9ca3af',
          label: 'Остановлен',
        };
    }
  };

  const colors = getStatusColor();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: colors.text,
        }}
      />
      {colors.label}
    </span>
  );
}
