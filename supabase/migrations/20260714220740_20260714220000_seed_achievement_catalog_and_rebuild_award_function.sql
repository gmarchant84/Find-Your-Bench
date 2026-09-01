/*
# Seed Achievement Catalog & Rebuild Auto-Award System

## Summary
Replaces the old UUID-based achievement catalog with a new text-ID catalog,
rewrites the `check_and_award_achievements` function to handle all four
requirement types (benches_added, reviews_written, streak_days, manual),
changes `point_transactions.reference_id` from uuid to text to accommodate
text achievement IDs, and seeds awards for existing users.

## Changes

### 1. achievement_catalog — change id column from uuid to text
- The `id` column changes from `uuid DEFAULT gen_random_uuid()` to `text PRIMARY KEY`.
- This allows stable, human-readable IDs like 'seedling', 'scout', etc.
- The FK on `user_achievement_unlocks.achievement_id` is dropped and recreated
  to reference the new text column.

### 2. point_transactions.reference_id — change from uuid to text
- The `reference_id` column stores achievement IDs (now text) and bench/rating IDs.
- Changed to text to accommodate text-based achievement IDs.

### 3. Old catalog rows and unlocks removed
- All existing `user_achievement_unlocks` rows are deleted (they reference
  old UUID IDs that will no longer exist).
- All old `achievement_catalog` rows are deleted.

### 4. New achievement catalog inserted (14 achievements)
**Bench badges (benches_added):**
- seedling (0 benches, 0 pts, common) — welcome badge
- groundskeeper (1 bench, 10 pts, common)
- scout (5 benches, 50 pts, rare)
- trail_blazer (15 benches, 150 pts, rare)
- park_ranger (30 benches, 300 pts, epic)
- bench_legend (50 benches, 500 pts, legendary)

**Review badges (reviews_written):**
- critic (1 review, 10 pts, common)
- connoisseur (10 reviews, 100 pts, rare)
- the_reviewer (25 reviews, 250 pts, epic)

**Streak badges (streak_days):**
- on_a_roll (2 days, 20 pts, common)
- unstoppable (5 days, 75 pts, rare)
- bench_obsessed (10 days, 150 pts, epic)
- perma_bencher (25 days, 500 pts, legendary)

**Special (manual):**
- the_benchfather (0, 1000 pts, legendary) — manually awarded only

### 5. check_and_award_achievements function rewritten
- Handles `benches_added`: counts rows in `benches` where `founding_user_id = p_user_id`
- Handles `reviews_written`: counts rows in `ratings` where `user_id = p_user_id`
  (only counts ratings that have a non-null/non-empty `review_text`)
- Handles `streak_days`: checks `profiles.current_streak >= requirement_value`,
  but only awards if not already unlocked (badges are permanent once earned)
- Handles `manual`: skipped entirely in the function
- Auto-awards Seedling badge on first call if the user has 0 benches and
  doesn't have it yet
- Awards points to user_stats for each newly unlocked achievement
- Returns newly_unlocked array of achievement IDs

### 6. Seed awards
- Seedling badge awarded to every existing user who doesn't already have it
- The Benchfather badge manually inserted for user 'thebenchfather'
  (UUID: 11ab94fd-632c-4354-a722-f246e02aaf2b)

## Security
- No RLS policy changes. Function remains SECURITY DEFINER.
- No new tables created.
*/

-- Step 1: Drop FK from user_achievement_unlocks to achievement_catalog
ALTER TABLE user_achievement_unlocks
  DROP CONSTRAINT IF EXISTS user_achievement_unlocks_achievement_id_fkey;

-- Step 2: Remove all existing unlocks (they reference old UUID IDs)
DELETE FROM user_achievement_unlocks;

-- Step 3: Remove all old catalog rows
DELETE FROM achievement_catalog;

-- Step 4: Change achievement_catalog.id from uuid to text
ALTER TABLE achievement_catalog
  ALTER COLUMN id TYPE text USING id::text,
  ALTER COLUMN id DROP DEFAULT;

