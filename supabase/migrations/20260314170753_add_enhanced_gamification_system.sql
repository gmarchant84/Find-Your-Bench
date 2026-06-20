/*
  # Enhanced Gamification System

  ## Overview
  This migration enhances the gamification system with:
  - User points and levels
  - Achievement catalog (separate from user achievements)
  - Activity streaks
  - Detailed point tracking for all actions

  ## New Tables
  
  ### `user_stats`
  Tracks overall user statistics and gamification metrics:
  - `user_id` (uuid, FK to auth.users) - User reference
  - `total_points` (integer) - Cumulative points earned
  - `level` (integer) - Current user level
  - `benches_added` (integer) - Total benches contributed
  - `ratings_given` (integer) - Total ratings submitted
  - `photos_uploaded` (integer) - Total photos uploaded
  - `verifications_done` (integer) - Total bench verifications
  - `current_streak` (integer) - Days of consecutive activity
  - `longest_streak` (integer) - Best streak achieved
  - `last_activity_date` (date) - Last activity for streak tracking
  - `next_level_points` (integer) - Points needed for next level
  - `created_at` (timestamptz) - Record creation time
  - `updated_at` (timestamptz) - Last update time

  ### `achievement_catalog`
  Defines available achievements/badges users can earn:
  - `id` (uuid, PK) - Achievement identifier
  - `name` (text) - Achievement name
  - `description` (text) - What user must do
  - `icon` (text) - Icon identifier
  - `category` (text) - Achievement type (explorer, contributor, social, streak)
  - `requirement_type` (text) - What triggers it (benches_added, points, streak, etc.)
  - `requirement_value` (integer) - Threshold to unlock
  - `points_reward` (integer) - Points awarded when unlocked
  - `rarity` (text) - common, rare, epic, legendary
  - `created_at` (timestamptz) - Creation time

  ### `user_achievement_unlocks`
  Tracks which achievements users have unlocked:
  - `id` (uuid, PK) - Record identifier
  - `user_id` (uuid, FK to auth.users) - User reference
  - `achievement_id` (uuid, FK to achievement_catalog) - Achievement reference
  - `unlocked_at` (timestamptz) - When achievement was earned
  - `notified` (boolean) - Whether user has seen notification

  ### `point_transactions`
  Detailed log of all point-earning activities:
  - `id` (uuid, PK) - Transaction identifier
  - `user_id` (uuid, FK to auth.users) - User reference
  - `points` (integer) - Points earned (or lost)
  - `action_type` (text) - Type of action (bench_added, rating_given, photo_uploaded, etc.)
  - `reference_id` (uuid) - ID of related bench/rating/photo
  - `description` (text) - Human-readable description
  - `created_at` (timestamptz) - Transaction time

  ## Security
  - Enable RLS on all new tables
  - Users can read their own stats and achievements
  - Users can read all achievements (public catalog)
  - Point transactions are read-only for users
  - Only authenticated users can access gamification features
*/

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points integer DEFAULT 0,
  level integer DEFAULT 1,
  benches_added integer DEFAULT 0,
  ratings_given integer DEFAULT 0,
  photos_uploaded integer DEFAULT 0,
  verifications_done integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_activity_date date,
  next_level_points integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats"
  ON user_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view other users' stats"
  ON user_stats FOR SELECT
  TO authenticated
  USING (true);

-- Create achievement_catalog table
CREATE TABLE IF NOT EXISTS achievement_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL CHECK (category IN ('explorer', 'contributor', 'social', 'streak', 'special')),
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  points_reward integer DEFAULT 0,
  rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE achievement_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievement catalog"
  ON achievement_catalog FOR SELECT
  TO authenticated
  USING (true);

-- Create user_achievement_unlocks table
CREATE TABLE IF NOT EXISTS user_achievement_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievement_catalog(id) ON DELETE CASCADE,
  unlocked_at timestamptz DEFAULT now(),
  notified boolean DEFAULT false,
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievement_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievement unlocks"
  ON user_achievement_unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view other users' achievement unlocks"
  ON user_achievement_unlocks FOR SELECT
  TO authenticated
  USING (true);

