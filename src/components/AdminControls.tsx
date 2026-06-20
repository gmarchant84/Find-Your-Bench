import { useState } from 'react';
import { Pencil, Trash2, EyeOff, Eye, Copy, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import EditBenchModal from './EditBenchModal';

interface Bench {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  tags: string[] | null;
  photos: string[] | null;
  is_hidden?: boolean;
  duplicate_of?: string | null;
}

interface AdminControlsProps {
  bench: Bench;
  onDeleted: () => void;
  onUpdated: (updates: Partial<Bench>) => void;
}

export default function AdminControls({ bench, onDeleted, onUpdated }: AdminControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicateId, setDuplicateId] = useState(bench.duplicate_of || '');
  const [showDuplicateInput, setShowDuplicateInput] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleToggleHidden = async () => {
    setActionLoading('hide');
    const newHidden = !bench.is_hidden;
    const { error } = await supabase
      .from('benches')
      .update({ is_hidden: newHidden })
      .eq('id', bench.id);
    setActionLoading(null);
    if (error) { flash(friendlyError(error, 'Unable to update bench.')); return; }
    flash(newHidden ? 'Bench hidden from public' : 'Bench is now visible');
  };

  const handleDelete = async () => {
    setActionLoading('delete');
    const { error } = await supabase.from('benches').delete().eq('id', bench.id);
    setActionLoading(null);
    if (error) { flash(friendlyError(error, 'Unable to delete bench.')); setShowDeleteConfirm(false); return; }
    onDeleted();
  };

  const handleMarkDuplicate = async () => {
    const trimmed = duplicateId.trim();
    if (!trimmed) { flash('Enter the canonical bench ID'); return; }
    if (trimmed === bench.id) { flash('A bench cannot be a duplicate of itself'); return; }
    setActionLoading('duplicate');
    const { error } = await supabase
      .from('benches')
      .update({ duplicate_of: trimmed })
      .eq('id', bench.id);
    setActionLoading(null);
    if (error) { flash(friendlyError(error, 'Unable to mark as duplicate.')); return; }
    onUpdated({ duplicate_of: trimmed });
    setShowDuplicateInput(false);
    flash('Marked as duplicate');
  };

  const handleClearDuplicate = async () => {
    setActionLoading('cleardupe');
    const { error } = await supabase
      .from('benches')
      .update({ duplicate_of: null })
      .eq('id', bench.id);
    setActionLoading(null);
    if (error) { flash(friendlyError(error, 'Unable to clear duplicate link.')); return; }
    setDuplicateId('');
    onUpdated({ duplicate_of: null });
    flash('Duplicate link cleared');
  };

  return (
    <>
      <div className="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden">
        {/* Toggle header */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition"
        >
          <div className="flex items-center gap-2 text-amber-800">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Admin Controls</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-amber-200">
            {actionMsg && (
              <div className="mt-3 p-2.5 bg-white border border-amber-300 rounded-lg text-amber-800 text-xs font-medium text-center">
                {actionMsg}
              </div>
            )}

            {/* Status badges */}
            <div className="flex flex-wrap gap-2 pt-3">
              {bench.is_hidden && (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium border border-red-200">
                  Hidden
                </span>
              )}
              {bench.duplicate_of && (
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium border border-orange-200">
                  Duplicate
                </span>
              )}
              {!bench.is_hidden && !bench.duplicate_of && (
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200">
                  Live
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 hover:text-blue-700 rounded-xl text-xs font-medium transition"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>

              <button
                onClick={handleToggleHidden}
                disabled={actionLoading === 'hide'}
                className="flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-700 hover:text-amber-700 rounded-xl text-xs font-medium transition disabled:opacity-50"
              >
                {bench.is_hidden
                  ? <><Eye className="w-3.5 h-3.5" />Unhide</>
                  : <><EyeOff className="w-3.5 h-3.5" />Hide</>
                }
              </button>

              <button
                onClick={() => setShowDuplicateInput(v => !v)}
                className={`flex items-center justify-center gap-2 py-2.5 bg-white border rounded-xl text-xs font-medium transition ${
                  bench.duplicate_of
                    ? 'border-orange-300 text-orange-700 hover:bg-orange-50'
                    : 'border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                {bench.duplicate_of ? 'Edit Dupe' : 'Mark Dupe'}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 hover:border-red-400 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-xl text-xs font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>

            {/* Duplicate input */}
            {showDuplicateInput && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-gray-500">Paste the canonical bench ID this is a duplicate of:</p>
                <input
                  type="text"
                  value={duplicateId}
                  onChange={e => setDuplicateId(e.target.value)}
                  placeholder="e.g. 3f2e1a..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-orange-400 transition"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkDuplicate}
                    disabled={actionLoading === 'duplicate'}
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    {actionLoading === 'duplicate' ? 'Saving...' : 'Save'}
                  </button>
                  {bench.duplicate_of && (
                    <button
                      onClick={handleClearDuplicate}
                      disabled={actionLoading === 'cleardupe'}
                      className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono break-all">This bench ID: {bench.id}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Bench?</h3>
                <p className="text-sm text-gray-500 mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              Are you sure you want to permanently delete <span className="font-semibold">"{bench.name}"</span>? All ratings and confirmations will also be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading === 'delete'}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-50"
              >
                {actionLoading === 'delete' ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditBenchModal
          bench={bench}
          onClose={() => setShowEditModal(false)}
          onSaved={onUpdated}
        />
      )}
    </>
  );
}
