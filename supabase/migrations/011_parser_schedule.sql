-- Migration 011: Parser schedule settings
-- Stores configurable interval for background parsing

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default: 2 minutes
INSERT INTO app_settings (key, value)
VALUES ('parser_interval_seconds', jsonb_build_object('seconds', 120))
ON CONFLICT (key) DO NOTHING;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_app_settings_updated_at ON app_settings;
CREATE TRIGGER trigger_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();

COMMENT ON TABLE app_settings IS 'Глобальные настройки приложения';
COMMENT ON COLUMN app_settings.key IS 'Ключ настройки';
COMMENT ON COLUMN app_settings.value IS 'JSON значение настройки';

