/*
  # Fix original_name to be nullable

  1. Changes
    - Make original_name column nullable in benches table
    - This allows users to add benches without providing a name
    - The system will auto-generate names as needed
*/

-- Make original_name nullable
ALTER TABLE benches ALTER COLUMN original_name DROP NOT NULL;
