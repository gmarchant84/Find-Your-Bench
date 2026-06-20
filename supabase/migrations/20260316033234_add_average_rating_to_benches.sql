/*
  # Add Average Rating to Benches Table

  1. Changes
    - Add `average_rating` column to benches table (decimal, default 0)
    - Add `total_ratings` column to benches table (integer, default 0)
    - Create function to update bench average rating when ratings are added/updated/deleted
    - Create triggers to automatically call the function

  2. Notes
    - The average_rating is calculated from the overall rating in the ratings table
    - total_ratings tracks the number of ratings for display purposes
    - Triggers ensure the values stay in sync automatically
*/

-- Add columns to benches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'benches' AND column_name = 'average_rating'
  ) THEN
    ALTER TABLE benches ADD COLUMN average_rating decimal DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'benches' AND column_name = 'total_ratings'
  ) THEN
    ALTER TABLE benches ADD COLUMN total_ratings integer DEFAULT 0;
  END IF;
END $$;

-- Create function to update bench average rating
CREATE OR REPLACE FUNCTION update_bench_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the bench_id (handle INSERT, UPDATE, DELETE)
  DECLARE
    target_bench_id uuid;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      target_bench_id := OLD.bench_id;
    ELSE
      target_bench_id := NEW.bench_id;
    END IF;

    -- Calculate and update average rating and total count
    UPDATE benches
    SET 
      average_rating = COALESCE((
        SELECT AVG(overall)
        FROM ratings
        WHERE bench_id = target_bench_id
      ), 0),
      total_ratings = COALESCE((
        SELECT COUNT(*)
        FROM ratings
        WHERE bench_id = target_bench_id
      ), 0)
    WHERE id = target_bench_id;

    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT, UPDATE, DELETE on ratings
DROP TRIGGER IF EXISTS trigger_update_bench_rating_insert ON ratings;
CREATE TRIGGER trigger_update_bench_rating_insert
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_bench_average_rating();

DROP TRIGGER IF EXISTS trigger_update_bench_rating_update ON ratings;
CREATE TRIGGER trigger_update_bench_rating_update
  AFTER UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_bench_average_rating();

DROP TRIGGER IF EXISTS trigger_update_bench_rating_delete ON ratings;
CREATE TRIGGER trigger_update_bench_rating_delete
  AFTER DELETE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_bench_average_rating();

-- Initialize average ratings for existing benches
UPDATE benches
SET 
  average_rating = COALESCE((
    SELECT AVG(overall)
    FROM ratings
    WHERE bench_id = benches.id
  ), 0),
  total_ratings = COALESCE((
    SELECT COUNT(*)
    FROM ratings
    WHERE bench_id = benches.id
  ), 0);