import { Badge } from '@/components/ui';

interface StatusBadgeProps {
  status: 'pending' | 'published' | 'rejected' | 'draft' | 'archived';
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  pending: {
    label: 'В ожидании',
    variant: 'warning' as const,
  },
  published: {
    label: 'Опубликовано',
    variant: 'success' as const,
  },
  rejected: {
    label: 'Отклонено',
    variant: 'error' as const,
  },
  draft: {
    label: 'Черновик',
    variant: 'default' as const,
  },
  archived: {
    label: 'В архиве',
    variant: 'default' as const,
  },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}
