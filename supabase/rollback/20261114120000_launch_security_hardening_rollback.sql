/*
# ROLLBACK for 20261114120000_launch_security_hardening.sql

Restores the pre-hardening policies / grants / functions captured read-only
from production on 2026-11-14. NOT a migration: run manually in the SQL editor
only if the hardening must be reverted. It re-opens the audited holes (public
email column, anon bench inserts, client-writable points, etc.).

Deliberately NOT reverted (strictly safer, and compatible with old code):
  - trigger_welcome_email(): keeps the Vault-based version. The old one had
    the webhook secret + anon JWT hardcoded and POSTed the full auth.users row.
  - SET search_path on functions.
  - ratings rows / user_stats values recomputed by the migration (data only).
  - the Vault secret 'welcome_webhook_secret'.
Frontend: revert the launch-security branch BEFORE or together with this
(the old AuthContext inserts profiles.email, which this script restores).
*/

BEGIN;

-- 1. New triggers + functions -----------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
DROP TRIGGER IF EXISTS benches_protect_columns ON public.benches;
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_bench ON public.benches;
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_rating ON public.ratings;
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_photo ON public.bench_photos;
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_confirmation ON public.bench_confirmations;
DROP TRIGGER IF EXISTS bench_notifications_dedupe ON public.bench_notifications;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.profiles_guard();
DROP FUNCTION IF EXISTS public.benches_protect_columns();
DROP FUNCTION IF EXISTS public.gamification_on_activity();
DROP FUNCTION IF EXISTS public.bench_notifications_dedupe();
DROP FUNCTION IF EXISTS public.delete_own_account();
-- check_and_award_achievements is restored below before these are dropped
-- (the new version calls them).

-- 2. Restore old function bodies (captured live) ------------------------------
-- live definition of public.check_and_award_achievements(uuid) captured 2026-11-14
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id uuid)
 RETURNS TABLE(newly_unlocked text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_bench_count integer;
  v_review_count integer;
  v_current_streak integer;
  v_achievement RECORD;
  v_unlocked text[];
  v_new_id text;
  v_has_seedling boolean;
BEGIN
  v_unlocked := ARRAY[]::text[];

  -- Count benches added by user
  SELECT count(*) INTO v_bench_count
  FROM benches
  WHERE founding_user_id = p_user_id;

  -- Count ALL ratings rows for the user (a rating is a review action, with or without text)
  SELECT count(*) INTO v_review_count
  FROM ratings
  WHERE user_id = p_user_id;

  -- Get current streak from profiles
  SELECT COALESCE(current_streak, 0) INTO v_current_streak
  FROM profiles
  WHERE id = p_user_id;

  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
  END IF;

  -- Auto-award Seedling if user has 0 benches and doesn't have it
  SELECT EXISTS (
    SELECT 1 FROM user_achievement_unlocks
    WHERE user_id = p_user_id AND achievement_id = 'seedling'
  ) INTO v_has_seedling;

  IF NOT v_has_seedling AND v_bench_count = 0 THEN
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, 'seedling')
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
    END IF;
  END IF;

  -- Check benches_added achievements (skip seedling, handled above)
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'benches_added'
      AND requirement_value <= v_bench_count
      AND id <> 'seedling'
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
      IF v_achievement.points_reward > 0 THEN
        INSERT INTO point_transactions (user_id, points, action_type, reference_id, description)
        VALUES (p_user_id, v_achievement.points_reward, 'achievement_unlocked', v_achievement.id,
                'Achievement unlocked: ' || v_achievement.name);
        UPDATE user_stats
          SET total_points = total_points + v_achievement.points_reward,
              updated_at = now()
          WHERE user_id = p_user_id;
      END IF;
    END IF;
  END LOOP;

  -- Check reviews_written achievements
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'reviews_written'
      AND requirement_value <= v_review_count
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
      IF v_achievement.points_reward > 0 THEN
        INSERT INTO point_transactions (user_id, points, action_type, reference_id, description)
        VALUES (p_user_id, v_achievement.points_reward, 'achievement_unlocked', v_achievement.id,
                'Achievement unlocked: ' || v_achievement.name);
        UPDATE user_stats
          SET total_points = total_points + v_achievement.points_reward,
              updated_at = now()
          WHERE user_id = p_user_id;
      END IF;
    END IF;
  END LOOP;

  -- Check streak_days achievements (permanent once earned, never revoked)
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'streak_days'
      AND requirement_value <= v_current_streak
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
      IF v_achievement.points_reward > 0 THEN
        INSERT INTO point_transactions (user_id, points, action_type, reference_id, description)
        VALUES (p_user_id, v_achievement.points_reward, 'achievement_unlocked', v_achievement.id,
                'Achievement unlocked: ' || v_achievement.name);
        UPDATE user_stats
          SET total_points = total_points + v_achievement.points_reward,
              updated_at = now()
          WHERE user_id = p_user_id;
      END IF;
    END IF;
  END LOOP;

  -- manual type: skipped, awarded manually only

  RETURN QUERY SELECT v_unlocked;
