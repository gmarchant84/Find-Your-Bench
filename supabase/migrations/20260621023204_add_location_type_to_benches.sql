-- RECONSTRUCTED 2026-08-31 from the live database schema (originally applied
-- via Bolt's database console on 2026-06-21; the original file was never
-- committed to any repo). Definition below matches the live column exactly:
-- nullable text, no default, with a CHECK constraint on allowed values.
-- No rows currently use this column (all 291 benches have NULL).

ALTER TABLE public.benches ADD COLUMN location_type text;

ALTER TABLE public.benches ADD CONSTRAINT benches_location_type_check
  CHECK (location_type = ANY (ARRAY[
    'downtown', 'neighborhood', 'waterfront', 'trail', 'state-park',
    'beach', 'campus', 'cemetery', 'rooftop', 'plaza', 'other'
  ]));
