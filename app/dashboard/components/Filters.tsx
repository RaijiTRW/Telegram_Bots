'use client';

import { Select } from '@/components/ui';

interface FiltersProps {
  channels: Array<{ id: string; name: string }>;
  selectedChannel: string;
  selectedStatus: string;
  sortOrder: 'asc' | 'desc';
  onChannelChange: (channelId: string) => void;
  onStatusChange: (status: string) => void;
  onSortChange: (order: 'asc' | 'desc') => void;
}

export function Filters({
  channels,
  selectedChannel,
  selectedStatus,
  sortOrder,
  onChannelChange,
  onStatusChange,
  onSortChange,
}: FiltersProps) {
  const channelOptions = [
    { value: '', label: 'Все каналы' },
    ...channels.map((ch) => ({ value: ch.id, label: ch.name })),
  ];

  const statusOptions = [
    { value: '', label: 'Все статусы' },
    { value: 'pending', label: 'В ожидании' },
    { value: 'published', label: 'Опубликовано' },
    { value: 'rejected', label: 'Отклонено' },
    { value: 'draft', label: 'Черновик' },
    { value: 'archived', label: 'В архиве' },
  ];

  const sortOptions = [
    { value: 'desc', label: 'Сначала новые' },
    { value: 'asc', label: 'Сначала старые' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
      <Select
        options={channelOptions}
        value={selectedChannel}
        onChange={(e) => onChannelChange(e.target.value)}
        label="Канал"
      />

      <Select
        options={statusOptions}
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        label="Статус"
      />

      <Select
        options={sortOptions}
        value={sortOrder}
        onChange={(e) => onSortChange(e.target.value as 'asc' | 'desc')}
        label="Сортировка"
      />
    </div>
  );
}
