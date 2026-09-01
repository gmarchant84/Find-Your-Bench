alter table profiles
  add column if not exists display_name text,
  add column if not exists bio text check (char_length(bio) <= 200),
  add column if not exists avatar_url text,
  add column if not exists featured_badge_id text;
