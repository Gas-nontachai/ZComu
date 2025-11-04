"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { ProfilesRow } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfilesRow | null;
  loading: boolean;
  refreshingProfile: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type PostgrestError = {
  code?: string;
};

function isNotFoundError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as PostgrestError).code === "PGRST116"
  );
}

async function bootstrapProfile(user: User, accessToken?: string) {
  if (!accessToken) return;

  try {
    const response = await fetch("/api/profiles/bootstrap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        metadata: user.user_metadata ?? {},
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error("Failed to bootstrap profile", message);
    }
  } catch (error) {
    console.error("Failed to bootstrap profile", error);
  }
}

async function fetchProfileByUserId(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfilesRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingProfile, setRefreshingProfile] = useState(false);

  const loadProfile = useCallback(
    async (user: User | null, accessToken?: string) => {
      if (!user) {
        setProfile(null);
        return;
      }

      setRefreshingProfile(true);
      try {
        const data = await fetchProfileByUserId(user.id);
        setProfile(data);
      } catch (error: unknown) {
        if (isNotFoundError(error)) {
          await bootstrapProfile(user, accessToken);
          try {
            const data = await fetchProfileByUserId(user.id);
            setProfile(data);
          } catch (nestedError) {
            console.error(nestedError);
          }
        } else {
          console.error(error);
        }
      } finally {
        setRefreshingProfile(false);
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!isMounted) return;
        setSession(data.session ?? null);
        if (data.session?.user && isMounted) {
          await loadProfile(data.session.user, data.session.access_token);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user, nextSession.access_token);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadProfile(session.user, session.access_token);
  }, [loadProfile, session?.access_token, session?.user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshingProfile,
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, refreshingProfile, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
