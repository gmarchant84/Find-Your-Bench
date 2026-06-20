/*
  # Fix missing RLS write policies on gamification tables

  ## Problem
  Three tables used by the client-side gamification system (awardPoints,
  checkAndUnlockAchievements in src/lib/gamification.ts) have RLS enabled
  but are missing INSERT and/or UPDATE policies. When the calling user hits
  these tables, the writes are silently blocked by RLS while holding row
  locks, causing the request to hang and APISIX to return a 502 Bad Gateway.

  Affected tables and missing policies:
  - user_stats:            no INSERT, no UPDATE policy
  - point_transactions:    no INSERT policy
  - user_achievement_unlocks: no INSERT policy

  ## Fix
  Add the minimum necessary write policies for each table, scoped to the
  authenticated user's own rows only.
*/

-- user_stats: users insert their own row (upsert on signup / first action)
CREATE POLICY "Users can insert their own stats"
  ON user_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- user_stats: users update their own row (points, level, streak)
CREATE POLICY "Users can update their own stats"
  ON user_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- point_transactions: users insert their own transactions
CREATE POLICY "Users can insert their own point transactions"
  ON point_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- user_achievement_unlocks: users insert their own unlocks
CREATE POLICY "Users can insert their own achievement unlocks"
  ON user_achievement_unlocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
