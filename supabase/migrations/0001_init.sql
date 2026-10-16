-- ============================================================
-- Alpha Planner — initial schema for OPTIONAL cloud sync
--
-- EXPERIMENTAL: sync is not part of the default local-first app.
-- The app only talks to Supabase when both EXPO_PUBLIC_SUPABASE_URL
-- and EXPO_PUBLIC_SUPABASE_KEY are set at build time. The schema
-- and the sync protocol may change without notice before they are
-- declared stable.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste this
-- file into the Supabase SQL editor. See supabase/README.md.
--
-- Security model: every table has Row Level Security enabled and a
-- single policy that restricts rows to their owner
-- ((select auth.uid()) = user_id). Never ship a service_role key
-- in the app; only the anon/publishable key belongs in the client.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ============================================================
-- TABLES
-- ============================================================

-- User profile (1:1 with auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  app_settings JSONB NOT NULL DEFAULT '{}',
  pomodoro_settings JSONB NOT NULL DEFAULT '{}',
  gamification_state JSONB NOT NULL DEFAULT '{}',
  prestige_count INTEGER NOT NULL DEFAULT 0,
  prestige_history JSONB NOT NULL DEFAULT '[]',
  locale TEXT NOT NULL DEFAULT 'tr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Tasks
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  estimated_pomodoros INTEGER,
  pomodoro_sessions INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Subtasks
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Pomodoro sessions
CREATE TABLE pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  phase TEXT NOT NULL CHECK (phase IN ('focus', 'short_break', 'long_break')),
  duration INTEGER NOT NULL,
  target_duration INTEGER NOT NULL,
  was_completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  paused_duration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unlocked achievements
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Daily statistics
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pomodoros_completed INTEGER NOT NULL DEFAULT 0,
  focus_time INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  daily_quests_completed INTEGER NOT NULL DEFAULT 0,
  summary_shown_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Daily quests
CREATE TABLE daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quest_type TEXT NOT NULL,
  quest_params JSONB NOT NULL DEFAULT '{}',
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  xp_reward INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, quest_type)
);

-- Weekly goals
-- Uniqueness per (user, week, goal_type, metric) is enforced by the
-- unique index below: a table-level UNIQUE constraint cannot contain
-- an expression such as goal_params->>'metric'.
CREATE TABLE weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('system', 'personal')),
  goal_params JSONB NOT NULL DEFAULT '{}',
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  xp_reward INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- Postgres does not index foreign keys automatically, so every
-- user_id FK and frequently queried column is indexed. Tables with
-- soft delete use partial indexes (only live rows are indexed).
-- ============================================================

-- profiles: the primary key is enough. No GIN index on
-- gamification_state: the profile is always read by id, never by
-- JSONB key.

-- categories: FK + soft-delete partial index
CREATE INDEX idx_categories_user_id ON categories (user_id) WHERE deleted_at IS NULL;

-- todos: FKs + status / priority / due_date lookups (soft-delete partial)
CREATE INDEX idx_todos_user_id_status ON todos (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_todos_user_id_due_date ON todos (user_id, due_date) WHERE deleted_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX idx_todos_category_id ON todos (category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_todos_user_id_priority ON todos (user_id, priority) WHERE deleted_at IS NULL;

-- subtasks: FKs (soft-delete partial)
CREATE INDEX idx_subtasks_todo_id ON subtasks (todo_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subtasks_user_id ON subtasks (user_id) WHERE deleted_at IS NULL;

-- pomodoro_sessions: FKs + time-based queries
CREATE INDEX idx_pomodoro_sessions_user_id ON pomodoro_sessions (user_id);
CREATE INDEX idx_pomodoro_sessions_user_started ON pomodoro_sessions (user_id, started_at DESC);
CREATE INDEX idx_pomodoro_sessions_todo_id ON pomodoro_sessions (todo_id) WHERE todo_id IS NOT NULL;

-- achievements: FK + achievement_id lookup
CREATE INDEX idx_achievements_user_id ON achievements (user_id);

-- daily_stats: UNIQUE(user_id, date) already creates an index; this
-- one serves newest-first queries
CREATE INDEX idx_daily_stats_user_date_desc ON daily_stats (user_id, date DESC);

-- daily_quests: composite index
CREATE INDEX idx_daily_quests_user_date ON daily_quests (user_id, date DESC);

-- weekly_goals: composite index + expression-based uniqueness
CREATE INDEX idx_weekly_goals_user_week ON weekly_goals (user_id, week_start DESC);
CREATE UNIQUE INDEX uq_weekly_goals_user_week_type_metric
  ON weekly_goals (user_id, week_start, goal_type, (goal_params->>'metric'));

-- ============================================================
-- UPDATED_AT TRIGGERS (moddatetime extension)
-- Keeps updated_at current without relying on the client.
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON daily_stats
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON daily_quests
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON weekly_goals
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Creates a profiles row whenever a user is added to auth.users.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User')
  );
  RETURN NEW;
END;
$$;

-- The function only needs to run as a trigger; it must not be callable by API roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table is locked down to its owner. Wrapping auth.uid() in a
-- sub-select lets Postgres evaluate it once per statement instead of
-- once per row. WITH CHECK covers INSERT/UPDATE, not just reads.
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON profiles
  FOR ALL TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "users_own_data" ON categories
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON todos
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON subtasks
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON pomodoro_sessions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON achievements
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON daily_stats
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON daily_quests
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON weekly_goals
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- OPTIONAL: SOFT DELETE CLEANUP (hard delete after 30 days)
-- Requires the pg_cron extension (enable it in the Supabase
-- dashboard under Database > Extensions), then run:
--
-- SELECT cron.schedule('cleanup-soft-deletes', '0 3 * * *', $$
--   DELETE FROM categories WHERE deleted_at < now() - interval '30 days';
--   DELETE FROM subtasks WHERE deleted_at < now() - interval '30 days';
--   DELETE FROM todos WHERE deleted_at < now() - interval '30 days';
-- $$);
-- ============================================================
