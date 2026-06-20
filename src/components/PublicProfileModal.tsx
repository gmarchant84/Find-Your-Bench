import { useEffect, useState } from 'react';
import { X, MapPin, Star, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FoundingBencherBadge from './FoundingBencherBadge';

interface Bench {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  photos: string[] | null;
  average_rating?: number;
}

interface Review {
  id: string;
  bench_id: string;
  bench_name: string;
  overall: number;
  review_text: string | null;
  created_at: string;
}

interface PublicProfileModalProps {
  userId: string;
  displayName: string;
  onClose: () => void;
  onBenchClick?: (benchId: string) => void;
}

export default function PublicProfileModal({ userId, displayName, onClose, onBenchClick }: PublicProfileModalProps) {
  const [benches, setBenches] = useState<Bench[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'benches' | 'reviews'>('benches');
  const [isFoundingBencher, setIsFoundingBencher] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    const [benchRes, ratingRes, profileRes] = await Promise.all([
      supabase.from('benches').select('id, name, latitude, longitude, photos, average_rating').eq('founding_user_id', userId).order('created_at', { ascending: false }),
      supabase.from('ratings').select('id, bench_id, overall, review_text, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('is_founding_bencher').eq('id', userId).maybeSingle(),
    ]);

    if (benchRes.data) setBenches(benchRes.data);
    if (profileRes.data) setIsFoundingBencher(profileRes.data.is_founding_bencher ?? false);

    if (ratingRes.data && ratingRes.data.length > 0) {
      const benchIds = ratingRes.data.map(r => r.bench_id);
      const { data: benchNames } = await supabase.from('benches').select('id, name').in('id', benchIds);
      const nameMap = new Map((benchNames ?? []).map(b => [b.id, b.name]));
      setReviews(ratingRes.data.map(r => ({
        ...r,
        bench_name: nameMap.get(r.bench_id) ?? 'Unknown Bench',
      })));
    }

    setLoading(false);
  };

  const handleBenchClick = (benchId: string) => {
    if (onBenchClick) {
      onBenchClick(benchId);
      onClose();
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">@{displayName}</h2>
              {isFoundingBencher && <FoundingBencherBadge size="sm" />}
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              {benches.length} bench{benches.length !== 1 ? 'es' : ''} added &middot; {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4">
          <button
            onClick={() => setActiveTab('benches')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === 'benches'
                ? 'border-green-500 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Benches Added
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'benches' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {benches.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === 'reviews'
                ? 'border-green-500 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Reviews
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'reviews' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {reviews.length}
            </span>
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
            </div>
          ) : activeTab === 'benches' ? (
            benches.length > 0 ? (
              <div className="space-y-2">
                {benches.map(bench => (
                  <button
                    key={bench.id}
                    onClick={() => handleBenchClick(bench.id)}
                    disabled={!onBenchClick}
                    className={`w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl text-left transition ${onBenchClick ? 'hover:bg-green-50 hover:border-green-200 active:bg-green-100 cursor-pointer' : 'cursor-default'}`}
                  >
                    {bench.photos && bench.photos.length > 0 ? (
                      <img src={bench.photos[0]} alt={bench.name} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{bench.name}</div>
                      {bench.average_rating && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="w-3 h-3 text-amber-500 fill-current" />
                          <span className="text-xs text-gray-500">{bench.average_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {onBenchClick && (
                      <MapPin className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">No benches added yet</p>
              </div>
            )
          ) : (
            reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map(review => (
                  <button
                    key={review.id}
                    onClick={() => handleBenchClick(review.bench_id)}
                    disabled={!onBenchClick}
                    className={`w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-left transition ${onBenchClick ? 'hover:bg-green-50 hover:border-green-200 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm truncate flex-1">{review.bench_name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < Math.round(review.overall) ? 'text-amber-500 fill-current' : 'text-gray-200 fill-current'}`}
                          />
                        ))}
                        <span className="text-xs text-gray-500 ml-1">{Number(review.overall).toFixed(1)}</span>
                      </div>
                    </div>
                    {review.review_text && (
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{review.review_text}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5">{formatDate(review.created_at)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">No reviews written yet</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
