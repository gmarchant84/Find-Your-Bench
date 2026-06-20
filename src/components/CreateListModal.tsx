import { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';

interface CreateListModalProps {
  onClose: () => void;
  onCreate: (name: string, emoji: string, description?: string) => Promise<void>;
}

const ALL_EMOJIS = ['📍', '☕', '🌅', '🧠', '🐕', '🥪', '📚', '🎨', '🌳', '🏃', '🎵', '💼', '🌙', '🌊', '🏔️', '🌸', '⛅', '🌿', '🦋', '🌻'];

export default function CreateListModal({ onClose, onCreate }: CreateListModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [description, setDescription] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim(), emoji, description.trim() || undefined);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-4 pt-2 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">New List</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Emoji + Name row */}
          <div className="flex gap-2 items-start">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(p => !p)}
                className="w-12 h-12 bg-gray-50 border-2 border-gray-200 rounded-xl text-2xl flex items-center justify-center hover:border-green-400 transition flex-shrink-0"
              >
                {emoji}
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-gray-200 rounded-xl shadow-lg grid grid-cols-5 gap-1 z-20 w-48">
                  {ALL_EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                      className="text-xl p-1.5 hover:bg-gray-100 rounded-lg transition text-center"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="List name…"
                maxLength={40}
                required
                autoFocus
                className="w-full px-3 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 transition"
              />
            </div>
          </div>

          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            maxLength={250}
            className="w-full px-3 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 transition"
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create List
            </button>
          </div>
        </form>
        <div className="h-safe-bottom sm:hidden" />
      </div>
    </div>
  );
}
