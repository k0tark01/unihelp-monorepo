// ─── Primitives ─────────────────────────────────────────────────────────────

export type Language = "fr" | "ar" | "en";

export type UserRole = "student" | "admin" | "super_admin";

// ─── Standard API envelope ───────────────────────────────────────────────────

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Matches backend StudentProfile.to_dict() */
export type StudentProfile = {
  student_id: string;
  department: string | null;
  level: string | null;
};

/** Matches backend AdminProfile.to_dict() */
export type AdminProfile = {
  title: string | null;
};

/** Matches backend User.to_dict(include_timestamps=True) */
export type BackendUser = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  is_active: boolean;
  profile: StudentProfile | AdminProfile | null;
  created_at?: string;
  updated_at?: string;
};

/** POST /api/auth/register body */
export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
  student_id?: string;
  department?: string;
  level?: string;
  title?: string;
};

/** POST /api/auth/login body */
export type LoginPayload = {
  email: string;
  password: string;
};

/** POST /api/auth/login response */
export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

/** Login success envelope */
export type LoginResponse = AuthTokens & {
  user: BackendUser;
};

/** PUT /api/auth/profile body */
export type UpdateProfilePayload = {
  full_name?: string;
  department?: string;
  level?: string;
  title?: string;
};

// ─── RAG / Chat ──────────────────────────────────────────────────────────────

/** Individual source returned from the RAG engine */
export type RetrievalSource = {
  /** Friendly display title (mapped from backend `title`) */
  docTitle: string;
  /** Unique chunk identifier (mapped from backend `id`) */
  chunkId: string;
  page?: number;
  /** Text snippet (mapped from backend `text`) */
  snippet: string;
  /** Cosine similarity score */
  confidence?: number;
  /** Cross-encoder re-ranking score */
  rerankScore?: number | null;
  /** Document type tag */
  docType?: string;
  /** Public URL of the original file in Supabase Storage */
  fileUrl?: string | null;
};

/** Raw source shape returned by the backend */
export type BackendSource = {
  id: string | number;
  title: string;
  type?: string;
  text?: string;
  file_url?: string | null;
  similarity?: number;
  rerank_score?: number | null;
};

/** POST /api/ai/query body */
export type QueryPayload = {
  question: string;
  history?: ConversationHistoryItem[];
  top_k?: number;
};

/** POST /api/ai/query response */
export type QueryResponse = {
  success: boolean;
  question: string;
  answer: string;
  sources: BackendSource[];
  language: string;
  has_answer: boolean;
};

/** Legacy frontend chat request (kept for backward compat) */
export type ChatRequest = {
  sessionId: string;
  question: string;
  language: Language;
  context?: {
    studentLevel?: string;
    department?: string;
  };
};

/** Normalised chat response used by the UI */
export type ChatResponse = {
  answer: string;
  sources: RetrievalSource[];
  language?: string;
  hasAnswer?: boolean;
};

/** Conversation history item sent to the backend */
export type ConversationHistoryItem = {
  role: "user" | "assistant" | "system";
  content: string;
};

// ─── Conversations ───────────────────────────────────────────────────────────

/** Message stored in a conversation */
export type BackendMessage = {
  id?: string;
  conversation_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: BackendSource[];
  language?: string;
  created_at?: string;
};

/** Conversation summary (list view) */
export type BackendConversation = {
  id: string;
  user_id: string;
  title: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  message_count: number;
};

/** Conversation with messages (detail view) */
export type BackendConversationDetail = BackendConversation & {
  messages: BackendMessage[];
};

/** POST /api/conversations/<id>/messages response */
export type SendMessageResponse = {
  success: boolean;
  user_message: BackendMessage;
  assistant_message: BackendMessage;
  sources: BackendSource[];
  language: string;
  has_answer: boolean;
};

/** POST /api/conversations/quick body */
export type QuickAskPayload = {
  question: string;
  history?: ConversationHistoryItem[];
  top_k?: number;
};

// ─── Documents ───────────────────────────────────────────────────────────────

/** Single document row returned by the backend */
export type BackendDocument = {
  id: string | number;
  title: string;
  type?: string;
  file_url?: string | null;
  created_at?: string;
};

/** Normalised document used by the UI */
export type UniversityDocument = {
  id: string;
  title: string;
  /** Either the doc `type` field or "active" as fallback */
  status: string;
  uploaded_at: string;
  file_url?: string | null;
};

/** GET /api/documents/ response envelope */
export type DocumentsResponse = {
  documents: UniversityDocument[];
};

// ─── Emails ──────────────────────────────────────────────────────────────────

export type EmailType =
  | "attestation"
  | "reclamation"
  | "stage"
  | "absence"
  | "rattrapage"
  | "custom";

/** Domain form values collected from the UI */
export type EmailFormValues = {
  fullName: string;
  studentId: string;
  department: string;
  level: string;
  reason: string;
  recipientOffice: string;
};

/** POST /api/emails/generate body */
export type GenerateEmailRequest = {
  type: EmailType | string;
  language: Language;
  data: EmailFormValues;
};

/** POST /api/emails/generate success payload */
export type GeneratedEmail = {
  subject: string;
  body: string;
};

/** Saved email row returned by GET /api/emails/ */
export type SavedEmail = {
  id: string | number;
  email_type: string;
  student_name: string;
  student_id: string;
  subject: string;
  body: string;
  created_at: string;
};

/** Email type descriptor from GET /api/emails/types */
export type EmailTypeDescriptor = {
  key: EmailType | string;
  label: string;
  description?: string;
};

// ─── Health ──────────────────────────────────────────────────────────────────

export type HealthResponse = {
  status: "ok" | "fail";
  message?: string;
};

// ─── UI helpers ──────────────────────────────────────────────────────────────

export type ChatAction = {
  type: "EMAIL_TEMPLATE";
  templateKey: string;
};

/** Chat message item rendered in the UI */
export type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievalSource[];
  actions?: ChatAction[];
  language?: string;
};