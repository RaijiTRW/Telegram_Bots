-- Store Telegram MTProto sessions per app user
-- This prevents different dashboard accounts from sharing the same Telegram session.

ALTER TABLE telegram_sessions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user_id
  ON telegram_sessions(user_id);

-- Ensure only one active session per user (NULL user_id is treated as "global" and is not restricted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_sessions_active_user
  ON telegram_sessions(user_id)
  WHERE is_active = TRUE;

