/*
  # Find Your Bench - Database Schema
  
  1. New Tables
    - `benches`
      - `id` (uuid, primary key)
      - `name` (text) - current display name
      - `original_name` (text) - name given by founder
      - `latitude` (decimal)
      - `longitude` (decimal)
      - `description` (text)
      - `tags` (text array) - quiet, sunny, shady, scenic, people-watching
      - `founding_user_id` (uuid) - references auth.users
      - `photos` (text array) - URLs to uploaded photos
      - `created_at` (timestamptz)
      
    - `ratings`
      - `id` (uuid, primary key)
      - `bench_id` (uuid) - references benches
      - `user_id` (uuid) - references auth.users
      - `comfort` (integer 1-5)
      - `view` (integer 1-5)
      - `quietness` (integer 1-5)
      - `overall` (decimal) - calculated average
      - `review_text` (text, optional)
      - `created_at` (timestamptz)
      
    - `name_votes`
      - `id` (uuid, primary key)
      - `bench_id` (uuid) - references benches
      - `suggested_name` (text)
      - `suggested_by` (uuid) - references auth.users
      - `votes` (integer) - vote count
      - `created_at` (timestamptz)
      
    - `user_votes`
      - `id` (uuid, primary key)
      - `name_vote_id` (uuid) - references name_votes
      - `user_id` (uuid) - references auth.users
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS on all tables
    - Authenticated users can read all benches
    - Authenticated users can create benches, ratings, and name votes
    - Users can only update/delete their own content
*/

-- Create benches table
CREATE TABLE IF NOT EXISTS benches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_name text NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  description text DEFAULT '',
  tags text[] DEFAULT '{}',
  founding_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  photos text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bench_id uuid REFERENCES benches(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comfort integer CHECK (comfort >= 1 AND comfort <= 5) NOT NULL,
  view integer CHECK (view >= 1 AND view <= 5) NOT NULL,
  quietness integer CHECK (quietness >= 1 AND quietness <= 5) NOT NULL,
  overall decimal DEFAULT 0,
  review_text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(bench_id, user_id)
);

-- Create name_votes table
CREATE TABLE IF NOT EXISTS name_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bench_id uuid REFERENCES benches(id) ON DELETE CASCADE NOT NULL,
  suggested_name text NOT NULL,
  suggested_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  votes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create user_votes table to track individual votes
CREATE TABLE IF NOT EXISTS user_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_vote_id uuid REFERENCES name_votes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name_vote_id, user_id)
);

-- Enable RLS
ALTER TABLE benches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE name_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;

-- Benches policies
CREATE POLICY "Anyone can view benches"
  ON benches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create benches"
  ON benches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = founding_user_id);

CREATE POLICY "Founders can update their benches"
  ON benches FOR UPDATE
  TO authenticated
  USING (auth.uid() = founding_user_id)
  WITH CHECK (auth.uid() = founding_user_id);

-- Ratings policies
CREATE POLICY "Anyone can view ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings"
  ON ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings"
  ON ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Name votes policies
CREATE POLICY "Anyone can view name votes"
  ON name_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can suggest names"
  ON name_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = suggested_by);

-- User votes policies
CREATE POLICY "Anyone can view user votes"
  ON user_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON user_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their votes"
  ON user_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_benches_location ON benches(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_ratings_bench ON ratings(bench_id);
CREATE INDEX IF NOT EXISTS idx_name_votes_bench ON name_votes(bench_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_name_vote ON user_votes(name_vote_id);