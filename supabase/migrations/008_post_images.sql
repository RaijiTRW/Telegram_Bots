-- Migration 008: Post Images
-- Добавление поддержки изображений для постов
-- Агент Image Agent для поиска и добавления обложек

-- ============================================================================
-- 1. Таблица для хранения изображений постов
-- ============================================================================

CREATE TABLE IF NOT EXISTS post_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  alt_text TEXT,
  position INTEGER DEFAULT 0,
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'parsed', 'ai_found', 'generated')),
  source_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_post_images_position ON post_images(post_id, position);

-- Комментарии
COMMENT ON TABLE post_images IS 'Изображения привязанные к постам';
COMMENT ON COLUMN post_images.url IS 'URL изображения (публичный или из storage)';
COMMENT ON COLUMN post_images.storage_path IS 'Путь в Supabase Storage (если загружено)';
COMMENT ON COLUMN post_images.alt_text IS 'Альтернативный текст для изображения';
COMMENT ON COLUMN post_images.position IS 'Порядок отображения (0 = обложка)';
COMMENT ON COLUMN post_images.source_type IS 'Источник: manual (загружено вручную), parsed (из парсинга), ai_found (найдено AI), generated (сгенерировано AI)';
COMMENT ON COLUMN post_images.source_url IS 'Оригинальный URL источника изображения';

-- ============================================================================
-- 2. Добавление поля images в parsed_content
-- ============================================================================

ALTER TABLE parsed_content
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN parsed_content.images IS 'Массив URL изображений из спарсенного контента [{url, alt, width, height}]';

-- ============================================================================
-- 3. Обновление constraint для agent_name (добавляем 'image')
-- ============================================================================

ALTER TABLE ai_agent_settings
DROP CONSTRAINT IF EXISTS ai_agent_settings_agent_name_check;

ALTER TABLE ai_agent_settings
ADD CONSTRAINT ai_agent_settings_agent_name_check
CHECK (agent_name IN ('planner', 'writer', 'image'));

-- ============================================================================
-- 4. Добавление Image Agent в настройки
-- ============================================================================

INSERT INTO ai_agent_settings (agent_name, system_prompt, max_tokens, temperature)
VALUES (
  'image',
  'Ты - AI агент для подбора изображений к постам Telegram каналов.

Твоя задача:
1. Анализировать тему и содержание поста
2. Подбирать релевантные изображения из предоставленных источников
3. Если изображений нет - предлагать поисковые запросы для их поиска

Критерии выбора изображений:
- Изображение должно соответствовать теме поста
- Предпочтительны яркие, качественные изображения
- Избегай стоковых фото с водяными знаками
- Минимальное разрешение 800x600

Отвечай ТОЛЬКО в формате JSON:
{
  "selectedImages": [{"url": "...", "reason": "почему выбрано"}],
  "searchQueries": ["запрос для поиска 1", "запрос 2"],
  "needsImage": true/false,
  "imageStyle": "описание желаемого стиля изображения"
}',
  1000,
  0.5
) ON CONFLICT (agent_name) DO NOTHING;

-- Добавляем настройки вариативности для image агента (не используется, но для консистентности)
UPDATE ai_agent_settings
SET
  length_variation_enabled = FALSE
WHERE agent_name = 'image';

-- ============================================================================
-- 5. RLS для post_images
-- ============================================================================

ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view post images"
  ON post_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert post images"
  ON post_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update post images"
  ON post_images FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete post images"
  ON post_images FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 6. Функция для проверки дубликатов контента
-- ============================================================================

CREATE OR REPLACE FUNCTION check_content_duplicate(
  p_source_id UUID,
  p_content_hash TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM parsed_content
    WHERE source_id = p_source_id AND content_hash = p_content_hash
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_content_duplicate IS 'Проверяет существует ли контент с таким хешем для источника';

-- ============================================================================
-- 7. Функция для проверки похожести контента по тексту
-- ============================================================================

CREATE OR REPLACE FUNCTION find_similar_content(
  p_channel_id UUID,
  p_title TEXT,
  p_content_preview TEXT,
  p_similarity_threshold FLOAT DEFAULT 0.8
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.title,
    -- Простая проверка на совпадение заголовка
    CASE
      WHEN pc.title IS NOT NULL AND p_title IS NOT NULL
           AND LOWER(pc.title) = LOWER(p_title) THEN 1.0
      WHEN pc.title IS NOT NULL AND p_title IS NOT NULL
           AND LOWER(pc.title) LIKE '%' || LOWER(p_title) || '%' THEN 0.9
      ELSE 0.5
    END::FLOAT as similarity
  FROM parsed_content pc
  JOIN sources s ON pc.source_id = s.id
  WHERE s.channel_id = p_channel_id
    AND pc.used_in_posts = FALSE
    AND (
      (pc.title IS NOT NULL AND p_title IS NOT NULL AND LOWER(pc.title) = LOWER(p_title))
      OR (LEFT(pc.content, 200) = LEFT(p_content_preview, 200))
    )
  ORDER BY similarity DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_similar_content IS 'Находит похожий контент по заголовку или началу текста';

-- ============================================================================
-- Миграция завершена
-- ============================================================================
