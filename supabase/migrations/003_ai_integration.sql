-- Migration 003: AI Integration
-- Добавление полей для AI функциональности в существующие таблицы
-- Создание новых таблиц для хранения спарсенного контента и логов AI

-- ============================================================================
-- 1. Добавление AI полей в таблицу channels
-- ============================================================================

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'stopped' CHECK (ai_status IN ('stopped', 'running', 'error')),
  ADD COLUMN IF NOT EXISTS ai_last_run_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ai_error_message TEXT;

-- Комментарии для полей channels
COMMENT ON COLUMN channels.ai_enabled IS 'Включена ли AI генерация для канала';
COMMENT ON COLUMN channels.ai_status IS 'Статус AI: stopped (остановлен), running (работает), error (ошибка)';
COMMENT ON COLUMN channels.ai_last_run_at IS 'Время последнего запуска AI парсинга';
COMMENT ON COLUMN channels.ai_error_message IS 'Сообщение об ошибке если ai_status = error';

-- ============================================================================
-- 2. Добавление полей для парсинга в таблицу sources
-- ============================================================================

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS last_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS parsing_config JSONB DEFAULT '{}'::jsonb;

-- Комментарии для полей sources
COMMENT ON COLUMN sources.last_content_hash IS 'SHA-256 хеш последнего спарсенного контента для дедупликации';
COMMENT ON COLUMN sources.parsing_config IS 'JSON конфигурация для парсинга (селекторы CSS для сайтов и т.д.)';

-- ============================================================================
-- 3. Добавление AI полей в таблицу posts
-- ============================================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS source_content_ids UUID[],
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_editing BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_content JSONB,
  ADD COLUMN IF NOT EXISTS generation_prompt TEXT;

-- Комментарии для полей posts
COMMENT ON COLUMN posts.source_content_ids IS 'Массив ID из таблицы parsed_content, использованных для генерации поста';
COMMENT ON COLUMN posts.ai_generated IS 'Был ли пост сгенерирован AI (true) или создан вручную (false)';
COMMENT ON COLUMN posts.ai_editing IS 'Находится ли пост в процессе редактирования AI (блокировка UI)';
COMMENT ON COLUMN posts.original_content IS 'Оригинальный контент (Tiptap JSON) до последнего AI редактирования';
COMMENT ON COLUMN posts.generation_prompt IS 'Промпт использованный при генерации поста AI';

-- ============================================================================
-- 4. Создание таблицы parsed_content
-- Хранит спарсенный контент из источников
-- ============================================================================

CREATE TABLE IF NOT EXISTS parsed_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  parsed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_in_posts BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Ограничение: уникальная комбинация source_id + content_hash
  CONSTRAINT unique_source_content UNIQUE (source_id, content_hash)
);

-- Индексы для parsed_content
CREATE INDEX IF NOT EXISTS idx_parsed_content_source_id ON parsed_content(source_id);
CREATE INDEX IF NOT EXISTS idx_parsed_content_hash ON parsed_content(content_hash);
CREATE INDEX IF NOT EXISTS idx_parsed_content_used ON parsed_content(used_in_posts);
CREATE INDEX IF NOT EXISTS idx_parsed_content_parsed_at ON parsed_content(parsed_at DESC);

-- Комментарии для таблицы parsed_content
COMMENT ON TABLE parsed_content IS 'Хранит весь спарсенный контент из источников для генерации постов';
COMMENT ON COLUMN parsed_content.source_id IS 'ID источника из которого был спарсен контент';
COMMENT ON COLUMN parsed_content.content_hash IS 'SHA-256 хеш контента для дедупликации';
COMMENT ON COLUMN parsed_content.title IS 'Заголовок контента (если есть)';
COMMENT ON COLUMN parsed_content.content IS 'Текстовое содержимое (plain text или markdown)';
COMMENT ON COLUMN parsed_content.url IS 'URL оригинального контента (для веб-сайтов и RSS)';
COMMENT ON COLUMN parsed_content.published_at IS 'Дата публикации оригинального контента (если доступна)';
COMMENT ON COLUMN parsed_content.parsed_at IS 'Дата и время парсинга';
COMMENT ON COLUMN parsed_content.used_in_posts IS 'Был ли этот контент уже использован в генерации постов';
COMMENT ON COLUMN parsed_content.metadata IS 'Дополнительные метаданные (автор, теги, и т.д.)';

