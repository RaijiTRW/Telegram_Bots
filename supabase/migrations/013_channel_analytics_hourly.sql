-- Migration 013: Hourly channel analytics snapshots (for "Today" chart by hours)

CREATE TABLE IF NOT EXISTS channel_analytics_hourly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  hour TIMESTAMP WITH TIME ZONE NOT NULL,
  subscribers_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, hour)
);

CREATE INDEX IF NOT EXISTS idx_channel_analytics_hourly_channel_hour
  ON channel_analytics_hourly(channel_id, hour DESC);

DROP TRIGGER IF EXISTS trigger_channel_analytics_hourly_updated_at ON channel_analytics_hourly;
CREATE TRIGGER trigger_channel_analytics_hourly_updated_at
  BEFORE UPDATE ON channel_analytics_hourly
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_updated_at();

COMMENT ON TABLE channel_analytics_hourly IS 'Почасовые снимки подписчиков каналов для графика за сегодня';
