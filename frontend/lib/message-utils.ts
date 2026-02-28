/**
 * message-utils.ts – helpers that map backend message shapes to the UI
 * `ChatMessageItem` structure.
 */
import type { BackendMessage, ChatMessageItem, RetrievalSource } from "@/lib/types";

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Convert a single `BackendMessage` to a `ChatMessageItem`. */
export function mapBackendMessageToUI(m: BackendMessage): ChatMessageItem {
  const sources: RetrievalSource[] | undefined = m.sources?.map((s) => ({
    docTitle: (s as { title?: string }).title ?? "Unknown",
    chunkId: String((s as { id?: string | number }).id ?? ""),
    snippet: (s as { text?: string }).text ?? "",
    confidence: (s as { similarity?: number }).similarity,
    rerankScore: (s as { rerank_score?: number | null }).rerank_score ?? null,
    docType: (s as { type?: string }).type,
  }));

  const role = m.role === "system" ? "assistant" : m.role;

  return {
    id: m.id ?? generateId(),
    role,
    content: m.content,
    sources: sources?.length ? sources : undefined,
    language: m.language,
  };
}
