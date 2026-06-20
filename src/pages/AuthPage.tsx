import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function openLegal(tab: 'tos' | 'privacy') {
  window.dispatchEvent(new CustomEvent('open-legal', { detail: tab }));
}

export default function AuthPage() {
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === '1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSignUp && !agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, username);
      } else {
        await signIn(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 40%, #ecfdf5 100%)' }}
    >
      {/* Back to browsing */}
      <div className="w-full max-w-sm mb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Continue browsing
        </button>
      </div>

      {/* Brand lockup */}
      <div className="flex flex-col items-center mb-8 select-none">
        <img
          src="/ChatGPT_Image_May_26,_2026,_09_16_01_PM.png"
          alt="Find Your Bench"
          className="w-24 h-24 sm:w-28 sm:h-28 object-contain mb-4 drop-shadow-sm"
        />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Find Your Bench
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-medium tracking-wide">
          Get Outside. Stay Outside.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setIsSignUp(false); setError(''); }}
            className={`flex-1 py-3.5 text-sm font-semibold transition ${
              !isSignUp ? 'text-green-700 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(''); }}
            className={`flex-1 py-3.5 text-sm font-semibold transition ${
              isSignUp ? 'text-green-700 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:bg-white transition text-sm"
                  placeholder="Choose a username"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:bg-white transition text-sm"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:bg-white transition text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {isSignUp && (
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0 cursor-pointer"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => openLegal('tos')}
                    className="text-green-700 hover:text-green-800 underline underline-offset-2 font-medium"
                  >
                    Terms of Service
                  </button>
                  {' '}and{' '}
                  <button
                    type="button"
                    onClick={() => openLegal('privacy')}
                    className="text-green-700 hover:text-green-800 underline underline-offset-2 font-medium"
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm mt-1"
            >
              {loading ? 'Loading…' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center max-w-xs">
        Discover, rate, and share your favorite outdoor benches with the community.
      </p>

      {/* Footer */}
      <div className="mt-5 flex items-center gap-3 text-xs text-gray-400">
        <button
          onClick={() => openLegal('tos')}
          className="hover:text-gray-600 transition underline underline-offset-2"
        >
          Terms
        </button>
        <span>·</span>
        <button
          onClick={() => openLegal('privacy')}
          className="hover:text-gray-600 transition underline underline-offset-2"
        >
          Privacy
        </button>
        <span>·</span>
        <span>findyourbench.app</span>
      </div>
    </div>
  );
}
