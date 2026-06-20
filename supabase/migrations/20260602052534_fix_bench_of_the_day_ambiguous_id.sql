/*
  # Fix get_bench_of_the_day ambiguous column reference

  The variable `id` in the RETURNS TABLE conflicts with the column name used in
  the inner SELECT. Rename the internal selection variables to avoid the ambiguity.
*/

DROP FUNCTION IF EXISTS get_bench_of_the_day(double precision, double precision, double precision);

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
  -- Already selected today — return it
  SELECT h.bench_id INTO featured_bench_id
  FROM bench_of_the_day_history h
  WHERE h.featured_date = today_date
  LIMIT 1;

  IF featured_bench_id IS NULL THEN
    -- What ran yesterday?
    SELECT h.bench_id INTO yesterday_bench
    FROM bench_of_the_day_history h
    WHERE h.featured_date = today_date - INTERVAL '1 day'
    LIMIT 1;

    -- Count eligible user benches (not seeded, not hidden)
    SELECT COUNT(*) INTO pool_size
    FROM benches b
    WHERE b.is_seeded = false
      AND b.is_hidden IS NOT TRUE;

    IF pool_size = 0 THEN
      RETURN;
    END IF;

    -- Pick randomly from the 5 most recently added user benches,
    -- excluding yesterday's pick
    SELECT sub.bench_id INTO featured_bench_id
    FROM (
      SELECT b2.id AS bench_id
      FROM benches b2
      WHERE b2.is_seeded = false
        AND b2.is_hidden IS NOT TRUE
      ORDER BY b2.created_at DESC
      LIMIT 5
    ) sub
    WHERE sub.bench_id IS DISTINCT FROM yesterday_bench
    ORDER BY RANDOM()
    LIMIT 1;

    -- Edge case: only 1 bench and it was yesterday — allow repeat
    IF featured_bench_id IS NULL THEN
      SELECT b2.id INTO featured_bench_id
      FROM benches b2
      WHERE b2.is_seeded = false
        AND b2.is_hidden IS NOT TRUE
      ORDER BY b2.created_at DESC
      LIMIT 1;
    END IF;

    IF featured_bench_id IS NULL THEN
      RETURN;
    END IF;

    INSERT INTO bench_of_the_day_history (bench_id, featured_date)
    VALUES (featured_bench_id, today_date)
    ON CONFLICT (featured_date) DO NOTHING;
  END IF;

  -- Return bench + founder info
  RETURN QUERY
    SELECT
      b.id,
      b.name,
      b.description,
      b.latitude::double precision,
      b.longitude::double precision,
      b.photos[1]::text                        AS photo_url,
      COALESCE(b.average_rating, 0)::numeric   AS average_rating,
      COALESCE(b.total_ratings, 0)::bigint      AS total_ratings,
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
      END                                       AS distance_miles,
      (b.verification_status = 'verified')      AS is_verified,
      p.username::text                          AS founder_username,
      COALESCE(p.is_founding_bencher, false)    AS founder_is_founding_bencher
    FROM benches b
    LEFT JOIN profiles p ON p.id = b.founding_user_id
    WHERE b.id = featured_bench_id;
END;
$$;
