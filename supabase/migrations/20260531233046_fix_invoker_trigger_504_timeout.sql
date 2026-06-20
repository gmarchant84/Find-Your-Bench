/*
  # Fix SECURITY INVOKER triggers causing 504 timeouts on bench confirmation

  ## Problem
  When any authenticated user inserts into bench_confirmations, the
  auto_update_bench_stats trigger fires. It calls update_bench_verification_status()
  and calculate_credibility_score(), both of which do UPDATE benches. Because all
  three functions run as SECURITY INVOKER, the UPDATE runs as the calling user.
  RLS only allows a user to UPDATE benches they founded, so for any other user
  the UPDATE is silently blocked by RLS while holding a row lock, causing the
  request to hang until Postgres times it out — resulting in a 504 Bad Gateway.

  ## Fix
  Recreate all three functions as SECURITY DEFINER so they always run with
  sufficient privileges to update the benches table, regardless of who triggered
  the operation. Each function is narrowly scoped (updates a single bench by
  primary key) so SECURITY DEFINER is safe here.

  ## Functions changed
  - auto_update_bench_stats: INVOKER -> DEFINER
  - update_bench_verification_status: INVOKER -> DEFINER
  - calculate_credibility_score: INVOKER -> DEFINER
*/

CREATE OR REPLACE FUNCTION calculate_credibility_score(bench_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score numeric := 0;
  confirm_count integer;
  sat_here_count integer;
  photo_count integer;
  removal_count integer;
BEGIN
  SELECT COUNT(*) INTO confirm_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param
    AND confirmation_type = 'exists';

  SELECT COUNT(*) INTO sat_here_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param
    AND confirmation_type = 'sat_here';

  SELECT COUNT(*) INTO removal_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param
    AND confirmation_type = 'removed';

  SELECT COALESCE(array_length(photos, 1), 0) INTO photo_count
  FROM benches
  WHERE id = bench_id_param;

  IF photo_count IS NULL THEN
    photo_count := 0;
  END IF;

  score := (confirm_count * 10) + (sat_here_count * 5) + (photo_count * 20) - (removal_count * 15);

  IF score > 100 THEN score := 100; END IF;
  IF score < 0   THEN score := 0;   END IF;

  UPDATE benches
  SET credibility_score = score
  WHERE id = bench_id_param;

  RETURN score;
END;
$$;

CREATE OR REPLACE FUNCTION update_bench_verification_status(bench_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  confirm_count integer;
  photo_count integer;
  new_status text;
BEGIN
  SELECT COUNT(*) INTO confirm_count
  FROM bench_confirmations
  WHERE bench_id = bench_id_param
    AND confirmation_type IN ('exists', 'sat_here');

  SELECT COALESCE(array_length(photos, 1), 0) INTO photo_count
  FROM benches
  WHERE id = bench_id_param;

  IF photo_count IS NULL THEN photo_count := 0; END IF;

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
$$;

CREATE OR REPLACE FUNCTION auto_update_bench_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_bench_verification_status(NEW.bench_id);
  PERFORM calculate_credibility_score(NEW.bench_id);
  RETURN NEW;
END;
$$;
