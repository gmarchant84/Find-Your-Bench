/*
  # Seed benches for Palo Alto

  Adds 20 believable, real-location benches across Palo Alto.

  ## Areas covered
  - Rinconada Park (5 benches)
  - Foothills Park (6 benches)
  - Downtown Palo Alto / University Ave corridor (4 benches)
  - Stanford University / Dish Trail area (3 benches)
  - Baylands Nature Preserve (2 benches)

  All rows marked is_seed_data = true and verification_status = 'verified'.
*/

INSERT INTO benches (name, latitude, longitude, description, tags, verification_status, credibility_score, confirmation_count, average_rating, total_ratings, is_seed_data, vibe_category) VALUES

-- Rinconada Park (5)
('Rinconada Park Rose Garden Bench',         37.44210, -122.13830, 'Inside the fragrant rose garden on the south end of Rinconada Park. Quiet on weekday mornings and buzzing with families on weekends.', ARRAY['scenic','quiet'], 'verified', 84, 4, 4.7, 10, true, 'peaceful'),
('Rinconada Pool Lawn Bench',                37.44310, -122.13690, 'Shaded bench on the lawn beside the Rinconada Pool building. Lively in summer, serene the rest of the year.', ARRAY['shady','people-watching'], 'verified', 76, 3, 4.4, 7, true, 'social'),
('Rinconada Park Duck Pond Bench',           37.44160, -122.13530, 'Faces the small duck pond at the heart of the park. Turtles sunbathe on the logs in the afternoon.', ARRAY['scenic','quiet'], 'verified', 82, 4, 4.6, 9, true, 'peaceful'),
('Rinconada Park Playground Bench',          37.44390, -122.13600, 'Beside the main playground structure — ideal for parents while kids play. Shaded by mature sycamores.', ARRAY['shady','family'], 'verified', 73, 3, 4.3, 6, true, 'family'),
('Rinconada Park North Meadow Bench',        37.44470, -122.13720, 'On the edge of the open north meadow, catching afternoon sun. Good view of the whole park.', ARRAY['sunny','quiet'], 'verified', 78, 3, 4.5, 8, true, 'quiet'),

-- Foothills Park (6)
('Foothills Park Lake View Bench',           37.37410, -122.16180, 'Overlooks the reservoir lake from the main picnic area. Herons wade in the shallows below.', ARRAY['scenic','quiet'], 'verified', 91, 5, 4.9, 14, true, 'scenic'),
('Foothills Park Ridge Trail Bench',         37.37020, -122.16520, 'Midway up the ridge trail with an open view east toward the bay and the South Bay flatlands.', ARRAY['scenic','adventurous'], 'verified', 87, 4, 4.8, 12, true, 'adventurous'),
('Foothills Park Arastradero Meadow Bench',  37.36790, -122.16090, 'In the rolling meadow near the Arastradero trailhead. Golden grasses in summer, green in spring.', ARRAY['scenic','sunny'], 'verified', 83, 4, 4.6, 9, true, 'peaceful'),
('Foothills Park Oak Woodland Bench',        37.37260, -122.16740, 'Under a sprawling valley oak near the woodland picnic area. Deep shade and birdsong all day.', ARRAY['shady','quiet'], 'verified', 80, 3, 4.6, 8, true, 'peaceful'),
('Foothills Park Summit Overlook Bench',     37.37650, -122.16850, 'Near the highest accessible point of Foothills Park — on a clear day you can see both the bay and the Santa Cruz Mountains.', ARRAY['scenic','lunch'], 'verified', 93, 5, 4.9, 15, true, 'scenic'),
('Foothills Park Creek Crossing Bench',      37.37130, -122.16300, 'Beside a seasonal creek crossing on the lower loop trail. Woodpeckers are active in the oaks above.', ARRAY['quiet','shady'], 'verified', 77, 3, 4.5, 7, true, 'quiet'),

-- Downtown Palo Alto / University Ave (4)
('University Ave Median Bench',              37.44820, -122.15990, 'On the planted median of University Avenue near Ramona Street. Watch the steady parade of bikes, students, and locals.', ARRAY['people-watching','sunny'], 'verified', 75, 3, 4.3, 7, true, 'social'),
('Lytton Plaza Corner Bench',                37.44730, -122.16100, 'In Lytton Plaza at the corner of University and Emerson. Farmers market buzz on Saturday mornings, cafe calm the rest of the week.', ARRAY['people-watching','lunch'], 'verified', 81, 4, 4.5, 9, true, 'people-watching'),
('Hamilton Avenue Park Bench',               37.44540, -122.16150, 'Small vest-pocket park bench on Hamilton Ave. A quiet escape two blocks off University.', ARRAY['quiet','shady'], 'verified', 72, 2, 4.3, 6, true, 'quiet'),
('Palo Alto Art Center Garden Bench',        37.44620, -122.14950, 'In the sculpture garden of the Palo Alto Art Center. Changing outdoor installations make every visit different.', ARRAY['scenic','quiet'], 'verified', 79, 3, 4.5, 8, true, 'peaceful'),

-- Stanford / Dish Trail area (3)
('Dish Trail West Summit Bench',             37.40450, -122.17360, 'At the high point of the Dish Loop with a full panorama: the bay to the east, the ocean hills to the west.', ARRAY['scenic','lunch'], 'verified', 95, 5, 4.9, 18, true, 'scenic'),
('Dish Trail Lower Loop Bench',              37.40950, -122.17090, 'Shaded rest stop on the lower section of the Dish Trail loop, popular with Stanford students and faculty.', ARRAY['shady','quiet'], 'verified', 82, 4, 4.6, 9, true, 'peaceful'),
('Stanford Arboretum Bench',                 37.40330, -122.16640, 'Inside the Peter Coyote Native Plant Garden on the Stanford campus edge. Peaceful and rarely crowded.', ARRAY['quiet','scenic'], 'verified', 80, 3, 4.6, 8, true, 'quiet'),

-- Baylands Nature Preserve (2)
('Baylands Observation Platform Bench',      37.45620, -122.10880, 'At the Lucy Evans Nature Interpretive Center dock. Watch shorebirds work the mudflats at low tide.', ARRAY['scenic','quiet'], 'verified', 86, 4, 4.7, 11, true, 'peaceful'),
('Baylands Slough Trail Bench',              37.46080, -122.11240, 'Along the levee trail deeper into the preserve. Wind, marsh grass, and the quiet hum of the bay.', ARRAY['scenic','adventurous'], 'verified', 83, 4, 4.6, 9, true, 'adventurous');
