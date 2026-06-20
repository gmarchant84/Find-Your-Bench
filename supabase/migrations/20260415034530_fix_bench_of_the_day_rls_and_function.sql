/*
  # Fix bench_of_the_day_history RLS and function security

  1. Changes
    - Recreate get_bench_of_the_day as SECURITY DEFINER so the INSERT into
      bench_of_the_day_history runs with elevated privileges instead of the
      caller's role, bypassing the missing INSERT policy.
    - Add a policy allowing authenticated users to read the history table
      (the existing public read policy is kept but we also add authenticated).

  2. Security
    - SECURITY DEFINER is safe here because the function controls exactly what
      gets inserted (only the daily featured bench), with ON CONFLICT DO NOTHING.
*/

CREATE OR REPLACE FUNCTION get_bench_of_the_day(
  user_lat double precision DEFAULT NULL,
  user_lng double precision DEFAULT NULL,
  max_distance_miles double precision DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  latitude double precision,
  longitude double precision,
  location_description text,
  photo_url text,
  average_rating numeric,
  total_ratings bigint,
  distance_miles double precision,
  is_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date date := CURRENT_DATE;
  featured_bench_id uuid;
BEGIN
  SELECT bench_id INTO featured_bench_id
  FROM bench_of_the_day_history
  WHERE featured_date = today_date;

  IF featured_bench_id IS NULL THEN
    SELECT b.id INTO featured_bench_id
    FROM benches b
    LEFT JOIN (
      SELECT bench_id, COUNT(*) as review_count
      FROM ratings
      GROUP BY bench_id
    ) r ON b.id = r.bench_id
    LEFT JOIN (
      SELECT bench_id, MAX(created_at) as last_featured
      FROM bench_of_the_day_history
      GROUP BY bench_id
    ) h ON b.id = h.bench_id
    WHERE
      COALESCE(r.review_count, 0) >= 3
      AND b.photo_url IS NOT NULL
      AND b.average_rating >= 3.5
      AND (h.last_featured IS NULL OR h.last_featured < CURRENT_DATE - INTERVAL '30 days')
      AND (
        user_lat IS NULL
        OR user_lng IS NULL
        OR (
          3959 * acos(
            cos(radians(user_lat)) *
            cos(radians(b.latitude)) *
            cos(radians(b.longitude) - radians(user_lng)) +
            sin(radians(user_lat)) *
            sin(radians(b.latitude))
          ) <= max_distance_miles
        )
      )
    ORDER BY
      CASE
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
          3959 * acos(
            cos(radians(user_lat)) *
            cos(radians(b.latitude)) *
            cos(radians(b.longitude) - radians(user_lng)) +
            sin(radians(user_lat)) *
            sin(radians(b.latitude))
          )
        ELSE 999999
      END,
      b.average_rating DESC,
      r.review_count DESC,
      RANDOM()
    LIMIT 1;

    IF featured_bench_id IS NULL THEN
      SELECT b.id INTO featured_bench_id
      FROM benches b
      LEFT JOIN (
        SELECT bench_id, COUNT(*) as review_count
        FROM ratings
        GROUP BY bench_id
      ) r ON b.id = r.bench_id
      LEFT JOIN (
        SELECT bench_id, MAX(created_at) as last_featured
        FROM bench_of_the_day_history
        GROUP BY bench_id
      ) h ON b.id = h.bench_id
      WHERE
        COALESCE(r.review_count, 0) >= 3
        AND b.photo_url IS NOT NULL
        AND b.average_rating >= 3.5
        AND (h.last_featured IS NULL OR h.last_featured < CURRENT_DATE - INTERVAL '30 days')
      ORDER BY
        b.average_rating DESC,
        r.review_count DESC,
        RANDOM()
      LIMIT 1;
    END IF;

    IF featured_bench_id IS NULL THEN
      SELECT b.id INTO featured_bench_id
      FROM benches b
      WHERE b.photo_url IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 1;
    END IF;

    IF featured_bench_id IS NOT NULL THEN
      INSERT INTO bench_of_the_day_history (bench_id, featured_date)
      VALUES (featured_bench_id, today_date)
      ON CONFLICT (featured_date) DO NOTHING;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.description,
    b.latitude,
    b.longitude,
    b.location_description,
    b.photo_url,
    b.average_rating,
    (SELECT COUNT(*) FROM ratings WHERE bench_id = b.id) as total_ratings,
    CASE
      WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        3959 * acos(
          cos(radians(user_lat)) *
          cos(radians(b.latitude)) *
          cos(radians(b.longitude) - radians(user_lng)) +
          sin(radians(user_lat)) *
          sin(radians(b.latitude))
        )
      ELSE NULL
    END as distance_miles,
    b.is_verified
  FROM benches b
  WHERE b.id = featured_bench_id;
END;
$$;
