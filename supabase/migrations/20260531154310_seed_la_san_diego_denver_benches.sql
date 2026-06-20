/*
  # Seed benches for Los Angeles, San Diego, and Denver

  Adds believable, real-location benches for three early-user cities.

  ## Los Angeles (25 benches)
  Anchor parks: Griffith Park, Runyon Canyon Park, Echo Park Lake,
  Kenneth Hahn State Recreation Area — plus Silver Lake, Elysian Park,
  Exposition Park, Santa Monica Palisades, and Lacy Park.

  ## San Diego (17 benches)
  Anchor parks: Balboa Park, Sunset Cliffs Natural Park, Kate Sessions Park
  — plus Embarcadero, Waterfront Park, Mission Bay, and Coronado.

  ## Denver (17 benches)
  Anchor parks: Washington Park, City Park, Sloan's Lake Park
  — plus Cheesman Park, Congress Park, Commons Park, and Confluence Park.

  All rows are marked is_seed_data = true and verification_status = 'verified'.
*/

INSERT INTO benches (name, latitude, longitude, description, tags, verification_status, credibility_score, confirmation_count, average_rating, total_ratings, is_seed_data, vibe_category) VALUES

-- ============================================================
-- LOS ANGELES
-- ============================================================

-- Griffith Park (6)
('Griffith Observatory Lawn Bench',        34.11865, -118.30027, 'Faces west toward the Hollywood Sign with the entire LA basin stretching below. Best at golden hour.', ARRAY['scenic','people-watching'], 'verified', 85, 4, 4.7, 12, true, 'scenic'),
('Griffith Park Trail Overlook',           34.12440, -118.29610, 'Quiet bench along the Hollyridge Trail with a clear view of the Griffith Observatory dome.', ARRAY['scenic','quiet'], 'verified', 80, 3, 4.5, 8, true, 'peaceful'),
('Fern Dell Shaded Rest',                  34.10710, -118.30560, 'Tucked under giant ferns beside the Fern Dell stream. Cool and shady even on the hottest LA days.', ARRAY['shady','quiet'], 'verified', 78, 3, 4.6, 9, true, 'peaceful'),
('Greek Theatre Entrance Bench',           34.11420, -118.29880, 'Wooden bench near the Greek Theatre main entrance, under mature oak trees.', ARRAY['shady','people-watching'], 'verified', 72, 2, 4.3, 6, true, 'social'),
('Griffith Park Pony Ride Meadow Bench',   34.12680, -118.27540, 'Faces the open meadow by the Travel Town area. Families and dog walkers pass all day.', ARRAY['sunny','people-watching'], 'verified', 70, 2, 4.2, 5, true, 'family'),
('Mount Hollywood Summit Bench',           34.12270, -118.30520, 'At the top of Mount Hollywood Trail — panoramic 360° view of the entire LA basin, ocean on clear days.', ARRAY['scenic','lunch'], 'verified', 92, 5, 4.9, 15, true, 'adventurous'),

-- Runyon Canyon Park (4)
('Runyon Canyon Summit Bench',             34.10985, -118.35440, 'Top of the canyon with sweeping views of the Hollywood Hills and downtown skyline.', ARRAY['scenic','people-watching'], 'verified', 88, 4, 4.8, 11, true, 'scenic'),
('Runyon Canyon Dog Run Bench',            34.10420, -118.35290, 'Beside the upper dog run — perfect for watching dogs play against a backdrop of the hills.', ARRAY['people-watching','sunny'], 'verified', 76, 3, 4.4, 7, true, 'social'),
('Runyon Lower Trail Rest Bench',          34.09878, -118.35182, 'Shaded bench partway up the main trail, good resting spot with a view toward Hollywood.', ARRAY['shady','quiet'], 'verified', 73, 3, 4.3, 6, true, 'peaceful'),
('Runyon Canyon Mulholland Entry Bench',   34.11322, -118.35610, 'At the Mulholland Drive entrance, facing south toward the city grid.', ARRAY['scenic','lunch'], 'verified', 79, 3, 4.5, 8, true, 'scenic'),

-- Echo Park Lake (4)
('Echo Park Lake Lotus Bed Bench',         34.07780, -118.26040, 'Right beside the famous lotus bed — spectacular in summer bloom, peaceful year-round.', ARRAY['scenic','quiet'], 'verified', 86, 4, 4.7, 10, true, 'romantic'),
('Echo Park Lake North Shore Bench',       34.07890, -118.26210, 'Shaded by tall palms on the north shore, facing the downtown skyline across the water.', ARRAY['scenic','people-watching'], 'verified', 82, 4, 4.6, 9, true, 'scenic'),
('Echo Park Boathouse Bench',              34.07700, -118.26130, 'Near the pedal boat dock. Watch paddlers glide across the lake with the city behind them.', ARRAY['people-watching','sunny'], 'verified', 74, 3, 4.4, 7, true, 'social'),
('Echo Park Duck Pond Corner Bench',       34.07640, -118.25980, 'Quiet corner bench frequented by ducks and turtles. Great for reading on a weekday morning.', ARRAY['quiet','shady'], 'verified', 71, 2, 4.5, 8, true, 'peaceful'),

