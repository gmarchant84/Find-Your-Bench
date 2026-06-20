/*
  # Allow anonymous bench photo uploads

  The existing INSERT policy on bench_photos requires auth.uid() = user_id,
  which blocks unauthenticated users from uploading.

  We drop the restrictive policy and replace it with one that allows:
  - Authenticated users inserting with their own user_id
  - Unauthenticated users inserting with NULL user_id

  This mirrors the approach used for bench creation.
*/

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON bench_photos;

CREATE POLICY "Anyone can upload bench photos"
  ON bench_photos
  FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR auth.uid() = user_id
  );
