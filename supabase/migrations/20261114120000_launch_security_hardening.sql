/*
# Launch security hardening (consolidated)

Source: /home/user/workspace/audit/security.md (P0-1..P0-5 + cheap P1s) and the
Supabase security advisor run on 2026-11-14. Written against the LIVE policy /
function state read from pg_policies + pg_proc on 2026-11-14 (not just the
migration history, which has drifted).

Idempotent: every DROP is IF EXISTS, every function is CREATE OR REPLACE,
constraints/triggers are guarded. Safe to re-run.

Deploy order: (1) apply this migration, (2) IMMEDIATELY deploy the frontend
from branch `launch-security` (it relies on the handle_new_user trigger added
here; the old frontend's signup shows an error after this migration even though
the account + profile are created), (3) deploy the two edited edge functions
(send-welcome-email, get-user-emails) and confirm WEBHOOK_SECRET / ADMIN_SECRET
are set (they now fail closed). Rollback: supabase/rollback/.

Sections
  0. Preflight assertions (abort if data would violate new rules)
  1. profiles: drop email column, server-side profile creation, column grants
  2. benches: authenticated-only insert, hidden-bench RLS filter, protected columns
  3. ratings: overall 1-5 CHECK
  4. bench_photos: own-path rows, no primary hijack, column-limited updates
  5. storage: drop public read on bench-photos, path-scoped uploads, upload rate cap
  6. gamification: user_stats / point_transactions / unlocks become server-owned
  7. name votes: auth required, recount instead of +1/-1
  8. notifications: no spoofed actor/recipient, dedupe, read-only column updates
  9. bench_confirmations: own rows only (location-trail leak)
 10. welcome email trigger: secret from Vault, minimal payload, never blocks signup
 11. account deletion RPC
 12. function hardening (advisor: search_path + anon-executable SECURITY DEFINER)
 13. table privilege cleanup for anon / authenticated
 14. Postflight assertions
*/

-- ============================================================================
-- 0. PREFLIGHT
-- ============================================================================
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.ratings WHERE overall IS NULL OR overall < 1 OR overall > 5;
  IF n > 0 THEN
    RAISE EXCEPTION 'preflight: % ratings have overall outside 1..5; fix data before applying', n;
  END IF;

  SELECT count(*) INTO n FROM public.profiles WHERE is_admin;
  IF n = 0 THEN
    RAISE EXCEPTION 'preflight: no admin profile found; refusing to continue';
  END IF;
END $$;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================

-- 1a. P0-1: emails were world-readable. auth.users.email is the source of truth
--     (verified 45/45 identical on 2026-11-14), so the copy is dropped.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 1b. P0-2: profiles are created server-side only (no client INSERT, so nobody
--     can insert their own row with is_admin = true).
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text := btrim(NEW.raw_user_meta_data ->> 'username');
  v_suffix   text := substr(replace(NEW.id::text, '-', ''), 1, 8);
BEGIN
  -- Same rule the client enforces. Anything else (incl. email-looking names)
  -- falls back to a neutral handle instead of failing the signup.
  IF v_username IS NULL OR v_username !~ '^[A-Za-z0-9_.-]{3,30}$' THEN
    v_username := 'bencher_' || v_suffix;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) THEN
    v_username := left(v_username, 21) || '_' || v_suffix;
  END IF;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, v_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: 2 auth users currently have no profile row (signup half-failed).
INSERT INTO public.profiles (id, username)
SELECT u.id, 'bencher_' || substr(replace(u.id::text, '-', ''), 1, 8)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT DO NOTHING;

