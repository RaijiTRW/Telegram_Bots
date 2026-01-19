-- Добавление настроек вариативности длины постов
-- Позволяет AI создавать посты разной длины (короткие, средние, длинные)

-- Добавляем новые колонки для настроек длины
ALTER TABLE ai_agent_settings
ADD COLUMN IF NOT EXISTS length_variation_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS min_length TEXT DEFAULT 'short' CHECK (min_length IN ('short', 'medium', 'long')),
ADD COLUMN IF NOT EXISTS max_length TEXT DEFAULT 'long' CHECK (max_length IN ('short', 'medium', 'long')),
ADD COLUMN IF NOT EXISTS length_weights JSONB DEFAULT '{"short": 30, "medium": 50, "long": 20}'::jsonb;

-- Обновляем writer агент с дефолтными настройками вариативности
UPDATE ai_agent_settings
SET
  length_variation_enabled = TRUE,
  min_length = 'short',
  max_length = 'long',
  length_weights = '{"short": 30, "medium": 50, "long": 20}'::jsonb
WHERE agent_name = 'writer';

-- Комментарии к новым колонкам
COMMENT ON COLUMN ai_agent_settings.length_variation_enabled IS 'Включить вариативность длины постов';
COMMENT ON COLUMN ai_agent_settings.min_length IS 'Минимальная длина поста (short/medium/long)';
COMMENT ON COLUMN ai_agent_settings.max_length IS 'Максимальная длина поста (short/medium/long)';
COMMENT ON COLUMN ai_agent_settings.length_weights IS 'Веса для случайного выбора длины: {"short": 30, "medium": 50, "long": 20}';
