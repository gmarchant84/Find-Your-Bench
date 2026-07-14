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
    const { error, data } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('User creation failed');
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, email, username });
    if (profileError) {
      await supabase.auth.signOut().catch(() => {});
      throw profileError;
    }
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
