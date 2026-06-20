import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Bench } from '../lib/supabase';
import BenchDetail from '../components/BenchDetailPage';
import { MapPin } from 'lucide-react';

export default function BenchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bench, setBench] = useState<Bench | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); return; }
    fetchBench(id);
  }, [id]);

  async function fetchBench(benchId: string) {
    const { data, error } = await supabase
      .from('benches')
      .select('*')
      .eq('id', benchId)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      return;
    }

    // Enrich with founder profile if available
    let founder_username: string | null = null;
    let founder_is_founding_bencher = false;
    if (data.founding_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, is_founding_bencher')
        .eq('id', data.founding_user_id)
        .maybeSingle();
      if (profile) {
        founder_username = profile.username ?? null;
        founder_is_founding_bencher = profile.is_founding_bencher ?? false;
      }
    }

    setBench({ ...data, founder_username, founder_is_founding_bencher });
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center">
          <MapPin className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Bench not found</h1>
          <p className="text-gray-500 text-sm mb-6">This bench may have been removed or the link is invalid.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition"
          >
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  if (!bench) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pb-12 pt-0">
        <BenchDetail
          bench={bench}
          onBack={() => navigate('/')}
          backButtonText="Back to Map"
          founderUsername={bench.founder_username}
          founderIsFoundingBencher={bench.founder_is_founding_bencher}
        />
      </div>
    </div>
  );
}