-- Step 5: Change user_achievement_unlocks.achievement_id to text
ALTER TABLE user_achievement_unlocks
  ALTER COLUMN achievement_id TYPE text USING achievement_id::text;

-- Step 6: Change point_transactions.reference_id from uuid to text
ALTER TABLE point_transactions
  ALTER COLUMN reference_id TYPE text USING reference_id::text;

-- Step 7: Recreate the FK
ALTER TABLE user_achievement_unlocks
  ADD CONSTRAINT user_achievement_unlocks_achievement_id_fkey
  FOREIGN KEY (achievement_id) REFERENCES achievement_catalog(id) ON DELETE CASCADE;

-- Step 8: Insert the new achievement catalog
INSERT INTO achievement_catalog (id, name, icon, category, requirement_type, requirement_value, points_reward, rarity, description) VALUES
  -- Bench badges (benches_added)
  ('seedling',       'Seedling',      ':seedling:',        'contributor', 'benches_added',  0, 0,    'common',    'You just joined. Welcome to the community.'),
  ('groundskeeper',  'Groundskeeper', ':chair:',           'contributor', 'benches_added',  1, 10,   'common',    'Added your first bench.'),
  ('scout',          'Scout',         ':world_map:',       'contributor', 'benches_added',  5, 50,   'rare',      'Added 5 benches.'),
  ('trail_blazer',   'Trail Blazer',  ':camping:',         'contributor', 'benches_added', 15, 150,  'rare',      'Added 15 benches.'),
  ('park_ranger',    'Park Ranger',   ':deciduous_tree:',  'contributor', 'benches_added', 30, 300,  'epic',      'Added 30 benches.'),
  ('bench_legend',   'Bench Legend',  ':trophy:',          'contributor', 'benches_added', 50, 500,  'legendary', 'Added 50 benches.'),
  -- Review badges (reviews_written)
  ('critic',         'Critic',        ':writing_hand:',    'social',      'reviews_written', 1, 10,  'common',    'Wrote your first review.'),
  ('connoisseur',    'Connoisseur',   ':mag:',             'social',      'reviews_written',10, 100, 'rare',      'Wrote 10 reviews.'),
  ('the_reviewer',   'The Reviewer',  ':scroll:',          'social',      'reviews_written',25, 250, 'epic',      'Wrote 25 reviews.'),
  -- Streak badges (streak_days)
  ('on_a_roll',      'On a Roll',     ':fire:',            'streak',      'streak_days',    2, 20,  'common',    'Kept a 2-day streak.'),
  ('unstoppable',    'Unstoppable',   ':zap:',             'streak',      'streak_days',    5, 75,  'rare',      'Kept a 5-day streak.'),
  ('bench_obsessed', 'Bench Obsessed',':gem:',             'streak',      'streak_days',   10, 150, 'epic',      'Kept a 10-day streak.'),
  ('perma_bencher',  'Perma-Bencher', ':star2:',           'streak',      'streak_days',   25, 500, 'legendary', 'Kept a 25-day streak.'),
  -- Special (manual)
  ('the_benchfather','The Benchfather',':crown:',          'special',     'manual',         0, 1000,'legendary', 'One of a kind.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  requirement_type = EXCLUDED.requirement_type,
  requirement_value = EXCLUDED.requirement_value,
  points_reward = EXCLUDED.points_reward,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description;

-- Step 9: Drop old function (return type changed from uuid[] to text[])
DROP FUNCTION IF EXISTS public.check_and_award_achievements(uuid);

-- Step 10: Create new check_and_award_achievements function
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id uuid)
RETURNS TABLE(newly_unlocked text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_bench_count integer;
  v_review_count integer;
  v_current_streak integer;
  v_achievement RECORD;
  v_unlocked text[];
  v_new_id text;
  v_has_seedling boolean;
BEGIN
  v_unlocked := ARRAY[]::text[];

  -- Count benches added by user
  SELECT count(*) INTO v_bench_count
  FROM benches
  WHERE founding_user_id = p_user_id;

  -- Count reviews written by user (ratings with non-empty review_text)
  SELECT count(*) INTO v_review_count
  FROM ratings
  WHERE user_id = p_user_id
    AND review_text IS NOT NULL
    AND btrim(review_text) <> '';

  -- Get current streak from profiles
  SELECT COALESCE(current_streak, 0) INTO v_current_streak
  FROM profiles
  WHERE id = p_user_id;

  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
  END IF;

  -- Auto-award Seedling if user has 0 benches and doesn't have it
  SELECT EXISTS (
    SELECT 1 FROM user_achievement_unlocks
    WHERE user_id = p_user_id AND achievement_id = 'seedling'
  ) INTO v_has_seedling;

  IF NOT v_has_seedling AND v_bench_count = 0 THEN
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, 'seedling')
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
    END IF;
  END IF;

  -- Check benches_added achievements (skip seedling, handled above)
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'benches_added'
      AND requirement_value <= v_bench_count
      AND id <> 'seedling'
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
      IF v_achievement.points_reward > 0 THEN
        INSERT INTO point_transactions (user_id, points, action_type, reference_id, description)
        VALUES (p_user_id, v_achievement.points_reward, 'achievement_unlocked', v_achievement.id,
                'Achievement unlocked: ' || v_achievement.name);
        UPDATE user_stats
          SET total_points = total_points + v_achievement.points_reward,
              updated_at = now()
          WHERE user_id = p_user_id;
      END IF;
    END IF;
  END LOOP;

  -- Check reviews_written achievements
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'reviews_written'
      AND requirement_value <= v_review_count
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
      IF v_achievement.points_reward > 0 THEN
        INSERT INTO point_transactions (user_id, points, action_type, reference_id, description)
        VALUES (p_user_id, v_achievement.points_reward, 'achievement_unlocked', v_achievement.id,
                'Achievement unlocked: ' || v_achievement.name);
        UPDATE user_stats
          SET total_points = total_points + v_achievement.points_reward,
              updated_at = now()
          WHERE user_id = p_user_id;
      END IF;
    END IF;
  END LOOP;

  -- Check streak_days achievements (permanent once earned, never revoked)
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'streak_days'
      AND requirement_value <= v_current_streak
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_new_id);
      IF v_achievement.points_reward > 0 THEN
        INSERT INTO point_transactions (user_id, points, action_type, reference_id, description)
        VALUES (p_user_id, v_achievement.points_reward, 'achievement_unlocked', v_achievement.id,
                'Achievement unlocked: ' || v_achievement.name);
        UPDATE user_stats
          SET total_points = total_points + v_achievement.points_reward,
              updated_at = now()
          WHERE user_id = p_user_id;
      END IF;
    END IF;
  END LOOP;

  -- manual type: skipped, awarded manually only

  RETURN QUERY SELECT v_unlocked;
END;
$function$;

-- Step 11: Seed Seedling badge to all existing users who don't have it
INSERT INTO user_achievement_unlocks (user_id, achievement_id)
SELECT p.id, 'seedling'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_achievement_unlocks u
  WHERE u.user_id = p.id AND u.achievement_id = 'seedling'
)
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Step 12: Manually award The Benchfather badge
INSERT INTO user_achievement_unlocks (user_id, achievement_id)
VALUES ('11ab94fd-632c-4354-a722-f246e02aaf2b', 'the_benchfather')
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Award the 1000 points for the Benchfather badge
INSERT INTO point_transactions (user_id, points, action_type, reference_id, description)
VALUES ('11ab94fd-632c-4354-a722-f246e02aaf2b', 1000, 'achievement_unlocked', 'the_benchfather',
        'Achievement unlocked: The Benchfather')
ON CONFLICT DO NOTHING;

UPDATE user_stats
  SET total_points = total_points + 1000,
      updated_at = now()
  WHERE user_id = '11ab94fd-632c-4354-a722-f246e02aaf2b';
