-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invite_tokens table
CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  telegram_link TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT,
  content JSONB NOT NULL,
  plain_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'draft')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('telegram', 'website', 'rss')),
  url TEXT NOT NULL,
  last_parsed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX idx_invite_tokens_used ON invite_tokens(used);
CREATE INDEX idx_posts_channel_id ON posts(channel_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_plain_text ON posts USING gin(to_tsvector('russian', plain_text));
CREATE INDEX idx_sources_channel_id ON sources(channel_id);
CREATE INDEX idx_channels_is_active ON channels(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (для начала разрешаем всё аутентифицированным пользователям)
-- Users table policies
CREATE POLICY "Users can view all users" ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Invite tokens policies
CREATE POLICY "Anyone can view unused tokens" ON invite_tokens
  FOR SELECT
  TO anon
  USING (used = FALSE AND expires_at > NOW());

CREATE POLICY "Service role can manage tokens" ON invite_tokens
  FOR ALL
  TO service_role
  USING (true);

-- Channels policies
CREATE POLICY "Authenticated users can view channels" ON channels
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage channels" ON channels
  FOR ALL
  TO authenticated
  USING (true);

-- Posts policies
CREATE POLICY "Authenticated users can view posts" ON posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage posts" ON posts
  FOR ALL
  TO authenticated
  USING (true);

-- Sources policies
CREATE POLICY "Authenticated users can view sources" ON sources
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage sources" ON sources
  FOR ALL
  TO authenticated
  USING (true);
