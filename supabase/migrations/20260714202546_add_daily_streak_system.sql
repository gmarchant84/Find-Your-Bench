/*
# Add Daily Streak System to Profiles

## Summary
Adds a daily activity streak counter directly to the `profiles` table so it is
immediately available wherever profile data is loaded (header, profile modal,
leaderboard, etc.) without an extra join to `user_stats`.

## Changes

### 1. New columns on `profiles`
- `current_streak` (integer, default 0) — the user's current consecutive-day streak.
- `last_activity_date` (date, nullable) — the US/Pacific calendar date of the
  user's last qualifying activity (adding a bench or submitting a rating).

### 2. New function: `update_streak()`
A SECURITY DEFINER trigger function that fires AFTER INSERT on both `ratings`
and `benches`. It determines the acting user (`NEW.user_id` for ratings,
`NEW.founding_user_id` for benches), computes today's date in US/Pacific time,
and applies the streak rules:
- `last_activity_date` = yesterday → increment `current_streak` by 1
- `last_activity_date` = today → no change (already counted)
- `last_activity_date` is older than yesterday or NULL → reset to 1
Then sets `last_activity_date` to today.

### 3. New triggers
- `trigger_update_streak_on_rating` — AFTER INSERT on `ratings`
- `trigger_update_streak_on_bench` — AFTER INSERT on `benches`

## Security
- The function is SECURITY DEFINER (owned by postgres) so it can UPDATE
  `profiles` regardless of the caller's RLS context, matching the pattern
  already used by `update_bench_average_rating()`.
- No new RLS policies are needed — the columns are read through existing
  profile SELECT policies and written only by the trigger function.

## Notes
1. Benches inserted with a NULL `founding_user_id` are skipped (no user to
   attribute the streak to).
2. If a profile row does not exist for the user, the function skips silently
   (profiles are created at sign-up, so this should not happen in practice).
3. The existing `user_stats.current_streak` / `user_stats.last_activity_date`
   columns are NOT touched — they remain maintained by the frontend
   `awardPoints()` gamification flow. The new `profiles` columns are the
   canonical source for streak display.
4. The migration is idempotent: columns use IF NOT EXISTS, the function is
   CREATE OR REPLACE, and triggers are dropped before re-creating.
*/

-- 1. Add streak columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'current_streak'
  ) THEN
    ALTER TABLE profiles ADD COLUMN current_streak integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_activity_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_activity_date date;
  END IF;
END $$;

-- 2. Create the update_streak trigger function
CREATE OR REPLACE FUNCTION public.update_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p_user_id         uuid;
  today_date        date;
  yesterday_date    date;
  v_last_date       date;
  v_current_streak  integer;
BEGIN
  -- Determine which user triggered the activity
  IF TG_TABLE_NAME = 'ratings' THEN
    p_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'benches' THEN
    p_user_id := NEW.founding_user_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Nothing to do if there is no associated user
  IF p_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Today's date in US/Pacific time
  today_date     := (now() AT TIME ZONE 'America/Los_Angeles')::date;
  yesterday_date := today_date - 1;

  -- Fetch current streak state from profiles
  SELECT current_streak, last_activity_date
    INTO v_current_streak, v_last_date
  FROM profiles
  WHERE id = p_user_id;

  -- If the profile row doesn't exist, skip silently
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Streak logic
  IF v_last_date = today_date THEN
    -- Already counted today — do nothing
    RETURN NEW;
  ELSIF v_last_date = yesterday_date THEN
    -- Consecutive day — increment
    v_current_streak := v_current_streak + 1;
  ELSE
    -- Streak broken or first-ever activity — reset to 1
    v_current_streak := 1;
  END IF;

  -- Persist the updated streak
  UPDATE profiles
  SET current_streak      = v_current_streak,
      last_activity_date  = today_date
  WHERE id = p_user_id;

  RETURN NEW;
END;
$$;

-- 3. Create triggers on ratings and benches
DROP TRIGGER IF EXISTS trigger_update_streak_on_rating ON ratings;
CREATE TRIGGER trigger_update_streak_on_rating
  AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_streak();

DROP TRIGGER IF EXISTS trigger_update_streak_on_bench ON benches;
CREATE TRIGGER trigger_update_streak_on_bench
  AFTER INSERT ON benches
  FOR EACH ROW EXECUTE FUNCTION update_streak();
