/*
  # Add Bench Lists Feature

  1. New Tables
    - `bench_lists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - list name
      - `emoji` (text) - emoji icon for the list
      - `description` (text, nullable) - optional description
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `list_benches`
      - `id` (uuid, primary key)
      - `list_id` (uuid, references bench_lists)
      - `bench_id` (uuid, references benches)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)
      - Unique constraint on (list_id, bench_id)

  2. Security
    - Enable RLS on both tables
    - Users can only manage their own lists
    - Users can only add benches to their own lists

  3. Indexes
    - Index on list_benches.list_id for fast lookups
    - Index on list_benches.bench_id for reverse lookups
*/

-- Create bench_lists table
CREATE TABLE IF NOT EXISTS bench_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  emoji text DEFAULT '📍',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create list_benches junction table
CREATE TABLE IF NOT EXISTS list_benches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES bench_lists(id) ON DELETE CASCADE NOT NULL,
  bench_id uuid REFERENCES benches(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(list_id, bench_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bench_lists_user_id ON bench_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_benches_list_id ON list_benches(list_id);
CREATE INDEX IF NOT EXISTS idx_list_benches_bench_id ON list_benches(bench_id);
CREATE INDEX IF NOT EXISTS idx_list_benches_user_id ON list_benches(user_id);

-- Enable RLS
ALTER TABLE bench_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_benches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bench_lists
CREATE POLICY "Users can view own lists"
  ON bench_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lists"
  ON bench_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists"
  ON bench_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
  ON bench_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for list_benches
CREATE POLICY "Users can view own list benches"
  ON list_benches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add benches to own lists"
  ON list_benches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own list benches"
  ON list_benches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove benches from own lists"
  ON list_benches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bench_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_bench_lists_updated_at_trigger ON bench_lists;
CREATE TRIGGER update_bench_lists_updated_at_trigger
  BEFORE UPDATE ON bench_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_bench_lists_updated_at();
