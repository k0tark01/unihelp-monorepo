export type Language = "fr" | "ar" | "en";

export type RetrievalSource = {
  docTitle: string;
  chunkId: string;
  page?: number;
  snippet: string;
  confidence?: number;
};

export type ChatAction = {
  type: "EMAIL_TEMPLATE";
  templateKey: string;
};

export type ChatRequest = {
  sessionId: string;
  question: string;
  language: Language;
  context?: {
    studentLevel?: string;
    department?: string;
  };
};

export type ChatResponse = {
  answer: string;
  sources: RetrievalSource[];
  actions?: ChatAction[];
};

export type EmailType =
  | "attestation_request"
  | "grade_complaint"
  | "internship_request"
  | "absence_justification"
  | "scholarship_request";

export type EmailFormValues = {
  fullName: string;
  studentId: string;
  department: string;
  level: string;
  reason: string;
  recipientOffice: string;
};

export type GenerateEmailRequest = {
  type: string;
  language: Language;
  data: EmailFormValues;
};

export type GeneratedEmail = {
  subject: string;
  body: string;
};

export type UniversityDocument = {
  id: string;
  title: string;
  status: string;
  uploaded_at: string;
};

export type DocumentsResponse = {
  documents: UniversityDocument[];
};

export type HealthResponse = {
  status: "ok" | "fail";
  message?: string;
};

export type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievalSource[];
  actions?: ChatAction[];
};