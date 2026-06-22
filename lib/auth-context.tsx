'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { pullAll, startSync, stopSync } from './web-sync';

function dispatch(name: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(name));
}

async function syncPull(uid: string) {
  dispatch('lexivo-sync-start');
  try { await pullAll(uid); dispatch('lexivo-sync-done'); }
  catch { dispatch('lexivo-sync-error'); }
}

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) {
        syncPull(data.session.user.id).then(() => startSync(data.session!.user.id));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session?.user) {
        syncPull(session.user.id).then(() => startSync(session.user.id));
      }
      if (event === 'SIGNED_OUT') {
        stopSync();
      }
      if (event === 'PASSWORD_RECOVERY' && typeof window !== 'undefined' && !window.location.pathname.includes('update-password')) {
        window.location.replace('/update-password');
      }
    });

    return () => { subscription.unsubscribe(); stopSync(); };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (data.user) { await syncPull(data.user.id); startSync(data.user.id); }
    return { error: signInError?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.user) { await syncPull(data.user.id); startSync(data.user.id); }
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    stopSync();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
