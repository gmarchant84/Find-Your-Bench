/*
  # Add distance unit preference to profiles

  1. Changes
    - Add `distance_unit` column to profiles table
    - Options: 'miles' or 'km'
    - Default: 'miles'
  
  2. Security
    - Users can update their own distance preference
*/

-- Add distance_unit column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'distance_unit'
  ) THEN
    ALTER TABLE profiles ADD COLUMN distance_unit text DEFAULT 'miles' CHECK (distance_unit IN ('miles', 'km'));
  END IF;
END $$;
