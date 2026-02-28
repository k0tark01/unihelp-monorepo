/**
 * api.ts – All typed action functions for every backend endpoint.
 *
 * Pattern:
 *  - `request<T>()` is the base fetch primitive (adds auth header, parses JSON).
 *  - Each exported function maps 1-to-1 with a backend route and stays pure
 *    (no side-effects beyond the network call).
 *  - Raw backend shapes are declared inline and mapped to the UI types in
 *    `lib/types.ts`.
 */

import {
  AuthTokens,
  BackendConversation,
  BackendConversationDetail,
  BackendUser,
  ChatRequest,
  ChatResponse,
  DocumentsResponse,
  EmailTypeDescriptor,
  GenerateEmailRequest,
  GeneratedEmail,
  HealthResponse,
  LoginPayload,
  LoginResponse,
  QueryPayload,
  QueryResponse,
  QuickAskPayload,
  RegisterPayload,
  RetrievalSource,
  SavedEmail,
  SendMessageResponse,
  UniversityDocument,
  UpdateProfilePayload,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

// NOTE: BASE_URL is intentionally resolved lazily (inside request()) so that
// test environments can override process.env.NEXT_PUBLIC_BACKEND_URL per-test.

// ────────────────────────────────────────────────────────────────────────────
// Errors
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Base request primitive
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns a valid (non-expired) Supabase access token.
 * If the current session expires within 60 s it is proactively refreshed
 * before the token is returned.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;

    // Proactively refresh if the token expires in ≤ 60 seconds
    const expiresAt = data.session.expires_at ?? 0; // Unix seconds
    const nowSec = Math.floor(Date.now() / 1000);
    if (expiresAt - nowSec <= 60) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (!error && refreshed.session) {
        return refreshed.session.access_token;
      }
    }

    return data.session.access_token;
  } catch {
    return null;
  }
}

/** Execute one raw fetch and return the parsed body + Response. */
async function fetchOnce(
  url: string,
  token: string | null,
  init: RequestInit | undefined,
  isFormData: boolean,
): Promise<{ response: Response; parsed: unknown }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }
  return { response, parsed };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Read lazily so test environments can set process.env per-test
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  if (!baseUrl) {
    throw new ApiError(
      "NEXT_PUBLIC_BACKEND_URL is not configured. Check your .env file.",
      500,
    );
  }

  const isFormData = init?.body instanceof FormData;
  const url = `${baseUrl}${path}`;

  let token = await getAuthToken();
  let { response, parsed } = await fetchOnce(url, token, init, isFormData);

  // ── 401 auto-retry: refresh the session once and retry ─────────────────
  if (response.status === 401) {
    try {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (!error && refreshed.session) {
        token = refreshed.session.access_token;
        ({ response, parsed } = await fetchOnce(url, token, init, isFormData));
      }
    } catch {
      // If refresh fails, fall through to the error throw below
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  if (!response.ok) {
    const obj =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    const message =
      typeof obj["error"] === "string"
        ? obj["error"]
        : typeof obj["message"] === "string"
          ? obj["message"]
          : `API error (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return parsed as T;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Raw source shape returned by the backend */
export type RawBackendSource = {
  id?: string | number;
  title?: string;
  type?: string;
  text?: string;
  file_url?: string | null;
  similarity?: number;
  rerank_score?: number | null;
};

function mapSource(s: RawBackendSource): RetrievalSource {
  return {
    docTitle: s.title ?? "Unknown",
    chunkId: String(s.id ?? ""),
    snippet: s.text ?? "",
    confidence: s.similarity,
    rerankScore: s.rerank_score ?? null,
    docType: s.type,
    fileUrl: s.file_url ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// AUTH  –  /api/auth/*
// ────────────────────────────────────────────────────────────────────────────

export async function register(payload: RegisterPayload): Promise<BackendUser> {
  type Res = { success: boolean; user: BackendUser };
  const res = await request<Res>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.user;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  type Res = { success: boolean } & LoginResponse;
  const res = await request<Res>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    expires_in: res.expires_in,
    token_type: res.token_type,
    user: res.user,
  };
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<BackendUser> {
  const res = await request<{ success: boolean } & BackendUser>("/api/auth/me");
  return {
    id: res.id,
    email: res.email,
    role: res.role,
    full_name: res.full_name,
    is_active: res.is_active,
    profile: res.profile,
    created_at: res.created_at,
    updated_at: res.updated_at,
  };
}

export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<BackendUser> {
  const res = await request<{
    success: boolean;
    message: string;
    user: BackendUser;
  }>("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.user;
}

export async function refreshToken(
  refreshTokenValue: string,
): Promise<AuthTokens> {
  const res = await request<{ success: boolean } & AuthTokens>(
    "/api/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshTokenValue }),
    },
  );
  return {
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    expires_in: res.expires_in,
    token_type: res.token_type,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// AI QUERY  –  /api/ai/query
// ────────────────────────────────────────────────────────────────────────────

export function query(payload: QueryPayload): Promise<QueryResponse> {
  return request<QueryResponse>("/api/ai/query", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function chat(payload: ChatRequest): Promise<ChatResponse> {
  return query({ question: payload.question }).then(
    (res): ChatResponse => ({
      answer: res.answer,
      sources: (res.sources ?? []).map(mapSource),
      language: res.language,
      hasAnswer: res.has_answer,
    }),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS  –  /api/conversations/*
// ────────────────────────────────────────────────────────────────────────────

export async function listConversations(opts?: {
  limit?: number;
  offset?: number;
}): Promise<BackendConversation[]> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await request<{
    success: boolean;
    data: BackendConversation[];
    count: number;
  }>(`/api/conversations/${qs}`);
  return res.data ?? [];
}

export async function createConversation(
  title?: string,
): Promise<BackendConversation> {
  const res = await request<{ success: boolean; data: BackendConversation }>(
    "/api/conversations/",
    {
      method: "POST",
      body: JSON.stringify({ title: title ?? null }),
    },
  );
  return res.data;
}

export async function getConversation(
  id: string,
): Promise<BackendConversationDetail> {
  const res = await request<{
    success: boolean;
    data: BackendConversationDetail;
  }>(`/api/conversations/${id}`);
  return res.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await request<{ success: boolean; message: string }>(
    `/api/conversations/${id}`,
    { method: "DELETE" },
  );
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<BackendConversation> {
  const res = await request<{ success: boolean; data: BackendConversation }>(
    `/api/conversations/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({ title }),
    },
  );
  return res.data;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  topK = 8,
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content, top_k: topK }),
    },
  );
}

