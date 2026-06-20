import { useCallback } from 'react';
import { checkAchievements } from '../lib/achievements';
import { useAuth } from '../context/AuthContext';

export function useAchievements() {
  const { session } = useAuth();

  const triggerAchievementCheck = useCallback(async () => {
    if (!session?.user) return;

    try {
      const newlyUnlocked = await checkAchievements(session.user.id);
      return newlyUnlocked;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }, [session]);

  return { triggerAchievementCheck };
}
