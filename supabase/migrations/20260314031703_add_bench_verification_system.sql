/*
  # Add Bench Verification and Confirmation System

  1. New Tables
    - `bench_confirmations`
      - `id` (uuid, primary key)
      - `bench_id` (uuid, foreign key to benches)
      - `user_id` (uuid, foreign key to auth.users)
      - `confirmation_type` (text: 'exists', 'sat_here', 'removed')
      - `created_at` (timestamptz)
    
  2. Changes to Existing Tables
    - Add `name` nullable column to benches (was required, now optional)
    - Add `verification_status` column to benches
    - Add `confirmation_count` column to benches
    - Add `credibility_score` column to benches
    - Add `flagged_for_removal` boolean to benches
    - Add `removal_reports` counter to benches

  3. Security
    - Enable RLS on `bench_confirmations` table
    - Add policies for authenticated users to create confirmations
    - Add policies to view all confirmations
    - Add function to calculate verification status
    - Add function to update credibility score

  4. Functions
    - `get_verification_status(bench_id)` - calculates verification status
    - `calculate_credibility_score(bench_id)` - calculates credibility score
    - `check_for_duplicate_benches(lat, lng, radius)` - finds nearby benches
*/

-- Add new columns to benches table
DO $$
BEGIN
  -- Make name nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'benches' AND column_name = 'name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE benches ALTER COLUMN name DROP NOT NULL;
  END IF;

  -- Add verification_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'benches' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE benches ADD COLUMN verification_status text DEFAULT 'unverified';
  END IF;

  -- Add confirmation_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'benches' AND column_name = 'confirmation_count'
  ) THEN
    ALTER TABLE benches ADD COLUMN confirmation_count integer DEFAULT 0;
  END IF;

  -- Add credibility_score column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'benches' AND column_name = 'credibility_score'
  ) THEN
    ALTER TABLE benches ADD COLUMN credibility_score numeric DEFAULT 0;
  END IF;

  -- Add flagged_for_removal column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'benches' AND column_name = 'flagged_for_removal'
  ) THEN
    ALTER TABLE benches ADD COLUMN flagged_for_removal boolean DEFAULT false;
  END IF;

  -- Add removal_reports column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'benches' AND column_name = 'removal_reports'
  ) THEN
    ALTER TABLE benches ADD COLUMN removal_reports integer DEFAULT 0;
  END IF;
END $$;

-- Create bench_confirmations table
CREATE TABLE IF NOT EXISTS bench_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bench_id uuid NOT NULL REFERENCES benches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmation_type text NOT NULL CHECK (confirmation_type IN ('exists', 'sat_here', 'removed')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(bench_id, user_id, confirmation_type)
);

-- Enable RLS on bench_confirmations
ALTER TABLE bench_confirmations ENABLE ROW LEVEL SECURITY;

-- Policies for bench_confirmations
CREATE POLICY "Anyone can view confirmations"
  ON bench_confirmations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add confirmations"
  ON bench_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own confirmations"
  ON bench_confirmations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update verification status
CREATE OR REPLACE FUNCTION update_bench_verification_status(bench_id_param uuid)
RETURNS void AS $$
DECLARE
  confirm_count integer;
  photo_count integer;
  new_status text;
BEGIN
  -- Get confirmation counts
  SELECT COUNT(*) INTO confirm_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param 
    AND confirmation_type IN ('exists', 'sat_here');

  -- Get photo count
  SELECT array_length(photos, 1) INTO photo_count
  FROM benches
  WHERE id = bench_id_param;
  
  IF photo_count IS NULL THEN
    photo_count := 0;
  END IF;

  -- Determine verification status
  IF photo_count > 0 OR confirm_count >= 5 THEN
    new_status := 'verified';
  ELSIF confirm_count >= 3 THEN
    new_status := 'community_confirmed';
  ELSE
    new_status := 'unverified';
  END IF;

  -- Update bench
  UPDATE benches
  SET 
    confirmation_count = confirm_count,
    verification_status = new_status
  WHERE id = bench_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate credibility score
CREATE OR REPLACE FUNCTION calculate_credibility_score(bench_id_param uuid)
RETURNS numeric AS $$
DECLARE
  score numeric := 0;
  confirm_count integer;
  sat_here_count integer;
  photo_count integer;
  removal_count integer;
BEGIN
  -- Get confirmation counts
  SELECT COUNT(*) INTO confirm_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param 
    AND confirmation_type = 'exists';

  SELECT COUNT(*) INTO sat_here_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param 
    AND confirmation_type = 'sat_here';

  SELECT COUNT(*) INTO removal_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param 
    AND confirmation_type = 'removed';

  -- Get photo count
  SELECT array_length(photos, 1) INTO photo_count
  FROM benches
  WHERE id = bench_id_param;
  
  IF photo_count IS NULL THEN
    photo_count := 0;
  END IF;

  -- Calculate score (0-100)
  score := (confirm_count * 10) + (sat_here_count * 5) + (photo_count * 20) - (removal_count * 15);
  
  -- Cap at 100
  IF score > 100 THEN
    score := 100;
  END IF;

  -- Floor at 0
  IF score < 0 THEN
    score := 0;
  END IF;

  -- Update bench
  UPDATE benches
  SET credibility_score = score
  WHERE id = bench_id_param;

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby benches (for duplicate detection)
CREATE OR REPLACE FUNCTION find_nearby_benches(
  lat_param numeric,
  lng_param numeric,
  radius_meters numeric DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  latitude numeric,
  longitude numeric,
  distance_meters numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.latitude,
    b.longitude,
    (
      6371000 * acos(
        cos(radians(lat_param)) * 
        cos(radians(b.latitude)) * 
        cos(radians(b.longitude) - radians(lng_param)) + 
        sin(radians(lat_param)) * 
        sin(radians(b.latitude))
      )
    ) as distance_meters
  FROM benches b
  WHERE (
    6371000 * acos(
      cos(radians(lat_param)) * 
      cos(radians(b.latitude)) * 
      cos(radians(b.longitude) - radians(lng_param)) + 
      sin(radians(lat_param)) * 
      sin(radians(b.latitude))
    )
  ) <= radius_meters
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update verification status and credibility score
CREATE OR REPLACE FUNCTION auto_update_bench_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_bench_verification_status(NEW.bench_id);
  PERFORM calculate_credibility_score(NEW.bench_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bench_confirmation_stats_trigger
AFTER INSERT OR DELETE ON bench_confirmations
FOR EACH ROW
EXECUTE FUNCTION auto_update_bench_stats();
