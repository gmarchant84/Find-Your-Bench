import { Star, MapPin, Tag, Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { Bench, getVibe } from '../lib/supabase';
import VerificationBadge from './VerificationBadge';
import ImageLightbox from './ImageLightbox';

interface BenchCardProps {
  bench: Bench;
  onClick: () => void;
}

export function BenchCard({ bench, onClick }: BenchCardProps) {
  const averageRating = bench.average_rating || 0;
  const totalRatings = bench.total_ratings || 0;
  const vibe = getVibe(bench.vibe_category);
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <div
        onClick={onClick}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg hover:border-green-200 transition-shadow card-press"
      >
        <div className="relative">
          {(bench.photos ?? []).length > 0 ? (
            <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
              <img
                src={(bench.photos ?? [])[0]}
                alt={bench.name}
                className="w-full h-full object-cover object-center"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
                className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
                title="View full image"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          ) : (
            <div
              className="w-full h-48 flex items-center justify-center"
              style={vibe
                ? { background: `linear-gradient(135deg, ${vibe.markerGradient[0]}33, ${vibe.markerGradient[1]}55)` }
                : undefined}
            >
              {!vibe && <div className="w-full h-full bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center"><MapPin size={48} className="text-green-300" /></div>}
              {vibe && <span className="text-6xl select-none">{vibe.emoji}</span>}
            </div>
          )}
          {vibe && (
            <div className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${vibe.bg} ${vibe.color} border ${vibe.border}`}>
              <span>{vibe.emoji}</span>
              <span>{vibe.label}</span>
            </div>
          )}
          {averageRating > 0 && (
            <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-full backdrop-blur-sm bg-white/95 shadow-md">
              <div className="flex items-center gap-1">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="font-bold text-sm text-gray-900">
                  {averageRating.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-lg font-bold text-gray-900 flex-1">{bench.name}</h3>
            <VerificationBadge
              status={(bench as any).verification_status || 'unverified'}
              confirmationCount={(bench as any).confirmation_count}
              size="sm"
              showLabel={false}
            />
          </div>

          {averageRating > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Star size={16} className="text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-bold text-gray-900">
                {averageRating.toFixed(1)}
              </span>
              {totalRatings > 0 && (
                <span className="text-xs text-gray-500">({totalRatings} {totalRatings === 1 ? 'review' : 'reviews'})</span>
              )}
            </div>
          )}

          {bench.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{bench.description}</p>
          )}

          {(bench.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {(bench.tags ?? []).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs"
                >
                  <Tag size={12} />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Coordinates strip */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-1.5">
          <MapPin size={11} className="text-green-500 flex-shrink-0" />
          <span className="text-[11px] font-medium text-gray-400">
            {bench.latitude.toFixed(4)}, {bench.longitude.toFixed(4)}
          </span>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          imageUrl={(bench.photos ?? [])[0]}
          imageAlt={bench.name}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  );
}
