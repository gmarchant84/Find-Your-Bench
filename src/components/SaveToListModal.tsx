import { useEffect, useState, useCallback } from 'react';
import { X, Plus, Check, Loader2, FolderOpen, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAchievements } from '../hooks/useAchievements';

interface BenchList {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  bench_count?: number;
}

interface SaveToListModalProps {
  benchId: string;
  benchName: string;
  onClose: () => void;
}

const QUICK_LISTS = [
  { emoji: '☕', name: 'Coffee Benches' },
  { emoji: '🌅', name: 'Sunset Benches' },
  { emoji: '🧠', name: 'Thinking Benches' },
  { emoji: '🐕', name: 'Dog Walk Benches' },
  { emoji: '🥪', name: 'Lunch Break Benches' },
];

const ALL_EMOJIS = ['📍', '☕', '🌅', '🧠', '🐕', '🥪', '📚', '🎨', '🌳', '🏃', '🎵', '💼', '🌙', '🌊', '🏔️', '🌸', '⛅', '🌿', '🦋', '🌻'];

export default function SaveToListModal({ benchId, benchName, onClose }: SaveToListModalProps) {
  const { session } = useAuth();
  const { triggerAchievementCheck } = useAchievements();
  const [lists, setLists] = useState<BenchList[]>([]);
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📍');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);

    const [{ data: listsData }, { data: memberData }] = await Promise.all([
      supabase
        .from('bench_lists')
        .select('id, name, emoji, description')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('list_benches')
        .select('list_id')
        .eq('bench_id', benchId)
        .eq('user_id', session.user.id),
    ]);

    if (listsData) setLists(listsData);
    if (memberData) setSelectedLists(new Set(memberData.map(m => m.list_id)));
    setLoading(false);
  }, [session, benchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleList = async (list: BenchList) => {
    if (!session?.user || togglingId) return;
    setTogglingId(list.id);
    const isIn = selectedLists.has(list.id);

    if (isIn) {
      const { error } = await supabase
        .from('list_benches')
        .delete()
        .eq('list_id', list.id)
        .eq('bench_id', benchId)
        .eq('user_id', session.user.id);
      if (!error) {
        setSelectedLists(prev => { const n = new Set(prev); n.delete(list.id); return n; });
        showToast(`Removed from "${list.name}"`);
      }
    } else {
      const { error } = await supabase
        .from('list_benches')
        .insert({ list_id: list.id, bench_id: benchId, user_id: session.user.id });
      if (!error) {
        setSelectedLists(prev => new Set(prev).add(list.id));
        showToast(`Saved to "${list.name}"`);
        await triggerAchievementCheck();
      }
    }
    setTogglingId(null);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || !newName.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from('bench_lists')
      .insert({ user_id: session.user.id, name: newName.trim(), emoji: newEmoji, description: newDesc.trim() || null })
      .select()
      .single();

    if (!error && data) {
      // Auto-add this bench to the new list
      await supabase
        .from('list_benches')
        .insert({ list_id: data.id, bench_id: benchId, user_id: session.user.id });

      setLists(prev => [data, ...prev]);
      setSelectedLists(prev => new Set(prev).add(data.id));
      showToast(`Saved to "${data.name}"`);
      setNewName(''); setNewEmoji('📍'); setNewDesc('');
      setShowCreate(false);
      await triggerAchievementCheck();
    }
    setCreating(false);
  };

  const handleQuickCreate = async (emoji: string, name: string) => {
    if (!session?.user) return;
    setCreating(true);

    const { data: existing } = await supabase
      .from('bench_lists')
      .select('id, name, emoji')
      .eq('user_id', session.user.id)
      .ilike('name', name)
      .maybeSingle();

    let listId = existing?.id;
    let listName = existing?.name ?? name;

    if (!existing) {
      const { data } = await supabase
        .from('bench_lists')
        .insert({ user_id: session.user.id, name, emoji })
        .select()
        .single();
      if (data) { listId = data.id; listName = data.name; setLists(prev => [data, ...prev]); }
    }

    if (listId) {
      if (!selectedLists.has(listId)) {
        await supabase
          .from('list_benches')
          .insert({ list_id: listId, bench_id: benchId, user_id: session.user.id });
        setSelectedLists(prev => new Set(prev).add(listId!));
        showToast(`Saved to "${listName}"`);
        await triggerAchievementCheck();
      } else {
        showToast(`Already in "${listName}"`);
      }
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-end sm:pb-0" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Toast */}
      {toast && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg animate-slide-down pointer-events-none">
          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl sm:mb-6 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="px-4 pt-2 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Save to List</h2>
            <p className="text-xs text-gray-500 truncate max-w-[240px]">{benchName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
            </div>
          ) : (
            <div className="px-4 py-4 space-y-5">
              {/* Quick-add suggestions (only when no lists yet) */}
              {lists.length === 0 && !showCreate && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Quick Lists</p>
                  <div className="grid grid-cols-1 gap-2">
                    {QUICK_LISTS.map(q => (
                      <button
                        key={q.name}
                        onClick={() => handleQuickCreate(q.emoji, q.name)}
                        disabled={!!creating}
                        className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 hover:bg-green-50 hover:border-green-200 border border-gray-200 rounded-xl text-left transition active:scale-[0.98]"
                      >
                        <span className="text-xl">{q.emoji}</span>
                        <span className="text-sm font-medium text-gray-800 flex-1">{q.name}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing lists */}
              {lists.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">My Lists</p>
                  <div className="space-y-2">
                    {lists.map(list => {
                      const isIn = selectedLists.has(list.id);
                      const isLoading = togglingId === list.id;
                      return (
                        <button
                          key={list.id}
                          onClick={() => toggleList(list)}
                          disabled={!!togglingId}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition active:scale-[0.98] text-left ${
                            isIn
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          } ${togglingId && !isLoading ? 'opacity-60' : ''}`}
                        >
                          <span className="text-xl flex-shrink-0">{list.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{list.name}</p>
                            {list.description && (
                              <p className="text-xs text-gray-500 truncate">{list.description}</p>
                            )}
                          </div>
                          <div className="w-6 h-6 flex-shrink-0">
                            {isLoading ? (
                              <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                            ) : isIn ? (
                              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Create new list — inline form */}
              {showCreate ? (
                <div className="border-2 border-green-200 bg-green-50/40 rounded-2xl p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">New List</h3>
                  <form onSubmit={handleCreateList} className="space-y-3">
                    {/* Emoji + Name row */}
                    <div className="flex gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(p => !p)}
                          className="w-12 h-12 bg-white border-2 border-gray-200 rounded-xl text-2xl flex items-center justify-center hover:border-green-400 transition flex-shrink-0"
                        >
                          {newEmoji}
                        </button>
                        {showEmojiPicker && (
                          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-gray-200 rounded-xl shadow-lg grid grid-cols-5 gap-1 z-20 w-48">
                            {ALL_EMOJIS.map(e => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => { setNewEmoji(e); setShowEmojiPicker(false); }}
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
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="List name…"
                        maxLength={40}
                        required
                        autoFocus
                        className="flex-1 px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 transition"
                      />
                    </div>
                    <input
                      type="text"
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="Short description (optional)"
                      maxLength={80}
                      className="w-full px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 transition"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => { setShowCreate(false); setShowEmojiPicker(false); }}
                        className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newName.trim() || creating}
                        className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Create & Save
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50/40 text-gray-500 hover:text-green-700 rounded-xl transition"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Create new list</p>
                    <p className="text-xs opacity-70">Add a custom collection</p>
                  </div>
                </button>
              )}

              {/* Empty state CTA */}
              {lists.length === 0 && !showCreate && (
                <div className="pt-1 pb-2 text-center">
                  <p className="text-xs text-gray-400">or start with a quick list above</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {lists.length > 0 && selectedLists.size > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FolderOpen className="w-4 h-4 text-green-600" />
                <span>Saved to <span className="font-semibold text-gray-900">{selectedLists.size}</span> list{selectedLists.size !== 1 ? 's' : ''}</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Safe area spacer for mobile */}
        <div className="h-safe-bottom sm:hidden" />
      </div>
    </div>
  );
}
