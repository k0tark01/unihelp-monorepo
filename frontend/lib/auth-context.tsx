"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Dev-mode fake user (enabled via NEXT_PUBLIC_DEV_BYPASS_AUTH=true)
// ---------------------------------------------------------------------------

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

const FAKE_USER: User = {
  id: "dev-user-id",
  email: "dev@isitcom.tn",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: { full_name: "Dev User" },
  identities: [],
} as unknown as User;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!DEV_BYPASS); // skip loading in bypass mode

  useEffect(() => {
    if (DEV_BYPASS) return; // skip Supabase call entirely
    // Hydrate initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for auth state changes (login / logout / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (DEV_BYPASS) return; // no-op in bypass mode
    await supabase.auth.signOut();
  }, []);

  // In bypass mode return the fake user immediately
  const user = DEV_BYPASS ? FAKE_USER : (session?.user ?? null);

  return (
    <AuthContext.Provider
      value={{ session, user, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  return useContext(AuthContext);
}
