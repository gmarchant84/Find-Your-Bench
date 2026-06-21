-- Allow anonymous (logged-out) users to read all public-facing tables.
-- This enables open discovery without requiring an account.

-- Benches: anyone can view
DROP POLICY IF EXISTS "Anyone can view benches" ON benches;
CREATE POLICY "Anyone can view benches"
  ON benches FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ratings: anyone can view
DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;
CREATE POLICY "Anyone can view ratings"
  ON ratings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Name votes: anyone can view
DROP POLICY IF EXISTS "Anyone can view name votes" ON name_votes;
CREATE POLICY "Anyone can view name votes"
  ON name_votes FOR SELECT
  TO anon, authenticated
  USING (true);

-- User votes: anyone can view
DROP POLICY IF EXISTS "Anyone can view user votes" ON user_votes;
CREATE POLICY "Anyone can view user votes"
  ON user_votes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Profiles: anyone can view public profile info (username, badges)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- Bench photos: anyone can view
DROP POLICY IF EXISTS "Anyone can view bench photos" ON bench_photos;
CREATE POLICY "Anyone can view bench photos"
  ON bench_photos FOR SELECT
  TO anon, authenticated
  USING (true);

-- Bench confirmations: anyone can view
DROP POLICY IF EXISTS "Anyone can view bench confirmations" ON bench_confirmations;
CREATE POLICY "Anyone can view bench confirmations"
  ON bench_confirmations FOR SELECT
  TO anon, authenticated
  USING (true);