-- Kenneth Hahn State Recreation Area (3)
('Kenneth Hahn Japanese Garden Bench',     33.98820, -118.35750, 'Overlooks the Japanese garden pond with koi and stepping stones. One of the most serene spots in LA.', ARRAY['scenic','quiet'], 'verified', 84, 4, 4.8, 11, true, 'peaceful'),
('Kenneth Hahn Summit View Bench',         33.99150, -118.36050, 'Hilltop bench with a clear view of LAX flight paths and the Pacific on clear days.', ARRAY['scenic','sunny'], 'verified', 81, 3, 4.6, 9, true, 'scenic'),
('Kenneth Hahn Meadow Picnic Bench',       33.98630, -118.35540, 'In the meadow picnic area, shaded by mature trees. Busy on weekends, peaceful on weekdays.', ARRAY['shady','lunch'], 'verified', 75, 3, 4.3, 7, true, 'family'),

-- Elysian Park (2)
('Elysian Park Angels Point Bench',        34.08650, -118.24540, 'Angels Point overlook — arguably the best view of Dodger Stadium and the Elysian hills.', ARRAY['scenic','people-watching'], 'verified', 83, 4, 4.7, 10, true, 'scenic'),
('Elysian Park Rose Garden Bench',         34.08240, -118.24030, 'Beside the historic Elysian Park rose garden, fragrant in spring with downtown views beyond.', ARRAY['scenic','quiet'], 'verified', 77, 3, 4.5, 8, true, 'romantic'),

-- Silver Lake (2)
('Silver Lake Reservoir Trail Bench',      34.09220, -118.27160, 'On the walking path circling the reservoir, with calm water reflections and bird activity.', ARRAY['scenic','quiet'], 'verified', 80, 3, 4.6, 9, true, 'peaceful'),
('Silver Lake Meadow Bench',               34.09060, -118.27390, 'In the meadow park beside the reservoir. Popular with locals for afternoon reading.', ARRAY['sunny','quiet'], 'verified', 73, 2, 4.4, 6, true, 'quiet'),

-- Santa Monica (2)
('Palisades Park Bluff Bench',             34.01440, -118.50720, 'Clifftop bench above the PCH with unobstructed Pacific Ocean views and cool ocean breeze.', ARRAY['scenic','quiet'], 'verified', 90, 5, 4.9, 14, true, 'romantic'),
('Santa Monica Pier North Bench',          34.00930, -118.49720, 'Just north of the pier, facing the water. Watch surfers and the ferris wheel from a quiet vantage.', ARRAY['scenic','people-watching'], 'verified', 85, 4, 4.7, 11, true, 'scenic'),

-- Exposition Park (2)
('Exposition Park Rose Garden Bench',      34.01800, -118.28610, 'Inside the sunken rose garden — thousands of blooms surround this bench in spring.', ARRAY['scenic','quiet'], 'verified', 82, 4, 4.6, 9, true, 'romantic'),
('Exposition Park Museum Lawn Bench',      34.01990, -118.28530, 'On the lawn between the Natural History Museum and the California Science Center.', ARRAY['people-watching','sunny'], 'verified', 74, 3, 4.3, 7, true, 'family'),

-- Lacy Park, San Marino (1)
('Lacy Park Fountain Bench',               34.12010, -118.10390, 'Across from the central fountain in one of the most manicured parks in the LA area.', ARRAY['scenic','quiet'], 'verified', 79, 3, 4.5, 8, true, 'peaceful'),

-- ============================================================
-- SAN DIEGO
-- ============================================================

