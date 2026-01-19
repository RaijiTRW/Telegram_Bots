-- Аналитика для каналов и постов
-- Использует TDLib (User API) для получения статистики

-- Таблица для хранения ежедневной статистики каналов
CREATE TABLE IF NOT EXISTS channel_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  subscribers_count INTEGER DEFAULT 0,
  subscribers_gained INTEGER DEFAULT 0,
  subscribers_lost INTEGER DEFAULT 0,
  views_total INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, date)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_channel_analytics_channel_id ON channel_analytics(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_analytics_date ON channel_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_channel_analytics_channel_date ON channel_analytics(channel_id, date DESC);

-- Таблица для хранения статистики отдельных постов
CREATE TABLE IF NOT EXISTS post_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  telegram_message_id BIGINT,
  views_count INTEGER DEFAULT 0,
  reactions_count INTEGER DEFAULT 0,
  forwards_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id)
);

-- Индексы для post_analytics
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_views ON post_analytics(views_count DESC);

-- Таблица для хранения Telegram сессии (User API)
CREATE TABLE IF NOT EXISTS telegram_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_string TEXT NOT NULL,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Триггер для обновления updated_at в post_analytics
CREATE OR REPLACE FUNCTION update_post_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_post_analytics_updated_at ON post_analytics;
CREATE TRIGGER trigger_post_analytics_updated_at
  BEFORE UPDATE ON post_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_updated_at();

-- Триггер для обновления updated_at в telegram_sessions
DROP TRIGGER IF EXISTS trigger_telegram_sessions_updated_at ON telegram_sessions;
CREATE TRIGGER trigger_telegram_sessions_updated_at
  BEFORE UPDATE ON telegram_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_updated_at();

-- Функция для получения статистики канала за период
CREATE OR REPLACE FUNCTION get_channel_stats(
  p_channel_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_subscribers INTEGER,
  subscribers_gained INTEGER,
  subscribers_lost INTEGER,
  total_views INTEGER,
  total_posts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT ca.subscribers_count
      FROM channel_analytics ca
      WHERE ca.channel_id = p_channel_id
      ORDER BY ca.date DESC
      LIMIT 1
    ), 0) AS total_subscribers,
    COALESCE(SUM(ca.subscribers_gained)::INTEGER, 0) AS subscribers_gained,
    COALESCE(SUM(ca.subscribers_lost)::INTEGER, 0) AS subscribers_lost,
    COALESCE(SUM(ca.views_total)::INTEGER, 0) AS total_views,
    COALESCE(SUM(ca.posts_published)::INTEGER, 0) AS total_posts
  FROM channel_analytics ca
  WHERE ca.channel_id = p_channel_id
    AND ca.date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Комментарии к таблицам
COMMENT ON TABLE channel_analytics IS 'Ежедневная статистика каналов (подписчики, просмотры)';
COMMENT ON TABLE post_analytics IS 'Статистика отдельных постов (просмотры, реакции, репосты)';
COMMENT ON TABLE telegram_sessions IS 'Сессии Telegram User API для получения статистики';
