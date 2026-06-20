/*
  # Fix user signup - initialize_user_stats trigger blocked by RLS

  ## Problem
  The `on_auth_user_created_init_stats` trigger calls `initialize_user_stats()` on every
  new signup to insert a row into `user_stats`. The `user_stats` table has RLS enabled
  but only SELECT policies — no INSERT policy. This causes the insert to be blocked,
  which rolls back the entire auth.users insert and returns "database error saving new user".

  ## Fix
  Recreate `initialize_user_stats()` with SECURITY DEFINER so it runs with the
  privileges of the function owner (postgres), bypassing RLS. This is the correct
  pattern for trigger functions that need to write to RLS-protected tables.
*/

CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
