/**
 * useAuth – comprehensive auth hook.
 *
 * Wraps the AuthContext and exposes every auth action with loading /
 * error states, so components never need to call the API directly.
 */
"use client";

import { useCallback, useState } from "react";
import { useAuth as useAuthContext } from "@/lib/auth-context";
import {
  register as apiRegister,
  login as apiLogin,
  logout as apiLogout,
  getMe,
  updateProfile as apiUpdateProfile,
  refreshToken as apiRefreshToken,
  ApiError,
} from "@/lib/api";
import type {
  BackendUser,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────

type AuthState = {
  loading: boolean;
  error: string | null;
};

type UseAuthReturn = ReturnType<typeof useAuthContext> & {
  // status
  actionLoading: boolean;
  actionError: string | null;
  clearError: () => void;
  // actions
  handleRegister: (payload: RegisterPayload) => Promise<BackendUser | null>;
  handleLogin: (payload: LoginPayload) => Promise<boolean>;
  handleLogout: () => Promise<void>;
  handleFetchMe: () => Promise<BackendUser | null>;
  handleUpdateProfile: (
    payload: UpdateProfilePayload,
  ) => Promise<BackendUser | null>;
  handleRefreshToken: (token: string) => Promise<boolean>;
};

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const context = useAuthContext();
  const [state, setState] = useState<AuthState>({
    loading: false,
    error: null,
  });

  const setLoading = (loading: boolean) =>
    setState((s) => ({ ...s, loading }));
  const setError = (error: string | null) =>
    setState((s) => ({ ...s, error }));

  const clearError = useCallback(() => setError(null), []);

  const wrap = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn();
        return result;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ── Actions ───────────────────────────────────────────────────────────

  const handleRegister = useCallback(
    (payload: RegisterPayload) => wrap(() => apiRegister(payload)),
    [wrap],
  );

  const handleLogin = useCallback(
    async (payload: LoginPayload): Promise<boolean> => {
      const result = await wrap(() => apiLogin(payload));
      return result !== null;
    },
    [wrap],
  );

  const handleLogout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await apiLogout();
      await context.signOut();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Logout failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [context, wrap]);

  const handleFetchMe = useCallback(
    () => wrap(() => getMe()),
    [wrap],
  );

  const handleUpdateProfile = useCallback(
    (payload: UpdateProfilePayload) =>
      wrap(() => apiUpdateProfile(payload)),
    [wrap],
  );

  const handleRefreshToken = useCallback(
    async (token: string): Promise<boolean> => {
      const result = await wrap(() => apiRefreshToken(token));
      return result !== null;
    },
    [wrap],
  );

  return {
    ...context,
    actionLoading: state.loading,
    actionError: state.error,
    clearError,
    handleRegister,
    handleLogin,
    handleLogout,
    handleFetchMe,
    handleUpdateProfile,
    handleRefreshToken,
  };
}
