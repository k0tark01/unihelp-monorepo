export const en = {
  /* ── Nav ──────────────────────────────────── */
  nav: {
    signIn: "Sign in",
    signOut: "Sign out",
    register: "Register",
  },

  /* ── Footer ───────────────────────────────── */
  footer: {
    text: "UniHelp — ISITCOM",
  },

  /* ── Hero ─────────────────────────────────── */
  hero: {
    badge: "Powered by Gemini AI + RAG",
    title: "Your ISITCOM",
    titleSpan: "Administrative Assistant",
    subtitle:
      "Ask questions about university procedures and get instant answers based on official ISITCOM documents.",
    trust: "Answers grounded exclusively on official ISITCOM documents",
  },

  /* ── Feature cards ────────────────────────── */
  features: {
    docs: {
      title: "Official Documents",
      desc: "Answers grounded in real ISITCOM regulations, procedures and guides.",
    },
    answers: {
      title: "Instant Answers",
      desc: "No more waiting at the office. Get answers on enrollment, certificates, absences and more.",
    },
    email: {
      title: "Email Generator",
      desc: "Auto-draft formal administrative emails: attestation, internship, grade complaint and more.",
    },
    multilingual: {
      title: "Multilingual",
      desc: "Ask in French, Arabic or English — the assistant responds in your language.",
    },
  },

  /* ── Suggestions ──────────────────────────── */
  suggestions: {
    s0: "How to get an enrollment certificate?",
    s1: "What are the grade review procedures?",
    s2: "How do I apply for a scholarship?",
    s3: "Deadline to submit a make-up exam request?",
  },

  /* ── Chat ─────────────────────────────────── */
  chat: {
    messages_one: "message",
    messages_other: "messages",
    clear: "Clear chat",
    cleared: "Chat cleared",
    copyAnswer: "Copy answer",
    copied: "Answer copied",
    copyFailed: "Could not copy answer",
    generateEmail: "Generate email",
    placeholder: "Ask about enrollment, certificates, absences, scholarships…",
    send: "Send",
  },

  /* ── Auth gate ────────────────────────────── */
  authGate: {
    title: "Sign in to start chatting",
    desc: "Create a free account to ask questions and generate administrative emails.",
    signIn: "Sign in",
    createAccount: "Create account",
  },

  /* ── Toast ────────────────────────────────── */
  toast: {
    chatError: "Chat request failed",
  },

  /* ── Login ────────────────────────────────── */
  login: {
    pageTitle: "ISITCOM Administrative AI Assistant",
    pageSubtitle: "Sign in to access the student portal",
    cardTitle: "Sign in",
    cardDesc: "Enter your email and password to continue",
    email: "Email",
    emailPlaceholder: "you@isitcom.tn",
    password: "Password",
    forgotPassword: "Forgot password?",
    showPassword: "Show password",
    hidePassword: "Hide password",
    submit: "Sign in",
    submitting: "Signing in…",
    noAccount: "Don't have an account?",
    createOne: "Create one",
    welcomeBack: "Welcome back!",
  },

  /* ── Register ─────────────────────────────── */
  register: {
    pageTitle: "ISITCOM Administrative AI Assistant",
    pageSubtitle: "Create your student account",
    cardTitle: "Create account",
    cardDesc: "Fill in your details to register",
    fullName: "Full Name",
    fullNamePlaceholder: "Ahmed Ben Ali",
    studentId: "Student ID",
    studentIdPlaceholder: "2024ISIT001",
    department: "Department",
    selectDept: "Select department…",
    email: "Email",
    emailPlaceholder: "you@isitcom.tn",
    password: "Password",
    passwordPlaceholder: "Min. 8 characters",
    confirmPassword: "Confirm Password",
    repeatPassword: "Repeat password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    submit: "Create account",
    submitting: "Creating account…",
    hasAccount: "Already have an account?",
    signIn: "Sign in",
    successMsg:
      "Account created! Please check your email to confirm your address.",
  },

  /* ── Departments ──────────────────────────── */
  departments: {
    cs: "Computer Science",
    es: "Electronic Systems",
    tc: "Telecommunications",
    im: "Industrial Maintenance",
    aut: "Automation",
    ic: "Industrial Computing",
    em: "Electromechanics",
  },

  /* ── Email Generator ─────────────────────── */
  emailGen: {
    title: "Email Generator",
    emailType: "Email type",
    selectType: "Select email type",
    language: "Language",
    fullName: "Full name",
    studentId: "Student ID",
    department: "Department",
    level: "Level",
    recipientOffice: "Recipient office",
    reason: "Reason",
    generate: "Generate email",
    generating: "Generating…",
    generated: "Email generated",
    error: "Could not generate email",
    previewTitle: "Generated Preview",
    previewEmpty: "Generate an email to preview the subject and body.",
    subject: "Subject",
    body: "Body",
    copySubject: "Copy subject",
    copyBody: "Copy body",
    download: "Download .txt",
    copiedLabel: "copied",
    copyFailed: "Could not copy",
  },

  /* ── Email Types ──────────────────────────── */
  emailTypes: {
    attestation_request: "Enrollment Certificate Request",
    grade_complaint: "Grade Complaint",
    internship_request: "Internship Request",
    absence_justification: "Absence Justification",
    scholarship_request: "Scholarship Request",
  },

  /* ── Admin ────────────────────────────────── */
  admin: {
    accessTitle: "Admin Access",
    passwordPlaceholder: "Enter admin password",
    unlock: "Unlock",
    unlocked: "Admin unlocked",
    invalidPass: "Invalid password",
    missingPass: "NEXT_PUBLIC_ADMIN_PASS is missing",
    documents: "Documents",
    health: "Health",
    uploadTitle: "Upload official documents",
    uploadBtn: "Upload PDFs",
    uploadSuccess: "Files uploaded",
    uploadFailed: "Upload failed",
    pleaseSelectPDF: "Please select at least one PDF",
    reindex: "Reindex",
    reindexTitle: "Confirm reindex",
    reindexDesc: "This triggers backend indexing of all uploaded documents.",
    reindexStarted: "Reindex started",
    reindexFailed: "Reindex failed",
    confirm: "Confirm",
    refresh: "Refresh",
    indexedDocs: "Indexed documents",
    noDocs: "No documents available.",
    uploaded: "Uploaded:",
    apiHealth: "API Health",
    status: "Status:",
    unknown: "unknown",
    loadFailed: "Could not load admin data",
  },

  /* ── Reset Password ───────────────────────── */
  resetPassword: {
    pageTitle: "ISITCOM Administrative AI Assistant",
    pageSubtitle: "Reset your password",
    cardTitle: "Forgot password?",
    cardDesc: "Enter your email and we will send you a reset link.",
    email: "Email",
    emailPlaceholder: "you@isitcom.tn",
    submit: "Send reset link",
    submitting: "Sending…",
    backToLogin: "Back to sign in",
    successTitle: "Check your email",
    successDesc: "A password reset link has been sent to your email address.",
    emailSent: "Password reset email sent!",
  },
};
