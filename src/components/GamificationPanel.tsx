import { useState, useEffect } from 'react';
import { Trophy, Star, Flame, TrendingUp, Award, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UserStats {
  total_points: number;
  level: number;
  benches_added: number;
  ratings_given: number;
  photos_uploaded: number;
  current_streak: number;
  longest_streak: number;
  next_level_points: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points_reward: number;
  requirement_type: string;
  requirement_value: number;
}

interface UnlockedAchievement extends Achievement {
  unlocked_at: string;
}

interface GamificationPanelProps {
  userId: string;
  compact?: boolean;
}

const rarityColors = {
  common: 'bg-gray-50 text-gray-800 border-gray-200',
  rare: 'bg-blue-50 text-blue-800 border-blue-200',
  epic: 'bg-amber-50 text-amber-800 border-amber-200',
  legendary: 'bg-yellow-50 text-yellow-900 border-yellow-300'
};

const iconMap: { [key: string]: any } = {
  Trophy, Star, Flame, TrendingUp, Award
};

export default function GamificationPanel({ userId, compact = false }: GamificationPanelProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  useEffect(() => {
    fetchGamificationData();
  }, [userId]);

  async function fetchGamificationData() {
    try {
      const [statsRes, achievementsRes, unlockedRes] = await Promise.all([
        supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('achievement_catalog')
          .select('*')
          .order('rarity', { ascending: true })
          .order('requirement_value', { ascending: true }),
        supabase
          .from('user_achievement_unlocks')
          .select(`
            *,
            achievement_catalog (*)
          `)
          .eq('user_id', userId)
      ]);

      if (statsRes.data) {
        setStats(statsRes.data);
      }

      if (achievementsRes.data) {
        setAchievements(achievementsRes.data);
      }

      if (unlockedRes.data) {
        setUnlockedAchievements(
          unlockedRes.data.map(u => ({
            ...u.achievement_catalog,
            unlocked_at: u.unlocked_at
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching gamification data:', error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (fetchError || !stats) {
    return (
      <div className="py-6 text-center text-gray-500 text-sm">
        Could not load stats. Check your connection and try again.
      </div>
    );
  }

  const progressToNextLevel = stats.next_level_points > 0
    ? ((stats.total_points % stats.next_level_points) / stats.next_level_points) * 100
    : 0;

  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg">
              {stats.level}
            </div>
            <div>
              <div className="font-semibold text-gray-900">Level {stats.level}</div>
              <div className="text-sm text-gray-600">{stats.total_points} points</div>
            </div>
          </div>

          {stats.current_streak > 0 && (
            <div className="flex items-center gap-2 bg-orange-100 px-3 py-1.5 rounded-full">
              <Flame className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-orange-900">{stats.current_streak} day streak</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress to Level {stats.level + 1}</span>
            <span className="font-medium text-gray-900">
              {stats.total_points} / {stats.next_level_points}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-600 to-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressToNextLevel}%` }}
            ></div>
          </div>
        </div>

        {unlockedAchievements.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              {unlockedAchievements.slice(0, 5).map((achievement) => {
                const IconComponent = iconMap[achievement.icon] || Award;
                return (
                  <div
                    key={achievement.id}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${
                      rarityColors[achievement.rarity]
                    }`}
                    title={achievement.description}
                  >
                    <IconComponent className="w-3 h-3" />
                    <span>{achievement.name}</span>
                  </div>
                );
              })}
              {unlockedAchievements.length > 5 && (
                <span className="text-xs text-gray-500">+{unlockedAchievements.length - 5} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl shadow-lg flex-shrink-0">
              {stats.level}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Level {stats.level}</h3>
              <p className="text-gray-600 text-sm">{stats.total_points.toLocaleString()} pts</p>
            </div>
          </div>

          {stats.current_streak > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-100 px-3 py-1.5 rounded-full flex-shrink-0">
              <Flame className="w-4 h-4 text-orange-600" />
              <span className="font-bold text-base text-orange-900">{stats.current_streak}d</span>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress to Level {stats.level + 1}</span>
            <span className="font-semibold text-gray-900">
              {stats.total_points} / {stats.next_level_points}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-600 to-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressToNextLevel}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-xl font-bold text-green-600">{stats.benches_added}</div>
            <div className="text-xs text-gray-600">Added</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">{stats.ratings_given}</div>
            <div className="text-xs text-gray-600">Ratings</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-600">{stats.photos_uploaded}</div>
            <div className="text-xs text-gray-600">Photos</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-orange-600">{stats.longest_streak}</div>
            <div className="text-xs text-gray-600">Best Streak</div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-900">Achievements</h3>
          <button
            onClick={() => setShowAllAchievements(!showAllAchievements)}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            {showAllAchievements ? 'Show Unlocked Only' : 'Show All'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(showAllAchievements ? achievements : unlockedAchievements).map((achievement) => {
            const isUnlocked = unlockedIds.has(achievement.id);
            const IconComponent = iconMap[achievement.icon] || Award;

            return (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isUnlocked
                    ? `${rarityColors[achievement.rarity]} shadow-sm`
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-white' : 'bg-gray-200'}`}>
                    {isUnlocked ? (
                      <IconComponent className="w-6 h-6" />
                    ) : (
                      <Lock className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1">{achievement.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">
                        +{achievement.points_reward} points
                      </span>
                      {isUnlocked && (
                        <span className="text-xs text-gray-500">
                          {new Date(
                            unlockedAchievements.find(u => u.id === achievement.id)?.unlocked_at || ''
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!showAllAchievements && unlockedAchievements.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No achievements unlocked yet. Keep exploring!</p>
          </div>
        )}
      </div>
    </div>
  );
}
