/*
  # Update bench verification thresholds

  1. Changes
    - Lowers `verified` threshold: photo uploaded OR 3+ confirmations (was 5 confirms)
    - Lowers `community_confirmed` threshold: 2+ confirmations (was 3)
    - Re-runs status update for all existing benches so they reflect the new rules

  2. Rationale
    - Community-driven trust should be achievable with reasonable effort
    - A single photo is meaningful evidence and earns verified status
    - 3 independent people confirming a bench exists is strong signal
*/

CREATE OR REPLACE FUNCTION update_bench_verification_status(bench_id_param uuid)
RETURNS void AS $$
DECLARE
  confirm_count integer;
  photo_count integer;
  new_status text;
BEGIN
  SELECT COUNT(*) INTO confirm_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param
    AND confirmation_type IN ('exists', 'sat_here');

  SELECT array_length(photos, 1) INTO photo_count
  FROM benches
  WHERE id = bench_id_param;

  IF photo_count IS NULL THEN
    photo_count := 0;
  END IF;

  IF photo_count > 0 OR confirm_count >= 3 THEN
    new_status := 'verified';
  ELSIF confirm_count >= 2 THEN
    new_status := 'community_confirmed';
  ELSE
    new_status := 'unverified';
  END IF;

  UPDATE benches
  SET
    confirmation_count = confirm_count,
    verification_status = new_status
  WHERE id = bench_id_param;
END;
$$ LANGUAGE plpgsql;

-- Re-evaluate all existing benches against new thresholds
DO $$
DECLARE
  b_id uuid;
BEGIN
  FOR b_id IN SELECT id FROM benches LOOP
    PERFORM update_bench_verification_status(b_id);
  END LOOP;
END $$;
