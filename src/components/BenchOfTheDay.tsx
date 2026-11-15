import { useState, useEffect, useMemo } from 'react';
import { Trophy, Star, Share2, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SignedPhotoImg } from '../lib/photos';

interface BenchOfTheDayData {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  average_rating: number;
  total_ratings: number;
  distance_miles: number | null;
  is_verified: boolean;
  founder_username: string | null;
  founder_is_founding_bencher: boolean;
}

interface NearbyCandidate {
  id: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  photos?: string[] | null;
  average_rating?: number;
  total_ratings?: number;
  is_hidden?: boolean;
}

interface BenchOfTheDayProps {
  /** Pass primitives, not an object: a new object each render refetched the RPC every render. */
  latitude: number | null;
  longitude: number | null;
  /** Benches already loaded by the page, used to pick a local bench when the global pick is far away. */
  benches?: NearbyCandidate[];
  onBenchClick: (benchId: string) => void;
}

/** A featured bench farther than this is swapped for a nearby one. */
export const BOTD_MAX_DISTANCE_MILES = 50;

// ~1 km grid, so GPS jitter doesn't trigger a refetch.
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

// Same pick for everyone in an area all day, a new one tomorrow.
function dailyIndex(count: number) {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % count;
}

/**
 * Compact one-row "Bench of the Day". The RPC picks a nearby bench for the day
 * (10/25/50 mi rings). If it still returns a far-away bench (older RPC, or the
 * loaded list has benches it skipped), we feature a nearby bench from the
 * loaded list instead. With no location it shows the RPC's pick. Renders nothing while
 * loading, so it never flashes a skeleton above the map.
 */
export function BenchOfTheDay({ latitude, longitude, benches = [], onBenchClick }: BenchOfTheDayProps) {
  const [rpcBench, setRpcBench] = useState<BenchOfTheDayData | null>(null);
  const lat = round2(latitude);
  const lng = round2(longitude);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_bench_of_the_day', {
          user_lat: lat,
          user_lng: lng,
          max_distance_miles: BOTD_MAX_DISTANCE_MILES,
        });
        if (error) throw error;
        if (!cancelled) setRpcBench(data && data.length > 0 ? data[0] : null);
      } catch (err) {
        console.error('Error loading bench of the day:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

  const bench = useMemo<BenchOfTheDayData | null>(() => {
    const rpcClose = rpcBench && rpcBench.distance_miles !== null && rpcBench.distance_miles <= BOTD_MAX_DISTANCE_MILES;
    if (lat === null || lng === null || rpcClose) return rpcBench;
    const nearby = benches
      .filter((b) => !b.is_hidden)
      .map((b) => ({ b, d: milesBetween(lat, lng, b.latitude, b.longitude) }))
      .filter((x) => x.d <= BOTD_MAX_DISTANCE_MILES)
      .sort((x, y) => (x.b.id < y.b.id ? -1 : 1));
    // Closest ring that has a good bench wins (10, 25, then 50 mi), so a downtown user isn't sent to the suburbs.
    const good = (x: { b: NearbyCandidate }) => (x.b.photos?.length ?? 0) > 0 && (x.b.average_rating ?? 0) >= 4;
    let pool: typeof nearby = [];
    for (const ring of [10, 25, BOTD_MAX_DISTANCE_MILES]) {
      pool = nearby.filter((x) => x.d <= ring && good(x));
      if (pool.length) break;
    }
    if (!pool.length) pool = nearby;
    if (!pool.length) return rpcBench;
    const { b, d } = pool[dailyIndex(pool.length)];
    return {
      id: b.id,
      name: b.name,
      description: b.description ?? '',
      latitude: b.latitude,
      longitude: b.longitude,
      photo_url: b.photos?.[0] ?? null,
      average_rating: b.average_rating ?? 0,
      total_ratings: b.total_ratings ?? 0,
      distance_miles: d,
      is_verified: false,
      founder_username: null,
      founder_is_founding_bencher: false,
    };
  }, [rpcBench, benches, lat, lng]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bench) return;
    // /bench/:id is the real route (the old ?bench= link just opened the home page).
    const shareUrl = `${window.location.origin}/bench/${bench.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${bench.name} - Bench of the Day`, text: `Check out today's featured bench: ${bench.name}`, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
      }
    } catch { /* user cancelled the share sheet */ }
  };

  if (!bench) return null;

  return (
    <div
      className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-sm border border-amber-200 flex items-center gap-3 p-2 pr-1 cursor-pointer hover:shadow-md transition"
      onClick={() => onBenchClick(bench.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onBenchClick(bench.id); }}
      aria-label={`Bench of the Day: ${bench.name}`}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
        {bench.photo_url ? (
          <SignedPhotoImg
            src={bench.photo_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Trophy className="text-white" size={20} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide leading-tight">Bench of the Day</p>
        <p className="text-sm font-bold text-gray-900 truncate leading-snug">{bench.name}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500 leading-tight">
          {bench.average_rating > 0 && (
            <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
              <Star size={11} fill="currentColor" />
              {bench.average_rating.toFixed(1)}
            </span>
          )}
          {/* Far-away global picks (no benches near the user yet) skip the distance */}
          {bench.distance_miles !== null && bench.distance_miles <= 250 && (
            <span>{bench.distance_miles.toFixed(1)} mi away</span>
          )}
        </div>
      </div>
      <button
        onClick={handleShare}
        className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/70 transition"
        aria-label="Share Bench of the Day"
      >
        <Share2 size={16} />
      </button>
      <ChevronRight className="flex-shrink-0 w-4 h-4 text-gray-400" />
    </div>
  );
}
