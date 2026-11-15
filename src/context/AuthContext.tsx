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
      .select('is_admin, current_streak')
      .eq('id', userId)
      .maybeSingle();
    setIsAdmin(data?.is_admin === true);
    setCurrentStreak(data?.current_streak ?? 0);
  };

  const refreshStreak = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('current_streak')
      .eq('id', session.user.id)
      .maybeSingle();
    setCurrentStreak(data?.current_streak ?? 0);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchAdminStatus(session.user.id);
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

    return () => subscription?.unsubscribe();
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
