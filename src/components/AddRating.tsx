import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAchievements } from '../hooks/useAchievements';

interface AddRatingProps {
  benchId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Barely better than the ground.',
  2: "It'll do in a pinch.",
  3: 'Solid bench, no complaints.',
  4: 'Worth going out of your way for.',
  5: 'Drop everything. Find this bench.',
};

export function AddRating({ benchId, onClose, onSuccess }: AddRatingProps) {
  const { session } = useAuth();
  const { triggerAchievementCheck } = useAchievements();
  const [overallRating, setOverallRating] = useState(0);
  const [comfort, setComfort] = useState(0);
  const [tranquility, setTranquility] = useState(0);
  const [peopleWatching, setPeopleWatching] = useState(0);
  const [beautifulViews, setBeautifulViews] = useState(0);
  const [accessibility, setAccessibility] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    if (overallRating === 0) {
      setError('Please provide an overall rating');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('ratings')
        .upsert({
          bench_id: benchId,
          user_id: session?.user?.id,
          comfort: comfort || null,
          tranquility: tranquility || null,
          people_watching: peopleWatching || null,
          beautiful_views: beautifulViews || null,
          accessibility: accessibility || null,
          overall: overallRating,
          review_text: reviewText,
        }, {
          onConflict: 'bench_id,user_id'
        });

      if (insertError) throw insertError;

      // Notify the bench founder (if different from the rater)
      const { data: benchData } = await supabase
        .from('benches')
        .select('founding_user_id')
        .eq('id', benchId)
        .maybeSingle();
      if (benchData?.founding_user_id && benchData.founding_user_id !== session.user.id) {
        await supabase.from('bench_notifications').insert({
          user_id: benchData.founding_user_id,
          bench_id: benchId,
          actor_id: session.user.id,
          type: 'rating',
        });
      }

      await triggerAchievementCheck();
      onSuccess();
    } catch (err) {
      setError('Unable to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const RatingButtons = ({
    value,
    onChange,
    label,
    icon,
    required = false
  }: {
    value: number;
    onChange: (v: number) => void;
    label: string;
    icon?: string;
    required?: boolean;
  }) => {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          {icon && <span className="text-xl">{icon}</span>}
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          {!required && <span className="text-xs text-gray-500 ml-auto font-normal">(optional)</span>}
        </label>
        <div className="flex gap-2 relative z-20">
          {[1, 2, 3, 4, 5].map((num) => {
            const isActive = num === value;
            return (
              <button
                key={num}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(num);
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onChange(num);
                }}
                className={`flex-1 h-12 rounded-lg font-bold text-lg transition-all cursor-pointer relative z-30 touch-none select-none ${
                  isActive
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="min-h-screen px-3 py-6 flex items-start sm:items-center justify-center">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10">
          <div className="bg-green-600 p-4 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-white hover:bg-green-700 rounded-full p-2"
            >
              <X size={22} />
            </button>
            <h2 className="text-xl font-bold">Rate This Bench</h2>
            <p className="text-green-100 mt-1">Share your experience</p>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <RatingButtons
                value={overallRating}
                onChange={setOverallRating}
                label="Overall Rating"
                icon="⭐"
                required={true}
              />
              {overallRating > 0 && (
                <p className="mt-2 text-sm font-medium text-green-700 transition-opacity duration-150">
                  {RATING_LABELS[overallRating]}
                </p>
              )}
            </div>

            <RatingButtons
              value={comfort}
              onChange={setComfort}
              label="Comfort"
              icon="🪑"
              required={false}
            />
            <RatingButtons
              value={tranquility}
              onChange={setTranquility}
              label="Tranquility"
              icon="🌿"
              required={false}
            />
            <RatingButtons
              value={peopleWatching}
              onChange={setPeopleWatching}
              label="People-watching"
              icon="👀"
              required={false}
            />
            <RatingButtons
              value={beautifulViews}
              onChange={setBeautifulViews}
              label="Beautiful Views"
              icon="🌅"
              required={false}
            />
            <RatingButtons
              value={accessibility}
              onChange={setAccessibility}
              label="Accessibility"
              icon="♿"
              required={false}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Review (optional)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={4}
                maxLength={1000}
                placeholder="Tell others about your experience..."
              />
              <p className="text-xs text-gray-400 text-right mt-1">{reviewText.length}/1000</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