-- 1c. Column-level UPDATE: users can only edit their own presentational fields.
--     is_admin, is_founding_bencher, current_streak, last_activity_date,
--     created_at, id become server-owned.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (username, display_name, bio, avatar_url, distance_unit, featured_badge_id)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile excluding admin flag" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 1d. Validate the editable fields when they change (direct API calls only).
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;  -- service_role / postgres / SECURITY DEFINER functions
  END IF;

  IF NEW.username IS DISTINCT FROM OLD.username
     AND NEW.username IS NOT NULL
     AND NEW.username !~ '^[A-Za-z0-9_.-]{3,30}$' THEN
    RAISE EXCEPTION 'Username must be 3-30 characters: letters, numbers, dot, dash or underscore.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.featured_badge_id IS DISTINCT FROM OLD.featured_badge_id
     AND NEW.featured_badge_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_achievement_unlocks u
       WHERE u.user_id = NEW.id AND u.achievement_id = NEW.featured_badge_id
     ) THEN
    RAISE EXCEPTION 'You can only feature a badge you have earned.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     AND NEW.avatar_url IS NOT NULL
     AND NEW.avatar_url !~ ('^avatars/' || NEW.id::text || '\.[A-Za-z0-9]+$') THEN
    RAISE EXCEPTION 'Invalid avatar path.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

-- ============================================================================
-- 2. BENCHES
-- ============================================================================

-- 2a. P0-3: no anonymous inserts; founder must be the caller.
DROP POLICY IF EXISTS "Anyone can create benches" ON public.benches;
DROP POLICY IF EXISTS "Authenticated users can create benches" ON public.benches;
CREATE POLICY "Authenticated users can create benches"
  ON public.benches FOR INSERT TO authenticated
  WITH CHECK (founding_user_id = auth.uid());

-- 2b. P1: hidden benches filtered in the database, not just in BenchMap.tsx.
--     Admins keep "Admins can view all benches including hidden" (unchanged).
--     Founders can still see their own hidden bench.
DROP POLICY IF EXISTS "Anyone can view benches" ON public.benches;
DROP POLICY IF EXISTS "Anyone can view visible benches" ON public.benches;
CREATE POLICY "Anyone can view visible benches"
  ON public.benches FOR SELECT TO anon, authenticated
  USING (is_hidden = false OR founding_user_id = auth.uid());

-- 2c. P0-3 / P1: server-owned columns. Clients (anon/authenticated roles)
--     cannot set trust/moderation fields on insert, and non-admins cannot
--     change them on update. SECURITY DEFINER recalculation functions run as
--     postgres and are unaffected.
CREATE OR REPLACE FUNCTION public.benches_protect_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_uid text := coalesce(auth.uid()::text, '');
  v_new_photo text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(p.is_admin, false) INTO v_is_admin
  FROM public.profiles p WHERE p.id = auth.uid();
  v_is_admin := coalesce(v_is_admin, false);

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'unverified';
    NEW.confirmation_count  := 0;
    NEW.credibility_score   := 0;
    NEW.average_rating      := 0;
    NEW.total_ratings       := 0;
    NEW.flagged_for_removal := false;
    NEW.removal_reports     := 0;
    NEW.is_seed_data        := false;
    NEW.is_seeded           := false;
    NEW.created_at          := now();
    IF NOT v_is_admin THEN
      NEW.is_hidden    := false;
      NEW.duplicate_of := NULL;
    END IF;
    NEW.original_name := coalesce(NEW.original_name, NEW.name);
  ELSE
    -- Recalculated by triggers; nobody edits these by hand via the API.
    NEW.verification_status := OLD.verification_status;
    NEW.confirmation_count  := OLD.confirmation_count;
    NEW.credibility_score   := OLD.credibility_score;
    NEW.average_rating      := OLD.average_rating;
    NEW.total_ratings       := OLD.total_ratings;
    NEW.id                  := OLD.id;
    NEW.created_at          := OLD.created_at;
    IF NOT v_is_admin THEN
      NEW.founding_user_id    := OLD.founding_user_id;
      NEW.original_name       := OLD.original_name;
      NEW.is_hidden           := OLD.is_hidden;
      NEW.duplicate_of        := OLD.duplicate_of;
      NEW.flagged_for_removal := OLD.flagged_for_removal;
      NEW.removal_reports     := OLD.removal_reports;
      NEW.is_seed_data        := OLD.is_seed_data;
      NEW.is_seeded           := OLD.is_seeded;
    END IF;
  END IF;

  -- Photos: any NEWLY added entry must be the caller's own storage path
  -- (userId/...) or a photo already attached to this bench in bench_photos.
  -- Existing legacy URLs are left alone.
  IF NOT v_is_admin AND NEW.photos IS NOT NULL THEN
    FOREACH v_new_photo IN ARRAY NEW.photos LOOP
      IF (TG_OP = 'INSERT' OR OLD.photos IS NULL OR NOT (v_new_photo = ANY (OLD.photos)))
         AND v_new_photo NOT LIKE (v_uid || '/%')
         AND NOT EXISTS (
           SELECT 1 FROM public.bench_photos bp
           WHERE bp.bench_id = NEW.id AND bp.photo_url = v_new_photo
         ) THEN
        RAISE EXCEPTION 'Photos must be uploaded by you.' USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS benches_protect_columns ON public.benches;
