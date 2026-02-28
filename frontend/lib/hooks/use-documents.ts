/**
 * useDocuments – fetches the document list with loading / error fallbacks.
 * Admin-only mutations (upload, reindex) are also exposed.
 */
"use client";

import { useCallback, useEffect, useReducer } from "react";
import {
  getDocuments,
  uploadDocuments as apiUpload,
  reindexDocuments as apiReindex,
  ApiError,
} from "@/lib/api";
import type { UniversityDocument } from "@/lib/types";

// ── State ─────────────────────────────────────────────────────────────────

type State = {
  documents: UniversityDocument[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  reindexing: boolean;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: UniversityDocument[] }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "UPLOAD_START" }
  | { type: "UPLOAD_DONE" }
  | { type: "UPLOAD_ERROR"; payload: string }
  | { type: "REINDEX_START" }
  | { type: "REINDEX_DONE" }
  | { type: "REINDEX_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, documents: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "UPLOAD_START":
      return { ...state, uploading: true, error: null };
    case "UPLOAD_DONE":
      return { ...state, uploading: false };
    case "UPLOAD_ERROR":
      return { ...state, uploading: false, error: action.payload };
    case "REINDEX_START":
      return { ...state, reindexing: true, error: null };
    case "REINDEX_DONE":
      return { ...state, reindexing: false };
    case "REINDEX_ERROR":
      return { ...state, reindexing: false, error: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDocuments(opts?: {
  type?: string;
  limit?: number;
  autoFetch?: boolean;
}) {
  const { type, limit, autoFetch = true } = opts ?? {};

  const [state, dispatch] = useReducer(reducer, {
    documents: [],
    loading: false,
    error: null,
    uploading: false,
    reindexing: false,
  });

  const fetch = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const res = await getDocuments({ type, limit });
      dispatch({ type: "FETCH_SUCCESS", payload: res.documents });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load documents";
      dispatch({ type: "FETCH_ERROR", payload: msg });
    }
  }, [type, limit]);

  useEffect(() => {
    if (autoFetch) void fetch();
  }, [autoFetch, fetch]);

  const uploadDocuments = useCallback(
    async (files: File[]): Promise<boolean> => {
      dispatch({ type: "UPLOAD_START" });
      try {
        await apiUpload(files);
        dispatch({ type: "UPLOAD_DONE" });
        void fetch(); // refresh list after upload
        return true;
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Upload failed";
        dispatch({ type: "UPLOAD_ERROR", payload: msg });
        return false;
      }
    },
    [fetch],
  );

  const reindexDocuments = useCallback(async (): Promise<boolean> => {
    dispatch({ type: "REINDEX_START" });
    try {
      await apiReindex();
      dispatch({ type: "REINDEX_DONE" });
      return true;
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Re-indexing failed";
      dispatch({ type: "REINDEX_ERROR", payload: msg });
      return false;
    }
  }, []);

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  return {
    documents: state.documents,
    loading: state.loading,
    error: state.error,
    uploading: state.uploading,
    reindexing: state.reindexing,
    refresh: fetch,
    uploadDocuments,
    reindexDocuments,
    clearError,
  };
}
