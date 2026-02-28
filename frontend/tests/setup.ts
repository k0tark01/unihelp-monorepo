/**
 * tests/setup.ts – global test setup
 *
 * - Imports jest-dom matchers (toBeInTheDocument, etc.)
 * - Stubs out `fetch` globally via vi.stubGlobal
 * - Stubs out the Supabase client so no real network calls are made
 * - Clears all mocks after every test
 */
import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";

// ── Mock fetch globally ───────────────────────────────────────────────────
// Individual tests override `global.fetch` with `vi.fn()` as needed.
if (typeof global.fetch === "undefined") {
  global.fetch = vi.fn();
}

// ── Stub out the Supabase module ──────────────────────────────────────────
// We never want real Supabase calls inside unit tests.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

// ── Reset mocks after each test ───────────────────────────────────────────
afterEach(() => {
  vi.clearAllMocks();
});
