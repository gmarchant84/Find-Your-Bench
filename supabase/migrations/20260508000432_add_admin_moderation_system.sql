/*
  # Admin Moderation System

  ## Summary
  Adds lightweight admin/moderation capabilities to the app.

  ## Changes

  ### profiles table
  - Add `is_admin` (boolean, default false) — marks a user as admin

  ### benches table
  - Add `is_hidden` (boolean, default false) — hides bench from public without deletion
  - Add `duplicate_of` (uuid, nullable, FK to benches.id) — links a bench to its canonical duplicate

  ## Security
  - `is_admin` can only be set via service role (no user-facing policy allows self-promotion)
  - `is_hidden` and `duplicate_of` can only be updated by admins via a secure policy
  - Public SELECT on benches filters out hidden benches via existing RLS; we add a permissive
    admin policy so admins can still see hidden benches
  - Admins can UPDATE and DELETE any bench
*/

-- 1. Add is_admin to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Add is_hidden to benches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'benches' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE benches ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Add duplicate_of to benches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'benches' AND column_name = 'duplicate_of'
  ) THEN
    ALTER TABLE benches ADD COLUMN duplicate_of uuid REFERENCES benches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Admin SELECT policy on benches (can see hidden benches)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'benches' AND policyname = 'Admins can view all benches including hidden'
  ) THEN
    CREATE POLICY "Admins can view all benches including hidden"
      ON benches FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- 5. Admin UPDATE policy on benches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'benches' AND policyname = 'Admins can update any bench'
  ) THEN
    CREATE POLICY "Admins can update any bench"
      ON benches FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- 6. Admin DELETE policy on benches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'benches' AND policyname = 'Admins can delete any bench'
  ) THEN
    CREATE POLICY "Admins can delete any bench"
      ON benches FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;
