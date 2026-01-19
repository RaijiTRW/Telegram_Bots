-- Add name and updated_at fields to sources table
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger for updated_at on sources
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update existing sources to have a default name based on URL
UPDATE sources
SET name = CASE
  WHEN type = 'telegram' THEN 'Telegram: ' || url
  WHEN type = 'rss' THEN 'RSS: ' || url
  ELSE 'Website: ' || url
END
WHERE name IS NULL;

-- Make name NOT NULL after updating existing records
ALTER TABLE sources
  ALTER COLUMN name SET NOT NULL;
