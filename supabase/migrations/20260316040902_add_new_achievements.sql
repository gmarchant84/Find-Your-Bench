/*
  # Add New Achievement Badges

  1. Changes
    - Add new achievement badges to the existing achievement_catalog
    - These include discovery, review, photo, and special collection achievements

  2. New Achievements
    - Bench discovery achievements (1, 5, 10, 25)
    - Review achievements (1, 5, 15)
    - Photo upload achievements (1, 5, 15)
    - Special list-based achievements (Sunset, Coffee, Dog Walk, Thinking)
    - Activity-based achievements (People-watching, Tranquility)
*/

-- Insert new achievements into the existing achievement_catalog
INSERT INTO achievement_catalog (name, description, icon, category, requirement_type, requirement_value, points_reward, rarity) VALUES
  ('First Bench', 'Add your first bench to the map', '🏆', 'explorer', 'benches_added', 1, 50, 'common'),
  ('5 Benches Found', 'Discover 5 benches', '🗺️', 'explorer', 'benches_added', 5, 100, 'common'),
  ('Bench Master', 'Discover 10 benches', '🎯', 'explorer', 'benches_added', 10, 200, 'rare'),
  ('Globe Trotter', 'Discover 25 benches', '🌍', 'explorer', 'benches_added', 25, 500, 'epic'),
  
  ('First Review', 'Write your first bench review', '⭐', 'contributor', 'ratings_given', 1, 50, 'common'),
  ('Bench Critic', 'Review 5 different benches', '📝', 'contributor', 'ratings_given', 5, 100, 'common'),
  ('Super Reviewer', 'Review 15 benches', '🎓', 'contributor', 'ratings_given', 15, 300, 'rare'),
  
  ('Photographer', 'Upload your first bench photo', '📸', 'contributor', 'photos_uploaded', 1, 50, 'common'),
  ('Photo Collector', 'Upload 5 bench photos', '🎨', 'contributor', 'photos_uploaded', 5, 100, 'common'),
  ('Visual Artist', 'Upload 15 bench photos', '🖼️', 'contributor', 'photos_uploaded', 15, 300, 'rare'),
  
  ('Sunset Seeker', 'Save a bench to your Sunset Benches list', '🌅', 'special', 'sunset_list', 1, 75, 'rare'),
  ('Coffee Bench Explorer', 'Save a bench to your Coffee Benches list', '☕', 'special', 'coffee_list', 1, 75, 'rare'),
  ('Dog Bench Visitor', 'Save a bench to your Dog Walk Benches list', '🐕', 'special', 'dog_list', 1, 75, 'rare'),
  ('Deep Thinker', 'Save a bench to your Thinking Benches list', '🧠', 'special', 'thinking_list', 1, 75, 'rare'),
  
  ('Social Butterfly', 'Rate 3 benches highly for people-watching', '👀', 'special', 'people_watching_ratings', 3, 100, 'rare'),
  ('Peace Seeker', 'Rate 3 benches 5 stars for tranquility', '🌿', 'special', 'tranquil_ratings', 3, 100, 'rare')
ON CONFLICT DO NOTHING;

-- Function to check and award achievements based on user stats
CREATE OR REPLACE FUNCTION check_and_award_achievements(p_user_id uuid)
RETURNS TABLE(newly_unlocked uuid[]) AS $$
DECLARE
  v_stats RECORD;
  v_achievement RECORD;
  v_unlocked uuid[];
  v_achievement_id uuid;
  v_list_count integer;
  v_people_watching_count integer;
  v_tranquil_count integer;
