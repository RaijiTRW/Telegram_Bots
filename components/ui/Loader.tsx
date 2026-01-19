import clsx from 'clsx';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Loader({ size = 'md', className }: LoaderProps) {
  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full border-2 border-primary',
          'border-t-transparent',
          {
            'w-4 h-4': size === 'sm',
            'w-8 h-8': size === 'md',
            'w-12 h-12': size === 'lg',
          }
        )}
      />
    </div>
  );
}
