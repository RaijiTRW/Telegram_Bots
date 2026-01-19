'use client';

export default function NoSourcesWarning() {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.2)',
        fontSize: '13px',
        color: '#fbbf24',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <svg
        style={{ width: '16px', height: '16px', flexShrink: 0 }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>Подключите сайт или Telegram канал для поиска</span>
    </div>
  );
}
