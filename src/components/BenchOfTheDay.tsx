import { useState, useEffect } from 'react';
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

interface BenchOfTheDayProps {
  /** Pass primitives, not an object: a new object each render refetched the RPC every render. */
  latitude: number | null;
  longitude: number | null;
  onBenchClick: (benchId: string) => void;
}

/** Only feature a bench the user could plausibly visit. */
export const BOTD_MAX_DISTANCE_MILES = 50;

// ~1 km grid, so GPS jitter doesn't trigger a refetch.
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/**
 * Compact one-row "Bench of the Day". Hidden until the user's location is known
 * and only shown when the featured bench is within BOTD_MAX_DISTANCE_MILES
 * (the RPC's max_distance_miles is not enforced server-side today: it returned
 * a bench 7,022 mi away for a San Francisco user). Renders nothing while
 * loading, so it never flashes a skeleton above the map.
 */
export function BenchOfTheDay({ latitude, longitude, onBenchClick }: BenchOfTheDayProps) {
  const [bench, setBench] = useState<BenchOfTheDayData | null>(null);
  const lat = round2(latitude);
  const lng = round2(longitude);

  useEffect(() => {
    if (lat === null || lng === null) { setBench(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_bench_of_the_day', {
          user_lat: lat,
          user_lng: lng,
          max_distance_miles: BOTD_MAX_DISTANCE_MILES,
        });
        if (error) throw error;
        if (!cancelled) setBench(data && data.length > 0 ? data[0] : null);
      } catch (err) {
        console.error('Error loading bench of the day:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

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
  if (bench.distance_miles === null || bench.distance_miles > BOTD_MAX_DISTANCE_MILES) return null;

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
          <span>{bench.distance_miles.toFixed(1)} mi away</span>
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
