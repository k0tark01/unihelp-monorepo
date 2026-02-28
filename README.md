# UniHelp — ISITCOM AI Assistant

Monorepo containing the full-stack UniHelp application.

``

Uploading cap.mp4…

`
unihelp-monorepo/
├── frontend/   # Next.js 14 (TypeScript, Tailwind, Supabase auth)
└── backend/    # Flask API (Gemini RAG, Supabase)
```

---

## Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in Supabase keys
npm run dev                         # → http://localhost:3000
```

**Environment variables** (`frontend/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_ADMIN_PASS=...
# NEXT_PUBLIC_DEV_BYPASS_AUTH=true   # enable to skip login during development
```

---

## Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in keys
python run.py                   # → http://localhost:8000
```

**Environment variables** (`backend/.env`):
```
SUPABASE_URL=...
SUPABASE_KEY=...          # service_role key
DATABASE_URL=...
GEMINI_API_KEY=...
```

---

## Features

- **Trilingual** — English, French, Arabic (RTL)
- **Auth** — Supabase email/password, reset-password flow
- **AI Chat** — Gemini RAG over university documents
- **Email generator** — automated academic email drafts
- **Admin panel** — document & user management