-- Balboa Park (6)
('Balboa Park Lily Pond Bench',            32.73140, -117.15060, 'Faces the Botanical Building reflected in the lily pond — one of the most photographed spots in San Diego.', ARRAY['scenic','quiet'], 'verified', 91, 5, 4.9, 16, true, 'romantic'),
('Balboa Park Organ Pavilion Bench',       32.72940, -117.14960, 'Stone bench in front of the outdoor organ pavilion. Free Sunday concerts fill the air with music.', ARRAY['people-watching','sunny'], 'verified', 85, 4, 4.7, 12, true, 'social'),
('Balboa Park Spanish Village Bench',      32.73390, -117.14840, 'Shaded bench in the artists'' quarter of the Spanish Village, surrounded by art studios.', ARRAY['shady','quiet'], 'verified', 78, 3, 4.5, 8, true, 'peaceful'),
('Balboa Park Cabrillo Bridge Bench',      32.73000, -117.15430, 'At the east end of the Cabrillo Bridge, overlooking the Cabrillo Freeway canyon and palms.', ARRAY['scenic','people-watching'], 'verified', 83, 4, 4.6, 10, true, 'scenic'),
('Balboa Park Rose Garden Bench',          32.73550, -117.15220, 'Inside the International Cottages garden, fragrant roses on three sides.', ARRAY['scenic','quiet'], 'verified', 80, 3, 4.6, 9, true, 'romantic'),
('Balboa Park Alcazar Garden Bench',       32.72820, -117.15140, 'In the geometric Alcazar Garden with fountains and colorful tile work inspired by Seville.', ARRAY['scenic','lunch'], 'verified', 82, 4, 4.7, 10, true, 'peaceful'),

-- Sunset Cliffs Natural Park (4)
('Sunset Cliffs Main Overlook Bench',      32.71630, -117.25460, 'At the most visited overlook — waves crash into sea caves directly below, glowing at sunset.', ARRAY['scenic','quiet'], 'verified', 94, 5, 4.9, 18, true, 'romantic'),
('Sunset Cliffs South Trail Bench',        32.71200, -117.25610, 'Less-visited southern section of the trail. Quieter, with the same dramatic cliffs and surf.', ARRAY['scenic','quiet'], 'verified', 87, 4, 4.8, 12, true, 'peaceful'),
('Sunset Cliffs Tide Pool Bench',          32.71920, -117.25320, 'Above the accessible tide pools. Watch the marine life at low tide from a comfortable seat.', ARRAY['scenic','sunny'], 'verified', 81, 3, 4.6, 9, true, 'adventurous'),
('Sunset Cliffs Ladera Street Bench',      32.72130, -117.25170, 'At the north end of the park with benches facing the Pacific. Popular with local surfers watching sets.', ARRAY['scenic','people-watching'], 'verified', 79, 3, 4.5, 8, true, 'social'),

-- Kate Sessions Park (3)
('Kate Sessions Park Summit Bench',        32.79990, -117.22690, 'At the hilltop of Kate Sessions Park with a panoramic view of Mission Bay, the airport, and downtown.', ARRAY['scenic','quiet'], 'verified', 89, 4, 4.8, 13, true, 'scenic'),
('Kate Sessions Park East Meadow Bench',   32.79870, -117.22510, 'In the open meadow on the east side, popular with families. Clear view of Mission Bay below.', ARRAY['sunny','family'], 'verified', 76, 3, 4.4, 7, true, 'family'),
('Kate Sessions Park Jacaranda Bench',     32.80080, -117.22820, 'Under a large jacaranda tree — brilliant purple canopy in May, cool shade the rest of the year.', ARRAY['shady','scenic'], 'verified', 82, 4, 4.6, 9, true, 'romantic'),

-- Embarcadero / Waterfront (2)
('Embarcadero Marina Bench',               32.71420, -117.17170, 'On the bayfront boardwalk with views of the USS Midway and Coronado Bridge.', ARRAY['scenic','people-watching'], 'verified', 86, 4, 4.7, 11, true, 'scenic'),
('Waterfront Park North Bench',            32.72310, -117.17380, 'Grassy hillock in Waterfront Park, looking out over the bay toward Coronado.', ARRAY['scenic','sunny'], 'verified', 80, 3, 4.5, 8, true, 'peaceful'),

-- Mission Bay (1)
('Mission Bay Tecolote Shores Bench',      32.77950, -117.22400, 'On the eastern shore of Mission Bay, facing the water. Pelicans and kayakers pass constantly.', ARRAY['scenic','quiet'], 'verified', 78, 3, 4.4, 7, true, 'peaceful'),

-- Coronado (1)
('Coronado Ferry Landing Bench',           32.69820, -117.17680, 'At the Ferry Landing on Coronado Island, facing the San Diego skyline across the bay.', ARRAY['scenic','people-watching'], 'verified', 88, 4, 4.8, 12, true, 'romantic'),

-- ============================================================
-- DENVER
-- ============================================================

