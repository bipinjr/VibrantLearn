-- VibrantLearn v0.4 initial schema. See docs/PRD_PROMPT.md §7 and SECURITY.md §6.
-- Access model: browser reads its own rows under RLS; every AI / file / limit write goes through
-- the API (postgres role, bypasses RLS) which re-checks ownership itself.

create extension if not exists citext with schema extensions;

-- New tables are opt-in to the Data API (Supabase 2026-04 change). Make that explicit for
-- anything created later by this role, then grant per table below.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  username extensions.citext unique
    check (
      username ~ '^[A-Za-z0-9.|]{3,30}$'
      and username !~ '^[.|]' and username !~ '[.|]$'
      and position('..' in username) = 0 and position('||' in username) = 0
    ),
  full_name text check (char_length(full_name) <= 100),
  university text not null default 'Bengaluru City University' check (char_length(university) <= 120),
  course text check (course in ('BCA', 'BCom', 'BSc', 'PU', 'Other')),
  semester smallint check (semester between 1 and 10),
  scheme text check (scheme in ('SEP', 'NEP', 'Other')),
  language text not null default 'en' check (language in ('en', 'kn', 'hi')),
  style text not null default 'short' check (style in ('short', 'detailed')),
  formats text[] not null default '{}'
    check (formats <@ array['quiz', 'flashcards', 'notes', 'important_questions', 'pyq', 'timetable']),
  consent_at timestamptz,
  onboarded_at timestamptz
);

-- ---------------------------------------------------------------------------------------------
-- study sessions, messages
-- ---------------------------------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null default 'New study session' check (char_length(title) between 1 and 120),
  subject text check (char_length(subject) <= 120),
  deadline_at timestamptz,
  mode text check (mode in ('sprint', 'crash', 'steady', 'deep')),
  deleted_at timestamptz
);
create index study_sessions_user_updated_idx on public.study_sessions (user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null check (role in ('user', 'assistant')),
  content text not null default '' check (char_length(content) <= 20000),
  blocks jsonb not null default '[]',
  intent text,
  served_from text check (served_from in ('ml', 'cache', 'llm'))
);
create index messages_session_created_idx on public.messages (session_id, created_at);
create index messages_user_idx on public.messages (user_id);

-- ---------------------------------------------------------------------------------------------
-- files and chunks
-- ---------------------------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) <= 255),
  display_name text not null check (char_length(display_name) <= 120),
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'scanning', 'processing', 'ready', 'failed')),
  pages integer,
  error text check (char_length(error) <= 500)
);
create index files_session_idx on public.files (session_id);
create index files_user_idx on public.files (user_id);
create index files_session_sha_idx on public.files (session_id, sha256);

create table public.file_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  idx integer not null,
  content text not null,
  page integer,
  -- 'simple' config: content may be English, Kannada or Hindi.
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  unique (file_id, idx)
);
create index file_chunks_tsv_idx on public.file_chunks using gin (tsv);
create index file_chunks_session_idx on public.file_chunks (session_id);
create index file_chunks_user_idx on public.file_chunks (user_id);

-- ---------------------------------------------------------------------------------------------
-- syllabus reference data (shared, read-only)
-- ---------------------------------------------------------------------------------------------
create table public.syllabi (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university text not null,
  course text not null,
  semester smallint not null,
  scheme text not null,
  subject text not null,
  version text not null,
  source text not null,
  unique (university, course, semester, scheme, subject, version)
);

create table public.syllabus_topics (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.syllabi (id) on delete cascade,
  created_at timestamptz not null default now(),
  unit smallint not null,
  unit_title text not null,
  ord smallint not null,
  topic text not null,
  subtopics text[] not null default '{}',
  weightage smallint not null check (weightage between 1 and 10),   -- exam priority
  difficulty smallint not null check (difficulty between 1 and 3),
  est_minutes smallint not null check (est_minutes between 5 and 600),
  keywords text[] not null default '{}'
);
create index syllabus_topics_syllabus_idx on public.syllabus_topics (syllabus_id, unit, ord);

-- ---------------------------------------------------------------------------------------------
-- plans, checkpoints, generated content, quizzes, flashcards
-- ---------------------------------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  subject text not null,
  deadline_at timestamptz not null,
  mode text not null check (mode in ('sprint', 'crash', 'steady', 'deep')),
  hours_available numeric(5, 1) check (hours_available > 0),
  language text not null check (language in ('en', 'kn', 'hi')),
  style text not null check (style in ('short', 'detailed')),
  formats text[] not null default '{}',
  plan jsonb not null,
  cache_key text not null,
  version integer not null default 1
);
create index study_plans_session_idx on public.study_plans (session_id);
create index study_plans_user_idx on public.study_plans (user_id);
create index study_plans_cache_key_idx on public.study_plans (cache_key);

create table public.plan_checkpoints (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  ord smallint not null,
  title text not null,
  due_at timestamptz,
  done_at timestamptz,
  unique (plan_id, ord)
);
create index plan_checkpoints_user_idx on public.plan_checkpoints (user_id);