export function quickAsk(payload: QuickAskPayload): Promise<QueryResponse> {
  return request<QueryResponse>("/api/conversations/quick", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// DOCUMENTS  –  /api/documents/*
// ────────────────────────────────────────────────────────────────────────────

export async function getDocuments(opts?: {
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<DocumentsResponse> {
  const params = new URLSearchParams();
  if (opts?.type) params.set("type", opts.type);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await request<{
    success: boolean;
    data: Array<{
      id: string | number;
      title: string;
      type?: string;
      file_url?: string | null;
      created_at?: string;
    }>;
    count: number;
  }>(`/api/documents/${qs}`);

  return {
    documents: (res.data ?? []).map(
      (d): UniversityDocument => ({
        id: String(d.id),
        title: d.title,
        status: d.type ?? "active",
        uploaded_at: d.created_at ?? new Date().toISOString(),
        file_url: d.file_url ?? null,
      }),
    ),
  };
}

export async function uploadDocuments(files: File[]): Promise<unknown> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return request("/api/documents/upload", { method: "POST", body: formData });
}

export function reindexDocuments(): Promise<unknown> {
  return request("/api/documents/reindex", { method: "POST" });
}

// ────────────────────────────────────────────────────────────────────────────
// EMAILS  –  /api/emails/*
// ────────────────────────────────────────────────────────────────────────────

export async function listEmails(): Promise<SavedEmail[]> {
  const res = await request<{ success: boolean; data: SavedEmail[] }>(
    "/api/emails/",
  );
  return res.data ?? [];
}

export async function getEmailTypes(): Promise<EmailTypeDescriptor[]> {
  const res = await request<{
    success: boolean;
    data: EmailTypeDescriptor[];
  }>("/api/emails/types");
  return res.data ?? [];
}

export async function generateEmail(
  payload: GenerateEmailRequest,
): Promise<GeneratedEmail> {
  const details = [
    payload.data.level,
    payload.data.department,
    payload.data.reason,
  ]
    .filter(Boolean)
    .join(" | ");

  const res = await request<{
    success: boolean;
    subject: string;
    body: string;
  }>("/api/emails/generate", {
    method: "POST",
    body: JSON.stringify({
      email_type: payload.type,
      student_name: payload.data.fullName,
      student_id: payload.data.studentId,
      details,
      recipient: payload.data.recipientOffice,
    }),
  });

  return { subject: res.subject, body: res.body };
}

export async function deleteEmail(id: string | number): Promise<void> {
  await request<{ success: boolean }>(`/api/emails/${id}`, {
    method: "DELETE",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// HEALTH  –  /api/health
// ────────────────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthResponse> {
  const res = await request<{ status: string; message?: string }>("/api/health");
  return {
    status: res.status === "healthy" || res.status === "ok" ? "ok" : "fail",
    message: res.message,
  };
}
