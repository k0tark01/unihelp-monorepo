## shadcn/ui setup commands

If you want to initialize the official shadcn registry in this project and regenerate components, run:

```bash
npx shadcn@latest init
npx shadcn@latest add button card input textarea select tabs badge separator scroll-area accordion alert dialog
```

## University Administrative AI Assistant (Frontend)

Next.js 14 App Router frontend for:
- Student Q&A chat with backend RAG citations
- Administrative email generation
- Admin document upload/reindex and health checks

## Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_ADMIN_PASS=demo-admin-pass
```

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.