END;
$function$
;

-- live definition of public.decrement_name_vote(uuid) captured 2026-11-14
CREATE OR REPLACE FUNCTION public.decrement_name_vote(vote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
UPDATE name_votes
SET votes = GREATEST(0, votes - 1)
WHERE id = vote_id;
END;
$function$
;

-- live definition of public.increment_name_vote(uuid) captured 2026-11-14
CREATE OR REPLACE FUNCTION public.increment_name_vote(vote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
UPDATE name_votes
SET votes = votes + 1
WHERE id = vote_id;
END;
$function$
;

DROP FUNCTION IF EXISTS public.award_points_internal(uuid, text, text, integer, text);
DROP FUNCTION IF EXISTS public.refresh_user_stats(uuid);

ALTER FUNCTION public.find_nearby_benches(numeric, numeric, numeric) SECURITY DEFINER;

-- 3. profiles.email (NOT NULL, UNIQUE) backfilled from auth.users -------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
UPDATE public.profiles p SET email = u.email
  FROM auth.users u WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email IS NULL) THEN
    ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;
  ELSE
    RAISE WARNING 'Some profiles have no auth email; email left nullable.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- 4. Constraints / indexes ----------------------------------------------------
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_overall_range;
DROP INDEX IF EXISTS public.point_transactions_user_action_ref_key;

-- 5. Policies: drop new, recreate old (verbatim from pg_policies 2026-11-14) -
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO public WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile excluding admin flag" ON public.profiles;
CREATE POLICY "Users can update own profile excluding admin flag" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK ((auth.uid() = id) AND ((is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()))
              OR ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true)));

DROP POLICY IF EXISTS "Authenticated users can create benches" ON public.benches;
DROP POLICY IF EXISTS "Anyone can create benches" ON public.benches;
CREATE POLICY "Anyone can create benches" ON public.benches
  FOR INSERT TO public WITH CHECK ((founding_user_id IS NULL) OR (auth.uid() = founding_user_id));
DROP POLICY IF EXISTS "Anyone can view visible benches" ON public.benches;
DROP POLICY IF EXISTS "Anyone can view benches" ON public.benches;
CREATE POLICY "Anyone can view benches" ON public.benches
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert own photos" ON public.bench_photos;
CREATE POLICY "Authenticated users can insert own photos" ON public.bench_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can view photos" ON public.bench_photos;
CREATE POLICY "Anyone can view photos" ON public.bench_photos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can read own bench-photos objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own bench-photos folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own bench-photos objects" ON storage.objects;
DROP POLICY IF EXISTS "Public bench photos are viewable by everyone" ON storage.objects;
CREATE POLICY "Public bench photos are viewable by everyone" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'bench-photos');
DROP POLICY IF EXISTS "Authenticated users can upload to bench-photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload to bench-photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bench-photos');

DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
CREATE POLICY "Users can insert their own stats" ON public.user_stats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
CREATE POLICY "Users can update their own stats" ON public.user_stats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own point transactions" ON public.point_transactions;
CREATE POLICY "Users can insert their own point transactions" ON public.point_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own achievement unlocks" ON public.user_achievement_unlocks;
CREATE POLICY "Users can insert their own achievement unlocks" ON public.user_achievement_unlocks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert achievements" ON public.achievements;
CREATE POLICY "System can insert achievements" ON public.achievements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can suggest names" ON public.name_votes;
CREATE POLICY "Authenticated users can suggest names" ON public.name_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = suggested_by);

DROP POLICY IF EXISTS "Users can notify bench founders of their own activity" ON public.bench_notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.bench_notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.bench_notifications
  FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.bench_notifications;
CREATE POLICY "Users can mark own notifications read" ON public.bench_notifications
  FOR UPDATE TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own confirmations" ON public.bench_confirmations;
DROP POLICY IF EXISTS "Anyone can view confirmations" ON public.bench_confirmations;
CREATE POLICY "Anyone can view confirmations" ON public.bench_confirmations
  FOR SELECT TO authenticated USING (true);

-- 6. Grants back to Supabase defaults (table-level ALL incl. column grants) ---
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC, anon, authenticated;

COMMIT;
