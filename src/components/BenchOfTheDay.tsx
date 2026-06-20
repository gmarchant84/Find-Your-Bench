import { useState, useEffect } from 'react';
import { Trophy, MapPin, Star, Heart, List, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SaveToListModal from './SaveToListModal';
import FoundingBencherBadge from './FoundingBencherBadge';
import { useAuth } from '../context/AuthContext';

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
  userLocation?: { latitude: number; longitude: number } | null;
  onBenchClick: (benchId: string) => void;
}

export function BenchOfTheDay({ userLocation, onBenchClick }: BenchOfTheDayProps) {
  const [bench, setBench] = useState<BenchOfTheDayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showSaveToList, setShowSaveToList] = useState(false);
  const { session } = useAuth();
  const user = session?.user;

  useEffect(() => {
    loadBenchOfTheDay();
  }, [userLocation]);

  useEffect(() => {
    if (bench && user) checkIfSaved();
  }, [bench, user]);

  const loadBenchOfTheDay = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_bench_of_the_day', {
        user_lat: userLocation?.latitude ?? null,
        user_lng: userLocation?.longitude ?? null,
        max_distance_miles: 50,
      });
      if (error) throw error;
      setBench(data && data.length > 0 ? data[0] : null);
    } catch (err) {
      console.error('Error loading bench of the day:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkIfSaved = async () => {
    if (!bench || !user) return;
    const { data } = await supabase
      .from('saved_benches')
      .select('id')
      .eq('user_id', user.id)
      .eq('bench_id', bench.id)
      .maybeSingle();
    setIsSaved(!!data);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !bench) return;
    if (isSaved) {
      await supabase.from('saved_benches').delete().eq('user_id', user.id).eq('bench_id', bench.id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_benches').insert({ user_id: user.id, bench_id: bench.id });
      setIsSaved(true);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bench) return;
    const shareUrl = `${window.location.origin}?bench=${bench.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${bench.name} - Bench of the Day`, text: `Check out today's featured bench: ${bench.name}`, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 shadow border border-amber-200">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-amber-200 rounded w-40" />
          <div className="h-24 bg-amber-100 rounded-lg" />
          <div className="h-4 bg-amber-100 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!bench) return null;

  return (
    <>
      <div
        className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-md border border-amber-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
        onClick={() => onBenchClick(bench.id)}
      >
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-amber-100">
          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 p-1.5 rounded-lg shadow-sm">
            <Trophy className="text-white" size={13} />
          </div>
          <span className="text-sm font-bold text-amber-800 tracking-wide uppercase">Bench of the Day</span>
        </div>

        <div className="flex gap-3 p-4">
          {/* Photo */}
          {bench.photo_url && (
            <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden shadow-sm">
              <img
                src={bench.photo_url}
                alt={bench.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 leading-snug mb-1.5 truncate">
              {bench.name}
            </h3>

            {/* Founder attribution */}
            {bench.founder_username && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <span className="text-xs text-gray-500">Added by</span>
                <span className="text-xs font-bold text-gray-800">@{bench.founder_username}</span>
                {bench.founder_is_founding_bencher && (
                  <FoundingBencherBadge size="xs" showLabel={false} />
                )}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs">
              {bench.average_rating > 0 && (
                <div className="flex items-center gap-1 text-amber-600 font-semibold">
                  <Star size={12} fill="currentColor" />
                  <span>{bench.average_rating.toFixed(1)}</span>
                  {bench.total_ratings > 0 && (
                    <span className="text-gray-400 font-normal">({bench.total_ratings})</span>
                  )}
                </div>
              )}
              {bench.distance_miles !== null && (
                <div className="flex items-center gap-1 text-gray-500">
                  <MapPin size={11} />
                  <span>{bench.distance_miles.toFixed(1)} mi</span>
                </div>
              )}
            </div>

            {bench.description && (
              <p className="text-xs text-gray-500 italic mt-1.5 line-clamp-2">
                "{bench.description}"
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {user && (
              <>
                <button
                  onClick={handleSave}
                  className={`p-1.5 rounded-lg transition-all ${
                    isSaved
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                  }`}
                  title={isSaved ? 'Unsave' : 'Save bench'}
                >
                  <Heart size={15} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSaveToList(true); }}
                  className="p-1.5 rounded-lg bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all"
                  title="Add to list"
                >
                  <List size={15} />
                </button>
              </>
            )}
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all"
              title="Share bench"
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {showSaveToList && bench && user && (
        <SaveToListModal
          benchId={bench.id}
          benchName={bench.name}
          onClose={() => setShowSaveToList(false)}
        />
      )}
    </>
  );
}