BEGIN
  v_unlocked := ARRAY[]::uuid[];

  -- Get user stats
  SELECT * INTO v_stats
  FROM user_stats
  WHERE user_id = p_user_id;

  -- If no stats exist, create them
  IF NOT FOUND THEN
    INSERT INTO user_stats (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_stats;
  END IF;

  -- Check explorer achievements (benches_added)
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'benches_added'
    AND requirement_value <= v_stats.benches_added
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_achievement_id;
    
    IF v_achievement_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_achievement_id);
    END IF;
  END LOOP;

  -- Check contributor achievements (ratings_given)
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'ratings_given'
    AND requirement_value <= v_stats.ratings_given
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_achievement_id;
    
    IF v_achievement_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_achievement_id);
    END IF;
  END LOOP;

  -- Check photo achievements (photos_uploaded)
  FOR v_achievement IN
    SELECT * FROM achievement_catalog
    WHERE requirement_type = 'photos_uploaded'
    AND requirement_value <= v_stats.photos_uploaded
  LOOP
    INSERT INTO user_achievement_unlocks (user_id, achievement_id)
    VALUES (p_user_id, v_achievement.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id INTO v_achievement_id;
    
    IF v_achievement_id IS NOT NULL THEN
      v_unlocked := array_append(v_unlocked, v_achievement_id);
    END IF;
  END LOOP;

  -- Check special list achievements
  -- Sunset Benches
  SELECT COUNT(*) INTO v_list_count
  FROM list_benches lb
  JOIN bench_lists bl ON lb.list_id = bl.id
  WHERE lb.user_id = p_user_id
  AND LOWER(bl.name) LIKE '%sunset%';
  
  IF v_list_count > 0 THEN
    SELECT id INTO v_achievement_id FROM achievement_catalog WHERE requirement_type = 'sunset_list' LIMIT 1;
    IF v_achievement_id IS NOT NULL THEN
      INSERT INTO user_achievement_unlocks (user_id, achievement_id)
      VALUES (p_user_id, v_achievement_id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id INTO v_achievement_id;
      
      IF v_achievement_id IS NOT NULL THEN
        v_unlocked := array_append(v_unlocked, v_achievement_id);
      END IF;
    END IF;
  END IF;

  -- Coffee Benches
  SELECT COUNT(*) INTO v_list_count
  FROM list_benches lb
  JOIN bench_lists bl ON lb.list_id = bl.id
  WHERE lb.user_id = p_user_id
  AND LOWER(bl.name) LIKE '%coffee%';
  
  IF v_list_count > 0 THEN
    SELECT id INTO v_achievement_id FROM achievement_catalog WHERE requirement_type = 'coffee_list' LIMIT 1;
    IF v_achievement_id IS NOT NULL THEN
      INSERT INTO user_achievement_unlocks (user_id, achievement_id)
      VALUES (p_user_id, v_achievement_id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id INTO v_achievement_id;
      
      IF v_achievement_id IS NOT NULL THEN
        v_unlocked := array_append(v_unlocked, v_achievement_id);
      END IF;
    END IF;
  END IF;

  -- Dog Walk Benches
  SELECT COUNT(*) INTO v_list_count
  FROM list_benches lb
  JOIN bench_lists bl ON lb.list_id = bl.id
  WHERE lb.user_id = p_user_id
  AND LOWER(bl.name) LIKE '%dog%';
  
  IF v_list_count > 0 THEN
    SELECT id INTO v_achievement_id FROM achievement_catalog WHERE requirement_type = 'dog_list' LIMIT 1;
    IF v_achievement_id IS NOT NULL THEN
      INSERT INTO user_achievement_unlocks (user_id, achievement_id)
      VALUES (p_user_id, v_achievement_id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id INTO v_achievement_id;
      
      IF v_achievement_id IS NOT NULL THEN
        v_unlocked := array_append(v_unlocked, v_achievement_id);
      END IF;
    END IF;
  END IF;

  -- Thinking Benches
  SELECT COUNT(*) INTO v_list_count
  FROM list_benches lb
  JOIN bench_lists bl ON lb.list_id = bl.id
  WHERE lb.user_id = p_user_id
  AND LOWER(bl.name) LIKE '%think%';
  
  IF v_list_count > 0 THEN
    SELECT id INTO v_achievement_id FROM achievement_catalog WHERE requirement_type = 'thinking_list' LIMIT 1;
    IF v_achievement_id IS NOT NULL THEN
      INSERT INTO user_achievement_unlocks (user_id, achievement_id)
      VALUES (p_user_id, v_achievement_id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id INTO v_achievement_id;
      
      IF v_achievement_id IS NOT NULL THEN
        v_unlocked := array_append(v_unlocked, v_achievement_id);
      END IF;
    END IF;
  END IF;

  -- Check people watching ratings
  SELECT COUNT(*) INTO v_people_watching_count
  FROM ratings
  WHERE user_id = p_user_id
  AND people_watching >= 4;
  
  IF v_people_watching_count >= 3 THEN
    SELECT id INTO v_achievement_id FROM achievement_catalog WHERE requirement_type = 'people_watching_ratings' LIMIT 1;
    IF v_achievement_id IS NOT NULL THEN
      INSERT INTO user_achievement_unlocks (user_id, achievement_id)
      VALUES (p_user_id, v_achievement_id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id INTO v_achievement_id;
      
      IF v_achievement_id IS NOT NULL THEN
        v_unlocked := array_append(v_unlocked, v_achievement_id);
      END IF;
    END IF;
  END IF;

  -- Check tranquil ratings
  SELECT COUNT(*) INTO v_tranquil_count
  FROM ratings
  WHERE user_id = p_user_id
  AND tranquility = 5;
  
  IF v_tranquil_count >= 3 THEN
    SELECT id INTO v_achievement_id FROM achievement_catalog WHERE requirement_type = 'tranquil_ratings' LIMIT 1;
    IF v_achievement_id IS NOT NULL THEN
      INSERT INTO user_achievement_unlocks (user_id, achievement_id)
      VALUES (p_user_id, v_achievement_id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id INTO v_achievement_id;
      
      IF v_achievement_id IS NOT NULL THEN
        v_unlocked := array_append(v_unlocked, v_achievement_id);
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_unlocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
