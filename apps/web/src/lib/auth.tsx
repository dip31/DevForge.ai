/**
 * React auth provider and hook built on top of Supabase Auth.
 *
 * Usage:
 *   // Wrap the app:
 *   <AuthProvider><App /></AuthProvider>
 *
 *   // Consume in any component:
 *   const { user, session, loading, signOut } = useAuth()
 *
 *   // Get a fresh access token for API calls:
 *   const { data: { session } } = await supabase.auth.getSession()
 *   const token = session?.access_token
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { Session, User } from "@supabase/supabase-js";

import { supabase, supabaseEnabled } from "./supabase";

interface AuthContextValue {
  /** Supabase session — null when not authenticated. */

  session: Session | null;

  /** Supabase user — null when not authenticated. */

  user: User | null;

  /** True while the initial session is being restored from storage. */

  loading: boolean;

  /** Signs the user out and clears the session. */

  signOut: () => Promise<void>;

  /** Returns the current access token, or null if not authenticated. */

  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);

      return;
    }

    // Restore the session from storage on mount.

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);

      setLoading(false);
    });

    // Subscribe to auth state changes (login, logout, token refresh).

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut();

    setSession(null);
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!supabase) return null;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        session,

        user: session?.user ?? null,

        loading,

        signOut,

        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");

  return ctx;
}

/**
 * Returns an Authorization header value for Fastify API requests.
 * Returns null when no session is active.
 *
 * Example:
 *   const authHeader = await getAuthHeader()
 *   fetch("/api/v1/...", { headers: { Authorization: authHeader ?? "" } })
 */

export async function getAuthHeader(): Promise<string | null> {
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  return `Bearer ${session.access_token}`;
}
