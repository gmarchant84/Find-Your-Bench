/*
  # Fix Nearby Benches Function Conflict
  
  1. Changes
    - Drop all existing find_nearby_benches functions
    - Create a single consistent version with numeric parameters
  
  2. Notes
    - Resolves the function overloading ambiguity
    - Uses numeric type for all parameters for consistency
*/

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS find_nearby_benches(decimal, decimal, integer);
DROP FUNCTION IF EXISTS find_nearby_benches(numeric, numeric, numeric);
DROP FUNCTION IF EXISTS find_nearby_benches(numeric, numeric, integer);

-- Create the definitive version with all numeric parameters
CREATE FUNCTION find_nearby_benches(
  lat_param numeric,
  lng_param numeric,
  radius_meters numeric DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  latitude numeric,
  longitude numeric,
  distance_meters numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.latitude,
    b.longitude,
    (
      6371000 * acos(
        cos(radians(lat_param)) * 
        cos(radians(b.latitude::float)) * 
        cos(radians(b.longitude::float) - radians(lng_param)) + 
        sin(radians(lat_param)) * 
        sin(radians(b.latitude::float))
      )
    )::numeric as distance_meters
  FROM benches b
  WHERE (
    6371000 * acos(
      cos(radians(lat_param)) * 
      cos(radians(b.latitude::float)) * 
      cos(radians(b.longitude::float) - radians(lng_param)) + 
      sin(radians(lat_param)) * 
      sin(radians(b.latitude::float))
    )
  ) <= radius_meters
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
