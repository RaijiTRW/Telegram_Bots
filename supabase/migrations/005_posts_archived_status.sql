-- Добавление статуса 'archived' для постов
-- Обновляем CHECK constraint для поля status

-- Удаляем старый constraint
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;

-- Добавляем новый constraint с archived статусом
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('pending', 'published', 'rejected', 'draft', 'archived'));

-- Добавляем индекс для быстрого поиска архивных постов
CREATE INDEX IF NOT EXISTS idx_posts_archived ON posts(status) WHERE status = 'archived';
