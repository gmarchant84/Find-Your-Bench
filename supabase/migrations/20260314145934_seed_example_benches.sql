/*
  # Seed Example Benches with Personality

  1. Purpose
    - Add 10 example benches to demonstrate bench personalities and identities
    - Show how benches can have fun, relatable descriptions and stories
    - Provide diverse use cases (breakups, coffee, lunch, people-watching, etc.)
    - All benches located in San Francisco neighborhoods

  2. Benches Added
    - The Break-Up Bench (emotional, quiet, thinking)
    - The Morning Coffee Bench (coffee, morning, relaxing)
    - The Sandwich Bench (lunch, food, break)
    - The People-Watching Championship Bench (people-watching, lively, social)
    - The Thinking Bench (thinking, quiet, reflective)
    - The Sunset Bench (sunset, scenic, relaxing)
    - The Dog-Watching Bench (dogs, people-watching, park)
    - The "Call your Mom" Bench (relaxing, timewarp, chill)
    - The Reading Bench (reading, quiet, peaceful)
    - The Life Decision Bench (thinking, reflective, peaceful)

  3. Data Structure
    - Each bench includes name, description, coordinates, tags
    - Placeholder photos from Pexels stored in photos array
    - Distributed across SF neighborhoods (Castro, Mission, Marina, Dolores Park, etc.)
    - Set verification_status to 'verified' and credibility_score to 100
    - No founding_user_id (system-created benches)

  4. Notes
    - These benches demonstrate the personality and storytelling aspect of the platform
    - Coordinates are realistic SF locations
    - Tags help categorize different bench use cases
*/

-- Insert example benches with personality
INSERT INTO benches (
  name,
  description,
  latitude,
  longitude,
  tags,
  photos,
  verification_status,
  credibility_score,
  confirmation_count,
  is_seed_data
) VALUES
(
  'The Break-Up Bench',
  'Not every conversation here ends happily. But it''s quiet, private, and strangely comforting.',
  37.7599,
  -122.4364,
  ARRAY['emotional', 'quiet', 'thinking'],
  ARRAY['https://images.pexels.com/photos/207896/pexels-photo-207896.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The Morning Coffee Bench',
  'Perfect for coffee, sunshine, and pretending you''re about to be productive.',
  37.7749,
  -122.4194,
  ARRAY['coffee', 'morning', 'relaxing'],
  ARRAY['https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The Sandwich Bench',
  'Ideal lunch bench. Designed for sandwiches, chips, and a moment of peace.',
  37.7599,
  -122.4148,
  ARRAY['lunch', 'food', 'break'],
  ARRAY['https://images.pexels.com/photos/1509582/pexels-photo-1509582.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The People-Watching Championship Bench',
  'Elite people-watching location. Street performers, tourists, dogs, and chaos.',
  37.8024,
  -122.4058,
  ARRAY['people-watching', 'lively', 'social'],
  ARRAY['https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The Thinking Bench',
  'The kind of bench you sit on when you need to figure something out.',
  37.7599,
  -122.4274,
  ARRAY['thinking', 'quiet', 'reflective'],
  ARRAY['https://images.pexels.com/photos/931007/pexels-photo-931007.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The Sunset Bench',
  'A perfect place to sit when the sky starts turning orange.',
  37.8024,
  -122.4450,
  ARRAY['sunset', 'scenic', 'relaxing'],
  ARRAY['https://images.pexels.com/photos/531756/pexels-photo-531756.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The Dog-Watching Bench',
  'A steady parade of dogs passes by here. 10/10 bench for dog lovers.',
  37.7599,
  -122.4234,
  ARRAY['dogs', 'people-watching', 'park'],
  ARRAY['https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The "Call your Mom" Bench',
  'Perfect for long phone calls.',
  37.7699,
  -122.4294,
  ARRAY['relaxing', 'timewarp', 'chill'],
  ARRAY['https://images.pexels.com/photos/158780/park-bench-sun-seating-relaxation-158780.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The Reading Bench',
  'Quiet enough to finish a chapter without interruption.',
  37.7749,
  -122.4294,
  ARRAY['reading', 'quiet', 'peaceful'],
  ARRAY['https://images.pexels.com/photos/276517/pexels-photo-276517.jpeg'],
  'verified',
  100,
  5,
  true
),
(
  'The Life Decision Bench',
  'Big life decisions have definitely been made here.',
  37.7599,
  -122.4312,
  ARRAY['thinking', 'reflective', 'peaceful'],
  ARRAY['https://images.pexels.com/photos/531321/pexels-photo-531321.jpeg'],
  'verified',
  100,
  5,
  true
);