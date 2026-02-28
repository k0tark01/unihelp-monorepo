/**
 * use-conversations.test.ts – tests for the useConversations hook.
 *
 * Mocks: @/lib/api (all conversation actions)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useConversations } from "@/lib/hooks/use-conversations";
import type { BackendConversation } from "@/lib/types";

// ── Mock the api module ───────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));

import * as api from "@/lib/api";

// ── Fixtures ──────────────────────────────────────────────────────────────

const CONV_1: BackendConversation = {
  id: "c1", user_id: "u1", title: "Chat One",
  is_active: true, created_at: null, updated_at: null, message_count: 3,
};
const CONV_2: BackendConversation = {
  id: "c2", user_id: "u1", title: "Chat Two",
  is_active: true, created_at: null, updated_at: null, message_count: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useConversations – initial fetch", () => {
  it("starts loading and then populates conversations", async () => {
    vi.mocked(api.listConversations).mockResolvedValueOnce([CONV_1, CONV_2]);

    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conversations).toHaveLength(2);
    expect(result.current.conversations[0].id).toBe("c1");
  });

  it("sets error when fetch fails", async () => {
    vi.mocked(api.listConversations).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Network error", 500),
    );

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");
    expect(result.current.conversations).toHaveLength(0);
  });

  it("skips auto-fetch when autoFetch=false", () => {
    renderHook(() => useConversations({ autoFetch: false }));
    expect(api.listConversations).not.toHaveBeenCalled();
  });
});

describe("useConversations – createConversation", () => {
  it("prepends the new conversation and returns it", async () => {
    vi.mocked(api.listConversations).mockResolvedValueOnce([CONV_1]);
    const newConv: BackendConversation = { id: "c3", user_id: "u1", title: "New", is_active: true, created_at: null, updated_at: null, message_count: 0 };
    vi.mocked(api.createConversation).mockResolvedValueOnce(newConv);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: BackendConversation | null = null;
    await act(async () => {
      returned = await result.current.createConversation("New");
    });

    expect(returned?.id).toBe("c3");
    expect(result.current.conversations[0].id).toBe("c3");
  });

  it("sets error and returns null on failure", async () => {
    vi.mocked(api.listConversations).mockResolvedValueOnce([]);
    vi.mocked(api.createConversation).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Create failed", 500),
    );

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: BackendConversation | null = null;
    await act(async () => {
      returned = await result.current.createConversation("Fail");
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Create failed");
  });
});

describe("useConversations – deleteConversation", () => {
  it("optimistically removes the conversation from the list", async () => {
    vi.mocked(api.listConversations).mockResolvedValueOnce([CONV_1, CONV_2]);
    vi.mocked(api.deleteConversation).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    await act(async () => {
      await result.current.deleteConversation("c1");
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].id).toBe("c2");
  });

  it("re-syncs list when delete fails", async () => {
    vi.mocked(api.listConversations).mockResolvedValue([CONV_1, CONV_2]);
    vi.mocked(api.deleteConversation).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Not found", 404),
    );

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    let success = true;
    await act(async () => {
      success = await result.current.deleteConversation("c1");
    });

    expect(success).toBe(false);
    // refresh was called to re-sync
    expect(api.listConversations).toHaveBeenCalledTimes(2);
  });
});

describe("useConversations – renameConversation", () => {
  it("optimistically updates the title", async () => {
    vi.mocked(api.listConversations).mockResolvedValueOnce([CONV_1]);
    vi.mocked(api.renameConversation).mockResolvedValueOnce({ ...CONV_1, title: "Renamed" });

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    await act(async () => {
      await result.current.renameConversation("c1", "Renamed");
    });

    expect(result.current.conversations[0].title).toBe("Renamed");
  });
});

describe("useConversations – clearError", () => {
  it("clears the error field", async () => {
    vi.mocked(api.listConversations).mockRejectedValueOnce(new Error("oops"));
    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