-- Washington Park (5)
('Washington Park Boat House Bench',       39.69840, -104.97590, 'Right on the edge of Smith Lake, facing the boathouse. Ducks and paddleboarders year round.', ARRAY['scenic','quiet'], 'verified', 87, 4, 4.7, 11, true, 'peaceful'),
('Washington Park Flower Garden Bench',    39.69660, -104.97530, 'Beside the formal garden — a riot of colour in summer, serene and frost-tinged in winter.', ARRAY['scenic','quiet'], 'verified', 84, 4, 4.7, 10, true, 'romantic'),
('Washington Park Loop Bench North',       39.70120, -104.97580, 'On the popular running loop, north side. Good people-watching and mountain views on clear days.', ARRAY['people-watching','sunny'], 'verified', 78, 3, 4.4, 7, true, 'social'),
('Washington Park Lily Pond Bench',        39.69510, -104.97470, 'Quiet corner beside the small lily pond on the south end of the park.', ARRAY['quiet','scenic'], 'verified', 80, 3, 4.6, 8, true, 'peaceful'),
('Washington Park Pavilion Bench',         39.69770, -104.97340, 'Under the shade of the historic pavilion structure. Great for reading on summer afternoons.', ARRAY['shady','lunch'], 'verified', 76, 3, 4.4, 6, true, 'quiet'),

-- City Park (5)
('City Park Lake Overlook Bench',          39.74780, -104.95180, 'Faces Ferril Lake with the Denver skyline and Rockies as backdrop — one of Denver''s iconic views.', ARRAY['scenic','people-watching'], 'verified', 93, 5, 4.9, 17, true, 'scenic'),
('City Park Duck Island Bench',            39.74660, -104.95040, 'Near the small duck island on Ferril Lake. Peaceful early mornings before the joggers arrive.', ARRAY['quiet','scenic'], 'verified', 82, 4, 4.6, 9, true, 'peaceful'),
('City Park Museum Lawn Bench',            39.74510, -104.94230, 'On the lawn facing the Denver Museum of Nature & Science with mountain views behind it.', ARRAY['scenic','sunny'], 'verified', 85, 4, 4.7, 11, true, 'scenic'),
('City Park Jazz Amphitheater Bench',      39.74870, -104.94960, 'Near the jazz amphitheater stage. Home to free City Park Jazz concerts on Sunday evenings in summer.', ARRAY['people-watching','social'], 'verified', 79, 3, 4.5, 8, true, 'social'),
('City Park Rose Garden Bench',            39.74310, -104.95390, 'Inside the formal rose garden on the west side of the park. Fragrant and quiet on weekday mornings.', ARRAY['scenic','quiet'], 'verified', 81, 3, 4.6, 8, true, 'romantic'),

-- Sloan's Lake Park (4)
('Sloan''s Lake East Shore Bench',         39.74630, -105.03610, 'East shore path with the best view of the Rockies framing the lake — classic Denver shot.', ARRAY['scenic','quiet'], 'verified', 91, 5, 4.9, 15, true, 'scenic'),
('Sloan''s Lake Pavilion Bench',           39.74820, -105.04050, 'Near the pavilion and boat launch on the north end. Busy on weekends, tranquil at dawn.', ARRAY['people-watching','sunny'], 'verified', 80, 3, 4.5, 8, true, 'social'),
('Sloan''s Lake South Loop Bench',         39.74250, -105.03850, 'On the quieter south section of the 2.6-mile loop. Fewer crowds, same stunning mountain backdrop.', ARRAY['scenic','quiet'], 'verified', 77, 3, 4.5, 7, true, 'peaceful'),
('Sloan''s Lake Inlet Cove Bench',         39.74490, -105.04230, 'Tucked into a small cove on the west side of the lake. Shielded from wind, great for watching sunsets.', ARRAY['scenic','quiet'], 'verified', 83, 4, 4.7, 9, true, 'romantic'),

-- Cheesman Park (1)
('Cheesman Park Pavilion Bench',           39.73310, -104.96040, 'Beside the neoclassical pavilion at the top of Cheesman Park. Views east across the Capitol Hill neighborhood.', ARRAY['scenic','people-watching'], 'verified', 81, 3, 4.5, 8, true, 'social'),

-- Commons Park (1)
('Commons Park Platte River Bench',        39.75680, -105.00600, 'On the grassy bluff in Commons Park overlooking the South Platte River and the Highlands skyline.', ARRAY['scenic','quiet'], 'verified', 82, 4, 4.6, 9, true, 'scenic'),

-- Confluence Park (1)
('Confluence Park Creek Junction Bench',   39.75420, -105.00940, 'Where Cherry Creek meets the South Platte — watch kayakers navigate the whitewater feature.', ARRAY['scenic','people-watching'], 'verified', 84, 4, 4.7, 10, true, 'adventurous');
