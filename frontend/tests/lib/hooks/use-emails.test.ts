/**
 * use-emails.test.ts – tests for the useEmails hook.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEmails } from "@/lib/hooks/use-emails";
import type { SavedEmail, GeneratedEmail, EmailTypeDescriptor } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  listEmails: vi.fn(),
  getEmailTypes: vi.fn(),
  generateEmail: vi.fn(),
  deleteEmail: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));

import * as api from "@/lib/api";

// ── Fixtures ──────────────────────────────────────────────────────────────

const SAVED_EMAILS: SavedEmail[] = [
  { id: "e1", email_type: "attestation", student_name: "Ali", student_id: "21INF042", subject: "Demande d'attestation", body: "...", created_at: "2024-01-01" },
  { id: "e2", email_type: "stage",       student_name: "Sara", student_id: "22INFO9",  subject: "Demande de stage",     body: "...", created_at: "2024-02-01" },
];

const EMAIL_TYPES: EmailTypeDescriptor[] = [
  { key: "attestation", label: "Attestation de scolarité" },
  { key: "stage",       label: "Demande de stage" },
];

const DRAFT: GeneratedEmail = {
  subject: "Demande d'attestation de présence",
  body: "Monsieur le Directeur,\n\nJe soussigné...",
};

beforeEach(() => vi.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useEmails – initial fetch", () => {
  it("loads emails and types on mount", async () => {
    vi.mocked(api.listEmails).mockResolvedValueOnce(SAVED_EMAILS);
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce(EMAIL_TYPES);

    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.emails).toHaveLength(2);
    expect(result.current.emailTypes).toHaveLength(2);
    expect(result.current.emails[0].email_type).toBe("attestation");
    expect(result.current.emailTypes[1].key).toBe("stage");
  });

  it("sets error and leaves empty arrays when fetch fails", async () => {
    vi.mocked(api.listEmails).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("DB error", 500),
    );
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("DB error");
    expect(result.current.emails).toHaveLength(0);
  });

  it("skips auto-fetch when autoFetch=false", () => {
    renderHook(() => useEmails({ autoFetch: false }));
    expect(api.listEmails).not.toHaveBeenCalled();
    expect(api.getEmailTypes).not.toHaveBeenCalled();
  });
});

describe("useEmails – generateEmail", () => {
  it("stores draft and returns GeneratedEmail on success", async () => {
    vi.mocked(api.listEmails).mockResolvedValueOnce([]);
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce([]);
    vi.mocked(api.generateEmail).mockResolvedValueOnce(DRAFT);

    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let draft: GeneratedEmail | null = null;
    await act(async () => {
      draft = await result.current.generateEmail({
        type: "attestation",
        language: "fr",
        data: { fullName: "Ali", studentId: "21INF042", department: "Informatique", level: "L3", reason: "Stage", recipientOffice: "Directeur" },
      });
    });

    expect(draft?.subject).toBe(DRAFT.subject);
    expect(result.current.draft?.subject).toBe(DRAFT.subject);
    expect(result.current.generating).toBe(false);
  });

  it("returns null and sets error on failure", async () => {
    vi.mocked(api.listEmails).mockResolvedValueOnce([]);
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce([]);
    vi.mocked(api.generateEmail).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Gemini error", 502),
    );

    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let draft: GeneratedEmail | null = { subject: "x", body: "y" };
    await act(async () => {
      draft = await result.current.generateEmail({
        type: "custom", language: "fr",
        data: { fullName: "", studentId: "", department: "", level: "", reason: "", recipientOffice: "" },
      });
    });

    expect(draft).toBeNull();
    expect(result.current.draft).toBeNull();
    expect(result.current.error).toBe("Gemini error");
  });
});

describe("useEmails – deleteEmail", () => {
  it("optimistically removes the email from the list", async () => {
    vi.mocked(api.listEmails).mockResolvedValueOnce([...SAVED_EMAILS]);
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce([]);
    vi.mocked(api.deleteEmail).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.emails).toHaveLength(2));

    let success = false;
    await act(async () => {
      success = await result.current.deleteEmail("e1");
    });

    expect(success).toBe(true);
    expect(result.current.emails).toHaveLength(1);
    expect(result.current.emails[0].id).toBe("e2");
  });

  it("rolls back the optimistic removal on failure", async () => {
    vi.mocked(api.listEmails).mockResolvedValueOnce([...SAVED_EMAILS]);
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce([]);
    vi.mocked(api.deleteEmail).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Not found", 404),
    );

    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.emails).toHaveLength(2));

    let success = true;
    await act(async () => {
      success = await result.current.deleteEmail("e1");
    });

    expect(success).toBe(false);
    // rolled back – email should be back
    expect(result.current.emails.some((e) => e.id === "e1")).toBe(true);
  });
});

describe("useEmails – clearDraft and clearError", () => {
  it("clearDraft sets draft to null", async () => {
    vi.mocked(api.listEmails).mockResolvedValueOnce([]);
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce([]);
    vi.mocked(api.generateEmail).mockResolvedValueOnce(DRAFT);

    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.generateEmail({
        type: "attestation", language: "fr",
        data: { fullName: "", studentId: "", department: "", level: "", reason: "", recipientOffice: "" },
      });
    });
    expect(result.current.draft).not.toBeNull();

    act(() => result.current.clearDraft());
    expect(result.current.draft).toBeNull();
  });

  it("clearError clears error state", async () => {
    vi.mocked(api.listEmails).mockRejectedValueOnce(new Error("oops"));
    vi.mocked(api.getEmailTypes).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useEmails());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
