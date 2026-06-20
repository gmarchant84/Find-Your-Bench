import { Star, Navigation, Camera, MapPin } from 'lucide-react';
import { DistanceUnit, formatDistance } from '../lib/distance';
import FoundingBencherBadge from './FoundingBencherBadge';

interface Bench {
  id: string;
  name: string;
  original_name: string;
  latitude: number;
  longitude: number;
  description: string | null;
  founding_user_id: string | null;
  photos: string[] | null;
  tags: string[] | null;
  created_at: string;
  distance?: number;
  average_rating?: number;
  total_ratings?: number;
  founder_username?: string | null;
  founder_is_founding_bencher?: boolean;
}

interface BenchListProps {
  benches: Bench[];
  loading: boolean;
  onSelectBench: (bench: Bench) => void;
  distanceUnit?: DistanceUnit;
}

function BenchSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <div className="h-44 skeleton-light" />
      <div className="p-4 space-y-3">
        <div className="h-5 skeleton-light rounded-lg w-3/5" />
        <div className="h-4 skeleton-light rounded-lg w-full" />
        <div className="h-4 skeleton-light rounded-lg w-4/5" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-20 skeleton-light rounded-full" />
          <div className="h-6 w-16 skeleton-light rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function BenchList({
  benches,
  loading,
  onSelectBench,
  distanceUnit = 'miles',
}: BenchListProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[...Array(4)].map((_, i) => (
          <BenchSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (benches.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm animate-fade-in">
        <MapPin className="w-12 h-12 text-gray-200 mx-auto mb-4" />
        <p className="text-gray-500 font-medium mb-1">No benches found</p>
        <p className="text-gray-400 text-sm">Be the first to add a bench to the community!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {benches.map((bench, index) => {
        const hasPhoto = bench.photos && bench.photos.length > 0;
        const rating = bench.average_rating;

        return (
          <button
            key={bench.id}
            onClick={() => onSelectBench(bench)}
            className="w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 card-press hover:shadow-md hover:border-green-200 transition-shadow"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            {hasPhoto ? (
              <div className="relative">
                <img
                  src={bench.photos![0]}
                  alt={bench.name}
                  className="w-full h-44 object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                {rating && rating > 0 && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-full shadow-md">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-bold text-gray-900">{rating.toFixed(1)}</span>
                  </div>
                )}
                {bench.distance !== undefined && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <Navigation className="w-3 h-3 text-white" />
                    <span className="text-xs font-semibold text-white">{formatDistance(bench.distance, distanceUnit)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-28 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center relative">
                <MapPin className="w-10 h-10 text-green-300" />
                {bench.distance !== undefined && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <Navigation className="w-3 h-3 text-white" />
                    <span className="text-xs font-semibold text-white">{formatDistance(bench.distance, distanceUnit)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h3 className="text-base font-bold text-gray-900 leading-snug flex-1">
                  {bench.name}
                </h3>
                {!hasPhoto && rating && rating > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-bold text-gray-900">{rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {bench.description && (
                <p className="text-gray-500 text-sm mb-3 line-clamp-2 leading-relaxed">
                  {bench.description}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {bench.tags && bench.tags.slice(0, 2).map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    {tag}
                  </span>
                ))}
                {hasPhoto && (
                  <span className="px-2.5 py-1 bg-gray-50 text-gray-500 rounded-full text-xs font-medium flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    {bench.photos?.length ?? 0}
                  </span>
                )}
                {bench.total_ratings && bench.total_ratings > 0 && (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium">
                    {bench.total_ratings} {bench.total_ratings === 1 ? 'review' : 'reviews'}
                  </span>
                )}
              </div>

              {bench.founder_username && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Added by</span>
                  <span className="text-xs font-semibold text-gray-700">@{bench.founder_username}</span>
                  {bench.founder_is_founding_bencher && (
                    <FoundingBencherBadge size="xs" showLabel={false} />
                  )}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