CREATE TRIGGER benches_protect_columns
  BEFORE INSERT OR UPDATE ON public.benches
  FOR EACH ROW EXECUTE FUNCTION public.benches_protect_columns();

-- ============================================================================
-- 3. RATINGS (P0-5)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ratings'::regclass AND conname = 'ratings_overall_range'
  ) THEN
    ALTER TABLE public.ratings
      ADD CONSTRAINT ratings_overall_range CHECK (overall >= 1 AND overall <= 5) NOT VALID;
    ALTER TABLE public.ratings VALIDATE CONSTRAINT ratings_overall_range;
  END IF;
END $$;

-- ============================================================================
-- 4. BENCH_PHOTOS (P1)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view photos" ON public.bench_photos;  -- duplicate of "Anyone can view bench photos"

DROP POLICY IF EXISTS "Authenticated users can insert own photos" ON public.bench_photos;
CREATE POLICY "Authenticated users can insert own photos"
  ON public.bench_photos FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND photo_url LIKE (auth.uid()::text || '/%')
    AND coalesce(helpful_count, 0) = 0
    AND (
      coalesce(is_primary, false) = false
      OR NOT EXISTS (
        SELECT 1 FROM public.bench_photos p
        WHERE p.bench_id = bench_photos.bench_id AND p.is_primary
      )
      OR EXISTS (
        SELECT 1 FROM public.benches b
        WHERE b.id = bench_photos.bench_id AND b.founding_user_id = auth.uid()
      )
    )
  );

-- Owners may only edit caption/category (no url swap, no is_primary/helpful_count).
REVOKE UPDATE ON public.bench_photos FROM anon, authenticated;
GRANT UPDATE (caption, category) ON public.bench_photos TO authenticated;

-- ============================================================================
-- 5. STORAGE (P0-4)
-- ============================================================================
-- Bucket is private, but this legacy policy still let anyone read objects via
-- /object/authenticated/... All display goes through get-photo-urls
-- (service role), so no client needs direct read on other users' objects.
DROP POLICY IF EXISTS "Public bench photos are viewable by everyone" ON storage.objects;

DROP POLICY IF EXISTS "Users can read own bench-photos objects" ON storage.objects;
CREATE POLICY "Users can read own bench-photos objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bench-photos' AND owner_id = auth.uid()::text);

-- Uploads limited to the caller's own folder (userId/...) or their own avatar
-- (avatars/<userId>.<ext>, avatars/<userId>_thumb.<ext>), max 60 objects/hour.
DROP POLICY IF EXISTS "Authenticated users can upload to bench-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own bench-photos folder" ON storage.objects;
CREATE POLICY "Users can upload to own bench-photos folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bench-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name ~ ('^avatars/' || auth.uid()::text || '(_thumb)?\.[A-Za-z0-9]+$')
    )
    AND (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'bench-photos'
        AND o.owner_id = auth.uid()::text
        AND o.created_at > now() - interval '1 hour'
    ) < 60
  );

-- Needed for upsert (avatar re-upload, thumbnail overwrite) on own objects only.
DROP POLICY IF EXISTS "Users can update own bench-photos objects" ON storage.objects;
CREATE POLICY "Users can update own bench-photos objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bench-photos' AND owner_id = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'bench-photos'
    AND owner_id = auth.uid()::text
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name ~ ('^avatars/' || auth.uid()::text || '(_thumb)?\.[A-Za-z0-9]+$')
    )
  );
-- "Users can delete own bench photos" (owner = auth.uid()) is kept as-is.

