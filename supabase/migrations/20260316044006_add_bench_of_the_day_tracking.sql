/*
  # Bench of the Day Tracking System

  1. New Tables
    - `bench_of_the_day_history`
      - `id` (uuid, primary key)
      - `bench_id` (uuid, foreign key to benches)
      - `featured_date` (date, unique)
      - `created_at` (timestamptz)
  
  2. New Functions
    - `get_bench_of_the_day(user_lat, user_lng)` - Intelligently selects the bench of the day
      - Prioritizes benches within 50 miles of user if location provided
      - Rotates benches so same bench not featured within 30 days
      - Selects from highest rated benches with photos and 3+ reviews
      - Falls back to popular benches if no nearby options
  
  3. Security
    - Enable RLS on `bench_of_the_day_history` table
    - Public read access for featured bench history
    - Only system can insert featured bench records
*/

-- Create bench_of_the_day_history table
CREATE TABLE IF NOT EXISTS bench_of_the_day_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bench_id uuid REFERENCES benches(id) ON DELETE CASCADE NOT NULL,
  featured_date date UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bench_of_the_day_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view bench of the day history"
  ON bench_of_the_day_history FOR SELECT
  TO public
  USING (true);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_bench_of_the_day_featured_date 
  ON bench_of_the_day_history(featured_date DESC);

CREATE INDEX IF NOT EXISTS idx_bench_of_the_day_bench_id 
  ON bench_of_the_day_history(bench_id);

-- Function to get or select bench of the day
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
) AS $$
DECLARE
  today_date date := CURRENT_DATE;
  featured_bench_id uuid;
BEGIN
  -- Check if we already have a bench of the day for today
  SELECT bench_id INTO featured_bench_id
  FROM bench_of_the_day_history
  WHERE featured_date = today_date;

  -- If we don't have one yet, select a new bench
  IF featured_bench_id IS NULL THEN
    -- Select a bench based on criteria
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
      -- Must have at least 3 reviews
      COALESCE(r.review_count, 0) >= 3
      -- Must have a photo
      AND b.photo_url IS NOT NULL
      -- Must have good rating (3.5+)
      AND b.average_rating >= 3.5
      -- Not featured in last 30 days
      AND (h.last_featured IS NULL OR h.last_featured < CURRENT_DATE - INTERVAL '30 days')
      -- If user location provided, prioritize nearby benches
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
      -- Prioritize nearby if location provided
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
      -- Then by rating
      b.average_rating DESC,
      -- Then by review count
      r.review_count DESC,
      -- Random for variety
      RANDOM()
    LIMIT 1;

    -- Fallback: if no nearby benches, get any popular bench
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

    -- If still no bench found, just get any bench with a photo
    IF featured_bench_id IS NULL THEN
      SELECT b.id INTO featured_bench_id
      FROM benches b
      WHERE b.photo_url IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 1;
    END IF;

    -- Record this bench as today's featured bench
    IF featured_bench_id IS NOT NULL THEN
      INSERT INTO bench_of_the_day_history (bench_id, featured_date)
      VALUES (featured_bench_id, today_date)
      ON CONFLICT (featured_date) DO NOTHING;
    END IF;
  END IF;

  -- Return the featured bench with all details
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
$$ LANGUAGE plpgsql;