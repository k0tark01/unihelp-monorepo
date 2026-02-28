/**
 * use-chat.test.ts – tests for the useChat hook.
 *
 * Covers both persisted-conversation flow (sendMessage) and
 * stateless quick-ask flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "@/lib/hooks/use-chat";

// ── Mock the api module ───────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  getConversation: vi.fn(),
  sendMessage: vi.fn(),
  quickAsk: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));

import * as api from "@/lib/api";

// ── Fixtures ──────────────────────────────────────────────────────────────

const CONV_DETAIL = {
  id: "c1", user_id: "u1", title: "Chat", is_active: true,
  created_at: null, updated_at: null, message_count: 2,
  messages: [
    { id: "m0", role: "user" as const, content: "Hi", created_at: null },
    { id: "m1", role: "assistant" as const, content: "Hello!", sources: [], created_at: null },
  ],
};

const SEND_RESULT = {
  success: true,
  user_message: { id: "m2", role: "user" as const, content: "What are the rules?" },
  assistant_message: { id: "m3", role: "assistant" as const, content: "The rules are..." },
  sources: [{ id: 1, title: "Regulations", text: "rule 1", similarity: 0.91, rerank_score: 0.95 }],
  language: "French",
  has_answer: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useChat – loading a persisted conversation", () => {
  it("fetches messages on mount", async () => {
    vi.mocked(api.getConversation).mockResolvedValueOnce(CONV_DETAIL);

    const { result } = renderHook(() => useChat("c1"));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[1].role).toBe("assistant");
  });

  it("maps sources from backend messages", async () => {
    const convWithSources = {
      ...CONV_DETAIL,
      messages: [{
        id: "m1", role: "assistant" as const, content: "ans",
        sources: [{ id: 5, title: "Doc", text: "snip", similarity: 0.8, rerank_score: null }],
        created_at: null,
      }],
    };
    vi.mocked(api.getConversation).mockResolvedValueOnce(convWithSources);

    const { result } = renderHook(() => useChat("c1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages[0].sources?.[0].docTitle).toBe("Doc");
    expect(result.current.messages[0].sources?.[0].snippet).toBe("snip");
  });

  it("sets error when fetch fails", async () => {
    vi.mocked(api.getConversation).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Not found", 404),
    );

    const { result } = renderHook(() => useChat("c1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Not found");
  });

  it("resets when conversationId becomes null", async () => {
    vi.mocked(api.getConversation).mockResolvedValueOnce(CONV_DETAIL);
    const { result, rerender } = renderHook(({ id }) => useChat(id), {
      initialProps: { id: "c1" as string | null },
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    rerender({ id: null });
    await waitFor(() => expect(result.current.messages).toHaveLength(0));
  });
});

describe("useChat – sendMessage (persisted)", () => {
  it("adds user message optimistically then assistant message on success", async () => {
    vi.mocked(api.getConversation).mockResolvedValueOnce({ ...CONV_DETAIL, messages: [] });
    vi.mocked(api.sendMessage).mockResolvedValueOnce(SEND_RESULT);

    const { result } = renderHook(() => useChat("c1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = false;
    await act(async () => {
      success = await result.current.sendMessage("What are the rules?");
    });

    expect(success).toBe(true);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].content).toBe("What are the rules?");
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.messages[1].content).toBe("The rules are...");
    expect(result.current.messages[1].sources).toHaveLength(1);
    expect(result.current.messages[1].sources![0].docTitle).toBe("Regulations");
    expect(result.current.language).toBe("French");
    expect(result.current.hasAnswer).toBe(true);
  });

  it("removes the optimistic user message and sets error on failure", async () => {
    vi.mocked(api.getConversation).mockResolvedValueOnce({ ...CONV_DETAIL, messages: [] });
    vi.mocked(api.sendMessage).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("RAG error", 500),
    );

    const { result } = renderHook(() => useChat("c1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = true;
    await act(async () => {
      success = await result.current.sendMessage("Question?");
    });

    expect(success).toBe(false);
    expect(result.current.messages).toHaveLength(0); // rolled back
    expect(result.current.error).toBe("RAG error");
  });

  it("returns false and does not call API for empty content", async () => {
    vi.mocked(api.getConversation).mockResolvedValueOnce({ ...CONV_DETAIL, messages: [] });

    const { result } = renderHook(() => useChat("c1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = true;
    await act(async () => { success = await result.current.sendMessage("   "); });

    expect(success).toBe(false);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("returns false when conversationId is null", async () => {
    const { result } = renderHook(() => useChat(null));
    let success = true;
    await act(async () => { success = await result.current.sendMessage("hello"); });
    expect(success).toBe(false);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

describe("useChat – quickAsk (stateless)", () => {
  it("adds user + assistant messages without persisting", async () => {
    vi.mocked(api.quickAsk).mockResolvedValueOnce({
      success: true,
      question: "q",
      answer: "a",
      sources: [],
      language: "Arabic",
      has_answer: false,
    });

    const { result } = renderHook(() => useChat(null));

    let success = false;
    await act(async () => {
      success = await result.current.quickAsk({ question: "q" });
    });

    expect(success).toBe(true);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.language).toBe("Arabic");
    expect(result.current.hasAnswer).toBe(false);
    expect(api.getConversation).not.toHaveBeenCalled();
  });

  it("passes history and top_k to the API", async () => {
    vi.mocked(api.quickAsk).mockResolvedValueOnce({
      success: true, question: "q", answer: "a", sources: [], language: "fr", has_answer: true,
    });

    const { result } = renderHook(() => useChat(null));
    await act(async () => {
      await result.current.quickAsk({
        question: "follow-up?",
        history: [{ role: "user", content: "first" }, { role: "assistant", content: "reply" }],
        top_k: 3,
      });
    });

    expect(api.quickAsk).toHaveBeenCalledWith({
      question: "follow-up?",
      history: expect.any(Array),
      top_k: 3,
    });
  });

  it("sets error and rolls back on failure", async () => {
    vi.mocked(api.quickAsk).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Service down", 503),
    );

    const { result } = renderHook(() => useChat(null));
    let success = true;
    await act(async () => {
      success = await result.current.quickAsk({ question: "q" });
    });

    expect(success).toBe(false);
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBe("Service down");
  });
});

describe("useChat – reset and clearError", () => {
  it("reset clears all state", async () => {
    vi.mocked(api.getConversation).mockResolvedValueOnce(CONV_DETAIL);
    const { result } = renderHook(() => useChat("c1"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.reset());
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.language).toBeNull();
  });

  it("clearError clears the error field", async () => {
    vi.mocked(api.getConversation).mockRejectedValueOnce(new Error("oops"));
    const { result } = renderHook(() => useChat("c1"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
