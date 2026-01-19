import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          // Базовые стили
          'inline-flex items-center justify-center gap-2',
          'font-semibold rounded-lg',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-95',

          // Варианты
          {
            // Primary - современный стиль
            'bg-primary text-white hover:bg-primary-hover active:bg-primary-dark focus:ring-primary/30 shadow-sm hover:shadow-md':
              variant === 'primary',

            // Secondary - четкие границы
            'bg-surface text-foreground hover:bg-surface-hover border-2 border-border hover:border-border-hover focus:ring-primary/20 shadow-sm':
              variant === 'secondary',

            // Danger - яркий красный
            'bg-error text-white hover:opacity-90 active:opacity-80 focus:ring-error/30 shadow-sm hover:shadow-md':
              variant === 'danger',

            // Ghost - мягкий hover
            'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-foreground focus:ring-primary/20':
              variant === 'ghost',
          },

          // Размеры - увеличенные
          {
            'px-4 py-2.5 text-sm': size === 'sm',
            'px-6 py-3 text-base': size === 'md',
            'px-8 py-4 text-lg': size === 'lg',
          },

          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
