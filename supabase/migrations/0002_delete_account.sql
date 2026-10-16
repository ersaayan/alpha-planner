-- ============================================================
-- Alpha Planner — 0002: self-service account deletion
--
-- Lets a signed-in user permanently delete their own account from the
-- app (Settings → Sync → Delete account), as the App Store and Google
-- Play require for apps that let users create an account.
--
-- Deleting the auth.users row is enough: profiles references auth.users
-- ON DELETE CASCADE, and every user-data table (categories, todos,
-- subtasks, pomodoro_sessions, achievements, daily_stats, daily_quests,
-- weekly_goals) references profiles ON DELETE CASCADE (see 0001_init.sql).
-- Auth sessions and refresh tokens are removed with the user by GoTrue's
-- own foreign keys.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- Empty search_path: every object below is schema-qualified.
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Only ever the caller's own account.
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

COMMENT ON FUNCTION public.delete_account() IS
  'Deletes the calling user''s account; all their rows cascade. Called by the app via rpc(''delete_account'').';

-- Functions are executable by PUBLIC by default. Only signed-in users may call this one.
REVOKE EXECUTE ON FUNCTION public.delete_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
