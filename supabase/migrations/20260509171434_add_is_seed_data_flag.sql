/*
  # Add is_seed_data flag to benches

  1. Changes
    - Adds `is_seed_data` boolean column (default false) to `benches` table
    - Backfills `true` for all 10 seeded example benches (identified by founding_user_id IS NULL
      and names matching the original seed set)

  2. Purpose
    - Allows easy filtering or bulk deletion of sample/demo data
    - All future seed inserts should set is_seed_data = true
*/

ALTER TABLE benches
  ADD COLUMN IF NOT EXISTS is_seed_data boolean NOT NULL DEFAULT false;

UPDATE benches
SET is_seed_data = true
WHERE founding_user_id IS NULL
  AND name IN (
    'The Break-Up Bench',
    'The Morning Coffee Bench',
    'The Sandwich Bench',
    'The People-Watching Championship Bench',
    'The Thinking Bench',
    'The Sunset Bench',
    'The Dog-Watching Bench',
    'The "Call your Mom" Bench',
    'The Reading Bench',
    'The Life Decision Bench'
  );
