import { useEffect, useState } from 'react';
import { ThumbsUp, Plus } from 'lucide-react';
import { supabase, NameVote } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface CommunityNamingProps {
  benchId: string;
}

export function CommunityNaming({ benchId }: CommunityNamingProps) {
  const { session } = useAuth();
  const user = session?.user;
  const [nameVotes, setNameVotes] = useState<NameVote[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNameVotes();
    if (user) {
      fetchUserVotes();
    }
  }, [benchId, user]);

  const fetchNameVotes = async () => {
    const { data, error } = await supabase
      .from('name_votes')
      .select('*')
      .eq('bench_id', benchId)
      .order('votes', { ascending: false });

    if (error) {
      console.error('Error fetching name votes:', error);
      return;
    }

    if (data) {
      setNameVotes(data);
    }
  };

  const fetchUserVotes = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_votes')
      .select('name_vote_id')
      .eq('user_id', user.id);

    if (error) return;

    if (data) {
      setUserVotes(new Set(data.map(v => v.name_vote_id)));
    }
  };

  const handleSuggestName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('name_votes')
        .insert({
          bench_id: benchId,
          suggested_name: newName.trim(),
          suggested_by: user.id,
          votes: 0,
        });

      if (error) throw error;

      setNewName('');
      setShowAddForm(false);
      fetchNameVotes();
    } catch (err) {
      console.error('Error suggesting name:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (nameVoteId: string) => {
    if (!user) return;

    const hasVoted = userVotes.has(nameVoteId);

    try {
      if (hasVoted) {
        const { error } = await supabase
          .from('user_votes')
          .delete()
          .eq('name_vote_id', nameVoteId)
          .eq('user_id', user.id);

        if (error) throw error;

        await supabase.rpc('decrement_name_vote', { vote_id: nameVoteId });
      } else {
        const { error } = await supabase
          .from('user_votes')
          .insert({
            name_vote_id: nameVoteId,
            user_id: user.id,
          });

        if (error) throw error;

        await supabase.rpc('increment_name_vote', { vote_id: nameVoteId });
      }

      fetchNameVotes();
      fetchUserVotes();
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  if (nameVotes.length === 0 && !showAddForm) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-3">
          No alternative names suggested yet.
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          <Plus size={16} />
          Suggest a Name
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Community Names</h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium"
          >
            <Plus size={16} />
            Suggest
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSuggestName} className="bg-gray-50 p-4 rounded-lg">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Suggest a new name..."
            maxLength={50}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent mb-1"
            required
          />
          <p className="text-xs text-gray-400 text-right mb-2">{newName.length}/50</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewName('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {nameVotes.map((vote) => (
          <div
            key={vote.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <span className="font-medium text-gray-900">{vote.suggested_name}</span>
            <button
              onClick={() => handleVote(vote.id)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                userVotes.has(vote.id)
                  ? 'bg-green-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ThumbsUp size={14} />
              {vote.votes}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
