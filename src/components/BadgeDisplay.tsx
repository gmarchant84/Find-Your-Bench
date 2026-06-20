import { Achievement, UserAchievement } from '../lib/achievements';
import { Lock } from 'lucide-react';

interface BadgeDisplayProps {
  userAchievements: UserAchievement[];
  allAchievements: Achievement[];
  compact?: boolean;
}

const rarityStyles: Record<string, string> = {
  common: 'bg-gray-50 border-gray-200 text-gray-700',
  rare: 'bg-blue-50 border-blue-200 text-blue-800',
  epic: 'bg-amber-50 border-amber-200 text-amber-800',
  legendary: 'bg-yellow-50 border-yellow-300 text-yellow-900',
};

export default function BadgeDisplay({ userAchievements, allAchievements, compact = false }: BadgeDisplayProps) {
  const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {userAchievements.slice(0, 6).map((ua) => {
          const achievement = ua.achievement as Achievement;
          const style = rarityStyles[achievement.rarity] || rarityStyles.common;
          return (
            <div
              key={ua.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${style}`}
              title={achievement.description}
            >
              <span className="text-xl">{achievement.icon}</span>
              <span className="text-xs font-medium">{achievement.name}</span>
            </div>
          );
        })}
        {userAchievements.length > 6 && (
          <div className="flex items-center px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 text-xs">
            +{userAchievements.length - 6} more
          </div>
        )}
      </div>
    );
  }

  const categoryNames: Record<string, string> = {
    explorer: 'Explorer',
    contributor: 'Contributor',
    special: 'Special',
    social: 'Social',
    streak: 'Streak',
  };

  const grouped = allAchievements.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, Achievement[]>);

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, achievements]) => (
        <div key={category}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {categoryNames[category] || category}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map((achievement) => {
              const isUnlocked = unlockedIds.has(achievement.id);
              const ua = userAchievements.find(u => u.achievement_id === achievement.id);
              const style = rarityStyles[achievement.rarity] || rarityStyles.common;
              return (
                <div
                  key={achievement.id}
                  className={`relative p-3 rounded-xl border transition ${
                    isUnlocked ? style : 'bg-gray-50 border-gray-100 opacity-50'
                  }`}
                >
                  {!isUnlocked && (
                    <Lock className="absolute top-2 right-2 w-3.5 h-3.5 text-gray-400" />
                  )}
                  <div className={`text-3xl mb-2 ${!isUnlocked ? 'grayscale' : ''}`}>
                    {achievement.icon}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">{achievement.name}</div>
                  <div className="text-xs text-gray-500 mb-2 leading-snug">{achievement.description}</div>
                  {isUnlocked && ua ? (
                    <div className="text-xs text-green-700 font-medium">
                      Unlocked {new Date(ua.unlocked_at).toLocaleDateString()}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">{achievement.requirement_value} required</div>
                  )}
                  {isUnlocked && (
                    <div className="absolute bottom-2 right-2 text-xs font-bold text-amber-600">
                      +{achievement.points_reward}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
