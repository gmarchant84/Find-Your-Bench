/*
  # Make Rating Categories Optional

  1. Changes to `ratings` table
    - Make `comfort`, `tranquility`, `people_watching`, `beautiful_views`, and `accessibility` nullable
    - Keep `overall` as required (not null)
    - Update constraints to allow null values while maintaining 1-5 range when values are provided

  2. Notes
    - Users must provide an overall rating
    - Individual category ratings are now optional/recommended
    - When provided, category ratings must still be between 1-5
*/

-- Make rating columns nullable by removing NOT NULL constraints if they exist
DO $$
BEGIN
  -- Make comfort nullable
  ALTER TABLE ratings ALTER COLUMN comfort DROP NOT NULL;
  
  -- Make tranquility nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'tranquility'
  ) THEN
    ALTER TABLE ratings ALTER COLUMN tranquility DROP NOT NULL;
  END IF;

  -- Make people_watching nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'people_watching'
  ) THEN
    ALTER TABLE ratings ALTER COLUMN people_watching DROP NOT NULL;
  END IF;

  -- Make beautiful_views nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'beautiful_views'
  ) THEN
    ALTER TABLE ratings ALTER COLUMN beautiful_views DROP NOT NULL;
  END IF;

  -- Make accessibility nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'accessibility'
  ) THEN
    ALTER TABLE ratings ALTER COLUMN accessibility DROP NOT NULL;
  END IF;
END $$;

-- Update constraints to allow null but enforce 1-5 range when not null
DO $$
BEGIN
  -- Drop old constraints if they exist
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_comfort_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_tranquility_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_people_watching_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_beautiful_views_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_accessibility_check;

  -- Add new constraints that allow null
  ALTER TABLE ratings ADD CONSTRAINT ratings_comfort_check 
    CHECK (comfort IS NULL OR (comfort >= 1 AND comfort <= 5));
  
  ALTER TABLE ratings ADD CONSTRAINT ratings_tranquility_check 
    CHECK (tranquility IS NULL OR (tranquility >= 1 AND tranquility <= 5));
  
  ALTER TABLE ratings ADD CONSTRAINT ratings_people_watching_check 
    CHECK (people_watching IS NULL OR (people_watching >= 1 AND people_watching <= 5));
  
  ALTER TABLE ratings ADD CONSTRAINT ratings_beautiful_views_check 
    CHECK (beautiful_views IS NULL OR (beautiful_views >= 1 AND beautiful_views <= 5));
  
  ALTER TABLE ratings ADD CONSTRAINT ratings_accessibility_check 
    CHECK (accessibility IS NULL OR (accessibility >= 1 AND accessibility <= 5));
END $$;