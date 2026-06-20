/*
  # Add Nearby Benches Function
  
  1. Functions
    - `find_nearby_benches` - Finds benches within a specified radius of a location
  
  2. Notes
    - Uses the Haversine formula to calculate distances
    - Returns benches sorted by distance
    - Distance is returned in meters
*/

CREATE OR REPLACE FUNCTION find_nearby_benches(
  lat_param decimal,
  lng_param decimal,
  radius_meters integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  latitude decimal,
  longitude decimal,
  distance_meters decimal
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
    ) as distance_meters
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
