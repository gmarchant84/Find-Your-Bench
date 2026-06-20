/*
  # Make legacy rating columns nullable

  ## Summary
  The ratings table has two legacy columns (view, quietness) that are NOT NULL
  but are no longer sent by the frontend. This causes all rating inserts/upserts
  to fail with a NOT NULL constraint violation.

  ## Changes
  - `ratings.view` - changed from NOT NULL to nullable
  - `ratings.quietness` - changed from NOT NULL to nullable

  ## Notes
  These columns predate the newer rating categories (tranquility, people_watching,
  beautiful_views, accessibility) and are no longer used by the UI.
*/

ALTER TABLE ratings ALTER COLUMN view DROP NOT NULL;
ALTER TABLE ratings ALTER COLUMN quietness DROP NOT NULL;
