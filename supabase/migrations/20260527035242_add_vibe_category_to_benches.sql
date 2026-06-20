/*
  # Add vibe_category column to benches

  ## Summary
  Adds a nullable `vibe_category` text column to the `benches` table.
  This stores the primary emotional/experiential vibe of a bench.

  ## New Column
  - `benches.vibe_category` (text, nullable)
    Allowed values: 'family', 'romantic', 'nature', 'views', 'people-watching', 'quiet'
    NULL means no vibe selected yet.

  ## Notes
  - No existing rows are modified; column defaults to NULL.
  - No RLS changes required — existing bench policies cover this column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'benches' AND column_name = 'vibe_category'
  ) THEN
    ALTER TABLE benches ADD COLUMN vibe_category text DEFAULT NULL;
  END IF;
END $$;
