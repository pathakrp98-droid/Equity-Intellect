import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@workspace/api-client-react";
import type { AuthProvider } from "./authCopy";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  authProvider: AuthProvider | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

function getBasePath() {
  return import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProvider | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          user: AuthUser | null;
          authProvider?: unknown;
        }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setAuthProvider(
            data.authProvider === "google" || data.authProvider === "replit"
              ? data.authProvider
              : undefined,
          );
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setAuthProvider(undefined);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
  }, []);

  const logout = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(base)}`;
  }, []);

  return {
    user,
    authProvider,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
