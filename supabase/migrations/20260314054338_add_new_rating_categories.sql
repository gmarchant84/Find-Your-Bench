/*
  # Add New Rating Categories

  1. Changes to `ratings` table
    - Add `people_watching` column (1-5 stars) for how interesting the surrounding activity is
    - Add `beautiful_views` column (1-5 stars) for scenery, nature, skyline, water
    - Add `accessibility` column (1-5 stars) for ease of reaching the bench
    - Remove old `view` column (renamed to `beautiful_views`)
    - Remove old `quietness` column (renamed to `tranquility`)
    - Add `tranquility` column (1-5 stars) for how peaceful and quiet the spot feels
    - Update `overall` calculation to average all 5 new categories

  2. Notes
    - Existing `comfort` column remains unchanged
    - All new rating columns are required (1-5 stars)
    - Overall rating is auto-calculated as average of all 5 categories
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  -- Add tranquility (replaces quietness)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'tranquility'
  ) THEN
    ALTER TABLE ratings ADD COLUMN tranquility integer;
    ALTER TABLE ratings ADD CONSTRAINT ratings_tranquility_check CHECK (tranquility >= 1 AND tranquility <= 5);
  END IF;

  -- Add people_watching
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'people_watching'
  ) THEN
    ALTER TABLE ratings ADD COLUMN people_watching integer;
    ALTER TABLE ratings ADD CONSTRAINT ratings_people_watching_check CHECK (people_watching >= 1 AND people_watching <= 5);
  END IF;

  -- Add beautiful_views (replaces view)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'beautiful_views'
  ) THEN
    ALTER TABLE ratings ADD COLUMN beautiful_views integer;
    ALTER TABLE ratings ADD CONSTRAINT ratings_beautiful_views_check CHECK (beautiful_views >= 1 AND beautiful_views <= 5);
  END IF;

  -- Add accessibility
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'accessibility'
  ) THEN
    ALTER TABLE ratings ADD COLUMN accessibility integer;
    ALTER TABLE ratings ADD CONSTRAINT ratings_accessibility_check CHECK (accessibility >= 1 AND accessibility <= 5);
  END IF;
END $$;

-- Migrate existing data if old columns exist
DO $$
BEGIN
  -- Copy view to beautiful_views if not already done
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'view'
  ) THEN
    UPDATE ratings SET beautiful_views = view WHERE beautiful_views IS NULL;
  END IF;

  -- Copy quietness to tranquility if not already done
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'quietness'
  ) THEN
    UPDATE ratings SET tranquility = quietness WHERE tranquility IS NULL;
  END IF;
END $$;