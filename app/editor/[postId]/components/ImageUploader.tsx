'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface PostImage {
  id: string;
  url: string;
  storage_path?: string;
  alt_text?: string;
  position: number;
  source_type: 'manual' | 'parsed' | 'ai_found' | 'generated';
}

interface ImageUploaderProps {
  postId: string;
  onImagesChange?: (images: PostImage[]) => void;
}

export function ImageUploader({ postId, onImagesChange }: ImageUploaderProps) {
  const [images, setImages] = useState<PostImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Загрузка существующих изображений
  useEffect(() => {
    fetchImages();
  }, [postId]);

  const fetchImages = async () => {
    try {
      const response = await fetch(`/api/posts/${postId}/images`);
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
        onImagesChange?.(data.images || []);
      }
    } catch (err) {
      console.error('Error fetching images:', err);
    }
  };

  const uploadFile = async (file: File): Promise<PostImage | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('postId', postId);

    try {
      // Загрузка в Storage
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        let message = `Ошибка загрузки (${uploadResponse.status})`;
        try {
          const data = await uploadResponse.json();
          message = data?.error || message;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const uploadData = await uploadResponse.json();

      // Сохранение в БД
      const saveResponse = await fetch(`/api/posts/${postId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: uploadData.url,
          storage_path: uploadData.storagePath,
          source_type: 'manual',
          mime_type: uploadData.mimeType,
          file_size: uploadData.fileSize,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Ошибка сохранения изображения');
      }

      const saveData = await saveResponse.json();
      return saveData.image;
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message);
      return null;
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    setIsLoading(true);

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError(`Файл ${file.name} имеет неподдерживаемый формат`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`Файл ${file.name} превышает лимит 10MB`);
        return false;
      }
      return true;
    });

    const newImages: PostImage[] = [];

    for (const file of validFiles) {
      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

      const image = await uploadFile(file);
      if (image) {
        newImages.push(image);
      }

      setUploadProgress(prev => {
        const { [file.name]: _, ...rest } = prev;
        return rest;
      });
    }

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesChange?.(updatedImages);
    }

    setIsLoading(false);
  }, [images, postId, onImagesChange]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Сброс инпута для повторного выбора тех же файлов
    e.target.value = '';
  }, [handleFiles]);

  const handleRemoveImage = async (imageId: string, storagePath?: string) => {
    try {
      // Удаление из БД
      const response = await fetch(`/api/posts/${postId}/images?imageId=${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Ошибка удаления');
      }

      // Удаление из Storage (если есть путь)
      if (storagePath) {
        await fetch(`/api/upload?path=${encodeURIComponent(storagePath)}`, {
          method: 'DELETE',
        });
      }

      const updatedImages = images.filter(img => img.id !== imageId);
      setImages(updatedImages);
      onImagesChange?.(updatedImages);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReorder = async (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;

    const newImages = [...images];
    const [draggedItem] = newImages.splice(dragIndex, 1);
    newImages.splice(dropIndex, 0, draggedItem);

    // Обновляем позиции
    const reorderedImages = newImages.map((img, idx) => ({ ...img, position: idx }));
    setImages(reorderedImages);
    onImagesChange?.(reorderedImages);

    // Сохраняем в БД
    try {
      await fetch(`/api/posts/${postId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: draggedItem.id,
          position: dropIndex,
        }),
      });
    } catch (err) {
      console.error('Reorder error:', err);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  return (
    <div style={{ marginBottom: '24px' }}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--foreground)',
        marginBottom: '12px',
      }}>
        Изображения
        {images.length > 0 && (
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '8px' }}>
            ({images.length})
          </span>
        )}
      </label>

      {/* Зона drag-and-drop */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '24px',
          border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: '12px',
          backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.05)' : 'var(--surface)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'center',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div style={{
          width: '48px',
          height: '48px',
          margin: '0 auto 12px',
          borderRadius: '12px',
          backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.1)' : 'var(--background)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg
            style={{ width: '24px', height: '24px', color: isDragging ? 'var(--primary)' : 'var(--text-secondary)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <p style={{
          fontSize: '14px',
          color: isDragging ? 'var(--primary)' : 'var(--text-secondary)',
          marginBottom: '4px',
        }}>
          {isDragging ? 'Отпустите файлы' : 'Перетащите изображения сюда'}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          или нажмите для выбора • JPEG, PNG, GIF, WebP до 10MB
        </p>
      </div>

      {/* Ошибка */}
      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#ef4444',
            }}
          >
            <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Прогресс загрузки */}
      {Object.keys(uploadProgress).length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {Object.entries(uploadProgress).map(([fileName]) => (
            <div key={fileName} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              marginBottom: '8px',
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Загрузка {fileName}...
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Список изображений */}
      {images.length > 0 && (
        <div style={{
          marginTop: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '12px',
        }}>
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                  handleReorder(draggedIndex, index);
                  setDraggedIndex(index);
                }
              }}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                cursor: 'grab',
                opacity: draggedIndex === index ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <img
                src={image.url}
                alt={image.alt_text || ''}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />

              {/* Бейдж позиции */}
              {index === 0 && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 600,
                }}>
                  Обложка
                </div>
              )}

              {/* Источник */}
              {image.source_type !== 'manual' && (
                <div style={{
                  position: 'absolute',
                  bottom: '6px',
                  left: '6px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  fontSize: '9px',
                }}>
                  {image.source_type === 'parsed' && 'Парсинг'}
                  {image.source_type === 'ai_found' && 'AI'}
                  {image.source_type === 'generated' && 'Сгенер.'}
                </div>
              )}

              {/* Кнопка удаления */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage(image.id, image.storage_path);
                }}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.9)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }}
                className="delete-btn"
              >
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        div:hover .delete-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
