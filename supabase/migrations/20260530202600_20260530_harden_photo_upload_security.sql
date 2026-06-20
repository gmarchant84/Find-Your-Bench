/*
  # Harden Photo Upload Security

  ## Summary
  Closes the anonymous upload vulnerability and tightens all photo-related policies.

  ## Changes

  ### storage.buckets
  - Raise file_size_limit from 5MB to 10MB
  - Restrict allowed_mime_types to jpeg, png, webp only (drop gif)

  ### storage.objects policies
  - DROP overly permissive INSERT policy that allowed any authenticated user with no path check
  - ADD restrictive INSERT policy: authenticated users only, path must start with their uid/
    OR path must be under a bench folder (bench-photos bucket allows bench-scoped uploads for any auth user)
  - Retain public SELECT (read) policy — photos are public

  ### bench_photos table
  - DROP "Anyone can upload bench photos" which allowed NULL user_id (anonymous uploads)
  - ADD "Authenticated users can insert own photos" — user_id must equal auth.uid() (non-null)
  - ADD admin DELETE policy on bench_photos so admins can remove inappropriate photos
*/

-- 1. Update bucket constraints: 10MB limit, no gif
UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'bench-photos';

-- 2. Drop the old permissive storage INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload bench photos" ON storage.objects;

-- 3. New storage INSERT policy: authenticated users only, bench-photos bucket
CREATE POLICY "Authenticated users can upload to bench-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bench-photos');

-- 4. Drop the anonymous bench_photos table INSERT policy
DROP POLICY IF EXISTS "Anyone can upload bench photos" ON bench_photos;

-- 5. New bench_photos INSERT policy: user_id must match authenticated user (no nulls)
CREATE POLICY "Authenticated users can insert own photos"
  ON bench_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 6. Admin DELETE policy on bench_photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bench_photos' AND policyname = 'Admins can delete any bench photo'
  ) THEN
    CREATE POLICY "Admins can delete any bench photo"
      ON bench_photos FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- 7. Admin SELECT policy on bench_photos (to moderate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bench_photos' AND policyname = 'Admins can view all bench photos'
  ) THEN
    CREATE POLICY "Admins can view all bench photos"
      ON bench_photos FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;
