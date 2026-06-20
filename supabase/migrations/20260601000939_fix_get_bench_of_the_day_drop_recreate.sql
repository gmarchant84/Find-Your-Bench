/*
  # Fix get_bench_of_the_day function — drop and recreate

  The old function referenced b.photo_url, b.location_description, and b.is_verified
  which don't exist on the benches table. Real columns are:
    - photos (text[]) — use photos[1] as photo_url
    - verification_status (text) — derive is_verified from it
    - no location_description column

  Must DROP first because the return type changed (removed location_description).
*/

DROP FUNCTION IF EXISTS get_bench_of_the_day(float, float, float);

CREATE FUNCTION get_bench_of_the_day(
  user_lat float DEFAULT NULL,
  user_lng float DEFAULT NULL,
  max_distance_miles float DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  latitude numeric,
  longitude numeric,
  photo_url text,
  average_rating numeric,
  total_ratings bigint,
  distance_miles float,
  is_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
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
      FROM ratings GROUP BY bench_id
    ) r ON b.id = r.bench_id
    LEFT JOIN (
      SELECT bench_id, MAX(featured_date) as last_featured
      FROM bench_of_the_day_history GROUP BY bench_id
    ) h ON b.id = h.bench_id
    WHERE
      COALESCE(r.review_count, 0) >= 3
      AND b.photos IS NOT NULL AND array_length(b.photos, 1) > 0
      AND b.average_rating >= 3.5
      AND (h.last_featured IS NULL OR h.last_featured < CURRENT_DATE - INTERVAL '30 days')
      AND b.is_hidden IS NOT TRUE
      AND (
        user_lat IS NULL OR user_lng IS NULL OR
        3959 * acos(
          cos(radians(user_lat)) * cos(radians(b.latitude)) *
          cos(radians(b.longitude) - radians(user_lng)) +
          sin(radians(user_lat)) * sin(radians(b.latitude))
        ) <= max_distance_miles
      )
    ORDER BY
      CASE WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        3959 * acos(
          cos(radians(user_lat)) * cos(radians(b.latitude)) *
          cos(radians(b.longitude) - radians(user_lng)) +
          sin(radians(user_lat)) * sin(radians(b.latitude))
        )
      ELSE 999999 END,
      b.average_rating DESC, r.review_count DESC, RANDOM()
    LIMIT 1;

    IF featured_bench_id IS NULL THEN
      SELECT b.id INTO featured_bench_id
      FROM benches b
      LEFT JOIN (
        SELECT bench_id, COUNT(*) as review_count FROM ratings GROUP BY bench_id
      ) r ON b.id = r.bench_id
      LEFT JOIN (
        SELECT bench_id, MAX(featured_date) as last_featured
        FROM bench_of_the_day_history GROUP BY bench_id
      ) h ON b.id = h.bench_id
      WHERE
        COALESCE(r.review_count, 0) >= 3
        AND b.photos IS NOT NULL AND array_length(b.photos, 1) > 0
        AND b.average_rating >= 3.5
        AND (h.last_featured IS NULL OR h.last_featured < CURRENT_DATE - INTERVAL '30 days')
        AND b.is_hidden IS NOT TRUE
      ORDER BY b.average_rating DESC, r.review_count DESC, RANDOM()
      LIMIT 1;
    END IF;

    IF featured_bench_id IS NULL THEN
      SELECT b.id INTO featured_bench_id
      FROM benches b
      WHERE b.photos IS NOT NULL AND array_length(b.photos, 1) > 0 AND b.is_hidden IS NOT TRUE
      ORDER BY RANDOM() LIMIT 1;
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
    b.photos[1] AS photo_url,
    b.average_rating,
    (SELECT COUNT(*) FROM ratings WHERE bench_id = b.id)::bigint AS total_ratings,
    CASE WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
      3959 * acos(
        cos(radians(user_lat)) * cos(radians(b.latitude)) *
        cos(radians(b.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(b.latitude))
      )
    ELSE NULL END AS distance_miles,
    (b.verification_status = 'verified') AS is_verified
  FROM benches b
  WHERE b.id = featured_bench_id;
END;
$$;
