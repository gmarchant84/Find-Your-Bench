-- Regional Bench of the Day. The old function featured one bench for the whole
-- world and ignored max_distance_miles, so most users saw a bench thousands of
-- miles away. With a location it now picks, for the day, a nearby bench from the
-- closest ring (10 mi, 25 mi, then max_distance_miles) that has one: real
-- (not seeded), visible, with a photo, preferring rated 4+. The pick is stable
-- for everyone in an area all day (md5 of date + bench id) and needs no writes.
-- Without a location, or with nothing nearby, it falls back to the global pick.

ALTER FUNCTION public.get_bench_of_the_day(double precision, double precision, double precision)
  RENAME TO get_global_bench_of_the_day;
REVOKE EXECUTE ON FUNCTION public.get_global_bench_of_the_day(double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_bench_of_the_day(
  user_lat double precision DEFAULT NULL,
  user_lng double precision DEFAULT NULL,
  max_distance_miles double precision DEFAULT 50
)
RETURNS TABLE(id uuid, name text, description text, latitude double precision, longitude double precision,
              photo_url text, average_rating numeric, total_ratings bigint, distance_miles double precision,
              is_verified boolean, founder_username text, founder_is_founding_bencher boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pick uuid;
  v_ring double precision;
  v_max double precision := LEAST(GREATEST(COALESCE(max_distance_miles, 50), 1), 250);
BEGIN
  IF user_lat IS NOT NULL AND user_lng IS NOT NULL
     AND user_lat BETWEEN -90 AND 90 AND user_lng BETWEEN -180 AND 180 THEN
    FOREACH v_ring IN ARRAY ARRAY[LEAST(10, v_max), LEAST(25, v_max), v_max] LOOP
      SELECT c.id INTO v_pick
      FROM (
        SELECT b.id, b.average_rating,
               3959 * acos(LEAST(1.0,
                 cos(radians(user_lat)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(user_lng)) +
                 sin(radians(user_lat)) * sin(radians(b.latitude)))) AS d
        FROM benches b
        WHERE b.is_seeded = false
          AND b.is_hidden IS NOT TRUE
          AND COALESCE(array_length(b.photos, 1), 0) > 0
          -- cheap bounding box before the exact distance
          AND b.latitude BETWEEN user_lat - v_ring / 69.0 AND user_lat + v_ring / 69.0
      ) c
      WHERE c.d <= v_ring
      ORDER BY (COALESCE(c.average_rating, 0) >= 4) DESC, md5(CURRENT_DATE::text || c.id::text)
      LIMIT 1;
      EXIT WHEN v_pick IS NOT NULL;
    END LOOP;
  END IF;

  IF v_pick IS NULL THEN
    RETURN QUERY SELECT * FROM public.get_global_bench_of_the_day(user_lat, user_lng, max_distance_miles);
    RETURN;
  END IF;

  RETURN QUERY
    SELECT b.id, b.name, b.description,
           b.latitude::double precision, b.longitude::double precision,
           b.photos[1]::text,
           COALESCE(b.average_rating, 0)::numeric,
           COALESCE(b.total_ratings, 0)::bigint,
           3959 * acos(LEAST(1.0,
             cos(radians(user_lat)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(user_lng)) +
             sin(radians(user_lat)) * sin(radians(b.latitude)))),
           (b.verification_status = 'verified'),
           p.username::text,
           COALESCE(p.is_founding_bencher, false)
    FROM benches b
    LEFT JOIN profiles p ON p.id = b.founding_user_id
    WHERE b.id = v_pick;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_bench_of_the_day(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bench_of_the_day(double precision, double precision, double precision) TO anon, authenticated;
