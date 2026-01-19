-- Migration 010: Telegram post analytics (channel-native)
-- Хранит статистику сообщений канала напрямую из Telegram (не только посты, созданные в приложении)

CREATE TABLE IF NOT EXISTS telegram_post_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  telegram_message_id BIGINT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  text TEXT,
  views_count INTEGER DEFAULT 0,
  reactions_count INTEGER DEFAULT 0,
  forwards_count INTEGER DEFAULT 0,
  reactions_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_post_analytics_channel_posted_at
  ON telegram_post_analytics(channel_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_tg_post_analytics_channel_views
  ON telegram_post_analytics(channel_id, views_count DESC);

DROP TRIGGER IF EXISTS trigger_telegram_post_analytics_updated_at ON telegram_post_analytics;
CREATE TRIGGER trigger_telegram_post_analytics_updated_at
  BEFORE UPDATE ON telegram_post_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_updated_at();

COMMENT ON TABLE telegram_post_analytics IS 'Статистика постов канала напрямую из Telegram (views/reactions/forwards)';
COMMENT ON COLUMN telegram_post_analytics.reactions_breakdown IS 'Детализация реакций: [{"reaction":"👍","count":12}, ...]';

