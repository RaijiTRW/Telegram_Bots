'use client';

interface EditingOverlayProps {
  isEditing: boolean;
}

export function EditingOverlay({ isEditing }: EditingOverlayProps) {
  if (!isEditing) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'overlayIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          minWidth: '360px',
          boxShadow: '0 32px 64px rgba(0, 0, 0, 0.3)',
          animation: 'cardIn 0.3s ease-out',
        }}
      >
        {/* AI Icon with animation */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(139, 92, 246, 0.4)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <svg
            style={{ width: '40px', height: '40px', color: 'white' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <h3
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--foreground)',
              marginBottom: '12px',
            }}
          >
            AI в работе
          </h3>
          <p
            style={{
              fontSize: '15px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
            }}
          >
            Обрабатываем ваш запрос с помощью<br />
            искусственного интеллекта...
          </p>
        </div>

        {/* Progress dots */}
        <div style={{
          display: 'flex',
          gap: '8px',
        }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#8b5cf6',
                animation: `bounce 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes overlayIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes cardIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 12px 32px rgba(139, 92, 246, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 16px 40px rgba(139, 92, 246, 0.5);
          }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
