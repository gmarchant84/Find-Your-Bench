import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * Landing page for the password-recovery email link
 * (redirectTo https://www.findyourbench.app/reset-password).
 *
 * supabase-js parses the recovery token from the URL when the client starts
 * and emits PASSWORD_RECOVERY. That can happen before this page mounts, so we
 * also accept an existing session; a signed-in user may change their password
 * here too.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  // Read the link's error (expired/used) before supabase-js clears the hash.
  const [linkError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search);
    return params.get('error_description');
  });
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let settled = false;
    const markReady = () => { settled = true; setStatus((s) => (s === 'done' ? s : 'ready')); };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) markReady();
    });
    supabase.auth.getSession()
      .then(({ data }) => { if (data.session) markReady(); })
      .catch(() => {});
    // No recovery session after a few seconds: the link is invalid or expired.
    const timer = setTimeout(() => { if (!settled) setStatus('invalid'); }, linkError ? 0 : 6000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, [linkError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Use at least 6 characters.'); return; }
    if (password !== confirm) { setError("The passwords don't match."); return; }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus('done');
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? '';
      setError(/different from the old/i.test(msg)
        ? 'Choose a password different from your current one.'
        : /session|jwt|expired/i.test(msg)
          ? 'This reset link has expired. Request a new one from the sign-in page.'
          : 'Could not update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:bg-white transition text-base';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 40%, #ecfdf5 100%)' }}
    >
      <img src="/fyb-logo-256.png" alt="Find Your Bench" className="w-20 h-20 object-contain mb-4" />
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h1 className="text-lg font-bold text-gray-900 mb-4">Choose a new password</h1>

        {status === 'checking' && <p className="text-sm text-gray-500">Checking your reset link…</p>}

        {status === 'invalid' && (
          <div className="space-y-4 text-sm text-gray-700">
            <p>This reset link is invalid or has expired. Links work once and expire after an hour.</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm"
            >
              Request a new link
            </button>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-4 text-sm text-gray-700">
            <p>Your password has been updated and you're signed in.</p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm"
            >
              Continue to the map
            </button>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} className={inputClass} required minLength={6} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Confirm password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className={inputClass} required minLength={6} />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm shadow-sm"
            >
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
