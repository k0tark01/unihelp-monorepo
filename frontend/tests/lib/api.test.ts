/**
 * api.test.ts – unit tests for every action in lib/api.ts.
 *
 * Strategy:
 *  - globalThis.fetch is replaced with a vi.fn() per test
 *  - The Supabase stub is already registered in setup.ts (returns null token)
 *  - We test happy-path mapping AND error propagation for every route group
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api";

// ── helpers ───────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response);
}

function mockFetchError(message: string, status: number) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => JSON.stringify({ error: message }),
  } as Response);
}

// ── env setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:5000";
});

// ── ApiError ─────────────────────────────────────────────────────────────

describe("ApiError", () => {
  it("exposes status and message", () => {
    const err = new ApiError("bad request", 400);
    expect(err.message).toBe("bad request");
    expect(err.status).toBe(400);
    expect(err.isClientError).toBe(true);
    expect(err.isServerError).toBe(false);
    expect(err.isAuthError).toBe(false);
  });

  it("flags auth errors", () => {
    const err401 = new ApiError("unauthorized", 401);
    const err403 = new ApiError("forbidden", 403);
    expect(err401.isAuthError).toBe(true);
    expect(err403.isAuthError).toBe(true);
  });

  it("flags server errors", () => {
    const err = new ApiError("server error", 500);
    expect(err.isServerError).toBe(true);
    expect(err.isClientError).toBe(false);
  });
});

// ── Health ────────────────────────────────────────────────────────────────

describe("getHealth", () => {
  it("maps healthy → ok", async () => {
    mockFetch({ status: "healthy" });
    const { getHealth } = await import("@/lib/api");
    const res = await getHealth();
    expect(res.status).toBe("ok");
  });

  it("maps unknown → fail", async () => {
    mockFetch({ status: "degraded" });
    const { getHealth } = await import("@/lib/api");
    const res = await getHealth();
    expect(res.status).toBe("fail");
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────

describe("register", () => {
  it("returns the user on success", async () => {
    mockFetch({
      success: true,
      user: { id: "u1", email: "a@b.com", role: "student", full_name: "Test", is_active: true, profile: null },
    });
    const { register } = await import("@/lib/api");
    const user = await register({ email: "a@b.com", password: "pass", full_name: "Test" });
    expect(user.id).toBe("u1");
    expect(user.email).toBe("a@b.com");
  });

  it("throws ApiError on 400", async () => {
    mockFetchError("Email already exists", 400);
    const { register } = await import("@/lib/api");
    await expect(register({ email: "a@b.com", password: "pass", full_name: "Test" })).rejects.toThrow(ApiError);
  });
});

describe("login", () => {
  it("maps token + user on success", async () => {
    mockFetch({
      success: true,
      access_token: "tok",
      refresh_token: "ref",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "u1", email: "a@b.com", role: "student", full_name: "Test", is_active: true, profile: null },
    });
    const { login } = await import("@/lib/api");
    const res = await login({ email: "a@b.com", password: "pass" });
    expect(res.access_token).toBe("tok");
    expect(res.user.id).toBe("u1");
  });

  it("throws ApiError on 401", async () => {
    mockFetchError("Invalid credentials", 401);
    const { login } = await import("@/lib/api");
    await expect(login({ email: "a@b.com", password: "wrong" })).rejects.toThrow(ApiError);
  });
});

describe("getMe", () => {
  it("returns the current user", async () => {
    mockFetch({ success: true, id: "u1", email: "me@uni.tn", role: "admin", full_name: "Dr Ali", is_active: true, profile: { title: "Dean" } });
    const { getMe } = await import("@/lib/api");
    const user = await getMe();
    expect(user.role).toBe("admin");
    expect(user.full_name).toBe("Dr Ali");
  });
});

describe("updateProfile", () => {
  it("returns the updated user", async () => {
    mockFetch({ success: true, message: "ok", user: { id: "u1", email: "me@uni.tn", role: "student", full_name: "Updated", is_active: true, profile: null } });
    const { updateProfile } = await import("@/lib/api");
    const user = await updateProfile({ full_name: "Updated" });
    expect(user.full_name).toBe("Updated");
  });
});

describe("refreshToken", () => {
  it("returns new AuthTokens", async () => {
    mockFetch({ success: true, access_token: "new-tok", refresh_token: "new-ref", expires_in: 7200, token_type: "bearer" });
    const { refreshToken } = await import("@/lib/api");
    const tokens = await refreshToken("old-ref");
    expect(tokens.access_token).toBe("new-tok");
  });
});

// ── AI Query ──────────────────────────────────────────────────────────────

describe("query", () => {
  it("returns raw QueryResponse", async () => {
    mockFetch({
      success: true,
      question: "What are the rules?",
      answer: "The rules are...",
      sources: [{ id: 1, title: "Regulations", text: "snippet", similarity: 0.9 }],
      language: "French",
      has_answer: true,
    });
    const { query } = await import("@/lib/api");
    const res = await query({ question: "What are the rules?" });
    expect(res.answer).toBe("The rules are...");
    expect(res.has_answer).toBe(true);
  });
});

describe("chat (convenience wrapper)", () => {
  it("maps backend sources to RetrievalSource shape", async () => {
    mockFetch({
      success: true,
      question: "q",
      answer: "a",
      sources: [{ id: 10, title: "Doc A", text: "some text", similarity: 0.85, rerank_score: 0.9, type: "regulation" }],
      language: "English",
      has_answer: true,
    });
    const { chat } = await import("@/lib/api");
    const res = await chat({ sessionId: "s1", question: "q", language: "en" });
    expect(res.answer).toBe("a");
    expect(res.sources).toHaveLength(1);
    expect(res.sources[0].docTitle).toBe("Doc A");
    expect(res.sources[0].chunkId).toBe("10");
    expect(res.sources[0].snippet).toBe("some text");
    expect(res.sources[0].confidence).toBe(0.85);
    expect(res.sources[0].rerankScore).toBe(0.9);
    expect(res.sources[0].docType).toBe("regulation");
    expect(res.hasAnswer).toBe(true);
    expect(res.language).toBe("English");
  });
});

// ── Conversations ─────────────────────────────────────────────────────────

describe("listConversations", () => {
  it("returns the data array", async () => {
    mockFetch({
      success: true,
      data: [{ id: "c1", user_id: "u1", title: "Chat 1", is_active: true, created_at: null, updated_at: null, message_count: 2 }],
      count: 1,
    });
    const { listConversations } = await import("@/lib/api");
    const convs = await listConversations();
    expect(convs).toHaveLength(1);
    expect(convs[0].id).toBe("c1");
  });

  it("passes limit/offset as query params", async () => {
    mockFetch({ success: true, data: [], count: 0 });
    const { listConversations } = await import("@/lib/api");
    await listConversations({ limit: 5, offset: 10 });
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("limit=5");
    expect(url).toContain("offset=10");
  });
});

describe("createConversation", () => {
  it("returns the new conversation", async () => {
    mockFetch({ success: true, data: { id: "c2", user_id: "u1", title: "New chat", is_active: true, created_at: null, updated_at: null, message_count: 0 } });
    const { createConversation } = await import("@/lib/api");
    const conv = await createConversation("New chat");
    expect(conv.id).toBe("c2");
    expect(conv.title).toBe("New chat");
  });
});

describe("getConversation", () => {
  it("returns conversation with messages", async () => {
    mockFetch({
      success: true,
      data: {
        id: "c1", user_id: "u1", title: "Chat 1", is_active: true,
        created_at: null, updated_at: null, message_count: 1,
        messages: [{ id: "m1", role: "user", content: "Hello", created_at: null }],
      },
    });
    const { getConversation } = await import("@/lib/api");
    const conv = await getConversation("c1");
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].content).toBe("Hello");
  });
});

describe("deleteConversation", () => {
  it("resolves without error", async () => {
    mockFetch({ success: true, message: "Deleted" });
    const { deleteConversation } = await import("@/lib/api");
    await expect(deleteConversation("c1")).resolves.toBeUndefined();
  });

  it("throws on 404", async () => {
    mockFetchError("Not found", 404);
    const { deleteConversation } = await import("@/lib/api");
    await expect(deleteConversation("bad-id")).rejects.toThrow(ApiError);
  });
});

describe("renameConversation", () => {
  it("returns updated conversation with new title", async () => {
    mockFetch({ success: true, data: { id: "c1", user_id: "u1", title: "Renamed", is_active: true, created_at: null, updated_at: null, message_count: 0 } });
    const { renameConversation } = await import("@/lib/api");
    const conv = await renameConversation("c1", "Renamed");
    expect(conv.title).toBe("Renamed");
  });
});

describe("sendMessage", () => {
  it("returns user + assistant messages with sources", async () => {
    mockFetch({
      success: true,
      user_message: { id: "m1", role: "user", content: "Question?" },
      assistant_message: { id: "m2", role: "assistant", content: "Answer." },
      sources: [{ id: 5, title: "Doc", text: "snippet", similarity: 0.8 }],
      language: "French",
      has_answer: true,
    });
    const { sendMessage } = await import("@/lib/api");
    const res = await sendMessage("c1", "Question?");
    expect(res.user_message.content).toBe("Question?");
    expect(res.assistant_message.content).toBe("Answer.");
    expect(res.sources).toHaveLength(1);
    expect(res.has_answer).toBe(true);
  });
});

describe("quickAsk", () => {
  it("returns a QueryResponse without persistence", async () => {
    mockFetch({
      success: true,
      question: "q",
      answer: "a",
      sources: [],
      language: "Arabic",
      has_answer: false,
    });
    const { quickAsk } = await import("@/lib/api");
    const res = await quickAsk({ question: "q" });
    expect(res.has_answer).toBe(false);
    expect(res.language).toBe("Arabic");
  });
});

// ── Documents ─────────────────────────────────────────────────────────────

describe("getDocuments", () => {
  it("maps backend docs to UniversityDocument shape", async () => {
    mockFetch({
      success: true,
      data: [{ id: 3, title: "Regulation", type: "regulation", created_at: "2024-01-01T00:00:00Z" }],
      count: 1,
    });
    const { getDocuments } = await import("@/lib/api");
    const res = await getDocuments();
    expect(res.documents[0].id).toBe("3");
    expect(res.documents[0].status).toBe("regulation");
    expect(res.documents[0].uploaded_at).toBe("2024-01-01T00:00:00Z");
  });

  it("falls back status to active when type is missing", async () => {
    mockFetch({ success: true, data: [{ id: 1, title: "Doc" }], count: 1 });
    const { getDocuments } = await import("@/lib/api");
    const res = await getDocuments();
    expect(res.documents[0].status).toBe("active");
  });
});

// ── Emails ────────────────────────────────────────────────────────────────

describe("listEmails", () => {
  it("returns saved emails array", async () => {
    mockFetch({
      success: true,
      data: [{ id: "e1", email_type: "attestation", student_name: "Ali", student_id: "21INF", subject: "Subj", body: "Body", created_at: "2024-01-01" }],
    });
    const { listEmails } = await import("@/lib/api");
    const emails = await listEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].email_type).toBe("attestation");
  });
});

describe("getEmailTypes", () => {
  it("returns email type descriptors", async () => {
    mockFetch({ success: true, data: [{ key: "attestation", label: "Attestation" }] });
    const { getEmailTypes } = await import("@/lib/api");
    const types = await getEmailTypes();
    expect(types[0].key).toBe("attestation");
    expect(types[0].label).toBe("Attestation");
  });
});

describe("generateEmail", () => {
  it("maps backend result to GeneratedEmail", async () => {
    mockFetch({ success: true, subject: "Demande d'attestation", body: "Monsieur..." });
    const { generateEmail } = await import("@/lib/api");
    const result = await generateEmail({
      type: "attestation",
      language: "fr",
      data: { fullName: "Ali", studentId: "21INF", department: "Info", level: "L3", reason: "Stage", recipientOffice: "Directeur" },
    });
    expect(result.subject).toBe("Demande d'attestation");
    expect(result.body).toBe("Monsieur...");
  });

  it("sends correct fields to backend", async () => {
    mockFetch({ success: true, subject: "s", body: "b" });
    const { generateEmail } = await import("@/lib/api");
    await generateEmail({
      type: "stage",
      language: "fr",
      data: { fullName: "Ali", studentId: "21INF", department: "CS", level: "M1", reason: "Internship request", recipientOffice: "M. le Directeur" },
    });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.email_type).toBe("stage");
    expect(body.student_name).toBe("Ali");
    expect(body.student_id).toBe("21INF");
    expect(body.recipient).toBe("M. le Directeur");
    expect(body.details).toContain("CS");
    expect(body.details).toContain("M1");
  });
});

describe("deleteEmail", () => {
  it("resolves without error", async () => {
    mockFetch({ success: true });
    const { deleteEmail } = await import("@/lib/api");
    await expect(deleteEmail("e1")).resolves.toBeUndefined();
  });

  it("uses the correct URL", async () => {
    mockFetch({ success: true });
    const { deleteEmail } = await import("@/lib/api");
    await deleteEmail("e42");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/emails/e42");
  });
});

// ── Missing BACKEND_URL ───────────────────────────────────────────────────

describe("when NEXT_PUBLIC_BACKEND_URL is missing", () => {
  it("throws ApiError with status 500", async () => {
    const original = process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;

    // Import fresh module so it reads the cleared env var
    vi.resetModules();
    const freshApi = await import("@/lib/api");

    // After resetModules the thrown error is an instance of the *freshly*
    // imported ApiError class — check by name and status instead.
    const err = await freshApi.getHealth().catch((e: unknown) => e);
    expect((err as Error).name).toBe("ApiError");
    expect((err as { status: number }).status).toBe(500);
    expect((err as Error).message).toContain("NEXT_PUBLIC_BACKEND_URL");

    process.env.NEXT_PUBLIC_BACKEND_URL = original;
    vi.resetModules();
  });
});
