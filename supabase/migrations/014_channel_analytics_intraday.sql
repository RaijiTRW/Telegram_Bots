-- Migration 014: Intraday channel analytics snapshots (for "Today" chart with meaningful changes)

CREATE TABLE IF NOT EXISTS channel_analytics_intraday (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  bucket TIMESTAMP WITH TIME ZONE NOT NULL,
  subscribers_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_channel_analytics_intraday_channel_bucket
  ON channel_analytics_intraday(channel_id, bucket DESC);

DROP TRIGGER IF EXISTS trigger_channel_analytics_intraday_updated_at ON channel_analytics_intraday;
CREATE TRIGGER trigger_channel_analytics_intraday_updated_at
  BEFORE UPDATE ON channel_analytics_intraday
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_updated_at();

COMMENT ON TABLE channel_analytics_intraday IS 'Внутридневные снимки подписчиков (bucketed) для графика за сегодня';
