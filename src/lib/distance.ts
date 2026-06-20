export type DistanceUnit = 'miles' | 'km';

const METERS_TO_MILES = 0.000621371;
const METERS_TO_KM = 0.001;
const FEET_PER_MILE = 5280;
const METERS_PER_MILE = 1609.34;

export function formatDistance(meters: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    const miles = meters * METERS_TO_MILES;

    if (miles < 0.1) {
      const feet = Math.round(miles * FEET_PER_MILE);
      return `${feet} ft`;
    }

    if (miles < 10) {
      return `${miles.toFixed(1)} mi`;
    }

    return `${Math.round(miles)} mi`;
  } else {
    const km = meters * METERS_TO_KM;

    if (km < 0.1) {
      return `${Math.round(meters)} m`;
    }

    if (km < 10) {
      return `${km.toFixed(1)} km`;
    }

    return `${Math.round(km)} km`;
  }
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