-- ============================================================================
-- 6. GAMIFICATION: server-owned (P1)
-- ============================================================================
-- Clients previously wrote user_stats, point_transactions and
-- user_achievement_unlocks directly (src/lib/gamification.ts). Points and
-- counters are now maintained by triggers; unlocks only by
-- check_and_award_achievements(). Clients keep read access.

DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
REVOKE INSERT, UPDATE, DELETE ON public.user_stats FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can insert their own point transactions" ON public.point_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.point_transactions FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can insert their own achievement unlocks" ON public.user_achievement_unlocks;
REVOKE INSERT, UPDATE, DELETE ON public.user_achievement_unlocks FROM anon, authenticated;
GRANT UPDATE (notified) ON public.user_achievement_unlocks TO authenticated;  -- AchievementNotification.tsx

DROP POLICY IF EXISTS "System can insert achievements" ON public.achievements;  -- legacy table, unused by the app
REVOKE INSERT, UPDATE, DELETE ON public.achievements FROM anon, authenticated;

-- One award per (user, action, reference). Verified 0 duplicates on 2026-11-14.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.point_transactions
    GROUP BY user_id, action_type, reference_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_user_action_ref_key
      ON public.point_transactions (user_id, action_type, reference_id);
  ELSE
    RAISE NOTICE 'point_transactions has duplicates; unique index skipped (awards still dedupe via NOT EXISTS)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_user_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  UPDATE public.user_stats s SET
    benches_added      = (SELECT count(*) FROM public.benches b WHERE b.founding_user_id = p_user_id),
    ratings_given      = (SELECT count(*) FROM public.ratings r WHERE r.user_id = p_user_id),
    photos_uploaded    = (SELECT count(*) FROM public.bench_photos bp WHERE bp.user_id = p_user_id),
    verifications_done = (SELECT count(*) FROM public.bench_confirmations c
                          WHERE c.user_id = p_user_id AND c.confirmation_type IN ('exists', 'sat_here')),
    level              = public.calculate_level(coalesce(s.total_points, 0)),
    next_level_points  = public.calculate_next_level_points(coalesce(s.total_points, 0)),
    current_streak     = coalesce(p.current_streak, s.current_streak, 0),
    longest_streak     = greatest(coalesce(s.longest_streak, 0), coalesce(p.current_streak, 0)),
    last_activity_date = coalesce(p.last_activity_date, s.last_activity_date),
    updated_at         = now()
  FROM public.profiles p
  WHERE s.user_id = p_user_id AND p.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_points_internal(
  p_user_id uuid, p_action text, p_reference text, p_points integer, p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.point_transactions
    WHERE user_id = p_user_id AND action_type = p_action AND reference_id = p_reference
  ) THEN
    INSERT INTO public.point_transactions (user_id, points, action_type, reference_id, description)
    VALUES (p_user_id, p_points, p_action, p_reference, p_description);

    UPDATE public.user_stats
      SET total_points = coalesce(total_points, 0) + p_points, updated_at = now()
      WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Same point values the client used (src/lib/gamification.ts POINTS).
CREATE OR REPLACE FUNCTION public.gamification_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF TG_TABLE_NAME = 'benches' THEN
    v_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.founding_user_id ELSE NEW.founding_user_id END;
    IF TG_OP = 'INSERT' THEN
      PERFORM public.award_points_internal(v_user, 'bench_added', NEW.id::text, 100, 'Added a new bench to the map');
    END IF;
  ELSIF TG_TABLE_NAME = 'ratings' THEN
    v_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    IF TG_OP = 'INSERT' THEN
      PERFORM public.award_points_internal(v_user, 'rating_given', NEW.id::text, 25, 'Rated a bench');
    END IF;
  ELSE  -- bench_photos, bench_confirmations
    v_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  END IF;

  PERFORM public.refresh_user_stats(v_user);
  RETURN NULL;
END;
$$;

-- Names sort after trigger_update_streak_on_* so profiles.current_streak is
-- already updated when refresh_user_stats copies it.
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_bench ON public.benches;
CREATE TRIGGER trigger_update_user_stats_on_bench
  AFTER INSERT OR DELETE ON public.benches
  FOR EACH ROW EXECUTE FUNCTION public.gamification_on_activity();

