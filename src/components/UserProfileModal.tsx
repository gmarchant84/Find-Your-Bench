import { useEffect, useState } from 'react';
import { X, MapPin, Star, Bookmark, Check, Plus, FolderOpen, Award, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CreateListModal from './CreateListModal';
import ListDetailPage from './ListDetailPage';
import BadgeDisplay from './BadgeDisplay';
import FoundingBencherBadge from './FoundingBencherBadge';
import { getUserAchievements, getAllAchievements, Achievement, UserAchievement } from '../lib/achievements';

interface Bench {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  photos: string[] | null;
  average_rating?: number;
}

interface BenchList {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  bench_count?: number;
}

interface UserProfileModalProps {
  onClose: () => void;
  onBenchClick?: (benchId: string) => void;
}

export default function UserProfileModal({ onClose, onBenchClick }: UserProfileModalProps) {
  const { session, signOut } = useAuth();
  const [discoveredBenches, setDiscoveredBenches] = useState<Bench[]>([]);
  const [reviewedBenches, setReviewedBenches] = useState<Bench[]>([]);
  const [savedBenches, setSavedBenches] = useState<Bench[]>([]);
  const [visitedBenches, setVisitedBenches] = useState<Bench[]>([]);
  const [benchLists, setBenchLists] = useState<BenchList[]>([]);
  const [showCreateList, setShowCreateList] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isFoundingBencher, setIsFoundingBencher] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchUserData();
      fetchAchievements();
      supabase.from('profiles').select('username, is_founding_bencher').eq('id', session.user.id).maybeSingle()
        .then(({ data }) => {
          setUsername(data?.username ?? null);
          setIsFoundingBencher(data?.is_founding_bencher ?? false);
        });
    }
  }, [session]);

  const fetchAchievements = async () => {
    if (!session?.user) return;
    const [userAch, allAch] = await Promise.all([
      getUserAchievements(session.user.id),
      getAllAchievements()
    ]);
    setUserAchievements(userAch);
    setAllAchievements(allAch);
  };

  const fetchUserData = async () => {
    if (!session?.user) return;

    const { data: discovered } = await supabase
      .from('benches').select('*').eq('founding_user_id', session.user.id);
    if (discovered) setDiscoveredBenches(discovered);

    const { data: ratings } = await supabase
      .from('ratings').select('bench_id').eq('user_id', session.user.id);
    if (ratings && ratings.length > 0) {
      const benchIds = ratings.map(r => r.bench_id);
      const { data: reviewed } = await supabase.from('benches').select('*').in('id', benchIds);
      if (reviewed) setReviewedBenches(reviewed);
    }

    const { data: savedData } = await supabase
      .from('saved_benches').select('bench_id').eq('user_id', session.user.id);
    if (savedData && savedData.length > 0) {
      const savedBenchIds = savedData.map(s => s.bench_id);
      const { data: saved } = await supabase.from('benches').select('*').in('id', savedBenchIds);
      if (saved) setSavedBenches(saved);
    }

    const { data: visitedData } = await supabase
      .from('visited_benches').select('bench_id').eq('user_id', session.user.id);
    if (visitedData && visitedData.length > 0) {
      const visitedBenchIds = visitedData.map(v => v.bench_id);
      const { data: visited } = await supabase.from('benches').select('*').in('id', visitedBenchIds);
      if (visited) setVisitedBenches(visited);
    }

    const { data: lists } = await supabase
      .from('bench_lists').select('*').eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (lists && lists.length > 0) {
      // Single query to get all bench counts at once
      const { data: counts } = await supabase
        .from('list_benches')
        .select('list_id')
        .in('list_id', lists.map(l => l.id))
        .eq('user_id', session.user.id);
      const countMap: Record<string, number> = {};
      if (counts) {
        for (const row of counts) {
          countMap[row.list_id] = (countMap[row.list_id] ?? 0) + 1;
        }
      }
      setBenchLists(lists.map(l => ({ ...l, bench_count: countMap[l.id] ?? 0 })));
    } else {
      setBenchLists([]);
    }
  };

  const handleRemoveSaved = async (benchId: string) => {
    if (!session?.user) return;
    const { error } = await supabase.from('saved_benches').delete()
      .eq('bench_id', benchId).eq('user_id', session.user.id);
    if (!error) setSavedBenches(prev => prev.filter(b => b.id !== benchId));
  };

  const handleCreateList = async (name: string, emoji: string, description?: string) => {
    if (!session?.user) return;
    const { error } = await supabase.from('bench_lists')
      .insert({ user_id: session.user.id, name, emoji, description });
    if (!error) { setShowCreateList(false); fetchUserData(); }
  };

  const handleDeleteList = async (listId: string) => {
    if (!session?.user) return;
    await supabase.from('bench_lists').delete().eq('id', listId).eq('user_id', session.user.id);
    setBenchLists(prev => prev.filter(l => l.id !== listId));
  };

  if (selectedListId) {
    return (
      <ListDetailPage
        listId={selectedListId}
        onClose={() => setSelectedListId(null)}
        onBenchClick={(benchId) => {
          if (onBenchClick) { onBenchClick(benchId); onClose(); }
        }}
      />
    );
  }

  const BenchRow = ({ bench, onRemove }: { bench: Bench; onRemove?: () => void }) => (
    <div
      className={`flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl transition ${onBenchClick ? 'cursor-pointer hover:bg-green-50 hover:border-green-200 active:bg-green-100' : ''}`}
      onClick={onBenchClick ? () => { onBenchClick(bench.id); onClose(); } : undefined}
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
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition flex-shrink-0"
          title="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">My Profile</h2>
              {isFoundingBencher && <FoundingBencherBadge size="sm" />}
            </div>
            <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[220px]">{username ? `@${username}` : session?.user?.email ?? ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-green-700">{visitedBenches.length}</div>
              <div className="text-xs text-green-600 mt-0.5">Visited</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-amber-700">{savedBenches.length}</div>
              <div className="text-xs text-amber-600 mt-0.5">Saved</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-700">{discoveredBenches.length}</div>
              <div className="text-xs text-blue-600 mt-0.5">Added</div>
            </div>
          </div>

          {/* Achievements */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Achievements
              </h3>
              {userAchievements.length > 0 && (
                <button
                  onClick={() => setShowAllBadges(!showAllBadges)}
                  className="text-xs text-green-700 hover:text-green-800 font-medium transition"
                >
                  {showAllBadges ? 'Show Less' : 'View All'}
                </button>
              )}
            </div>
            {userAchievements.length > 0 ? (
              <BadgeDisplay
                userAchievements={userAchievements}
                allAchievements={allAchievements}
                compact={!showAllBadges}
              />
            ) : (
              <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                <Award className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Complete activities to unlock achievements</p>
              </div>
            )}
          </div>

          {/* Saved benches */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-500" />
              Saved Benches
            </h3>
            {savedBenches.length > 0 ? (
              <div className="space-y-2">
                {savedBenches.map(bench => (
                  <BenchRow key={bench.id} bench={bench} onRemove={() => handleRemoveSaved(bench.id)} />
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-5">No saved benches yet</p>
            )}
          </div>

          {/* Bench lists */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-green-600" />
                My Lists
              </span>
              <button
                onClick={() => setShowCreateList(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New List
              </button>
            </h3>
            {benchLists.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5">
                {benchLists.map(list => (
                  <div
                    key={list.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/40 transition group"
                  >
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => setSelectedListId(list.id)}
                    >
                      <span className="text-2xl flex-shrink-0">{list.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{list.name}</p>
                        {list.description && (
                          <p className="text-xs text-gray-500 truncate">{list.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {list.bench_count} bench{list.bench_count !== 1 ? 'es' : ''}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Delete list"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-700 font-semibold text-sm mb-1">Create your first bench list</p>
                <p className="text-gray-400 text-xs mb-4 max-w-[200px] mx-auto">
                  Organize favorites like Pinterest boards for outdoor spots
                </p>
                <button
                  onClick={() => setShowCreateList(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Create First List
                </button>
              </div>
            )}
          </div>

          {/* Visited benches */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Visited Benches
            </h3>
            {visitedBenches.length > 0 ? (
              <div className="space-y-2">
                {visitedBenches.map(bench => <BenchRow key={bench.id} bench={bench} />)}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-5">No visited benches yet</p>
            )}
          </div>

          {/* Discovered benches */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              My Discovered Benches
            </h3>
            {discoveredBenches.length > 0 ? (
              <div className="space-y-2">
                {discoveredBenches.map(bench => <BenchRow key={bench.id} bench={bench} />)}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-5">Discover your first bench!</p>
            )}
          </div>

          {/* Reviewed benches */}
          <div className="pb-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Reviewed Benches
            </h3>
            {reviewedBenches.length > 0 ? (
              <div className="space-y-2">
                {reviewedBenches.map(bench => <BenchRow key={bench.id} bench={bench} />)}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-5">No reviewed benches yet</p>
            )}
          </div>
        </div>
      </div>

      {showCreateList && (
        <CreateListModal
          onClose={() => setShowCreateList(false)}
          onCreate={handleCreateList}
        />
      )}
    </div>
  );
}
