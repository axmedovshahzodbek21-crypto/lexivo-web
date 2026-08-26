'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearUserData } from './storage';
import { pullAll } from './sync';
import { linkUser, unlinkUser } from './onesignal';
import { clearTeacherLibraryCaches } from './teacher-library-cache';

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, session: null, loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

async function relinkPushIfEnabled(userId: string) {
  const { data } = await supabase.from('profiles').select('push_enabled').eq('id', userId).maybeSingle();
  if (data?.push_enabled) linkUser(userId);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session) {
        pullAll();
        relinkPushIfEnabled(data.session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session) {
        relinkPushIfEnabled(session.user.id);
      }
      if (event === 'SIGNED_OUT') {
        // Covers automatic sign-out (token expiry) — manual sign-out calls
        // clearUserData() directly before reaching here, so calling twice is safe.
        clearUserData();
        clearTeacherLibraryCaches();
        unlinkUser();
      }
      if (event === 'PASSWORD_RECOVERY' && typeof window !== 'undefined' && !window.location.pathname.includes('update-password')) {
        window.location.replace('/update-password');
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') pullAll();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError) pullAll();
    return { error: signInError?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) pullAll();
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    clearUserData();
    clearTeacherLibraryCaches();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
