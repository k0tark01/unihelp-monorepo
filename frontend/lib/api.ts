import {
  ChatRequest,
  ChatResponse,
  DocumentsResponse,
  GenerateEmailRequest,
  GeneratedEmail,
  HealthResponse,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Get the current Supabase session access token (if any). */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!baseUrl) {
    throw new ApiError("NEXT_PUBLIC_BACKEND_URL is not configured", 500);
  }

  const token = await getAuthToken();
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${baseUrl}${path}`, {
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

  if (!response.ok) {
    const message =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : typeof parsed === "object" && parsed !== null && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : `API error (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return parsed as T;
}

export function chat(payload: ChatRequest): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function generateEmail(payload: GenerateEmailRequest): Promise<GeneratedEmail> {
  return request<GeneratedEmail>("/api/email/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDocuments(): Promise<DocumentsResponse> {
  return request<DocumentsResponse>("/api/docs/", {
    method: "GET",
  });
}

export async function uploadDocuments(files: File[]): Promise<unknown> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  return request("/api/docs/upload", {
    method: "POST",
    body: formData,
  });
}

export function reindexDocuments(): Promise<unknown> {
  return request("/api/docs/reindex", {
    method: "POST",
  });
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", {
    method: "GET",
  });
}
