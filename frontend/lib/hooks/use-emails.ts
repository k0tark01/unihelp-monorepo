/**
 * useEmails – list, generate and delete saved emails with loading / error
 * fallbacks and optimistic removal.
 */
"use client";

import { useCallback, useEffect, useReducer } from "react";
import {
  listEmails,
  getEmailTypes,
  generateEmail as apiGenerateEmail,
  deleteEmail as apiDeleteEmail,
  ApiError,
} from "@/lib/api";
import type {
  EmailTypeDescriptor,
  GenerateEmailRequest,
  GeneratedEmail,
  SavedEmail,
} from "@/lib/types";

// ── State ─────────────────────────────────────────────────────────────────

type State = {
  emails: SavedEmail[];
  emailTypes: EmailTypeDescriptor[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  /** Last generated draft (not yet persisted to the saved list) */
  draft: GeneratedEmail | null;
};

type Action =
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      payload: { emails: SavedEmail[]; types: EmailTypeDescriptor[] };
    }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "GENERATE_START" }
  | { type: "GENERATE_SUCCESS"; payload: GeneratedEmail }
  | { type: "GENERATE_ERROR"; payload: string }
  | { type: "REMOVE"; payload: string | number }
  | { type: "REMOVE_ERROR"; payload: { id: string | number; email: SavedEmail } }
  | { type: "CLEAR_DRAFT" }
  | { type: "CLEAR_ERROR" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return {
        ...state,
        loading: false,
        emails: action.payload.emails,
        emailTypes: action.payload.types,
      };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "GENERATE_START":
      return { ...state, generating: true, error: null, draft: null };
    case "GENERATE_SUCCESS":
      return { ...state, generating: false, draft: action.payload };
    case "GENERATE_ERROR":
      return { ...state, generating: false, error: action.payload };
    case "REMOVE":
      return {
        ...state,
        emails: state.emails.filter((e) => e.id !== action.payload),
      };
    case "REMOVE_ERROR":
      // Roll back the optimistic removal
      return {
        ...state,
        emails: [action.payload.email, ...state.emails],
        error: `Failed to delete email`,
      };
    case "CLEAR_DRAFT":
      return { ...state, draft: null };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useEmails(opts?: { autoFetch?: boolean }) {
  const { autoFetch = true } = opts ?? {};

  const [state, dispatch] = useReducer(reducer, {
    emails: [],
    emailTypes: [],
    loading: false,
    generating: false,
    error: null,
    draft: null,
  });

  const fetch = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const [emails, types] = await Promise.all([
        listEmails(),
        getEmailTypes(),
      ]);
      dispatch({ type: "FETCH_SUCCESS", payload: { emails, types } });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load emails";
      dispatch({ type: "FETCH_ERROR", payload: msg });
    }
  }, []);

  useEffect(() => {
    if (autoFetch) void fetch();
  }, [autoFetch, fetch]);

  const generateEmail = useCallback(
    async (payload: GenerateEmailRequest): Promise<GeneratedEmail | null> => {
      dispatch({ type: "GENERATE_START" });
      try {
        const result = await apiGenerateEmail(payload);
        dispatch({ type: "GENERATE_SUCCESS", payload: result });
        return result;
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to generate email";
        dispatch({ type: "GENERATE_ERROR", payload: msg });
        return null;
      }
    },
    [],
  );

  const deleteEmail = useCallback(
    async (id: string | number): Promise<boolean> => {
      const email = state.emails.find((e) => e.id === id);
      // Optimistic remove
      dispatch({ type: "REMOVE", payload: id });
      try {
        await apiDeleteEmail(id);
        return true;
      } catch (err) {
        // Roll back
        if (email) dispatch({ type: "REMOVE_ERROR", payload: { id, email } });
        return false;
      }
    },
    [state.emails],
  );

  const clearDraft = useCallback(() => dispatch({ type: "CLEAR_DRAFT" }), []);
  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  return {
    emails: state.emails,
    emailTypes: state.emailTypes,
    loading: state.loading,
    generating: state.generating,
    error: state.error,
    draft: state.draft,
    refresh: fetch,
    generateEmail,
    deleteEmail,
    clearDraft,
    clearError,
  };
}
