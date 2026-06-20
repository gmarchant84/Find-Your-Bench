/*
  # Add UPDATE policy for user_achievement_unlocks

  ## Problem
  The notified column update was silently failing because no UPDATE RLS policy
  existed on user_achievement_unlocks. This caused the achievement notification
  to re-appear every time the component mounted, since notified remained false.

  ## Fix
  Add an UPDATE policy so authenticated users can mark their own achievement
  unlocks as notified.
*/

CREATE POLICY "Users can update their own achievement unlock notifications"
  ON user_achievement_unlocks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
