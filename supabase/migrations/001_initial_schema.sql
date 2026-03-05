-- TalkTutor MVP Schema
-- Run this in Supabase SQL Editor

-- User preferences (language, level, dialect, daily goal)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL DEFAULT 'Spanish',
  level TEXT NOT NULL DEFAULT 'intermediate',
  dialect TEXT DEFAULT 'Spain (Barcelona)',
  daily_goal_minutes INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Sessions (call logs)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  scenario TEXT,
  transcript JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dictionary entries (words learned)
CREATE TABLE IF NOT EXISTS dictionary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL,
  term TEXT NOT NULL,
  meaning TEXT,
  example TEXT,
  scenario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User progress (per language, per day)
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  seconds_spoken INT DEFAULT 0,
  new_words_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, language, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dictionary_user ON dictionary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_user_date ON dictionary_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_user_date ON user_progress(user_id, date);

-- Row Level Security (RLS) Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own dictionary" ON dictionary_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dictionary" ON dictionary_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dictionary" ON dictionary_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);
