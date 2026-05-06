-- ============================================================
-- ClimbSmart Database Schema
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- It is safe to re-run: uses IF NOT EXISTS + DROP POLICY IF EXISTS guards
-- ============================================================

-- ── Schema access ─────────────────────────────────────────────────────────────
-- CRITICAL: without these GRANTs the anon/authenticated roles get
-- "permission denied for table ..." even when RLS policies are correct.
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ── Profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  full_name        TEXT,
  height           NUMERIC,
  weight           NUMERIC,
  wingspan         NUMERIC,
  experience_level TEXT DEFAULT 'intermediate',
  home_gym         TEXT,
  climbing_since   INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT  USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE  USING (id = auth.uid());
CREATE POLICY "profiles_delete" ON profiles FOR DELETE  USING (id = auth.uid());

-- ── Goals ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_grade  TEXT NOT NULL,
  target_date   DATE,
  status        TEXT DEFAULT 'active',
  discipline    TEXT DEFAULT 'bouldering',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO authenticated;

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_select" ON goals;
DROP POLICY IF EXISTS "goals_insert" ON goals;
DROP POLICY IF EXISTS "goals_update" ON goals;
DROP POLICY IF EXISTS "goals_delete" ON goals;

CREATE POLICY "goals_select" ON goals FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "goals_insert" ON goals FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "goals_update" ON goals FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "goals_delete" ON goals FOR DELETE  USING (user_id = auth.uid());

-- ── Climbing Sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS climbing_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  duration     INTEGER,
  gym_name     TEXT,
  session_type TEXT DEFAULT 'indoor',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON climbing_sessions TO authenticated;

ALTER TABLE climbing_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cs_select" ON climbing_sessions;
DROP POLICY IF EXISTS "cs_insert" ON climbing_sessions;
DROP POLICY IF EXISTS "cs_update" ON climbing_sessions;
DROP POLICY IF EXISTS "cs_delete" ON climbing_sessions;

CREATE POLICY "cs_select" ON climbing_sessions FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "cs_insert" ON climbing_sessions FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "cs_update" ON climbing_sessions FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "cs_delete" ON climbing_sessions FOR DELETE  USING (user_id = auth.uid());

-- ── Climbing Attempts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS climbing_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES climbing_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade      TEXT NOT NULL,
  attempts   INTEGER DEFAULT 1,
  result     TEXT DEFAULT 'send',
  route_name TEXT,
  style_tag  TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON climbing_attempts TO authenticated;

ALTER TABLE climbing_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ca_select" ON climbing_attempts;
DROP POLICY IF EXISTS "ca_insert" ON climbing_attempts;
DROP POLICY IF EXISTS "ca_update" ON climbing_attempts;
DROP POLICY IF EXISTS "ca_delete" ON climbing_attempts;

CREATE POLICY "ca_select" ON climbing_attempts FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "ca_insert" ON climbing_attempts FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ca_update" ON climbing_attempts FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "ca_delete" ON climbing_attempts FOR DELETE  USING (user_id = auth.uid());

-- ── Strength Sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strength_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  duration   INTEGER,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON strength_sessions TO authenticated;

ALTER TABLE strength_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ss_select" ON strength_sessions;
DROP POLICY IF EXISTS "ss_insert" ON strength_sessions;
DROP POLICY IF EXISTS "ss_update" ON strength_sessions;
DROP POLICY IF EXISTS "ss_delete" ON strength_sessions;

CREATE POLICY "ss_select" ON strength_sessions FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "ss_insert" ON strength_sessions FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ss_update" ON strength_sessions FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "ss_delete" ON strength_sessions FOR DELETE  USING (user_id = auth.uid());

-- ── Strength Entries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strength_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strength_session_id UUID NOT NULL REFERENCES strength_sessions(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_type       TEXT NOT NULL,
  sets                INTEGER,
  reps                INTEGER,
  weight              NUMERIC,
  duration            INTEGER,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON strength_entries TO authenticated;

ALTER TABLE strength_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "se_select" ON strength_entries;
DROP POLICY IF EXISTS "se_insert" ON strength_entries;
DROP POLICY IF EXISTS "se_update" ON strength_entries;
DROP POLICY IF EXISTS "se_delete" ON strength_entries;

CREATE POLICY "se_select" ON strength_entries FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "se_insert" ON strength_entries FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "se_update" ON strength_entries FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "se_delete" ON strength_entries FOR DELETE  USING (user_id = auth.uid());

-- ── Insights ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary        TEXT NOT NULL,
  recommendation TEXT,
  type           TEXT DEFAULT 'focus',
  data           JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON insights TO authenticated;

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insights_select" ON insights;
DROP POLICY IF EXISTS "insights_insert" ON insights;
DROP POLICY IF EXISTS "insights_update" ON insights;
DROP POLICY IF EXISTS "insights_delete" ON insights;

CREATE POLICY "insights_select" ON insights FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "insights_insert" ON insights FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "insights_update" ON insights FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "insights_delete" ON insights FOR DELETE  USING (user_id = auth.uid());

-- ── User Preferences ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme                 TEXT DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  units                 TEXT DEFAULT 'imperial',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO authenticated;

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prefs_select" ON user_preferences;
DROP POLICY IF EXISTS "prefs_insert" ON user_preferences;
DROP POLICY IF EXISTS "prefs_update" ON user_preferences;
DROP POLICY IF EXISTS "prefs_delete" ON user_preferences;

CREATE POLICY "prefs_select" ON user_preferences FOR SELECT  USING (user_id = auth.uid());
CREATE POLICY "prefs_insert" ON user_preferences FOR INSERT  WITH CHECK (user_id = auth.uid());
CREATE POLICY "prefs_update" ON user_preferences FOR UPDATE  USING (user_id = auth.uid());
CREATE POLICY "prefs_delete" ON user_preferences FOR DELETE  USING (user_id = auth.uid());

-- ── Ensure future tables pick up the same privileges automatically ─────────────
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ── Enable Realtime ───────────────────────────────────────────────────────────
-- These will error if already added; that is fine — run them once.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE climbing_sessions;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE strength_sessions;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE insights;
EXCEPTION WHEN others THEN NULL;
END $$;
