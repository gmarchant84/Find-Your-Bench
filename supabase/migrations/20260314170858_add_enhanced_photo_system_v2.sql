/*
  # Enhanced Photo System

  ## Overview
  This migration creates a comprehensive photo system inspired by RateYourSeat:
  - Photos stored as separate records (not just arrays)
  - Photo categories (view, bench detail, surroundings, etc.)
  - User attribution for each photo
  - Photo metadata (upload date, caption)
  - Photo voting/helpful system

  ## New Tables
  
  ### `bench_photos`
  Individual photo records for benches:
  - `id` (uuid, PK) - Photo identifier
  - `bench_id` (uuid, FK to benches) - Associated bench
  - `user_id` (uuid, FK to auth.users) - Photo uploader
  - `photo_url` (text) - Photo URL/path
  - `caption` (text) - Optional photo caption
  - `category` (text) - Photo type (view, bench, surroundings, seasonal)
  - `helpful_count` (integer) - Number of helpful votes
  - `is_primary` (boolean) - Whether this is the main bench photo
  - `uploaded_at` (timestamptz) - Upload timestamp
  - `updated_at` (timestamptz) - Last update time

  ### `photo_votes`
  Track helpful votes on photos:
  - `id` (uuid, PK) - Vote identifier
  - `photo_id` (uuid, FK to bench_photos) - Photo being voted on
  - `user_id` (uuid, FK to auth.users) - User voting
  - `created_at` (timestamptz) - Vote timestamp

  ## Security
  - Enable RLS on all tables
  - Anyone can view photos
  - Only authenticated users can upload photos
  - Users can only delete their own photos
  - Only authenticated users can vote on photos
  - One vote per user per photo
*/

-- Create bench_photos table
CREATE TABLE IF NOT EXISTS bench_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bench_id uuid NOT NULL REFERENCES benches(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  photo_url text NOT NULL,
  caption text DEFAULT '',
  category text NOT NULL DEFAULT 'bench' CHECK (category IN ('view', 'bench', 'surroundings', 'seasonal', 'detail')),
  helpful_count integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bench_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photos"
  ON bench_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload photos"
  ON bench_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photos"
  ON bench_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
  ON bench_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create photo_votes table
CREATE TABLE IF NOT EXISTS photo_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES bench_photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(photo_id, user_id)
);

ALTER TABLE photo_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photo votes"
  ON photo_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can vote on photos"
  ON photo_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own photo votes"
  ON photo_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update helpful count when votes change
CREATE OR REPLACE FUNCTION update_photo_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE bench_photos
    SET helpful_count = helpful_count + 1
    WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE bench_photos
    SET helpful_count = helpful_count - 1
    WHERE id = OLD.photo_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update helpful count
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_photo_vote_change'
  ) THEN
    CREATE TRIGGER on_photo_vote_change
      AFTER INSERT OR DELETE ON photo_votes
      FOR EACH ROW
      EXECUTE FUNCTION update_photo_helpful_count();
  END IF;
END $$;

-- Create indexes for faster photo queries
CREATE INDEX IF NOT EXISTS idx_bench_photos_bench_id ON bench_photos(bench_id);
CREATE INDEX IF NOT EXISTS idx_bench_photos_user_id ON bench_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_bench_photos_category ON bench_photos(category);
CREATE INDEX IF NOT EXISTS idx_photo_votes_photo_id ON photo_votes(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_votes_user_id ON photo_votes(user_id);

-- Migrate existing photos from benches.photos array to bench_photos table
INSERT INTO bench_photos (bench_id, user_id, photo_url, category, is_primary)
SELECT 
  b.id as bench_id,
  b.founding_user_id as user_id,
  unnest(b.photos) as photo_url,
  'bench' as category,
  false as is_primary
FROM benches b
WHERE b.photos IS NOT NULL AND array_length(b.photos, 1) > 0
  AND b.founding_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Set the first photo of each bench as primary
UPDATE bench_photos bp
SET is_primary = true
WHERE id IN (
  SELECT DISTINCT ON (bench_id) id
  FROM bench_photos
  ORDER BY bench_id, uploaded_at ASC
);
