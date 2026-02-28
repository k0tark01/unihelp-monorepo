-- =============================================
-- UniHelp Supabase Database Schema
-- Run these SQL statements in the Supabase SQL Editor
-- (Supabase Dashboard → SQL Editor → New query)
--
-- IMPORTANT: Before running this schema, configure Supabase Auth:
--   1. Go to Authentication → Settings in Supabase Dashboard
--   2. DISABLE "Confirm email" (uncheck the box)
--   3. This allows instant user registration without email verification
--   
-- See SUPABASE_SETUP.md for complete setup instructions.
-- =============================================

-- Enable pgvector extension (required for semantic search / RAG)
create extension if not exists vector;

-- =============================================
-- Table: documents
-- Stores university documents with Gemini vector embeddings for RAG
-- =============================================
create table if not exists documents (
    id         bigint generated always as identity primary key,
    title      text        not null,
    content    text        not null,
    type       text,                          -- 'regulation', 'announcement', 'guide', 'faq'
    file_url   text,                          -- public Supabase Storage URL of the original file
    embedding  vector(768),                   -- gemini-embedding-001 outputs 768 dims
    created_at timestamptz default now()
);

-- Add file_url to existing installations (safe to re-run)
alter table documents add column if not exists file_url text;

-- IVFFlat index for fast cosine similarity search
create index if not exists documents_embedding_idx
    on documents using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- =============================================
-- Table: emails
-- Stores AI-generated email drafts
-- =============================================
create table if not exists emails (
    id         bigint generated always as identity primary key,
    subject    text        not null,
    body       text        not null,
    recipient  text,
    email_type text,                          -- 'attestation', 'reclamation', 'stage', etc.
    created_at timestamptz default now()
);

-- =============================================
-- Stored function: semantic similarity search
-- Called from Flask via supabase.rpc('match_documents', {...})
-- =============================================
create or replace function match_documents (
    query_embedding vector(768),
    match_threshold float default 0.5,
    match_count     int   default 5
)
returns table (
    id         bigint,
    title      text,
    content    text,
    type       text,
    file_url   text,
    similarity float
)
language sql stable
as $$
    select
        documents.id,
        documents.title,
        documents.content,
        documents.type,
        documents.file_url,
        1 - (documents.embedding <=> query_embedding) as similarity
    from documents
    where 1 - (documents.embedding <=> query_embedding) > match_threshold
    order by similarity desc
    limit match_count;
$$;

-- =============================================
-- User tables
-- =============================================

-- Role enum
do $$ begin
    create type user_role_enum as enum ('student', 'admin', 'super_admin');
exception when duplicate_object then null;
end $$;

-- users — mirrors auth.users, id MUST equal auth.users.id
create table if not exists users (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       varchar(255) not null unique,
    full_name   varchar(255),
    role        user_role_enum not null default 'student',
    is_active   boolean not null default true,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- student_profiles
create table if not exists student_profiles (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null unique references users(id) on delete cascade,
    student_id  varchar(64)  not null unique,
    department  varchar(120),
    level       varchar(120),
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- admin_profiles
create table if not exists admin_profiles (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null unique references users(id) on delete cascade,
    title       varchar(120),
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- =============================================
-- Conversation / chat tables
-- =============================================

create table if not exists conversations (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references users(id) on delete cascade,
    title       text not null default 'New conversation',
    is_active   boolean not null default true,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

create index if not exists conversations_user_idx
    on conversations (user_id, is_active, created_at desc);

create table if not exists messages (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    role            text not null check (role in ('user', 'assistant', 'system')),
    content         text not null,
    sources         jsonb,                    -- RAG sources for assistant messages
    language        text,                     -- detected language
    created_at      timestamptz default now()
);

create index if not exists messages_conversation_idx
    on messages (conversation_id, created_at asc);

-- =============================================
-- Auto-update updated_at on row change
-- =============================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

create or replace trigger users_updated_at
    before update on users
    for each row execute procedure set_updated_at();

create or replace trigger student_profiles_updated_at
    before update on student_profiles
    for each row execute procedure set_updated_at();

create or replace trigger admin_profiles_updated_at
    before update on admin_profiles
    for each row execute procedure set_updated_at();

create or replace trigger conversations_updated_at
    before update on conversations
    for each row execute procedure set_updated_at();

-- =============================================
-- Auto-populate users table from auth.users
-- This trigger fires whenever a new user signs up via Supabase Auth,
-- guaranteeing a matching row in public.users regardless of whether
-- the backend insert succeeds.
-- =============================================
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.users (id, email, full_name, role, is_active)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        coalesce(
            (new.raw_user_meta_data->>'role')::user_role_enum,
            'student'
        ),
        true
    )
    on conflict (id) do nothing;   -- backend may have already inserted; safe to skip
    return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure handle_new_auth_user();

-- =============================================
-- Row Level Security (RLS)
-- =============================================
alter table documents        enable row level security;
alter table emails           enable row level security;
alter table users            enable row level security;
alter table student_profiles enable row level security;
alter table admin_profiles   enable row level security;
alter table conversations    enable row level security;
alter table messages         enable row level security;

-- Drop first so the file is safely re-runnable
drop policy if exists "Allow all for anon" on documents;
drop policy if exists "Allow all for anon" on emails;
drop policy if exists "Allow all for anon" on users;
drop policy if exists "Allow all for anon" on student_profiles;
drop policy if exists "Allow all for anon" on admin_profiles;
drop policy if exists "Allow all for anon" on conversations;
drop policy if exists "Allow all for anon" on messages;

create policy "Allow all for anon" on documents        for all using (true);
create policy "Allow all for anon" on emails           for all using (true);
create policy "Allow all for anon" on users            for all using (true);
create policy "Allow all for anon" on student_profiles for all using (true);
create policy "Allow all for anon" on admin_profiles   for all using (true);
create policy "Allow all for anon" on conversations    for all using (true);
create policy "Allow all for anon" on messages         for all using (true);
