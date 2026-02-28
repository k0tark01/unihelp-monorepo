# UniHelp Backend API — v3.0

Production-ready Flask backend for the UniHelp RAG (Retrieval-Augmented Generation) system. Clean architecture, persistent conversations, role-based auth, and advanced multi-signal retrieval — all powered by **Gemini API**.

## Architecture

```
backend/
├── app/
│   ├── core/                   # Domain layer (framework-agnostic)
│   │   └── rag/
│   │       ├── engine.py           # RAG orchestration
│   │       ├── retriever.py        # Multi-signal reranking retriever
│   │       ├── chunker.py          # Semantic text chunking
│   │       ├── embeddings.py       # Gemini embedding-001 (768-d)
│   │       └── prompts.py          # Multi-pass prompt engineering
│   ├── services/               # Business-logic layer
│   │   ├── auth_service.py         # Auth (register/login/JWT/profiles)
│   │   ├── conversation_service.py # Persistent chat + RAG integration
│   │   ├── document_service.py     # Document CRUD
│   │   ├── email_service.py        # Email generation + CRUD
│   │   └── query_service.py        # One-shot Q&A
│   ├── routes/                 # Presentation layer (Blueprints)
│   │   ├── ai.py                   # POST /api/ai/query
│   │   ├── auth.py                 # /api/auth/*
│   │   ├── conversations.py        # /api/conversations/*
│   │   ├── documents.py            # /api/documents/*
│   │   └── emails.py               # /api/emails/*
│   ├── models/                 # Data models / DTOs
│   │   ├── user.py                 # User, UserRole, StudentProfile, AdminProfile
│   │   ├── conversation.py         # Conversation, Message, MessageRole
│   │   ├── document.py             # Document
│   │   └── email.py                # Email
│   ├── exceptions/             # Custom exception hierarchy
│   ├── utils/                  # Shared utilities
│   │   ├── auth_middleware.py      # @require_auth, @require_role
│   │   ├── rag.py                  # Production RAG pipeline
│   │   ├── gemini_client.py        # Gemini SDK wrapper
│   │   ├── email_generator.py      # Email prompt templates
│   │   └── helpers.py              # Misc helpers
│   ├── container.py            # Dependency injection container
│   └── config.py               # Environment-based config
├── tests/                      # 6 test modules, 100+ test cases
│   ├── conftest.py
│   ├── test_core.py
│   ├── test_services.py
│   ├── test_routes.py
│   ├── test_models.py
│   └── test_rag.py
├── supabase_schema.sql         # Full DB schema (users, documents, conversations, …)
├── run.py                      # Entry point
└── requirements.txt
```

## Key Features

### Clean Architecture
- **Core → Services → Routes** layering with dependency injection
- DTOs with `__post_init__` validation on every service boundary
- Custom exception hierarchy (`ValidationError`, `NotFoundError`, `UnauthorizedError`, …)
- Consistent `{"success": bool, …}` response format across all endpoints

### Advanced RAG Pipeline
- **Multi-signal reranking**: 60 % vector similarity + 15 % keyword TF + 10 % title match + 15 % query-term coverage
- **Near-duplicate removal** via Jaccard similarity on first 60 tokens (threshold 0.92)
- **Multi-pass reasoning** prompt: the LLM is instructed to gather evidence, resolve conflicts, then synthesise
- **Multilingual**: auto-detects French / Arabic / English; answers in the same language
- **Graceful fallback**: returns raw context if the LLM fails

### Persistent Conversations
- Create, list, rename, soft-delete conversations
- Full message history stored in Supabase (user / assistant / system roles)
- Last 10 turns automatically injected as chat context
- Auto-generated titles from the first user message

### Role-Based Auth
- Supabase Auth (JWT) with `@require_auth` and `@require_role("admin")` decorators
- `UserRole` enum: STUDENT, ADMIN, SUPER_ADMIN
- Separate `student_profiles` / `admin_profiles` tables
- Token refresh endpoint

### Gemini Integration
- **Chat**: `gemini-2.0-flash-lite` via `google-genai` SDK
- **Embeddings**: `gemini-embedding-001` (768 dimensions, LRU-cached)

### Comprehensive Testing
- 6 test modules: core, services, routes, models, RAG utility, conftest
- All external deps mocked (Supabase, Gemini, embeddings)
- `pytest --cov` ready

## Quick Start

### Prerequisites
- Python 3.10+
- Supabase project (PostgreSQL + pgvector + Auth)
- Gemini API key

> **📌 First time setup?** See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for complete Supabase configuration (including disabling email verification).

### Installation

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create `.env`:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_service_role_key
DATABASE_URL=postgresql://user:password@host:port/database
GEMINI_API_KEY=your_gemini_api_key
SECRET_KEY=change_me_in_production
FLASK_ENV=development
```

Apply the schema **(Important: Disable email verification first! See [SUPABASE_SETUP.md](SUPABASE_SETUP.md))**:
```bash
psql "$DATABASE_URL" -f supabase_schema.sql
```

Run:
```bash
python run.py   # http://localhost:5000
```

## Testing

```bash
pytest                                    # all tests
pytest --cov=app --cov-report=html        # with coverage
pytest tests/test_core.py -v              # specific module
pytest tests/test_services.py::TestConversationService  # specific class
```

## API Reference

> All mutating endpoints require `Authorization: Bearer <token>`.  
> All responses follow `{"success": bool, …}`.

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register (email, password, full_name, role) |
| POST | `/login` | Login → access_token + refresh_token |
| POST | `/logout` | Logout (invalidate token) |
| GET | `/me` | Current user profile |
| PUT | `/profile` | Update profile fields |
| POST | `/refresh` | Refresh session |

### Conversations — `/api/conversations`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's conversations |
| POST | `/` | Create new conversation |
| GET | `/<id>` | Get conversation with messages |
| PUT | `/<id>` | Rename conversation |
| DELETE | `/<id>` | Soft-delete conversation |
| POST | `/<id>/messages` | Send message → RAG answer |
| POST | `/quick` | One-shot Q&A (no persistence) |

**Send message example:**
```http
POST /api/conversations/<id>/messages
Content-Type: application/json

{"question": "Combien d'absences sont autorisées ?", "top_k": 5}
```

```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Selon le règlement intérieur, …",
    "sources": [{"title": "Règlement intérieur", "similarity": 0.89}],
    "language": "French"
  }
}
```

### AI — `/api/ai`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/query` | RAG query with optional history |

### Documents — `/api/documents`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List (filter by type, limit, offset) |
| GET | `/<id>` | Get by ID |
| POST | `/` | Create document |
| PUT | `/<id>` | Update document |
| DELETE | `/<id>` | Delete document |
| GET | `/stats` | Aggregate statistics |

### Emails — `/api/emails`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's emails |
| GET | `/types` | Available email types |
| POST | `/generate` | Generate + save via Gemini |
| POST | `/` | Save manually |
| DELETE | `/<id>` | Delete email |

## Database Schema

Tables managed via `supabase_schema.sql`:

| Table | Purpose |
|-------|---------|
| `users` | Auth metadata (role, is_active) |
| `student_profiles` | Student-specific fields |
| `admin_profiles` | Admin-specific fields |
| `documents` | RAG knowledge base (+ `embedding vector(768)`) |
| `emails` | Generated/saved emails |
| `conversations` | Chat sessions (soft-deletable) |
| `messages` | Chat messages (user/assistant/system) |

All tables have RLS policies scoped to `auth.uid()`.

## Deployment

```bash
pip install gunicorn
gunicorn --bind 0.0.0.0:5000 --workers 4 run:app
```

Or with Docker:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "run:app"]
```
