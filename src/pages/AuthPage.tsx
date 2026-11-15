import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Must be listed under Supabase Auth -> URL Configuration -> Redirect URLs.
const RESET_REDIRECT_URL = 'https://www.findyourbench.app/reset-password';

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
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: RESET_REDIRECT_URL,
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 429
        ? 'Too many requests. Please wait a minute and try again.'
        : 'Could not send the reset email. Please check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

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
      const msg =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string' ? (err as any).message
        : 'Sign in failed. Please check your email and password.';
      // Never show raw objects or generic Supabase internals
      const isGeneric = !msg || msg === '{}' || msg.includes('fetch') || msg.length > 200;
      setError(isGeneric ? 'Sign in failed. Please check your email and password.' : msg);
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
          src="/fyb-logo-256.png"
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
            onClick={() => { setIsSignUp(false); setResetMode(false); setError(''); }}
            className={`flex-1 py-3.5 text-sm font-semibold transition ${
              !isSignUp ? 'text-green-700 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setResetMode(false); setError(''); }}
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

          {resetMode ? (
            resetSent ? (
              <div className="space-y-4 text-sm text-gray-700">
                <p>
                  If an account exists for <span className="font-semibold">{email.trim()}</span>, we've sent a link to
                  reset your password. It can take a minute to arrive; check your spam folder too.
                </p>
                <button
                  type="button"
                  onClick={() => { setResetMode(false); setResetSent(false); }}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition text-sm shadow-sm"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendReset} className="space-y-4">
                <p className="text-sm text-gray-600">Enter your account email and we'll send you a link to choose a new password.</p>
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:bg-white transition text-base"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setResetMode(false); setError(''); }}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
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
              {!isSignUp && (
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setResetSent(false); setError(''); }}
                    className="py-1 text-xs font-semibold text-green-700 hover:text-green-800"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
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
          )}
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
