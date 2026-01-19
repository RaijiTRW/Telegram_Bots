import { HTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', padding = 'md', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          // Базовые стили
          'bg-surface border border-border rounded-2xl',
          'transition-all duration-200',

          // Варианты
          {
            'hover:border-border-hover hover:shadow-lg shadow-sm': variant === 'default',
            'shadow-lg hover:shadow-xl border-border-hover': variant === 'elevated',
          },

          // Padding - современные пропорции
          {
            'p-0': padding === 'none',
            'p-4': padding === 'sm',
            'p-6': padding === 'md',
            'p-8': padding === 'lg',
          },

          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
