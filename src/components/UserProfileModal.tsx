import { useEffect, useState, useRef } from 'react';
import { X, MapPin, Star, Bookmark, Check, Plus, FolderOpen, Award, LogOut, Edit2, Camera, Lock, Mail, Trash2, ChevronRight } from 'lucide-react';
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

interface Profile {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_founding_bencher: boolean;
  featured_badge_id: string | null;
}

interface UserProfileModalProps {
  onClose: () => void;
  onBenchClick?: (benchId: string) => void;
}

type Tab = 'activity' | 'edit';

export default function UserProfileModal({ onClose, onBenchClick }: UserProfileModalProps) {
  const { session, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('activity');
  const [profile, setProfile] = useState<Profile>({
    username: null,
    display_name: null,
    bio: null,
    avatar_url: null,
    is_founding_bencher: false,
    featured_badge_id: null,
  });

  // Activity state
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

  // Edit state
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
      fetchUserData();
      fetchAchievements();
    }
  }, [session]);

  const fetchProfile = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, bio, avatar_url, is_founding_bencher, featured_badge_id')
      .eq('id', session.user.id)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
      setEditUsername(data.username ?? '');
      setEditDisplayName(data.display_name ?? '');
      setEditBio(data.bio ?? '');
      setEditAvatarUrl(data.avatar_url ?? '');
    }
  };

  const fetchAchievements = async () => {
    if (!session?.user) return;
    const [userAch, allAch] = await Promise.all([
      getUserAchievements(session.user.id),
      getAllAchievements(),
    ]);
    setUserAchievements(userAch);
    setAllAchievements(allAch);
  };

  const fetchUserData = async () => {
    if (!session?.user) return;
    const { data: discovered } = await supabase.from('benches').select('*').eq('founding_user_id', session.user.id);
    if (discovered) setDiscoveredBenches(discovered);

    const { data: ratings } = await supabase.from('ratings').select('bench_id').eq('user_id', session.user.id);
    if (ratings?.length) {
      const { data: reviewed } = await supabase.from('benches').select('*').in('id', ratings.map(r => r.bench_id));
      if (reviewed) setReviewedBenches(reviewed);
    }

    const { data: savedData } = await supabase.from('saved_benches').select('bench_id').eq('user_id', session.user.id);
    if (savedData?.length) {
      const { data: saved } = await supabase.from('benches').select('*').in('id', savedData.map(s => s.bench_id));
      if (saved) setSavedBenches(saved);
    }

    const { data: visitedData } = await supabase.from('visited_benches').select('bench_id').eq('user_id', session.user.id);
    if (visitedData?.length) {
      const { data: visited } = await supabase.from('benches').select('*').in('id', visitedData.map(v => v.bench_id));
      if (visited) setVisitedBenches(visited);
    }

    const { data: lists } = await supabase.from('bench_lists').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (lists?.length) {
      const { data: counts } = await supabase.from('list_benches').select('list_id').in('list_id', lists.map(l => l.id)).eq('user_id', session.user.id);
      const countMap: Record<string, number> = {};
      counts?.forEach(row => { countMap[row.list_id] = (countMap[row.list_id] ?? 0) + 1; });
      setBenchLists(lists.map(l => ({ ...l, bench_count: countMap[l.id] ?? 0 })));
    } else {
      setBenchLists([]);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!session?.user) return;
    setEditSaving(true);
    setEditError('');
    setEditSuccess('');
    try {
      let avatarUrl = editAvatarUrl;

      // Upload avatar if a new file was selected
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `avatars/${session.user.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('bench-photos')
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('bench-photos').getPublicUrl(path);
        avatarUrl = publicUrl;
      }

      const { error } = await supabase.from('profiles').update({
        username: editUsername.trim() || null,
        display_name: editDisplayName.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: avatarUrl || null,
      }).eq('id', session.user.id);
      if (error) throw error;

      setProfile(prev => ({ ...prev, username: editUsername, display_name: editDisplayName, bio: editBio, avatar_url: avatarUrl }));
      setEditAvatarUrl(avatarUrl);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditSuccess('Profile saved.');
    } catch (err: any) {
      setEditError(err?.message ?? 'Failed to save profile.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setEditSaving(true);
    setEditError('');
    setEditSuccess('');
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      setEditSuccess('Confirmation sent to your new email address.');
      setNewEmail('');
    } catch (err: any) {
      setEditError(err?.message ?? 'Failed to update email.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      setEditError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setEditError('Password must be at least 6 characters.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    setEditSuccess('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setEditSuccess('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setEditError(err?.message ?? 'Failed to update password.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSetFeaturedBadge = async (achievementId: string) => {
    if (!session?.user) return;
    const newId = profile.featured_badge_id === achievementId ? null : achievementId;
    await supabase.from('profiles').update({ featured_badge_id: newId }).eq('id', session.user.id);
    setProfile(prev => ({ ...prev, featured_badge_id: newId }));
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      // Delete profile and auth user via RPC or cascade
      await supabase.from('profiles').delete().eq('id', session!.user!.id);
      await supabase.auth.admin?.deleteUser?.(session!.user!.id).catch(() => {});
      await signOut();
      onClose();
    } catch {
      // If RPC not available, sign out and show instructions
      await signOut();
      onClose();
    }
  };

  const handleRemoveSaved = async (benchId: string) => {
    if (!session?.user) return;
    const { error } = await supabase.from('saved_benches').delete().eq('bench_id', benchId).eq('user_id', session.user.id);
    if (!error) setSavedBenches(prev => prev.filter(b => b.id !== benchId));
  };

  const handleCreateList = async (name: string, emoji: string, description?: string) => {
    if (!session?.user) return;
    const { error } = await supabase.from('bench_lists').insert({ user_id: session.user.id, name, emoji, description });
    if (!error) { setShowCreateList(false); fetchUserData(); }
  };

  const handleDeleteList = async (listId: string) => {
    if (!session?.user) return;
    await supabase.from('bench_lists').delete().eq('id', listId).eq('user_id', session.user.id);
    setBenchLists(prev => prev.filter(l => l.id !== listId));
  };

  // Get featured badge details
  const featuredBadge = profile.featured_badge_id
    ? userAchievements.find(ua => ua.achievement_id === profile.featured_badge_id)?.achievement as Achievement | undefined
    : null;

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
      className={`flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl transition ${onBenchClick ? 'cursor-pointer hover:bg-green-50 hover:border-green-200' : ''}`}
      onClick={onBenchClick ? () => { onBenchClick(bench.id); onClose(); } : undefined}
    >
      {bench.photos?.length ? (
        <img src={bench.photos[0]} alt={bench.name} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-green-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm truncate">{bench.name}</div>
        {bench.average_rating ? (
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-amber-500 fill-current" />
            <span className="text-xs text-gray-500">{bench.average_rating.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  const currentAvatar = avatarPreview || profile.avatar_url;
  const displayName = profile.display_name || profile.username || session?.user?.email?.split('@')[0] || 'Bencher';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {currentAvatar ? (
                  <img src={currentAvatar} alt={displayName} className="w-10 h-10 rounded-full object-cover border-2 border-green-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center border-2 border-green-200">
                    <span className="text-green-700 font-bold text-sm">{displayName[0]?.toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900 truncate">{displayName}</h2>
                  {profile.is_founding_bencher && !featuredBadge && <FoundingBencherBadge size="sm" />}
                  {featuredBadge && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-medium">
                      <span>{featuredBadge.icon}</span>
                      <span>{featuredBadge.name}</span>
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs truncate">
                  {profile.username ? `@${profile.username}` : session?.user?.email ?? ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition">
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTab('activity')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition ${tab === 'activity' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Activity
            </button>
            <button
              onClick={() => setTab('edit')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${tab === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          </div>
        </div>

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
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
                  <button onClick={() => setShowAllBadges(!showAllBadges)} className="text-xs text-green-700 hover:text-green-800 font-medium">
                    {showAllBadges ? 'Show Less' : 'View All'}
                  </button>
                )}
              </div>
              {userAchievements.length > 0 ? (
                <>
                  <BadgeDisplay userAchievements={userAchievements} allAchievements={allAchievements} compact={!showAllBadges} />
                  {userAchievements.length > 0 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Go to Edit Profile to pin your favorite badge to your header.
                    </p>
                  )}
                </>
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
                  {savedBenches.map(bench => <BenchRow key={bench.id} bench={bench} onRemove={() => handleRemoveSaved(bench.id)} />)}
                </div>
              ) : <p className="text-gray-400 text-sm text-center py-5">No saved benches yet</p>}
            </div>

            {/* Lists */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-green-600" />
                  My Lists
                </span>
                <button onClick={() => setShowCreateList(true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition">
                  <Plus className="w-3.5 h-3.5" />
                  New List
                </button>
              </h3>
              {benchLists.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {benchLists.map(list => (
                    <div key={list.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/40 transition group">
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setSelectedListId(list.id)}>
                        <span className="text-2xl flex-shrink-0">{list.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{list.name}</p>
                          {list.description && <p className="text-xs text-gray-500 truncate">{list.description}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{list.bench_count} bench{list.bench_count !== 1 ? 'es' : ''}</p>
                        </div>
                      </button>
                      <button onClick={() => handleDeleteList(list.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                  <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-700 font-semibold text-sm mb-1">Create your first bench list</p>
                  <p className="text-gray-400 text-xs mb-4 max-w-[200px] mx-auto">Organize favorites like Pinterest boards for outdoor spots</p>
                  <button onClick={() => setShowCreateList(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">Create First List</button>
                </div>
              )}
            </div>

            {/* Visited */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Visited Benches
              </h3>
              {visitedBenches.length > 0 ? (
                <div className="space-y-2">{visitedBenches.map(bench => <BenchRow key={bench.id} bench={bench} />)}</div>
              ) : <p className="text-gray-400 text-sm text-center py-5">No visited benches yet</p>}
            </div>

            {/* Discovered */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                My Discovered Benches
              </h3>
              {discoveredBenches.length > 0 ? (
                <div className="space-y-2">{discoveredBenches.map(bench => <BenchRow key={bench.id} bench={bench} />)}</div>
              ) : <p className="text-gray-400 text-sm text-center py-5">Discover your first bench!</p>}
            </div>

            {/* Reviewed */}
            <div className="pb-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Reviewed Benches
              </h3>
              {reviewedBenches.length > 0 ? (
                <div className="space-y-2">{reviewedBenches.map(bench => <BenchRow key={bench.id} bench={bench} />)}</div>
              ) : <p className="text-gray-400 text-sm text-center py-5">No reviewed benches yet</p>}
            </div>
          </div>
        )}

        {/* ── EDIT PROFILE TAB ── */}
        {tab === 'edit' && (
          <div className="p-4 space-y-6 pb-8">

            {/* Feedback */}
            {editSuccess && <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl">{editSuccess}</div>}
            {editError && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{editError}</div>}

            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-green-100" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center border-4 border-green-100">
                    <span className="text-green-700 font-bold text-2xl">{displayName[0]?.toUpperCase()}</span>
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center shadow-md transition"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <p className="text-xs text-gray-400">Tap the camera to change your photo</p>
            </div>

            {/* Name + Username + Bio */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={e => setEditDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                    placeholder="username"
                    className="w-full pl-8 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bio</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="A sentence about yourself..."
                  rows={3}
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{editBio.length}/200</p>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={editSaving}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-semibold transition"
              >
                {editSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>

            {/* Featured Badge */}
            {userAchievements.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Featured Badge</h3>
                <p className="text-xs text-gray-400 mb-3">Pick one badge to show on your profile header. Tap to select, tap again to unpin.</p>
                <div className="flex flex-wrap gap-2">
                  {userAchievements.map(ua => {
                    const ach = ua.achievement as Achievement;
                    if (!ach) return null;
                    const isPinned = profile.featured_badge_id === ua.achievement_id;
                    return (
                      <button
                        key={ua.id}
                        onClick={() => handleSetFeaturedBadge(ua.achievement_id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition ${
                          isPinned
                            ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-sm ring-2 ring-amber-300'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-amber-300'
                        }`}
                      >
                        <span className="text-base">{ach.icon}</span>
                        <span>{ach.name}</span>
                        {isPinned && <span className="text-amber-600 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Change Email */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Change Email
              </h3>
              <p className="text-xs text-gray-400 mb-3">Current: {session?.user?.email}</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="New email address"
                  className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  onClick={handleChangeEmail}
                  disabled={editSaving || !newEmail.trim()}
                  className="px-4 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-semibold transition"
                >
                  Update
                </button>
              </div>
            </div>

            {/* Change Password */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" />
                Change Password
              </h3>
              <div className="space-y-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={editSaving || !newPassword || !confirmPassword}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-semibold transition"
                >
                  Update Password
                </button>
              </div>
            </div>

            {/* Delete Account */}
            <div className="border border-red-100 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Delete Account
              </h3>
              <p className="text-xs text-gray-500 mb-3">This permanently deletes your account. Your benches will remain on the map.</p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition"
                >
                  Delete my account
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-700">Type DELETE to confirm:</p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3.5 py-2.5 border border-red-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE'}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-200 text-white rounded-xl text-sm font-semibold transition"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
