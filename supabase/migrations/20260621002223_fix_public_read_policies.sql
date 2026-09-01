/*
# Fix Public Read Policies

Recreates SELECT policies on core tables to allow both anonymous and authenticated users to read data.

1. Tables affected: benches, ratings, name_votes, profiles, bench_photos
2. Each policy is dropped then recreated for idempotency
3. Grants SELECT to both `anon` and `authenticated` roles
*/

DROP POLICY IF EXISTS "Anyone can view benches" ON benches;
CREATE POLICY "Anyone can view benches"
  ON benches FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;
CREATE POLICY "Anyone can view ratings"
  ON ratings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view name votes" ON name_votes;
CREATE POLICY "Anyone can view name votes"
  ON name_votes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view bench photos" ON bench_photos;
CREATE POLICY "Anyone can view bench photos"
  ON bench_photos FOR SELECT
  TO anon, authenticated
  USING (true);
