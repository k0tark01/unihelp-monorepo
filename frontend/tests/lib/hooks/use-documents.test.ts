/**
 * use-documents.test.ts – tests for the useDocuments hook.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDocuments } from "@/lib/hooks/use-documents";
import type { DocumentsResponse } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getDocuments: vi.fn(),
  uploadDocuments: vi.fn(),
  reindexDocuments: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));

import * as api from "@/lib/api";

const DOCS_RESPONSE: DocumentsResponse = {
  documents: [
    { id: "1", title: "Regulations 2024", status: "regulation", uploaded_at: "2024-01-01T00:00:00Z" },
    { id: "2", title: "Syllabus L3",      status: "syllabus",    uploaded_at: "2024-02-01T00:00:00Z" },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("useDocuments – initial fetch", () => {
  it("loads documents on mount", async () => {
    vi.mocked(api.getDocuments).mockResolvedValueOnce(DOCS_RESPONSE);
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.documents).toHaveLength(2);
    expect(result.current.documents[0].title).toBe("Regulations 2024");
  });

  it("sets error when fetch fails", async () => {
    vi.mocked(api.getDocuments).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Forbidden", 403),
    );
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Forbidden");
    expect(result.current.documents).toHaveLength(0);
  });

  it("skips auto-fetch when autoFetch=false", () => {
    renderHook(() => useDocuments({ autoFetch: false }));
    expect(api.getDocuments).not.toHaveBeenCalled();
  });

  it("passes type filter to the API", async () => {
    vi.mocked(api.getDocuments).mockResolvedValueOnce({ documents: [] });
    renderHook(() => useDocuments({ type: "regulation" }));
    await waitFor(() => expect(api.getDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ type: "regulation" }),
    ));
  });
});

describe("useDocuments – uploadDocuments", () => {
  it("returns true and refreshes list on success", async () => {
    vi.mocked(api.getDocuments).mockResolvedValue(DOCS_RESPONSE);
    vi.mocked(api.uploadDocuments).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = false;
    await act(async () => {
      success = await result.current.uploadDocuments([new File(["content"], "test.pdf")]);
    });

    expect(success).toBe(true);
    // getDocuments called again after upload
    expect(api.getDocuments).toHaveBeenCalledTimes(2);
    expect(result.current.uploading).toBe(false);
  });

  it("returns false and sets error on failure", async () => {
    vi.mocked(api.getDocuments).mockResolvedValueOnce(DOCS_RESPONSE);
    vi.mocked(api.uploadDocuments).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Upload failed", 500),
    );

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = true;
    await act(async () => {
      success = await result.current.uploadDocuments([new File(["x"], "x.pdf")]);
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("Upload failed");
    expect(result.current.uploading).toBe(false);
  });
});

describe("useDocuments – reindexDocuments", () => {
  it("returns true on success", async () => {
    vi.mocked(api.getDocuments).mockResolvedValueOnce(DOCS_RESPONSE);
    vi.mocked(api.reindexDocuments).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = false;
    await act(async () => {
      success = await result.current.reindexDocuments();
    });

    expect(success).toBe(true);
    expect(result.current.reindexing).toBe(false);
  });

  it("returns false and sets error on failure", async () => {
    vi.mocked(api.getDocuments).mockResolvedValueOnce(DOCS_RESPONSE);
    vi.mocked(api.reindexDocuments).mockRejectedValueOnce(
      new (api.ApiError as unknown as new (m: string, s: number) => Error)("Reindex failed", 500),
    );

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = true;
    await act(async () => {
      success = await result.current.reindexDocuments();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("Reindex failed");
  });
});

describe("useDocuments – refresh and clearError", () => {
  it("refresh re-fetches documents", async () => {
    vi.mocked(api.getDocuments).mockResolvedValue(DOCS_RESPONSE);
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.refresh(); });
    expect(api.getDocuments).toHaveBeenCalledTimes(2);
  });

  it("clearError clears error state", async () => {
    vi.mocked(api.getDocuments).mockRejectedValueOnce(new Error("oops"));
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
