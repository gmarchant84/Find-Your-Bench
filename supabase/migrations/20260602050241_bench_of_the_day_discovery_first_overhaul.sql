/*
  # Bench of the Day — Discovery-First Overhaul

  ## Summary
  Rewrites the Bench of the Day system to celebrate real user discoveries.

  ## Changes

  ### 1. New Column: benches.is_seeded
  - Adds `is_seeded boolean NOT NULL DEFAULT false` to benches
  - Backfills true for any bench that is already flagged as seed data OR
    has no founding_user_id (admin/import benches that predate the flag)
  - All future user-added benches default to false

  ### 2. Rewrites get_bench_of_the_day()
  - Only considers benches where is_seeded = false
  - Picks from the 5 most-recently added user benches (freshness pool)
  - Falls back to all user benches if fewer than 5 exist
  - Excludes the bench featured on the immediately prior day (no back-to-back)
  - Returns founder_username and founder_is_founding_bencher for attribution
  - Hides entirely (returns no row) when zero user benches exist

  ### 3. Security
  - No RLS changes; existing bench RLS covers the new column
*/

-- ──────────────────────────────────────────────
-- 1. Add is_seeded column
-- ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'benches' AND column_name = 'is_seeded'
  ) THEN
    ALTER TABLE benches ADD COLUMN is_seeded boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Backfill: mark as seeded if the old flag is set OR no real user owns it
UPDATE benches
SET is_seeded = true
WHERE is_seed_data = true
   OR founding_user_id IS NULL;

-- ──────────────────────────────────────────────
-- 2. Rewrite get_bench_of_the_day()
-- ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_bench_of_the_day(double precision, double precision, double precision);
DROP FUNCTION IF EXISTS get_bench_of_the_day(numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION get_bench_of_the_day(
  user_lat double precision DEFAULT NULL,
  user_lng double precision DEFAULT NULL,
  max_distance_miles double precision DEFAULT 50
)
RETURNS TABLE (
  id                          uuid,
  name                        text,
  description                 text,
  latitude                    double precision,
  longitude                   double precision,
  photo_url                   text,
  average_rating              numeric,
  total_ratings               bigint,
  distance_miles              double precision,
  is_verified                 boolean,
  founder_username            text,
  founder_is_founding_bencher boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date        date := CURRENT_DATE;
  yesterday_bench   uuid;
  featured_bench_id uuid;
  pool_size         int;
BEGIN
  -- ── Already selected today? Return it immediately ──────────────────
  SELECT h.bench_id INTO featured_bench_id
  FROM bench_of_the_day_history h
  WHERE h.featured_date = today_date;

  IF featured_bench_id IS NOT NULL THEN
    RETURN QUERY
      SELECT
        b.id,
        b.name,
        b.description,
        b.latitude::double precision,
        b.longitude::double precision,
        b.photos[1]::text,
        COALESCE(b.average_rating, 0)::numeric,
        (SELECT COUNT(*) FROM ratings r WHERE r.bench_id = b.id),
        CASE
          WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
            3959 * acos(
              LEAST(1.0,
                cos(radians(user_lat)) * cos(radians(b.latitude)) *
                cos(radians(b.longitude) - radians(user_lng)) +
                sin(radians(user_lat)) * sin(radians(b.latitude))
              )
            )
          ELSE NULL
        END,
        (b.verification_status = 'verified'),
        p.username::text,
        COALESCE(p.is_founding_bencher, false)
      FROM benches b
      LEFT JOIN profiles p ON p.id = b.founding_user_id
      WHERE b.id = featured_bench_id;
    RETURN;
  END IF;

  -- ── What did we feature yesterday? (avoid back-to-back) ────────────
  SELECT h.bench_id INTO yesterday_bench
  FROM bench_of_the_day_history h
  WHERE h.featured_date = today_date - INTERVAL '1 day';

  -- ── How many eligible user benches exist? ──────────────────────────
  SELECT COUNT(*) INTO pool_size
  FROM benches b
  WHERE b.is_seeded = false
    AND b.is_hidden IS NOT TRUE;

  IF pool_size = 0 THEN
    -- No user benches at all — return nothing
    RETURN;
  END IF;

  -- ── Pick from the 5 most-recently added user benches ───────────────
  -- (fall back to all if fewer than 5 exist)
  SELECT b.id INTO featured_bench_id
  FROM (
    SELECT id
    FROM benches
    WHERE is_seeded = false
      AND is_hidden IS NOT TRUE
    ORDER BY created_at DESC
    LIMIT GREATEST(5, pool_size)
  ) recent
  JOIN benches b ON b.id = recent.id
  WHERE b.id IS DISTINCT FROM yesterday_bench
  ORDER BY RANDOM()
  LIMIT 1;

  -- Edge case: if all 5 are yesterday's bench (pool_size = 1), allow repeat
  IF featured_bench_id IS NULL THEN
    SELECT b.id INTO featured_bench_id
    FROM benches b
    WHERE b.is_seeded = false
      AND b.is_hidden IS NOT TRUE
    ORDER BY b.created_at DESC
    LIMIT 1;
  END IF;

  IF featured_bench_id IS NULL THEN
    RETURN;
  END IF;

  -- ── Record in history ───────────────────────────────────────────────
  INSERT INTO bench_of_the_day_history (bench_id, featured_date)
  VALUES (featured_bench_id, today_date)
  ON CONFLICT (featured_date) DO NOTHING;

  -- ── Return the result ───────────────────────────────────────────────
  RETURN QUERY
    SELECT
      b.id,
      b.name,
      b.description,
      b.latitude::double precision,
      b.longitude::double precision,
      b.photos[1]::text,
      COALESCE(b.average_rating, 0)::numeric,
      (SELECT COUNT(*) FROM ratings r WHERE r.bench_id = b.id),
      CASE
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
          3959 * acos(
            LEAST(1.0,
              cos(radians(user_lat)) * cos(radians(b.latitude)) *
              cos(radians(b.longitude) - radians(user_lng)) +
              sin(radians(user_lat)) * sin(radians(b.latitude))
            )
          )
        ELSE NULL
      END,
      (b.verification_status = 'verified'),
      p.username::text,
      COALESCE(p.is_founding_bencher, false)
    FROM benches b
    LEFT JOIN profiles p ON p.id = b.founding_user_id
    WHERE b.id = featured_bench_id;
END;
$$;
