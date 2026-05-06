import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface SignUpResult {
  error: Error | null;
  needsConfirmation: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /** Ensure profile/prefs rows exist for current user (safe to call multiple times) */
  ensureProfile: (fullName?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Upsert profile + preferences rows — idempotent, safe to retry */
async function upsertUserRecords(userId: string, email: string, fullName?: string) {
  const [profileResult, prefResult] = await Promise.all([
    supabase.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: fullName ?? null,
        experience_level: 'intermediate',
      },
      { onConflict: 'id', ignoreDuplicates: false }
    ),
    supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        theme: 'dark',
        notifications_enabled: true,
        units: 'imperial',
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    ),
  ]);

  if (profileResult.error) {
    console.warn('[Auth] profile upsert error:', profileResult.error.message);
  }
  if (prefResult.error) {
    console.warn('[Auth] prefs upsert error:', prefResult.error.message);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // After a successful sign-in ensure profile rows exist (handles first login after email verify)
    if (!error && data.user) {
      upsertUserRecords(data.user.id, data.user.email ?? email).catch(console.warn);
    }
    return { error };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error, needsConfirmation: false };

      // If Supabase returned a session immediately (email confirmation disabled),
      // create the profile rows right now.
      if (data.session && data.user) {
        await upsertUserRecords(data.user.id, email, fullName);
        return { error: null, needsConfirmation: false };
      }

      // Email confirmation required — store the name so we can create the profile
      // after they confirm + sign in.
      // We still attempt the upsert in case the user row already exists server-side.
      if (data.user) {
        await upsertUserRecords(data.user.id, email, fullName).catch(() => null);
      }

      return { error: null, needsConfirmation: true };
    },
    []
  );

  const ensureProfile = useCallback(async (fullName?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await upsertUserRecords(user.id, user.email ?? '', fullName);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        ensureProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
