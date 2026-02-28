/**
 * useConversations – manages the list of conversations with optimistic
 * updates, pagination, and graceful fallbacks.
 */
"use client";

import { useCallback, useEffect, useReducer } from "react";
import {
  listConversations,
  createConversation as apiCreateConversation,
  deleteConversation as apiDeleteConversation,
  renameConversation as apiRenameConversation,
  ApiError,
} from "@/lib/api";
import type { BackendConversation } from "@/lib/types";

// ── State ─────────────────────────────────────────────────────────────────

type State = {
  conversations: BackendConversation[];
  loading: boolean;
  error: string | null;
  /** True while a create / delete / rename is in-flight */
  mutating: boolean;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: BackendConversation[] }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "MUTATE_START" }
  | { type: "MUTATE_ERROR"; payload: string }
  | { type: "ADD"; payload: BackendConversation }
  | { type: "REMOVE"; payload: string }
  | { type: "RENAME"; payload: { id: string; title: string } }
  | { type: "CLEAR_ERROR" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, conversations: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "MUTATE_START":
      return { ...state, mutating: true, error: null };
    case "MUTATE_ERROR":
      return { ...state, mutating: false, error: action.payload };
    case "ADD":
      return {
        ...state,
        mutating: false,
        conversations: [action.payload, ...state.conversations],
      };
    case "REMOVE":
      return {
        ...state,
        mutating: false,
        conversations: state.conversations.filter((c) => c.id !== action.payload),
      };
    case "RENAME":
      return {
        ...state,
        mutating: false,
        conversations: state.conversations.map((c) =>
          c.id === action.payload.id
            ? { ...c, title: action.payload.title }
            : c,
        ),
      };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useConversations(opts?: {
  limit?: number;
  autoFetch?: boolean;
}) {
  const { limit = 20, autoFetch = true } = opts ?? {};

  const [state, dispatch] = useReducer(reducer, {
    conversations: [],
    loading: false,
    error: null,
    mutating: false,
  });

  // ── Fetch list ─────────────────────────────────────────────────────────

  const fetch = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const data = await listConversations({ limit });
      dispatch({ type: "FETCH_SUCCESS", payload: data });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load conversations";
      dispatch({ type: "FETCH_ERROR", payload: msg });
    }
  }, [limit]);

  useEffect(() => {
    if (autoFetch) void fetch();
  }, [autoFetch, fetch]);

  // ── Create ─────────────────────────────────────────────────────────────

  const createConversation = useCallback(
    async (title?: string): Promise<BackendConversation | null> => {
      dispatch({ type: "MUTATE_START" });
      try {
        const conv = await apiCreateConversation(title);
        dispatch({ type: "ADD", payload: conv });
        return conv;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to create conversation";
        dispatch({ type: "MUTATE_ERROR", payload: msg });
        return null;
      }
    },
    [],
  );

  // ── Delete ─────────────────────────────────────────────────────────────

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      // Optimistic update — remove immediately from the list
      dispatch({ type: "REMOVE", payload: id });
      try {
        await apiDeleteConversation(id);
        return true;
      } catch (err) {
        // Roll back on failure
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to delete conversation";
        dispatch({ type: "MUTATE_ERROR", payload: msg });
        void fetch(); // re-sync list
        return false;
      }
    },
    [fetch],
  );

  // ── Rename ─────────────────────────────────────────────────────────────

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<boolean> => {
      // Optimistic update
      dispatch({ type: "RENAME", payload: { id, title: newTitle } });
      try {
        await apiRenameConversation(id, newTitle);
        return true;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to rename conversation";
        dispatch({ type: "MUTATE_ERROR", payload: msg });
        void fetch();
        return false;
      }
    },
    [fetch],
  );

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  return {
    conversations: state.conversations,
    loading: state.loading,
    error: state.error,
    mutating: state.mutating,
    refresh: fetch,
    createConversation,
    deleteConversation,
    renameConversation,
    clearError,
  };
}
