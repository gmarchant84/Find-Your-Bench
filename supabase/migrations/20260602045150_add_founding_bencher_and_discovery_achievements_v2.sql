/*
  # Founding Bencher Badge + Discovery Achievements

  1. Changes
    - Adds `is_founding_bencher` boolean to profiles, grants to first 50 users
    - Expands category check constraint to include 'discovery'
    - Inserts discovery-tier achievement badges into achievement_catalog
*/

-- Add founding bencher flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_founding_bencher'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_founding_bencher boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Grant founding bencher to first 50 users
UPDATE profiles
SET is_founding_bencher = true
WHERE id IN (
  SELECT id FROM profiles ORDER BY created_at ASC LIMIT 50
);

-- Expand category constraint to include 'discovery'
ALTER TABLE achievement_catalog DROP CONSTRAINT IF EXISTS achievement_catalog_category_check;
ALTER TABLE achievement_catalog ADD CONSTRAINT achievement_catalog_category_check
  CHECK (category = ANY (ARRAY['explorer', 'contributor', 'social', 'streak', 'special', 'discovery']));

-- Insert discovery achievements (idempotent)
INSERT INTO achievement_catalog (name, description, icon, category, requirement_type, requirement_value, points_reward, rarity)
SELECT * FROM (VALUES
  ('First Bench',   'Added your first bench to the map',          '🌱', 'discovery', 'benches_added',  1,   50,  'common'),
  ('Explorer',      'Added 10 benches to the map',                '🧭', 'discovery', 'benches_added', 10,  150,  'common'),
  ('Bench Hunter',  'Added 25 benches to the map',                '🪑', 'discovery', 'benches_added', 25,  300,  'rare'),
  ('Trailblazer',   'Added 50 benches to the map',                '🏔', 'discovery', 'benches_added', 50,  600,  'rare'),
  ('Bench Baron',   'Added 100 benches to the map',               '👑', 'discovery', 'benches_added', 100, 1000, 'epic'),
  ('World Bencher', 'Added benches in 5 different cities',        '🌎', 'discovery', 'cities_added',   5,  500,  'epic')
) AS v(name, description, icon, category, requirement_type, requirement_value, points_reward, rarity)
WHERE NOT EXISTS (
  SELECT 1 FROM achievement_catalog ac
  WHERE ac.name = v.name
    AND ac.requirement_type = v.requirement_type
    AND ac.requirement_value = v.requirement_value
);