DROP TRIGGER IF EXISTS trigger_update_user_stats_on_rating ON public.ratings;
CREATE TRIGGER trigger_update_user_stats_on_rating
  AFTER INSERT OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.gamification_on_activity();

DROP TRIGGER IF EXISTS trigger_update_user_stats_on_photo ON public.bench_photos;
CREATE TRIGGER trigger_update_user_stats_on_photo
  AFTER INSERT OR DELETE ON public.bench_photos
  FOR EACH ROW EXECUTE FUNCTION public.gamification_on_activity();

DROP TRIGGER IF EXISTS trigger_update_user_stats_on_confirmation ON public.bench_confirmations;
CREATE TRIGGER trigger_update_user_stats_on_confirmation
  AFTER INSERT OR DELETE ON public.bench_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.gamification_on_activity();

-- check_and_award_achievements: same logic as live, plus
--   * callers can only check themselves (was: any p_user_id, even anon)
--   * fixed search_path (advisor 0011)
--   * level/next_level recomputed after point awards
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id uuid)
RETURNS TABLE(newly_unlocked text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bench_count integer;
  v_review_count integer;
  v_current_streak integer;
  v_achievement RECORD;
  v_unlocked text[];
  v_new_id text;
  v_has_seedling boolean;
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'You can only check your own achievements.' USING ERRCODE = '42501';
  END IF;

  v_unlocked := ARRAY[]::text[];

  SELECT count(*) INTO v_bench_count FROM benches WHERE founding_user_id = p_user_id;
  SELECT count(*) INTO v_review_count FROM ratings WHERE user_id = p_user_id;
  SELECT COALESCE(current_streak, 0) INTO v_current_streak FROM profiles WHERE id = p_user_id;
  IF v_current_streak IS NULL THEN v_current_streak := 0; END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_achievement_unlocks
    WHERE user_id = p_user_id AND achievement_id = 'seedling'
  ) INTO v_has_seedling;

  IF NOT v_has_seedling AND v_bench_count = 0 THEN
    v_new_id := NULL;
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, 'seedling')
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;
    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
    END IF;
  END IF;

  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE (requirement_type = 'benches_added'   AND requirement_value <= v_bench_count AND id <> 'seedling')
       OR (requirement_type = 'reviews_written' AND requirement_value <= v_review_count)
       OR (requirement_type = 'streak_days'     AND requirement_value <= v_current_streak)
    -- 'manual' (the_benchfather) is never auto-awarded
  LOOP
    v_new_id := NULL;
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
      IF v_achievement.points_reward > 0 THEN
        PERFORM public.award_points_internal(
          p_user_id, 'achievement_unlocked', v_achievement.id,
          v_achievement.points_reward, 'Achievement unlocked: ' || v_achievement.name);
      END IF;
    END IF;
  END LOOP;

  PERFORM public.refresh_user_stats(p_user_id);

  RETURN QUERY SELECT v_unlocked;
END;
$$;

-- ============================================================================
-- 7. NAME VOTES (P1)
-- ============================================================================
-- Was: anon-callable SECURITY DEFINER "votes = votes + 1" on any id.
-- Now: signed-in only, and the counter is recomputed from user_votes (which
-- has UNIQUE(name_vote_id, user_id)), so repeated calls change nothing.
CREATE OR REPLACE FUNCTION public.increment_name_vote(vote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to vote.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.name_votes nv
    SET votes = (SELECT count(*) FROM public.user_votes uv WHERE uv.name_vote_id = nv.id)
    WHERE nv.id = vote_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_name_vote(vote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to vote.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.name_votes nv
    SET votes = (SELECT count(*) FROM public.user_votes uv WHERE uv.name_vote_id = nv.id)
    WHERE nv.id = vote_id;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can suggest names" ON public.name_votes;
CREATE POLICY "Authenticated users can suggest names"
  ON public.name_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = suggested_by AND coalesce(votes, 0) = 0);
REVOKE UPDATE, DELETE ON public.name_votes FROM anon, authenticated;

-- ============================================================================
-- 8. NOTIFICATIONS (P1)
-- ============================================================================
-- Was: any signed-in user could insert any notification for anyone with any
-- actor_id. Now: actor must be the caller, recipient must be the bench's
-- founder, and the caller must actually have done the action.
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.bench_notifications;
DROP POLICY IF EXISTS "Users can notify bench founders of their own activity" ON public.bench_notifications;
CREATE POLICY "Users can notify bench founders of their own activity"
  ON public.bench_notifications FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND user_id <> auth.uid()
    AND read = false
    AND EXISTS (
      SELECT 1 FROM public.benches b
      WHERE b.id = bench_notifications.bench_id
        AND b.founding_user_id = bench_notifications.user_id
    )
    AND (
      (type = 'rating' AND EXISTS (SELECT 1 FROM public.ratings r
         WHERE r.bench_id = bench_notifications.bench_id AND r.user_id = auth.uid()))
      OR (type = 'photo' AND EXISTS (SELECT 1 FROM public.bench_photos p
         WHERE p.bench_id = bench_notifications.bench_id AND p.user_id = auth.uid()))
      OR (type = 'confirmation' AND EXISTS (SELECT 1 FROM public.bench_confirmations c
         WHERE c.bench_id = bench_notifications.bench_id AND c.user_id = auth.uid()))
      OR (type = 'visit' AND EXISTS (SELECT 1 FROM public.visited_benches v
         WHERE v.bench_id = bench_notifications.bench_id AND v.user_id = auth.uid()))
    )
  );

