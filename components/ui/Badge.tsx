import { HTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'default', size = 'md', className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          // Базовые стили
          'inline-flex items-center justify-center',
          'font-semibold rounded-lg',

          // Варианты
          {
            'bg-success-bg text-success ring-1 ring-success/30':
              variant === 'success',
            'bg-warning-bg text-warning ring-1 ring-warning/30':
              variant === 'warning',
            'bg-error-bg text-error ring-1 ring-error/30':
              variant === 'error',
            'bg-info-bg text-info ring-1 ring-info/30':
              variant === 'info',
            'bg-surface-hover text-text-secondary ring-1 ring-border':
              variant === 'default',
          },

          // Размеры - увеличенные
          {
            'px-2.5 py-1 text-xs': size === 'sm',
            'px-3 py-1.5 text-sm': size === 'md',
            'px-4 py-2 text-base': size === 'lg',
          },

          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
