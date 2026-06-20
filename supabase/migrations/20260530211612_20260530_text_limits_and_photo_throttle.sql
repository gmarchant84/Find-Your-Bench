/*
  # Text Length Constraints and Photo Upload Throttling

  ## Summary
  Enforces server-side character limits on free-text fields and adds a DB-level
  throttle on photo uploads to prevent storage abuse.

  ## Text Length Constraints

  1. benches.description — max 500 characters
  2. benches.name — max 120 characters
  3. ratings.review_text — max 1000 characters
  4. name_votes.suggested_name — max 50 characters
  5. bench_lists.description — max 250 characters (if column exists)
  6. bench_photos.caption — max 200 characters

  ## Photo Upload Throttling (DB layer)

  A function `check_photo_upload_limits` is called via a BEFORE INSERT trigger on
  bench_photos. It raises an exception if the authenticated user has:
    - uploaded more than 10 photos in the last hour, OR
    - uploaded more than 50 photos in the last 24 hours, OR
    - this specific bench already has 5 or more photos from this user
*/

-- ─────────────────────────────────────────────
-- 1. Text length CHECK constraints
-- ─────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'benches' AND constraint_name = 'benches_name_length'
  ) THEN
    ALTER TABLE benches ADD CONSTRAINT benches_name_length CHECK (char_length(name) <= 120);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'benches' AND constraint_name = 'benches_description_length'
  ) THEN
    ALTER TABLE benches ADD CONSTRAINT benches_description_length CHECK (char_length(description) <= 500);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_review_text_length'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_review_text_length CHECK (char_length(review_text) <= 1000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'name_votes' AND constraint_name = 'name_votes_suggested_name_length'
  ) THEN
    ALTER TABLE name_votes ADD CONSTRAINT name_votes_suggested_name_length CHECK (char_length(suggested_name) <= 50);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bench_photos' AND column_name = 'caption'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'bench_photos' AND constraint_name = 'bench_photos_caption_length'
  ) THEN
    ALTER TABLE bench_photos ADD CONSTRAINT bench_photos_caption_length CHECK (caption IS NULL OR char_length(caption) <= 200);
  END IF;
END $$;

-- bench_lists description limit (only if table + column exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bench_lists' AND column_name = 'description'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'bench_lists' AND constraint_name = 'bench_lists_description_length'
  ) THEN
    ALTER TABLE bench_lists ADD CONSTRAINT bench_lists_description_length CHECK (description IS NULL OR char_length(description) <= 250);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 2. Photo upload throttle trigger
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_photo_upload_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uploads_last_hour  integer;
  uploads_last_day   integer;
  uploads_this_bench integer;
BEGIN
  -- Count uploads in the last hour by this user
  SELECT COUNT(*) INTO uploads_last_hour
  FROM bench_photos
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';

  IF uploads_last_hour >= 10 THEN
    RAISE EXCEPTION 'Upload limit reached: maximum 10 photos per hour.';
  END IF;

  -- Count uploads in the last 24 hours
  SELECT COUNT(*) INTO uploads_last_day
  FROM bench_photos
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';

  IF uploads_last_day >= 50 THEN
    RAISE EXCEPTION 'Upload limit reached: maximum 50 photos per day.';
  END IF;

  -- Count photos this user has already uploaded for this bench
  SELECT COUNT(*) INTO uploads_this_bench
  FROM bench_photos
  WHERE user_id = NEW.user_id
    AND bench_id = NEW.bench_id;

  IF uploads_this_bench >= 5 THEN
    RAISE EXCEPTION 'Upload limit reached: maximum 5 photos per bench.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_photo_upload_limits ON bench_photos;

CREATE TRIGGER trg_photo_upload_limits
  BEFORE INSERT ON bench_photos
  FOR EACH ROW
  EXECUTE FUNCTION check_photo_upload_limits();