-- Recipients may only flip "read".
REVOKE UPDATE ON public.bench_notifications FROM anon, authenticated;
GRANT UPDATE (read) ON public.bench_notifications TO authenticated;
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.bench_notifications;
CREATE POLICY "Users can mark own notifications read"
  ON public.bench_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Silently drop duplicates (same actor/bench/type to same recipient within an
-- hour) so toggling visit/confirm cannot spam a founder.
CREATE OR REPLACE FUNCTION public.bench_notifications_dedupe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  NEW.read := false;
  NEW.created_at := now();
  IF EXISTS (
    SELECT 1 FROM public.bench_notifications n
    WHERE n.user_id = NEW.user_id
      AND n.bench_id = NEW.bench_id
      AND n.actor_id IS NOT DISTINCT FROM NEW.actor_id
      AND n.type = NEW.type
      AND n.created_at > now() - interval '1 hour'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bench_notifications_dedupe ON public.bench_notifications;
CREATE TRIGGER bench_notifications_dedupe
  BEFORE INSERT ON public.bench_notifications
  FOR EACH ROW EXECUTE FUNCTION public.bench_notifications_dedupe();

-- ============================================================================
-- 9. BENCH_CONFIRMATIONS: own rows only (P1 location trail)
-- ============================================================================
-- The app only ever reads the caller's own confirmations; per-bench totals
-- come from benches.confirmation_count / credibility_score.
DROP POLICY IF EXISTS "Anyone can view confirmations" ON public.bench_confirmations;
DROP POLICY IF EXISTS "Users can view own confirmations" ON public.bench_confirmations;
CREATE POLICY "Users can view own confirmations"
  ON public.bench_confirmations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 10. WELCOME EMAIL TRIGGER (P1)
-- ============================================================================
-- Live function had the webhook secret and anon JWT hard-coded in its body and
-- POSTed the entire auth.users row (password hash, tokens) to the function.
-- Now: secret read from Vault, payload is {id, email} only, failures never
-- block signup, and if no secret is configured nothing is sent (fail closed).
--
-- One-time carry-over: if Vault has no 'welcome_webhook_secret' yet, copy the
-- value currently hard-coded in the live function so emails keep working.
-- ROTATE IT afterwards (see rollback/runbook note).
DO $$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'welcome_webhook_secret') THEN
    SELECT substring(
             pg_get_functiondef('public.trigger_welcome_email()'::regprocedure)
             FROM '''x-webhook-secret''\s*,\s*''([A-Za-z0-9]{16,})''')
      INTO v_secret;
    IF v_secret IS NOT NULL THEN
      PERFORM vault.create_secret(v_secret, 'welcome_webhook_secret',
                                  'x-webhook-secret for send-welcome-email');
    ELSE
      RAISE NOTICE 'No welcome_webhook_secret in Vault and none found in old trigger: welcome emails disabled until it is set.';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Vault carry-over skipped: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'welcome_webhook_secret'
    LIMIT 1;

    IF v_secret IS NULL OR v_secret = '' THEN
      RAISE WARNING 'welcome email skipped: vault secret welcome_webhook_secret not set';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := 'https://ubgnmvplrygcszjekeqv.supabase.co/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := jsonb_build_object(
        'type',   'INSERT',
        'table',  'users',
        'schema', 'auth',
        'record', jsonb_build_object('id', NEW.id, 'email', NEW.email)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome email enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 11. ACCOUNT DELETION (P1: App Store 5.1.1(v) / privacy-law expectation)
