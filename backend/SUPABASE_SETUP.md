# Supabase Setup & Configuration Guide

This guide walks you through setting up your Supabase project for the UniHelp backend.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and service role key (Settings → API)
3. Add them to your `.env`:
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=your_service_role_key
   ```

## 2. Disable Email Verification (REQUIRED)

**Important**: By default, Supabase requires email confirmation for new users. Since we want instant registration, you must disable this:

### Steps:
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Settings** (or **Providers**)
3. Find **Email Auth Provider** settings
4. **Disable** the following:
   - ✅ **Confirm email** (uncheck this box)
   - ✅ **Enable email confirmations** (uncheck this box)
5. Click **Save**

Alternatively, via Supabase CLI:
```bash
supabase auth update --enable-email-confirmations=false
```

## 3. Apply Database Schema

Run the SQL schema to create all tables, indexes, RLS policies, and triggers:

### Option A: Via Supabase SQL Editor
1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the entire contents of `supabase_schema.sql`
3. Paste and execute

### Option B: Via psql
```bash
psql "$DATABASE_URL" -f supabase_schema.sql
```

This will create:
- ✅ `users` table with role-based access
- ✅ `student_profiles` and `admin_profiles`
- ✅ `documents` table with vector embeddings (768-d)
- ✅ `emails` table
- ✅ `conversations` and `messages` tables for persistent chat
- ✅ RLS policies scoped to authenticated users
- ✅ Triggers (e.g., `updated_at` auto-update)

## 4. Enable pgvector Extension

The RAG system requires pgvector for similarity search:

1. Go to **Database** → **Extensions**
2. Search for `vector`
3. Enable **pgvector**

Or via SQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 5. Verify RPC Function

Ensure the `match_documents` RPC function exists (it's in `supabase_schema.sql`):

```sql
SELECT match_documents(
  query_embedding := ARRAY[0.1, 0.2, ...]::vector(768),
  match_threshold := 0.5,
  match_count := 5
);
```

If it returns results or an empty array, you're good.

## 6. Test Authentication

Try registering a user via the API:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "test123",
    "full_name": "Test Student",
    "role": "student",
    "student_id": "S12345"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Registration successful.",
  "user": {...},
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "..."
}
```

If you get `"email_confirm_required"` error, go back to **Step 2** and disable email confirmation.

## 7. Auth Configuration Summary

| Setting | Value | Location |
|---------|-------|----------|
| Enable email confirmations | ❌ **OFF** | Auth → Settings |
| Enable phone confirmations | ❌ OFF (optional) | Auth → Settings |
| Minimum password length | 6 | Auth → Settings |
| JWT expiry | 3600s (1h) | Auth → Settings (default is fine) |
| Refresh token expiry | 2592000s (30d) | Auth → Settings (default is fine) |

## 8. Production Checklist

Before going live:

- [ ] Set strong `SUPABASE_KEY` (service role key)
- [ ] Rotate `SECRET_KEY` in `.env`
- [ ] Enable HTTPS only in Supabase Auth settings
- [ ] Review RLS policies (ensure no data leaks)
- [ ] Set up database backups (Supabase does this automatically)
- [ ] Monitor rate limits (Supabase free tier: 500 requests/sec)
- [ ] Add custom SMTP for emails (if you re-enable confirmations later)
- [ ] Enable 2FA for admin accounts

## 9. Troubleshooting

### "Email confirmation required" error
→ You didn't disable email confirmations in Step 2. Go back and disable it.

### "vector dimension mismatch" error
→ Embeddings are 768-d. Check `app/core/rag/embeddings.py` uses `gemini-embedding-001`.

### "RLS policy violation" error
→ The user is trying to access data they don't own. Check `supabase_schema.sql` policies.

### "Function match_documents does not exist"
→ Run the `supabase_schema.sql` file again. The RPC function is at the bottom.

## 10. Useful SQL Queries

**Count users by role:**
```sql
SELECT role, COUNT(*) FROM users GROUP BY role;
```

**List all conversations with message count:**
```sql
SELECT c.id, c.title, u.email, COUNT(m.id) as msg_count
FROM conversations c
JOIN users u ON c.user_id = u.id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.title, u.email;
```

**Find documents with embeddings:**
```sql
SELECT id, title, type, 
       vector_dims(embedding) as dims
FROM documents
WHERE embedding IS NOT NULL
LIMIT 10;
```

---

**Need help?** Check the [README.md](README.md) or the Supabase docs.