-- Create point_transactions table
CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  action_type text NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON point_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to calculate level from points
CREATE OR REPLACE FUNCTION calculate_level(points integer)
RETURNS integer AS $$
BEGIN
  -- Level formula: sqrt(points / 50) + 1
  -- Level 1: 0-49 points
  -- Level 2: 50-199 points
  -- Level 3: 200-449 points
  -- Level 4: 450-799 points
  -- Level 5: 800-1249 points
  RETURN FLOOR(SQRT(points / 50.0)) + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate points needed for next level
CREATE OR REPLACE FUNCTION calculate_next_level_points(current_points integer)
RETURNS integer AS $$
DECLARE
  current_level integer;
  next_level integer;
BEGIN
  current_level := calculate_level(current_points);
  next_level := current_level + 1;
  -- Inverse of level formula: ((level - 1)^2) * 50
  RETURN ((next_level - 1) * (next_level - 1)) * 50;
END;
$$ LANGUAGE plpgsql;

-- Function to initialize user stats
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to initialize stats for new users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_init_stats'
  ) THEN
    CREATE TRIGGER on_auth_user_created_init_stats
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION initialize_user_stats();
  END IF;
END $$;

-- Seed initial achievements
INSERT INTO achievement_catalog (name, description, icon, category, requirement_type, requirement_value, points_reward, rarity)
VALUES
  ('First Bench', 'Add your first bench to the map', 'MapPin', 'contributor', 'benches_added', 1, 50, 'common'),
  ('Bench Scout', 'Add 5 benches to the map', 'Compass', 'explorer', 'benches_added', 5, 100, 'common'),
  ('Bench Hunter', 'Add 10 benches to the map', 'Target', 'explorer', 'benches_added', 10, 200, 'rare'),
  ('Bench Legend', 'Add 25 benches to the map', 'Crown', 'explorer', 'benches_added', 25, 500, 'epic'),
  ('Bench Master', 'Add 50 benches to the map', 'Award', 'explorer', 'benches_added', 50, 1000, 'legendary'),
  
  ('First Review', 'Rate your first bench', 'Star', 'contributor', 'ratings_given', 1, 25, 'common'),
  ('Critic', 'Rate 10 benches', 'MessageSquare', 'contributor', 'ratings_given', 10, 100, 'common'),
  ('Super Critic', 'Rate 25 benches', 'Sparkles', 'contributor', 'ratings_given', 25, 250, 'rare'),
  
  ('Shutterbug', 'Upload 5 photos', 'Camera', 'contributor', 'photos_uploaded', 5, 75, 'common'),
  ('Photographer', 'Upload 25 photos', 'Image', 'contributor', 'photos_uploaded', 25, 250, 'rare'),
  ('Pro Photographer', 'Upload 50 photos', 'Images', 'contributor', 'photos_uploaded', 50, 500, 'epic'),
  
  ('Week Warrior', 'Maintain a 7-day streak', 'Flame', 'streak', 'current_streak', 7, 200, 'rare'),
  ('Dedicated', 'Maintain a 14-day streak', 'Zap', 'streak', 'current_streak', 14, 400, 'epic'),
  ('Unstoppable', 'Maintain a 30-day streak', 'Rocket', 'streak', 'current_streak', 30, 1000, 'legendary'),
  
  ('Rising Star', 'Reach level 5', 'TrendingUp', 'special', 'level', 5, 100, 'common'),
  ('Superstar', 'Reach level 10', 'Star', 'special', 'level', 10, 300, 'rare'),
  ('Elite', 'Reach level 25', 'Trophy', 'special', 'level', 25, 1000, 'legendary')
ON CONFLICT DO NOTHING;

-- Initialize stats for existing users
INSERT INTO user_stats (user_id, benches_added, ratings_given)
SELECT 
  u.id,
  COALESCE(COUNT(DISTINCT b.id), 0) as benches_added,
  COALESCE(COUNT(DISTINCT r.id), 0) as ratings_given
FROM auth.users u
LEFT JOIN benches b ON b.founding_user_id = u.id
LEFT JOIN ratings r ON r.user_id = u.id
GROUP BY u.id
ON CONFLICT (user_id) DO UPDATE
SET 
  benches_added = EXCLUDED.benches_added,
  ratings_given = EXCLUDED.ratings_given,
  updated_at = now();
