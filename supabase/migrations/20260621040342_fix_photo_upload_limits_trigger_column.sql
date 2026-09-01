CREATE OR REPLACE FUNCTION public.check_photo_upload_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
uploads_last_hour  integer;
uploads_last_day   integer;
uploads_this_bench integer;
BEGIN
SELECT COUNT(*) INTO uploads_last_hour
FROM bench_photos
WHERE user_id = NEW.user_id
AND uploaded_at > now() - interval '1 hour';

IF uploads_last_hour >= 10 THEN
RAISE EXCEPTION 'Upload limit reached: maximum 10 photos per hour.';
END IF;

SELECT COUNT(*) INTO uploads_last_day
FROM bench_photos
WHERE user_id = NEW.user_id
AND uploaded_at > now() - interval '24 hours';

IF uploads_last_day >= 50 THEN
RAISE EXCEPTION 'Upload limit reached: maximum 50 photos per day.';
END IF;

SELECT COUNT(*) INTO uploads_this_bench
FROM bench_photos
WHERE user_id = NEW.user_id
AND bench_id = NEW.bench_id;

IF uploads_this_bench >= 5 THEN
RAISE EXCEPTION 'Upload limit reached: maximum 5 photos per bench.';
END IF;

RETURN NEW;
END;
$function$;
