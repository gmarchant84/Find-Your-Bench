import { useEffect, useState } from 'react';
import { Trophy, Star, X, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points_reward: number;
}

interface Notification {
  type: 'achievement' | 'level_up';
  achievement?: Achievement;
  newLevel?: number;
  points?: number;
}

const rarityColors = {
  common: 'from-gray-500 to-gray-700',
  rare: 'from-blue-500 to-blue-700',
  epic: 'from-orange-500 to-amber-600',
  legendary: 'from-yellow-400 to-amber-500'
};

const rarityGlow = {
  common: 'shadow-gray-500/40',
  rare: 'shadow-blue-500/40',
  epic: 'shadow-orange-500/40',
  legendary: 'shadow-yellow-500/40'
};

export default function AchievementNotification({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);

  useEffect(() => {
    checkForNewAchievements();

    const channel = supabase
      .channel('achievement_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievement_unlocks',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('achievement_catalog')
            .select('*')
            .eq('id', payload.new.achievement_id)
            .single();

          if (data) {
            addNotification({
              type: 'achievement',
              achievement: data
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_stats',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const oldLevel = payload.old?.level;
          const newLevel = payload.new?.level;

          if (newLevel && oldLevel && newLevel > oldLevel) {
            addNotification({
              type: 'level_up',
              newLevel: newLevel,
              points: payload.new?.total_points
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function checkForNewAchievements() {
    const { data } = await supabase
      .from('user_achievement_unlocks')
      .select(`
        *,
        achievement_catalog (*)
      `)
      .eq('user_id', userId)
      .eq('notified', false);

    if (data && data.length > 0) {
      data.forEach(unlock => {
        addNotification({
          type: 'achievement',
          achievement: unlock.achievement_catalog
        });
      });

      await supabase
        .from('user_achievement_unlocks')
        .update({ notified: true })
        .eq('user_id', userId)
        .eq('notified', false);
    }
  }

  function addNotification(notification: Notification) {
    setNotifications(prev => [...prev, notification]);

    if (!currentNotification) {
      showNextNotification([notification]);
    }
  }

  function showNextNotification(queue: Notification[]) {
    if (queue.length === 0) {
      setCurrentNotification(null);
      return;
    }

    const [next, ...rest] = queue;
    setCurrentNotification(next);

    setTimeout(() => {
      setCurrentNotification(null);
      setTimeout(() => showNextNotification(rest), 300);
    }, 5000);
  }

  useEffect(() => {
    if (!currentNotification && notifications.length > 0) {
      showNextNotification(notifications);
      setNotifications([]);
    }
  }, [currentNotification, notifications]);

  if (!currentNotification) return null;

  if (currentNotification.type === 'level_up') {
    return (
      <div className="fixed top-4 right-3 left-3 sm:left-auto sm:right-4 sm:max-w-sm z-50 animate-slide-in-right">
        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg shadow-2xl shadow-green-500/50 p-6 max-w-sm">
          <button
            onClick={() => setCurrentNotification(null)}
            className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4 mb-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <Star className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Level Up!</h3>
              <p className="text-white/90">You reached level {currentNotification.newLevel}</p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span>Total Points</span>
              <span className="font-bold">{currentNotification.points?.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Keep going to unlock more achievements!</span>
          </div>
        </div>
      </div>
    );
  }

  const achievement = currentNotification.achievement!;
  const gradient = rarityColors[achievement.rarity];
  const glow = rarityGlow[achievement.rarity];

  return (
    <div className="fixed top-4 right-3 left-3 sm:left-auto sm:right-4 sm:max-w-sm z-50 animate-slide-in-right">
      <div className={`bg-gradient-to-r ${gradient} text-white rounded-lg shadow-2xl ${glow} p-6 max-w-sm`}>
        <button
          onClick={() => setCurrentNotification(null)}
          className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 animate-bounce">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-xl">Achievement Unlocked!</h3>
            <p className="text-white/90 capitalize">{achievement.rarity}</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-3">
          <h4 className="font-bold text-lg mb-1">{achievement.name}</h4>
          <p className="text-sm text-white/90 mb-3">{achievement.description}</p>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="font-semibold">+{achievement.points_reward} points</span>
          </div>
        </div>

        <div className="text-sm text-white/80 text-center">
          🎉 Congratulations! 🎉
        </div>
      </div>
    </div>
  );
}
