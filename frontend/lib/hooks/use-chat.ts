/**
 * useChat – manages messages inside a single conversation with streaming-
 * friendly optimistic rendering, fallback error handling, and auto-scroll
 * support.
 */
"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  getConversation,
  sendMessage as apiSendMessage,
  quickAsk as apiQuickAsk,
  ApiError,
} from "@/lib/api";
import {
  mapBackendMessageToUI,
} from "@/lib/message-utils";
import type {
  BackendMessage,
  ChatMessageItem,
  QuickAskPayload,
  RetrievalSource,
} from "@/lib/types";

// ── State ─────────────────────────────────────────────────────────────────

type State = {
  messages: ChatMessageItem[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  language: string | null;
  hasAnswer: boolean | null;
};

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; payload: ChatMessageItem[] }
  | { type: "LOAD_ERROR"; payload: string }
  | { type: "SEND_START"; payload: ChatMessageItem }
  | {
      type: "SEND_SUCCESS";
      payload: {
        assistantMsg: ChatMessageItem;
        language: string;
        hasAnswer: boolean;
      };
    }
  | { type: "SEND_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, messages: action.payload };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "SEND_START":
      return {
        ...state,
        sending: true,
        error: null,
        messages: [...state.messages, action.payload],
      };
    case "SEND_SUCCESS":
      return {
        ...state,
        sending: false,
        messages: [...state.messages, action.payload.assistantMsg],
        language: action.payload.language,
        hasAnswer: action.payload.hasAnswer,
      };
    case "SEND_ERROR":
      return {
        ...state,
        sending: false,
        // Remove the optimistically added user message on error
        messages: state.messages.slice(0, -1),
        error: action.payload,
      };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "RESET":
      return {
        messages: [],
        loading: false,
        sending: false,
        error: null,
        language: null,
        hasAnswer: null,
      };
    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * @param conversationId  – pass a string to load a persisted conversation,
 *                          or `null` for a stateless quick-ask session.
 */
export function useChat(conversationId: string | null) {
  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    loading: false,
    sending: false,
    error: null,
    language: null,
    hasAnswer: null,
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // ── Load existing conversation ─────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) {
      dispatch({ type: "RESET" });
      return;
    }

    dispatch({ type: "LOAD_START" });

    getConversation(conversationId)
      .then((conv) => {
        const mapped: ChatMessageItem[] = (conv.messages ?? []).map(
          (m) => mapBackendMessageToUI(m),
        );
        dispatch({ type: "LOAD_SUCCESS", payload: mapped });
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to load conversation";
        dispatch({ type: "LOAD_ERROR", payload: msg });
      });
  }, [conversationId]);

  // ── Send message (persisted) ───────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, topK = 8): Promise<boolean> => {
      if (!conversationId) return false;
      if (!content.trim()) return false;

      const userMsg: ChatMessageItem = {
        id: generateId(),
        role: "user",
        content,
      };

      dispatch({ type: "SEND_START", payload: userMsg });

      try {
        const res = await apiSendMessage(conversationId, content, topK);
        const sources: RetrievalSource[] = (res.sources ?? []).map((s) => ({
          docTitle: s.title ?? "Unknown",
          chunkId: String(s.id ?? ""),
          snippet: s.text ?? "",
          confidence: s.similarity,
          rerankScore: s.rerank_score ?? null,
          docType: s.type,
        }));

        const assistantMsg: ChatMessageItem = {
          id: res.assistant_message.id ?? generateId(),
          role: "assistant",
          content: res.assistant_message.content,
          sources,
          language: res.language,
        };

        dispatch({
          type: "SEND_SUCCESS",
          payload: {
            assistantMsg,
            language: res.language,
            hasAnswer: res.has_answer,
          },
        });

        return true;
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to send message";
        dispatch({ type: "SEND_ERROR", payload: msg });
        return false;
      }
    },
    [conversationId],
  );

  // ── Quick ask (stateless, no persistence) ─────────────────────────────

  const quickAsk = useCallback(
    async (payload: QuickAskPayload): Promise<boolean> => {
      const userMsg: ChatMessageItem = {
        id: generateId(),
        role: "user",
        content: payload.question,
      };

      dispatch({ type: "SEND_START", payload: userMsg });

      try {
        const res = await apiQuickAsk(payload);
        const sources: RetrievalSource[] = (res.sources ?? []).map((s) => ({
          docTitle: s.title ?? "Unknown",
          chunkId: String(s.id ?? ""),
          snippet: s.text ?? "",
          confidence: s.similarity,
          rerankScore: s.rerank_score ?? null,
          docType: s.type,
        }));

        const assistantMsg: ChatMessageItem = {
          id: generateId(),
          role: "assistant",
          content: res.answer,
          sources,
          language: res.language,
        };

        dispatch({
          type: "SEND_SUCCESS",
          payload: {
            assistantMsg,
            language: res.language,
            hasAnswer: res.has_answer,
          },
        });

        return true;
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to get answer";
        dispatch({ type: "SEND_ERROR", payload: msg });
        return false;
      }
    },
    [],
  );

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    messages: state.messages,
    loading: state.loading,
    sending: state.sending,
    error: state.error,
    language: state.language,
    hasAnswer: state.hasAnswer,
    sendMessage,
    quickAsk,
    clearError,
    reset,
    bottomRef,
  };
}
