import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, X, Trash2, Star, MapPin, Pencil, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateDistance, formatDistance } from '../lib/distance';

interface Bench {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  photos: string[] | null;
  average_rating?: number;
  distance?: number;
}

interface BenchList {
  id: string;
  name: string;
  emoji: string;
  description?: string | null;
}

interface ListDetailPageProps {
  listId: string;
  onClose: () => void;
  onBenchClick: (benchId: string) => void;
  distanceUnit?: 'miles' | 'km';
}

const ALL_EMOJIS = ['📍', '☕', '🌅', '🧠', '🐕', '🥪', '📚', '🎨', '🌳', '🏃', '🎵', '💼', '🌙', '🌊', '🏔️', '🌸', '⛅', '🌿', '🦋', '🌻'];

export default function ListDetailPage({ listId, onClose, onBenchClick, distanceUnit = 'miles' }: ListDetailPageProps) {
  const { session } = useAuth();
  const user = session?.user;

  const [list, setList] = useState<BenchList | null>(null);
  const [benches, setBenches] = useState<Bench[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('📍');
  const [editDesc, setEditDesc] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Remove bench confirmation
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    if (user) fetchListData();
  }, [user, listId]);

  const fetchListData = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: listData }, { data: listBenches }] = await Promise.all([
      supabase.from('bench_lists').select('*').eq('id', listId).eq('user_id', user.id).maybeSingle(),
      supabase.from('list_benches').select('bench_id').eq('list_id', listId).eq('user_id', user.id),
    ]);

    if (listData) {
      setList(listData);
      setEditName(listData.name);
      setEditEmoji(listData.emoji);
      setEditDesc(listData.description ?? '');
    }

    if (listBenches && listBenches.length > 0) {
      const { data: benchData } = await supabase
        .from('benches')
        .select('*')
        .in('id', listBenches.map(lb => lb.bench_id));

      if (benchData) {
        setBenches(
          benchData.map(bench => ({
            ...bench,
            distance: userLocation
              ? calculateDistance(userLocation.lat, userLocation.lng, Number(bench.latitude), Number(bench.longitude))
              : undefined,
          }))
        );
      }
    } else {
      setBenches([]);
    }

    setLoading(false);
  };

  const handleSaveEdit = async () => {
    if (!user || !list || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('bench_lists')
      .update({ name: editName.trim(), emoji: editEmoji, description: editDesc.trim() || null })
      .eq('id', list.id)
      .eq('user_id', user.id);
    if (!error) {
      setList(prev => prev ? { ...prev, name: editName.trim(), emoji: editEmoji, description: editDesc.trim() || null } : prev);
      setEditing(false);
      showToast('List updated');
    }
    setSaving(false);
  };

  const handleDeleteList = async () => {
    if (!user || !list) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setDeleting(true);
    await supabase.from('bench_lists').delete().eq('id', list.id).eq('user_id', user.id);
    onClose();
  };

  const handleRemoveBench = async (benchId: string) => {
    if (!user || removingId) return;
    setRemovingId(benchId);
    const { error } = await supabase
      .from('list_benches')
      .delete()
      .eq('list_id', listId)
      .eq('bench_id', benchId)
      .eq('user_id', user.id);
    if (!error) {
      setBenches(prev => prev.filter(b => b.id !== benchId));
      showToast('Removed from list');
    }
    setRemovingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 text-green-500 animate-spin" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <MapPin className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-500 mb-4">List not found</p>
        <button onClick={onClose} className="text-green-700 font-medium text-sm">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg pointer-events-none animate-slide-down">
          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-3 py-3 flex items-center gap-3 z-20">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-green-700 hover:text-green-800 transition min-h-[44px] pr-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold text-sm">Back</span>
        </button>
        <h2 className="font-bold text-gray-900 text-base truncate flex-1">{list.name}</h2>
        <button
          onClick={() => { setEditing(true); setConfirmDelete(false); }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-500"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* List hero card */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="text-5xl flex-shrink-0">{list.emoji}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{list.name}</h1>
            {list.description && (
              <p className="text-gray-500 text-sm mt-0.5 leading-snug">{list.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1.5 font-medium">
              {benches.length} bench{benches.length !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="border-2 border-green-200 bg-green-50/40 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Edit List</h3>
            <div className="flex gap-2 items-start">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(p => !p)}
                  className="w-12 h-12 bg-white border-2 border-gray-200 rounded-xl text-2xl flex items-center justify-center hover:border-green-400 transition"
                >
                  {editEmoji}
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-gray-200 rounded-xl shadow-lg grid grid-cols-5 gap-1 z-20 w-48">
                    {ALL_EMOJIS.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setEditEmoji(e); setShowEmojiPicker(false); }}
                        className="text-xl p-1.5 hover:bg-gray-100 rounded-lg transition text-center"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={40}
                className="flex-1 px-3 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-green-400 transition"
              />
            </div>
            <input
              type="text"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              maxLength={80}
              className="w-full px-3 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 transition"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setEditing(false); setShowEmojiPicker(false); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editName.trim() || saving}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        )}

        {/* Bench list */}
        {benches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
            <div className="text-4xl mb-3">{list.emoji}</div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No benches yet</h3>
            <p className="text-gray-500 text-sm max-w-[220px] leading-snug">
              Save benches to this list from any bench detail page
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {benches.map(bench => (
              <div
                key={bench.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => onBenchClick(bench.id)}
                >
                  {bench.photos && bench.photos.length > 0 ? (
                    <img
                      src={bench.photos[0]}
                      alt={bench.name}
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-green-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{bench.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      {bench.average_rating && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Star className="w-3 h-3 text-amber-500 fill-current" />
                          <span>{bench.average_rating.toFixed(1)}</span>
                        </div>
                      )}
                      {bench.distance !== undefined && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{formatDistance(bench.distance, distanceUnit)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleRemoveBench(bench.id); }}
                    disabled={removingId === bench.id}
                    className="w-9 h-9 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-full transition flex-shrink-0"
                    title="Remove from list"
                  >
                    {removingId === bench.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <X className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete list */}
        <div className="pt-2 pb-6">
          <button
            onClick={handleDeleteList}
            disabled={deleting}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition border ${
              confirmDelete
                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
            }`}
          >
            {deleting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />
            }
            {confirmDelete ? 'Tap again to confirm delete' : 'Delete this list'}
          </button>
        </div>
      </div>
    </div>
  );
}
