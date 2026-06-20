/*
  # Prevent Self-Promotion of Admin Flag

  ## Summary
  The existing "Users can update own profile" policy allows users to update ANY column
  on their own profiles row, including is_admin. This migration replaces it with a
  column-level restricted policy and adds an explicit block on is_admin self-assignment.

  ## Changes

  ### profiles table
  - DROP the broad UPDATE policy that allowed users to modify any column including is_admin
  - ADD a restricted UPDATE policy that blocks changes to is_admin by non-admins
    (uses a CHECK that ensures is_admin value cannot be changed by the row owner unless
    they are already an admin — effectively only service role can grant admin)

  ## Notes
  - PostgreSQL RLS WITH CHECK fires AFTER the update; we compare NEW is_admin to the
    stored value by joining back to the same row via auth.uid().
  - The cleanest server-enforceable approach is: the new is_admin in the row being
    written must match the existing is_admin stored in the DB, unless the actor is
    already an admin themselves.
*/

-- Drop the overly broad policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Replace with a policy that prevents is_admin escalation
CREATE POLICY "Users can update own profile excluding admin flag"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- allow if is_admin is unchanged (user is not touching the flag)
      is_admin = (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
      -- OR the actor is already an admin (admins can manage admin status)
      OR (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) = true
    )
  );