-- ============================================================================
-- 5. Создание таблицы ai_generation_logs
-- Логирование всех AI операций (генерация, редактирование, пересоздание)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('generate', 'edit', 'regenerate')),
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для ai_generation_logs
CREATE INDEX IF NOT EXISTS idx_ai_logs_channel ON ai_generation_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_post ON ai_generation_logs(post_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_generation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_action_type ON ai_generation_logs(action_type);

-- Комментарии для таблицы ai_generation_logs
COMMENT ON TABLE ai_generation_logs IS 'Логи всех AI операций для мониторинга и аналитики';
COMMENT ON COLUMN ai_generation_logs.channel_id IS 'ID канала (для generate)';
COMMENT ON COLUMN ai_generation_logs.post_id IS 'ID поста (для edit и regenerate)';
COMMENT ON COLUMN ai_generation_logs.action_type IS 'Тип операции: generate, edit, regenerate';
COMMENT ON COLUMN ai_generation_logs.prompt IS 'Промпт отправленный в AI';
COMMENT ON COLUMN ai_generation_logs.model IS 'Модель AI использованная (например, anthropic/claude-sonnet-4.5)';
COMMENT ON COLUMN ai_generation_logs.tokens_used IS 'Количество токенов использованных в запросе';
COMMENT ON COLUMN ai_generation_logs.cost_usd IS 'Стоимость запроса в USD';
COMMENT ON COLUMN ai_generation_logs.success IS 'Успешно ли завершилась операция';
COMMENT ON COLUMN ai_generation_logs.error_message IS 'Сообщение об ошибке если success = false';
COMMENT ON COLUMN ai_generation_logs.created_at IS 'Время выполнения операции';

-- ============================================================================
-- 6. Row Level Security (RLS) для новых таблиц
-- ============================================================================

-- Включить RLS для новых таблиц
ALTER TABLE parsed_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- Политики для parsed_content (доступ только для аутентифицированных)
CREATE POLICY "Authenticated users can view parsed content"
  ON parsed_content FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert parsed content"
  ON parsed_content FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update parsed content"
  ON parsed_content FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete parsed content"
  ON parsed_content FOR DELETE
  TO authenticated
  USING (true);

-- Политики для ai_generation_logs (доступ только для аутентифицированных)
CREATE POLICY "Authenticated users can view AI logs"
  ON ai_generation_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert AI logs"
  ON ai_generation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 7. Функция для очистки старого спарсенного контента
-- Удаляет контент старше 30 дней который не был использован в постах
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_parsed_content()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM parsed_content
  WHERE
    used_in_posts = FALSE
    AND parsed_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_parsed_content IS 'Удаляет неиспользованный контент старше 30 дней';

-- ============================================================================
-- 8. Функция для получения статистики AI по каналу
-- ============================================================================

CREATE OR REPLACE FUNCTION get_channel_ai_stats(channel_uuid UUID)
RETURNS TABLE (
  total_posts_generated INTEGER,
  total_tokens_used BIGINT,
  total_cost_usd DECIMAL,
  last_generation TIMESTAMP WITH TIME ZONE,
  active_sources_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Посчитать AI-генерированные посты
    (SELECT COUNT(*)::INTEGER
     FROM posts
     WHERE channel_id = channel_uuid AND ai_generated = TRUE),

    -- Общее количество токенов
    (SELECT COALESCE(SUM(tokens_used), 0)::BIGINT
     FROM ai_generation_logs
     WHERE ai_generation_logs.channel_id = channel_uuid),

    -- Общая стоимость
    (SELECT COALESCE(SUM(cost_usd), 0)::DECIMAL
     FROM ai_generation_logs
     WHERE ai_generation_logs.channel_id = channel_uuid),

    -- Последняя генерация
    (SELECT MAX(created_at)
     FROM ai_generation_logs
     WHERE ai_generation_logs.channel_id = channel_uuid AND action_type = 'generate'),

    -- Количество активных источников
    (SELECT COUNT(*)::INTEGER
     FROM sources
     WHERE sources.channel_id = channel_uuid AND sources.is_active = TRUE);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_channel_ai_stats IS 'Возвращает статистику AI для конкретного канала';

-- ============================================================================
-- Миграция завершена
-- ============================================================================
