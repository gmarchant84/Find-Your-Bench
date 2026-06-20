/*
  # Seed 20 benches around downtown Juneau, Alaska

  Adds 20 benches spread across downtown Juneau, the waterfront, and nearby landmarks.
  Notable benches include:
  - "Walrus Viewing" on the waterfront near the cruise ship docks
  - "Pels Swimming in Sour Cream" near Tracy's Crab Shack
  All marked as seed data and verified.
*/

INSERT INTO benches (name, original_name, latitude, longitude, description, tags, verification_status, confirmation_count, credibility_score, is_seed_data, vibe_category)
VALUES
  (
    'Walrus Viewing',
    'Walrus Viewing',
    58.30012, -134.41230,
    'Prime waterfront perch right on Gastineau Channel. Keep your eyes peeled for the occasional sea lion or harbor seal drifting by — locals swear they''ve seen walruses. The cruise ships make for a surprisingly entertaining backdrop.',
    ARRAY['waterfront', 'wildlife', 'views', 'sunny'],
    'verified', 5, 95, true, 'scenic'
  ),
  (
    'Pels Swimming in Sour Cream',
    'Pels Swimming in Sour Cream',
    58.30048, -134.41965,
    'Tucked just around the corner from Tracy''s Crab Shack. You''ll sit here in a butter-and-Old-Bay haze wondering why you didn''t order the crab bisque too. Perfect post-seafood decompress bench.',
    ARRAY['food', 'waterfront', 'downtown', 'quirky'],
    'verified', 5, 95, true, 'social'
  ),
  (
    'Governor''s Lawn Lounger',
    'Governor''s Lawn Lounger',
    58.30183, -134.41872,
    'Faces the Governor''s mansion. Stately, a little smug, but the flower beds are genuinely excellent in summer.',
    ARRAY['historic', 'downtown', 'gardens'],
    'verified', 4, 88, true, 'peaceful'
  ),
  (
    'Capitol Steps Perch',
    'Capitol Steps Perch',
    58.30112, -134.41744,
    'Right across from the Alaska State Capitol. Great for watching the occasional protest, lobbyist speed-walk, or just the pigeons doing their thing.',
    ARRAY['historic', 'downtown', 'people-watching'],
    'verified', 4, 88, true, 'social'
  ),
  (
    'Marine Park Driftwood',
    'Marine Park Driftwood',
    58.29978, -134.40965,
    'Down at Marine Park where the floatplanes roar in low overhead. Every few minutes something loud and seaworthy goes by. Bring a windbreaker.',
    ARRAY['waterfront', 'floatplanes', 'windy', 'views'],
    'verified', 5, 92, true, 'scenic'
  ),
  (
    'Seward Street Switchback',
    'Seward Street Switchback',
    58.30244, -134.41590,
    'Halfway up the Seward Street steps — a mercy bench placed by someone who clearly made this climb in dress shoes once.',
    ARRAY['stairs', 'views', 'rest-stop', 'quirky'],
    'verified', 3, 80, true, 'adventurous'
  ),
  (
    'Gold Creek Contemplation Bench',
    'Gold Creek Contemplation Bench',
    58.30520, -134.40380,
    'Beside Gold Creek where it cuts through Cope Park. The creek is shockingly clear and cold. You''ll hear it before you see the bench.',
    ARRAY['creek', 'park', 'nature', 'quiet'],
    'verified', 4, 85, true, 'peaceful'
  ),
  (
    'Cope Park Canopy',
    'Cope Park Canopy',
    58.30490, -134.40520,
    'Shaded by a big Sitka spruce that''s been there longer than the city has. Damp in the best way.',
    ARRAY['park', 'shaded', 'trees', 'nature'],
    'verified', 3, 78, true, 'peaceful'
  ),
  (
    'Ferry Terminal Farewell',
    'Ferry Terminal Farewell',
    58.29801, -134.40612,
    'At the downtown ferry terminal. Half the people here are saying goodbye, the other half are nursing the same coffee from three hours ago. Good energy.',
    ARRAY['ferry', 'waterfront', 'people-watching', 'transportation'],
    'verified', 4, 86, true, 'social'
  ),
  (
    'Egan Drive Wind Break',
    'Egan Drive Wind Break',
    58.30071, -134.41455,
    'On the pedestrian strip along Egan Drive. The channel is right there and the mountains across the water are genuinely absurd in their size.',
    ARRAY['waterfront', 'views', 'mountains', 'windy'],
    'verified', 4, 84, true, 'scenic'
  ),
  (
    'St. Nicholas Church Overlook',
    'St. Nicholas Church Overlook',
    58.30298, -134.41702,
    'Next to the little octagonal Russian Orthodox church — one of the oldest buildings in Juneau. Cobblestones, history, and a great angle on the street below.',
    ARRAY['historic', 'church', 'views', 'quiet'],
    'verified', 3, 80, true, 'peaceful'
  ),
  (
    'Last Chance Basin Trailhead',
    'Last Chance Basin Trailhead',
    58.30850, -134.39410,
    'Where the Basin Road trail begins. Miners used to stage here. Now it''s mostly hikers adjusting their laces and tourists second-guessing their shoe choice.',
    ARRAY['trailhead', 'historic', 'hiking', 'nature'],
    'verified', 4, 87, true, 'adventurous'
  ),
  (
    'Amalga Flats Boardwalk',
    'Amalga Flats Boardwalk',
    58.30640, -134.39920,
    'On the boardwalk section past the flats. Boggy underfoot everywhere except exactly where you''re sitting. Excellent bird activity at dawn.',
    ARRAY['boardwalk', 'wetlands', 'birds', 'nature'],
    'verified', 3, 78, true, 'scenic'
  ),
  (
    'Red Dog Saloon Decompressor',
    'Red Dog Saloon Decompressor',
    58.30065, -134.41840,
    'Across the street from the Red Dog Saloon on South Franklin. A post-first-beer outdoor bench with a great view of the tourist shuffle.',
    ARRAY['downtown', 'nightlife', 'people-watching', 'franklin-street'],
    'verified', 4, 85, true, 'social'
  ),
  (
    'Franklin Street Turnaround',
    'Franklin Street Turnaround',
    58.30130, -134.41780,
    'Right in the heart of the South Franklin shopping strip. Midday people-watching is peak here when the cruise ships are in.',
    ARRAY['downtown', 'shopping', 'people-watching', 'busy'],
    'verified', 3, 76, true, 'social'
  ),
  (
    'Chicken Ridge Quiet Corner',
    'Chicken Ridge Quiet Corner',
    58.30420, -134.41880,
    'Up in the Chicken Ridge neighborhood where the old Victorian houses start. Peaceful, slightly steep, and totally ignored by tourists.',
    ARRAY['neighborhood', 'quiet', 'historic', 'residential'],
    'verified', 3, 75, true, 'peaceful'
  ),
  (
    'Douglas Island Ferry View',
    'Douglas Island Ferry View',
    58.29890, -134.41050,
    'Looking west across Gastineau Channel toward Douglas Island. The inter-island ferry zips past here. On clear days Mount Jumbo is fully ridiculous.',
    ARRAY['waterfront', 'views', 'mountains', 'ferry'],
    'verified', 4, 88, true, 'scenic'
  ),
  (
    'Juneau Library Terrace',
    'Juneau Library Terrace',
    58.30195, -134.41640,
    'On the terrace outside the Juneau Public Library. Good Wi-Fi bleed-through if you need it, complete respectability if you don''t.',
    ARRAY['library', 'downtown', 'quiet', 'shaded'],
    'verified', 3, 79, true, 'peaceful'
  ),
  (
    'Five Star Junction',
    'Five Star Junction',
    58.30305, -134.41410,
    'At the intersection where four streets converge into something only Juneau''s topography could produce. Surprisingly calm in the eye of it.',
    ARRAY['downtown', 'intersection', 'quirky', 'urban'],
    'verified', 3, 74, true, 'social'
  ),
  (
    'Treadwell Ditch Trailhead Rest',
    'Treadwell Ditch Trailhead Rest',
    58.30750, -134.40150,
    'At the lower trailhead for the Treadwell Ditch trail. The old mining ditch runs right behind you and you can hear the water moving through it year-round.',
    ARRAY['trailhead', 'historic', 'water', 'nature', 'hiking'],
    'verified', 4, 86, true, 'adventurous'
  );
