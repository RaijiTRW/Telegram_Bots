'use client';

import { Button } from '@/components/ui';

interface ActionButtonsProps {
  onSave: () => void;
  onRegenerate: () => void;
  onPublish: () => void;
  isSaving: boolean;
  isRegenerating?: boolean;
  status: string;
}

export function ActionButtons({
  onSave,
  onRegenerate,
  onPublish,
  isSaving,
  isRegenerating = false,
  status,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onSave} isLoading={isSaving}>
          Сохранить
        </Button>

        <Button
          variant="ghost"
          onClick={onRegenerate}
          disabled={isSaving || isRegenerating}
          isLoading={isRegenerating}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Пересоздать
        </Button>
      </div>

      {status === 'pending' && (
        <Button variant="primary" onClick={onPublish} disabled={isSaving}>
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Опубликовать
        </Button>
      )}
    </div>
  );
}
