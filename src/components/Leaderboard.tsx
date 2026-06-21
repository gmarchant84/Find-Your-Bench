import { useEffect, useState } from 'react';
import { Trophy, Award, MapPin, ChevronRight, Camera, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PublicProfileModal from './PublicProfileModal';
import FoundingBencherBadge from './FoundingBencherBadge';

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  benchesAdded: number;
  photosAdded: number;
  reviewsWritten: number;
  isFoundingBencher: boolean;
}

interface LeaderboardProps {
  onBenchClick?: (benchId: string) => void;
}

export function Leaderboard({ onBenchClick }: LeaderboardProps) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; displayName: string } | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const [benchRes, photoRes, ratingRes, profileRes] = await Promise.all([
        supabase.from('benches').select('founding_user_id'),
        supabase.from('bench_photos').select('user_id'),
        supabase.from('ratings').select('user_id'),
        supabase.from('profiles').select('id, username, is_founding_bencher'),
      ]);

      if (benchRes.error || profileRes.error) {
        setError(true);
        setLoading(false);
        return;
      }

      const profileMap = new Map<string, { displayName: string; isFoundingBencher: boolean }>();
      (profileRes.data ?? []).forEach(p => {
        profileMap.set(p.id, {
          displayName: p.username || 'Bencher',
          isFoundingBencher: p.is_founding_bencher ?? false,
        });
      });

      const userMap = new Map<string, LeaderboardEntry>();

      // Seed all profiles
      (profileRes.data ?? []).forEach(p => {
        const info = profileMap.get(p.id)!;
        userMap.set(p.id, {
          userId: p.id,
          displayName: info.displayName,
          benchesAdded: 0,
          photosAdded: 0,
          reviewsWritten: 0,
          isFoundingBencher: info.isFoundingBencher,
        });
      });

      (benchRes.data ?? []).forEach(b => {
        if (!b.founding_user_id) return;
        const entry = userMap.get(b.founding_user_id);
        if (entry) entry.benchesAdded++;
      });

      (photoRes.data ?? []).forEach(p => {
        if (!p.user_id) return;
        const entry = userMap.get(p.user_id);
        if (entry) entry.photosAdded++;
      });

      (ratingRes.data ?? []).forEach(r => {
        if (!r.user_id) return;
        const entry = userMap.get(r.user_id);
        if (entry) entry.reviewsWritten++;
      });

      const sorted = Array.from(userMap.values())
        .filter(e => e.benchesAdded > 0 || e.photosAdded > 0 || e.reviewsWritten > 0)
        .sort((a, b) => b.benchesAdded - a.benchesAdded || b.photosAdded - a.photosAdded);

      setLeaders(sorted);
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border-2 border-green-100 p-8">
        <div className="text-center text-gray-500">Loading leaderboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border-2 border-green-100 p-8">
        <div className="text-center text-red-500">Failed to load leaderboard. Please try again.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-green-100 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 border-b-2 border-green-100">
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="w-6 h-6 text-yellow-500 flex-shrink-0" />
          <h2 className="text-xl font-bold text-gray-900">Top Bench Discoverers</h2>
        </div>
        <p className="text-gray-500 text-sm">Ranked by benches added to the map</p>
      </div>

      <div className="p-4 space-y-3">
        {leaders.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No explorers yet. Be the first to add a bench!</p>
        ) : (
          leaders.map((leader, index) => (
            <button
              key={leader.userId}
              onClick={() => setSelectedUser({ userId: leader.userId, displayName: leader.displayName })}
              className={`w-full text-left p-4 rounded-xl border-2 transition hover:brightness-95 active:scale-[0.99] ${
                index === 0
                  ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300'
                  : index === 1
                  ? 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300'
                  : index === 2
                  ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {index === 0 ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-sm">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                  ) : index === 1 ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-sm">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                  ) : index === 2 ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600">#{index + 1}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <span className="font-bold text-gray-900 truncate">@{leader.displayName}</span>
                    {leader.isFoundingBencher && <FoundingBencherBadge size="xs" />}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1 text-green-700 font-semibold">
                      <MapPin size={12} />
                      <span>{leader.benchesAdded} bench{leader.benchesAdded !== 1 ? 'es' : ''}</span>
                    </div>
                    {leader.photosAdded > 0 && (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Camera size={12} />
                        <span>{leader.photosAdded} photo{leader.photosAdded !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {leader.reviewsWritten > 0 && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star size={12} />
                        <span>{leader.reviewsWritten} review{leader.reviewsWritten !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </button>
          ))
        )}
      </div>

      {selectedUser && (
        <PublicProfileModal
          userId={selectedUser.userId}
          displayName={selectedUser.displayName}
          onClose={() => setSelectedUser(null)}
          onBenchClick={onBenchClick}
        />
      )}
    </div>
  );
}
