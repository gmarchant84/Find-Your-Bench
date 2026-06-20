/*
  # Fix SECURITY INVOKER triggers causing 502/504 on ratings and photo votes

  ## Problem
  Two trigger functions run as SECURITY INVOKER and do cross-table UPDATEs:

  1. update_bench_average_rating — fires after INSERT/UPDATE/DELETE on ratings.
     It does UPDATE benches, but RLS only allows a user to update their own bench.
     Any user leaving a review on someone else's bench gets the UPDATE silently
     blocked by RLS while holding a row lock, causing a gateway timeout (502/504).

  2. update_photo_helpful_count — fires after INSERT/DELETE on photo_votes.
     It does UPDATE bench_photos, which is similarly RLS-restricted.
     Any user voting a photo helpful/unhelpful gets the same timeout.

  ## Fix
  Recreate both functions with SECURITY DEFINER so they always run with
  sufficient privileges regardless of who triggered the operation.
  Each function is narrowly scoped (updates a single row by primary key)
  so SECURITY DEFINER is safe here — same pattern already applied to
  auto_update_bench_stats and calculate_credibility_score.

  ## Functions changed
  - update_bench_average_rating: INVOKER -> DEFINER
  - update_photo_helpful_count:  INVOKER -> DEFINER
*/

CREATE OR REPLACE FUNCTION update_bench_average_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_bench_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_bench_id := OLD.bench_id;
  ELSE
    target_bench_id := NEW.bench_id;
  END IF;

  UPDATE benches
  SET
    average_rating = COALESCE((
      SELECT AVG(overall)
      FROM ratings
      WHERE bench_id = target_bench_id
    ), 0),
    total_ratings = COALESCE((
      SELECT COUNT(*)
      FROM ratings
      WHERE bench_id = target_bench_id
    ), 0)
  WHERE id = target_bench_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_photo_helpful_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE bench_photos
    SET helpful_count = helpful_count + 1
    WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE bench_photos
    SET helpful_count = helpful_count - 1
    WHERE id = OLD.photo_id;
  END IF;
  RETURN NULL;
END;
$$;