-- ============================================================================
-- Deleting the auth user cascades to profiles, ratings, confirmations, saved,
-- visited, lists, stats, points, unlocks, votes and notifications (FKs are
-- ON DELETE CASCADE). Benches and bench_photos the user contributed stay on
-- the map, unattributed (founding_user_id / user_id ON DELETE SET NULL).
-- Storage files are NOT removed by this (see report follow-ups).
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND is_admin) THEN
    RAISE EXCEPTION 'Admin accounts cannot be self-deleted. Remove admin first.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- ============================================================================
-- 12. FUNCTION HARDENING (Supabase advisor 0011 / 0028 / 0029)
-- ============================================================================
-- Trigger / internal functions: nobody should call these via /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.auto_update_bench_stats()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_photo_upload_limits()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_user_stats()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_welcome_email()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_bench_average_rating()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_photo_helpful_count()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_streak()                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_bench_lists_updated_at()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_credibility_score(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_bench_verification_status(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.benches_protect_columns()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_user_stats(uuid)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_internal(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gamification_on_activity()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bench_notifications_dedupe()              FROM PUBLIC, anon, authenticated;

-- Signed-in RPCs used by the app.
REVOKE EXECUTE ON FUNCTION public.check_and_award_achievements(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_and_award_achievements(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_name_vote(uuid)          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.increment_name_vote(uuid)          TO authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_name_vote(uuid)          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decrement_name_vote(uuid)          TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_own_account()               FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_own_account()               TO authenticated;

-- find_nearby_benches (AddBenchModal duplicate check, signed-in only):
-- run as caller so hidden benches are not leaked, fixed search_path.
ALTER FUNCTION public.find_nearby_benches(numeric, numeric, numeric) SECURITY INVOKER;
ALTER FUNCTION public.find_nearby_benches(numeric, numeric, numeric) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.find_nearby_benches(numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.find_nearby_benches(numeric, numeric, numeric) TO authenticated;

-- Remaining advisor 0011 (mutable search_path).
ALTER FUNCTION public.update_bench_lists_updated_at()          SET search_path = public;
ALTER FUNCTION public.calculate_level(integer)                 SET search_path = public;
ALTER FUNCTION public.calculate_next_level_points(integer)     SET search_path = public;
ALTER FUNCTION public.check_photo_upload_limits()              SET search_path = public;

-- get_bench_of_the_day stays anon-executable on purpose (public homepage
-- feature; it only returns non-hidden benches). Advisor 0028 will still list it.

-- ============================================================================
-- 13. TABLE PRIVILEGE CLEANUP
-- ============================================================================
-- anon never writes. TRUNCATE is not subject to RLS, so nobody but the owner
-- should hold it.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.achievement_catalog      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bench_of_the_day_history FROM authenticated;

-- ============================================================================
-- 14. POSTFLIGHT
-- ============================================================================
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE is_admin;
  IF n = 0 THEN
    RAISE EXCEPTION 'postflight: admin flag lost';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    RAISE EXCEPTION 'postflight: profiles.email still present';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage'
             AND policyname = 'Public bench photos are viewable by everyone') THEN
    RAISE EXCEPTION 'postflight: public storage read policy still present';
  END IF;

  IF has_function_privilege('anon', 'public.increment_name_vote(uuid)', 'execute') THEN
    RAISE EXCEPTION 'postflight: anon can still execute increment_name_vote';
  END IF;

  IF has_table_privilege('authenticated', 'public.user_stats', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.point_transactions', 'INSERT')
     OR has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE') THEN
    RAISE EXCEPTION 'postflight: client can still write server-owned gamification/admin columns';
  END IF;
END $$;
