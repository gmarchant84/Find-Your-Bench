/*
  # Fix bench INSERT RLS policy

  ## Problem
  The existing INSERT policy uses:
    WITH CHECK (auth.uid() = founding_user_id)

  In SQL, NULL = NULL evaluates to NULL (not TRUE), so anonymous users
  whose founding_user_id is NULL cannot insert benches — the policy
  silently rejects their rows.

  ## Fix
  Replace the policy to allow:
  - Authenticated users inserting with their own user ID
  - Unauthenticated users inserting with NULL founding_user_id

  Both cases are legitimate: logged-in users get credit, anonymous
  users can still contribute benches.
*/

DROP POLICY IF EXISTS "Authenticated users can create benches" ON benches;

CREATE POLICY "Anyone can create benches"
  ON benches
  FOR INSERT
  WITH CHECK (
    founding_user_id IS NULL
    OR auth.uid() = founding_user_id
  );
