import { supabase } from './supabase';

const POINTS = {
  BENCH_ADDED: 100,
  RATING_GIVEN: 25,
  PHOTO_UPLOADED: 15,
  VERIFICATION_DONE: 10,
  NAME_VOTE: 5,
};

export async function awardPoints(
  userId: string,
  actionType: string,
  points: number,
  referenceId?: string,
  description?: string
) {
  try {
    await supabase.from('point_transactions').insert({
      user_id: userId,
      points,
      action_type: actionType,
      reference_id: referenceId,
      description: description || `Earned ${points} points for ${actionType}`
    });

    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (stats) {
      const newPoints = stats.total_points + points;
      const newLevel = calculateLevel(newPoints);
      const nextLevelPoints = calculateNextLevelPoints(newPoints);

      const updates: any = {
        total_points: newPoints,
        level: newLevel,
        next_level_points: nextLevelPoints,
        updated_at: new Date().toISOString()
      };

      if (actionType === 'bench_added') {
        updates.benches_added = stats.benches_added + 1;
      } else if (actionType === 'rating_given') {
        updates.ratings_given = stats.ratings_given + 1;
      } else if (actionType === 'photo_uploaded') {
        updates.photos_uploaded = stats.photos_uploaded + 1;
      } else if (actionType === 'verification_done') {
        updates.verifications_done = stats.verifications_done + 1;
      }

      const today = new Date().toISOString().split('T')[0];
      const lastActivity = stats.last_activity_date;

      if (lastActivity) {
        const lastDate = new Date(lastActivity);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          const newStreak = stats.current_streak + 1;
          updates.current_streak = newStreak;
          updates.longest_streak = Math.max(stats.longest_streak, newStreak);
        } else if (diffDays > 1) {
          updates.current_streak = 1;
        }
      } else {
        updates.current_streak = 1;
      }

      updates.last_activity_date = today;

      await supabase
        .from('user_stats')
        .update(updates)
        .eq('user_id', userId);

      await checkAndUnlockAchievements(userId, {
        ...stats,
        ...updates
      });
    }
  } catch (error) {
    console.error('Error awarding points:', error);
  }
}

function calculateLevel(points: number): number {
  return Math.floor(Math.sqrt(points / 50)) + 1;
}

function calculateNextLevelPoints(currentPoints: number): number {
  const currentLevel = calculateLevel(currentPoints);
  const nextLevel = currentLevel + 1;
  return ((nextLevel - 1) * (nextLevel - 1)) * 50;
}

async function checkAndUnlockAchievements(userId: string, stats: any) {
  try {
    const { data: allAchievements } = await supabase
      .from('achievement_catalog')
      .select('*');

    const { data: unlockedAchievements } = await supabase
      .from('user_achievement_unlocks')
      .select('achievement_id')
      .eq('user_id', userId);

    const unlockedIds = new Set(unlockedAchievements?.map(a => a.achievement_id) || []);

    const achievementsToUnlock = [];

    for (const achievement of allAchievements || []) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.requirement_type) {
        case 'benches_added':
          shouldUnlock = stats.benches_added >= achievement.requirement_value;
          break;
        case 'ratings_given':
          shouldUnlock = stats.ratings_given >= achievement.requirement_value;
          break;
        case 'photos_uploaded':
          shouldUnlock = stats.photos_uploaded >= achievement.requirement_value;
          break;
        case 'current_streak':
          shouldUnlock = stats.current_streak >= achievement.requirement_value;
          break;
        case 'level':
          shouldUnlock = stats.level >= achievement.requirement_value;
          break;
        case 'cities_added':
          // Count distinct city buckets from the user's benches (rounded to 1 decimal)
          if (stats.benches_added >= achievement.requirement_value) {
            const { data: userBenches } = await supabase
              .from('benches')
              .select('latitude, longitude')
              .eq('founding_user_id', userId);
            if (userBenches) {
              const citySet = new Set(
                userBenches.map(b => `${Math.round(Number(b.latitude))},${Math.round(Number(b.longitude))}`)
              );
              shouldUnlock = citySet.size >= achievement.requirement_value;
            }
          }
          break;
      }

      if (shouldUnlock) {
        achievementsToUnlock.push({
          user_id: userId,
          achievement_id: achievement.id,
          notified: false
        });

        if (achievement.points_reward > 0) {
          await supabase.from('point_transactions').insert({
            user_id: userId,
            points: achievement.points_reward,
            action_type: 'achievement_unlocked',
            reference_id: achievement.id,
            description: `Achievement unlocked: ${achievement.name}`
          });

          await supabase
            .from('user_stats')
            .update({
              total_points: stats.total_points + achievement.points_reward,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        }
      }
    }

    if (achievementsToUnlock.length > 0) {
      await supabase
        .from('user_achievement_unlocks')
        .insert(achievementsToUnlock);
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  }
}

export async function handleBenchAdded(userId: string, benchId: string) {
  await awardPoints(
    userId,
    'bench_added',
    POINTS.BENCH_ADDED,
    benchId,
    'Added a new bench to the map'
  );
}

export async function handleRatingGiven(userId: string, ratingId: string) {
  await awardPoints(
    userId,
    'rating_given',
    POINTS.RATING_GIVEN,
    ratingId,
    'Rated a bench'
  );
}

export async function handlePhotoUploaded(userId: string, photoId: string) {
  await awardPoints(
    userId,
    'photo_uploaded',
    POINTS.PHOTO_UPLOADED,
    photoId,
    'Uploaded a photo'
  );
}

export async function handleVerificationDone(userId: string, verificationId: string) {
  await awardPoints(
    userId,
    'verification_done',
    POINTS.VERIFICATION_DONE,
    verificationId,
    'Verified a bench'
  );
}

export async function handleNameVote(userId: string, voteId: string) {
  await awardPoints(
    userId,
    'name_vote',
    POINTS.NAME_VOTE,
    voteId,
    'Voted on a bench name'
  );
}