create table public.generated_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.study_sessions (id) on delete cascade,
  plan_id uuid references public.study_plans (id) on delete cascade,
  file_id uuid references public.files (id) on delete cascade,
  created_at timestamptz not null default now(),
  topic text not null,
  kind text not null check (kind in ('notes', 'important_questions', 'pyq', 'quiz', 'flashcards')),
  language text not null check (language in ('en', 'kn', 'hi')),
  payload jsonb not null,
  cache_key text not null
);
create index generated_content_user_idx on public.generated_content (user_id);
create index generated_content_session_idx on public.generated_content (session_id);
create index generated_content_plan_idx on public.generated_content (plan_id);
create index generated_content_file_idx on public.generated_content (file_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_id uuid not null references public.generated_content (id) on delete cascade,
  created_at timestamptz not null default now(),
  answers jsonb not null,
  score smallint not null check (score >= 0),
  total smallint not null check (total > 0 and score <= total)
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id);
create index quiz_attempts_content_idx on public.quiz_attempts (content_id);

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_id uuid not null references public.generated_content (id) on delete cascade,
  created_at timestamptz not null default now(),
  card_idx smallint not null check (card_idx >= 0),
  box smallint not null default 1 check (box between 1 and 5),
  next_due_at timestamptz not null default now(),
  unique (user_id, content_id, card_idx)
);
create index flashcard_reviews_content_idx on public.flashcard_reviews (content_id);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email extensions.citext not null unique check (char_length(email) <= 254),
  kind text not null default 'teacher' check (kind in ('teacher')),
  source text check (char_length(source) <= 60)
);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security + grants (copy SECURITY.md §6 shapes; never invent new ones)
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.files enable row level security;
alter table public.file_chunks enable row level security;
alter table public.syllabi enable row level security;
alter table public.syllabus_topics enable row level security;
alter table public.study_plans enable row level security;
alter table public.plan_checkpoints enable row level security;
alter table public.generated_content enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.waitlist enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-- profiles: owner reads; owner edits preferences only. Username, consent and onboarding stamps
-- are written by the API (reserved-word check lives there).
grant select on public.profiles to authenticated;
grant update (full_name, university, course, semester, scheme, language, style, formats)
  on public.profiles to authenticated;
create policy "owner_select" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "owner_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- study_sessions: owner creates, reads, renames. Delete goes through the API (storage cleanup).
grant select on public.study_sessions to authenticated;
grant insert (title, subject, deadline_at, mode) on public.study_sessions to authenticated;
grant update (title, subject, deadline_at, mode, updated_at) on public.study_sessions to authenticated;
create policy "owner_select" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.study_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- user_id is filled from the JWT so clients cannot pick it.
alter table public.study_sessions alter column user_id set default auth.uid();

-- Read-only for the owner; only the API writes these.
grant select on public.messages, public.files, public.file_chunks, public.study_plans,
  public.generated_content, public.quiz_attempts to authenticated;
create policy "owner_select" on public.messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_select" on public.files
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_select" on public.file_chunks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_select" on public.study_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_select" on public.generated_content
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_select" on public.quiz_attempts
  for select to authenticated using ((select auth.uid()) = user_id);

-- plan_checkpoints: owner may only tick/untick (column grant on done_at).
grant select on public.plan_checkpoints to authenticated;
grant update (done_at) on public.plan_checkpoints to authenticated;
create policy "owner_select" on public.plan_checkpoints
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_update" on public.plan_checkpoints
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- flashcard_reviews: owner CRUD, only against their own generated content.
grant select, insert, update, delete on public.flashcard_reviews to authenticated;
alter table public.flashcard_reviews alter column user_id set default auth.uid();
create policy "owner_select" on public.flashcard_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.flashcard_reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.generated_content g
                where g.id = content_id and g.user_id = (select auth.uid()))
  );
create policy "owner_update" on public.flashcard_reviews
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner_delete" on public.flashcard_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Shared reference data.
grant select on public.syllabi, public.syllabus_topics to authenticated;
create policy "signed_in_read" on public.syllabi for select to authenticated using (true);
create policy "signed_in_read" on public.syllabus_topics for select to authenticated using (true);

-- waitlist: no client access at all (API only). RLS on with no policy = deny.

-- ---------------------------------------------------------------------------------------------
-- internal schema: not exposed through the Data API, service role / API only
-- ---------------------------------------------------------------------------------------------
create schema internal;
revoke all on schema internal from public, anon, authenticated;

create table internal.llm_cache (
  cache_key text primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  model text not null,
  prompt_version text not null,
  response jsonb not null,
  hits integer not null default 0,
  expires_at timestamptz not null default now() + interval '30 days'
);
create index llm_cache_expires_idx on internal.llm_cache (expires_at);

-- Fixed-window counters: one atomic upsert per request (SECURITY.md §11).
create table internal.rate_limits (
  subject text not null,          -- user id or salted ip hash, never a raw ip
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (subject, bucket, window_start)
);
create index rate_limits_window_idx on internal.rate_limits (window_start);

create table internal.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  action text not null,
  ip_hash text,
  meta jsonb not null default '{}'
);
create index audit_log_user_idx on internal.audit_log (user_id);
create index audit_log_created_idx on internal.audit_log (created_at);

create table internal.usage_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  kind text not null,
  served_from text check (served_from in ('ml', 'cache', 'llm')),
  tokens_in integer,
  tokens_out integer,
  latency_ms integer
);
create index usage_events_user_created_idx on internal.usage_events (user_id, created_at);

alter table internal.llm_cache enable row level security;
alter table internal.rate_limits enable row level security;
alter table internal.audit_log enable row level security;
alter table internal.usage_events enable row level security;
grant usage on schema internal to service_role;
grant select, insert, update, delete on all tables in schema internal to service_role;

-- ---------------------------------------------------------------------------------------------
-- Storage: private bucket, every object under {user_id}/... (bucket itself comes from
-- config.toml locally; created here too so hosted projects get it from migrations)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-files', 'user-files', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do nothing;

create policy "own_folder_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own_folder_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own_folder_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No update policy: re-upload creates a new file.
