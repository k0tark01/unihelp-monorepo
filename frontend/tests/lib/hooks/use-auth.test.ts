/**
 * use-auth.test.ts – tests for the useAuth hook.
 *
 * Mocks both @/lib/auth-context (Supabase context) and @/lib/api
 * so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/lib/hooks/use-auth";
import type { BackendUser } from "@/lib/types";

// ── Mock auth-context ─────────────────────────────────────────────────────

const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    session: null,
    user: null,
    loading: false,
    signOut: mockSignOut,
  }),
}));

// ── Mock api ──────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  updateProfile: vi.fn(),
  refreshToken: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));

import * as api from "@/lib/api";

// ── Fixtures ──────────────────────────────────────────────────────────────

const MOCK_USER: BackendUser = {
  id: "u1",
  email: "test@uni.tn",
  role: "student",
  full_name: "Test User",
  is_active: true,
  profile: { student_id: "21INF042", department: "Informatique", level: "L3" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useAuth – initial state from context", () => {
  it("inherits loading/user/session from AuthContext", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.actionLoading).toBe(false);
    expect(result.current.actionError).toBeNull();
  });
});

describe("useAuth – handleRegister", () => {
  it("returns the user on success", async () => {
    vi.mocked(api.register).mockResolvedValueOnce(MOCK_USER);
    const { result } = renderHook(() => useAuth());

    let user: BackendUser | null = null;
    await act(async () => {
      user = await result.current.handleRegister({
        email: "test@uni.tn", password: "pass123", full_name: "Test User",
        role: "student", student_id: "21INF042",
      });
    });

    expect(user?.id).toBe("u1");
    expect(result.current.actionLoading).toBe(false);
    expect(result.current.actionError).toBeNull();
  });

  it("returns null and sets actionError on failure", async () => {
    vi.mocked(api.register).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Email already registered", 409),
    );
    const { result } = renderHook(() => useAuth());

    let user: BackendUser | null = MOCK_USER;
    await act(async () => {
      user = await result.current.handleRegister({ email: "dup@uni.tn", password: "pass", full_name: "Dup" });
    });

    expect(user).toBeNull();
    expect(result.current.actionError).toBe("Email already registered");
    expect(result.current.actionLoading).toBe(false);
  });
});

describe("useAuth – handleLogin", () => {
  it("returns true on success", async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: "tok", refresh_token: "ref", expires_in: 3600, token_type: "bearer",
      user: MOCK_USER,
    });
    const { result } = renderHook(() => useAuth());

    let success = false;
    await act(async () => {
      success = await result.current.handleLogin({ email: "test@uni.tn", password: "pass" });
    });

    expect(success).toBe(true);
    expect(result.current.actionError).toBeNull();
  });

  it("returns false and sets error on failure", async () => {
    vi.mocked(api.login).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Invalid credentials", 401),
    );
    const { result } = renderHook(() => useAuth());

    let success = true;
    await act(async () => {
      success = await result.current.handleLogin({ email: "bad@uni.tn", password: "wrong" });
    });

    expect(success).toBe(false);
    expect(result.current.actionError).toBe("Invalid credentials");
  });
});

describe("useAuth – handleLogout", () => {
  it("calls both api.logout and context.signOut", async () => {
    vi.mocked(api.logout).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(api.logout).toHaveBeenCalledOnce();
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(result.current.actionError).toBeNull();
  });

  it("sets error when api.logout fails", async () => {
    vi.mocked(api.logout).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Logout failed", 500),
    );
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(result.current.actionError).toBe("Logout failed");
  });
});

describe("useAuth – handleFetchMe", () => {
  it("returns the current backend user", async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce(MOCK_USER);
    const { result } = renderHook(() => useAuth());

    let user: BackendUser | null = null;
    await act(async () => {
      user = await result.current.handleFetchMe();
    });

    expect(user?.email).toBe("test@uni.tn");
    expect(user?.profile).toMatchObject({ student_id: "21INF042" });
  });

  it("returns null on error", async () => {
    vi.mocked(api.getMe).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Unauthorized", 401),
    );
    const { result } = renderHook(() => useAuth());

    let user: BackendUser | null = MOCK_USER;
    await act(async () => {
      user = await result.current.handleFetchMe();
    });

    expect(user).toBeNull();
    expect(result.current.actionError).toBe("Unauthorized");
  });
});

describe("useAuth – handleUpdateProfile", () => {
  it("returns the updated user", async () => {
    const updated = { ...MOCK_USER, full_name: "Updated Name" };
    vi.mocked(api.updateProfile).mockResolvedValueOnce(updated);
    const { result } = renderHook(() => useAuth());

    let user: BackendUser | null = null;
    await act(async () => {
      user = await result.current.handleUpdateProfile({ full_name: "Updated Name" });
    });

    expect(user?.full_name).toBe("Updated Name");
  });
});

describe("useAuth – handleRefreshToken", () => {
  it("returns true on success", async () => {
    vi.mocked(api.refreshToken).mockResolvedValueOnce({
      access_token: "new-tok", refresh_token: "new-ref", expires_in: 7200, token_type: "bearer",
    });
    const { result } = renderHook(() => useAuth());

    let ok = false;
    await act(async () => {
      ok = await result.current.handleRefreshToken("old-ref");
    });

    expect(ok).toBe(true);
  });

  it("returns false on failure", async () => {
    vi.mocked(api.refreshToken).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Token expired", 401),
    );
    const { result } = renderHook(() => useAuth());

    let ok = true;
    await act(async () => {
      ok = await result.current.handleRefreshToken("expired");
    });

    expect(ok).toBe(false);
    expect(result.current.actionError).toBe("Token expired");
  });
});

describe("useAuth – clearError", () => {
  it("clears actionError", async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new Error("oops"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.handleLogin({ email: "x@y.z", password: "p" });
    });

    await waitFor(() => expect(result.current.actionError).toBeTruthy());

    act(() => result.current.clearError());
    expect(result.current.actionError).toBeNull();
  });
});
