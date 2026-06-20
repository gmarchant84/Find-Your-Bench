/*
  # Add Saved and Visited Benches Feature

  1. New Tables
    - `saved_benches`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `bench_id` (uuid, references benches)
      - `saved_at` (timestamptz, when the bench was saved)
      - Unique constraint on (user_id, bench_id)
    
    - `visited_benches`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `bench_id` (uuid, references benches)
      - `visited_at` (timestamptz, when the bench was marked as visited)
      - Unique constraint on (user_id, bench_id)

  2. Security
    - Enable RLS on both tables
    - Users can insert their own saved/visited benches
    - Users can view their own saved/visited benches
    - Users can delete their own saved/visited benches
    - All users can view saved/visited counts (for leaderboards)

  3. Indexes
    - Index on user_id for both tables (for fast profile lookups)
    - Index on bench_id for both tables (for fast bench lookups)
*/

-- Create saved_benches table
CREATE TABLE IF NOT EXISTS saved_benches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bench_id uuid NOT NULL REFERENCES benches(id) ON DELETE CASCADE,
  saved_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, bench_id)
);

-- Create visited_benches table
CREATE TABLE IF NOT EXISTS visited_benches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bench_id uuid NOT NULL REFERENCES benches(id) ON DELETE CASCADE,
  visited_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, bench_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS saved_benches_user_id_idx ON saved_benches(user_id);
CREATE INDEX IF NOT EXISTS saved_benches_bench_id_idx ON saved_benches(bench_id);
CREATE INDEX IF NOT EXISTS visited_benches_user_id_idx ON visited_benches(user_id);
CREATE INDEX IF NOT EXISTS visited_benches_bench_id_idx ON visited_benches(bench_id);

-- Enable RLS
ALTER TABLE saved_benches ENABLE ROW LEVEL SECURITY;
ALTER TABLE visited_benches ENABLE ROW LEVEL SECURITY;

-- Policies for saved_benches
CREATE POLICY "Users can view their own saved benches"
  ON saved_benches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved benches"
  ON saved_benches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved benches"
  ON saved_benches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for visited_benches
CREATE POLICY "Users can view their own visited benches"
  ON visited_benches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own visited benches"
  ON visited_benches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visited benches"
  ON visited_benches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);