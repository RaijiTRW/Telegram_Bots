-- Migration 009: Post analytics reactions breakdown
-- Добавляет JSONB поле для детализации реакций (эмодзи -> count)

ALTER TABLE post_analytics
ADD COLUMN IF NOT EXISTS reactions_breakdown JSONB;

COMMENT ON COLUMN post_analytics.reactions_breakdown IS 'Детализация реакций: [{"reaction":"👍","count":12}, ...]';

