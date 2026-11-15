-- Launch data cleanup (approved list items 1-5). Nothing is deleted:
-- test and duplicate benches are hidden (is_hidden = true, duplicates also get
-- duplicate_of), and a full copy of every table is in schema backup_20261115.
-- Runs as the migration owner, so benches_protect_columns does not apply.


-- 2 and 5. Remove Pexels stock photos (includes the 404 "Call your Mom" photo).
--    First, so verification below is computed without them.
UPDATE public.benches b
SET photos = NULLIF(ARRAY(SELECT p FROM unnest(b.photos) p WHERE p NOT LIKE '%images.pexels.com%'), '{}')
WHERE EXISTS (SELECT 1 FROM unnest(b.photos) p WHERE p LIKE '%images.pexels.com%');

-- 1. Seeded benches: replace invented ratings and "Verified" status with what
--    real users actually did (same formulas as the rating and confirmation triggers).
UPDATE public.benches b
SET average_rating = COALESCE((SELECT AVG(r.overall) FROM public.ratings r WHERE r.bench_id = b.id), 0),
    total_ratings  = (SELECT COUNT(*) FROM public.ratings r WHERE r.bench_id = b.id)
WHERE b.is_seeded;

DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.benches WHERE is_seeded LOOP
    UPDATE public.benches
    SET verification_status = 'unverified',
        confirmation_count  = (SELECT COUNT(*) FROM public.bench_confirmations c WHERE c.bench_id = v_id)
    WHERE id = v_id;
    PERFORM public.update_bench_verification_status(v_id);
    PERFORM public.calculate_credibility_score(v_id);
  END LOOP;
END $$;

-- 3. Hide test and joke benches.
UPDATE public.benches
SET is_hidden = true
WHERE id IN (
  'c9cb34c5-9112-40e1-9ce7-37daf781b110', '522ffe27-4e0d-4b19-abf3-4e9cc48a3a60',
  '35a188f6-4b95-46e1-aae3-a7b8dc5ed3bd', 'da68c6b3-129d-4316-ab73-5e1e41e03026',
  'a2c9d8cc-120d-417b-a652-19b1194307f4',               -- Pels pels pels pels pels x5
  '96e839be-9b95-483e-9715-dd87cdbb7a98', '9277fa90-b099-479a-b196-5907cbbf41f3', -- Pels Swimming in Sour Cream x2
  '57eb4528-6c7b-4f77-8c9a-0b6402ae5916'                -- Red Dog Saloon Decompressor
);

-- 4. Hide exact-coordinate duplicates. Keep the copy with the most ratings,
--    then photos, then saves/visits, then the oldest.
WITH g AS (
  SELECT b.id, round(b.latitude::numeric, 6) la, round(b.longitude::numeric, 6) lo, b.created_at,
         COALESCE(array_length(b.photos, 1), 0) np,
         (SELECT COUNT(*) FROM public.ratings r WHERE r.bench_id = b.id) nr,
         (SELECT COUNT(*) FROM public.saved_benches s WHERE s.bench_id = b.id)
           + (SELECT COUNT(*) FROM public.visited_benches v WHERE v.bench_id = b.id) ns
  FROM public.benches b
  WHERE b.is_hidden IS NOT TRUE
), d AS (
  SELECT id,
         first_value(id) OVER w AS keeper,
         row_number() OVER w AS rn
  FROM g
  WINDOW w AS (PARTITION BY la, lo ORDER BY nr DESC, np DESC, ns DESC, created_at, id)
)
UPDATE public.benches b
SET is_hidden = true, duplicate_of = d.keeper
FROM d
WHERE b.id = d.id AND d.rn > 1;

