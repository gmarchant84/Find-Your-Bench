import { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  currentStreak: number;
  refreshStreak: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AUTH_INIT_TIMEOUT_MS = 4000;

// The update_streak() trigger only touches profiles.current_streak when the
// user acts, so a streak that lapsed days ago is still stored as e.g. 7.
// Treat it as broken for display if the last activity is older than
// yesterday in US/Pacific (the timezone the trigger uses).
function effectiveStreak(streak: number | null | undefined, lastActivity: string | null | undefined): number {
  if (!streak || !lastActivity) return 0;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date()); // YYYY-MM-DD
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  return lastActivity >= yesterday ? streak : 0;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Must match the rule in handle_new_user() / profiles_guard() in
// supabase/migrations/20261114120000_launch_security_hardening.sql
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;

export function validateUsername(username: string): string | null {
  if (username.includes('@')) return "Usernames can't contain @ (please don't use your email address).";
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-30 characters: letters, numbers, dot, dash or underscore.';
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);

  const fetchAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin, current_streak, last_activity_date')
      .eq('id', userId)
      .maybeSingle();
    setIsAdmin(data?.is_admin === true);
    setCurrentStreak(effectiveStreak(data?.current_streak, data?.last_activity_date));
  };

  const refreshStreak = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('current_streak, last_activity_date')
      .eq('id', session.user.id)
      .maybeSingle();
    setCurrentStreak(effectiveStreak(data?.current_streak, data?.last_activity_date));
  };

  useEffect(() => {
    // getSession() can block on a network token refresh when the stored access
    // token has expired (e.g. app reopened after >1h). On a slow or hung
    // connection that promise can take 30-50s or never settle, and the splash
    // only hides once loading=false. Never let auth hold the UI hostage:
    // render as signed-out after a short grace period; onAuthStateChange will
    // update the session when the refresh eventually completes.
    const authTimeout = setTimeout(() => setLoading(false), AUTH_INIT_TIMEOUT_MS);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) fetchAdminStatus(session.user.id);
      })
      .catch((err) => {
        console.error('[auth] getSession failed', err);
      })
      .finally(() => {
        clearTimeout(authTimeout);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (() => {
        setSession(session);
        if (session?.user) {
          fetchAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
          setCurrentStreak(0);
        }
        setLoading(false);
      })();
    });

    return () => {
      clearTimeout(authTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const cleanUsername = username.trim();
    const usernameError = validateUsername(cleanUsername);
    if (usernameError) throw new Error(usernameError);

    // Friendly pre-check; the database trigger still guarantees uniqueness.
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', cleanUsername.replace(/[\\%_]/g, '\\$&'))
      .limit(1);
    if (taken && taken.length > 0) throw new Error('That username is taken. Please choose another.');

    // The profile row is created server-side by the handle_new_user trigger on
    // auth.users (reads username from user metadata). The client no longer
    // inserts into profiles, and email is never copied out of auth.users.
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: cleanUsername } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('User creation failed');
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin, currentStreak, refreshStreak, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
