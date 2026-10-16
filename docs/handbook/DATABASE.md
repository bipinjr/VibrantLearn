# DATABASE.md — schema, access model and conventions

The complete data reference for VibrantLearn. Every table, who may touch it, and how to extend it safely.

Read with: [SECURITY.md](SECURITY.md) §6 (RLS rules) · [ARCHITECTURE.md](ARCHITECTURE.md) §4 (flexible data) · [API.md](API.md).

Source of truth is `supabase/migrations/`. This file explains **why** the schema looks the way it does; the migrations are **what** it is. If the two disagree, the migrations win and this file is out of date.

---

## 1. The access model in one paragraph

Postgres, not the application, decides who may see what. Every table in `public` has Row Level Security on, with policies that compare `(select auth.uid())` to the row's `user_id`. The browser holds only a publishable key, so it can run queries but can never see another student's rows. Writes that need judgement the database cannot make — file validation, AI content, quiz scoring, rate limits, money — are not granted to clients at all; the API performs them with a privileged role and re-checks ownership itself. Anything a client must never read lives in the `internal` schema, which is not exposed through the Data API.

Three enforcement points for anything that matters. A username, for example, is checked in the browser (`lib/username.ts`), in the API (`services/usernames.py`) and by a database CHECK constraint. Skipping any one of them is a bug.

---

## 2. Entity map

```
auth.users (Supabase)
    │ 1:1
    ├── profiles ─────────────── the student: username, course, language, consent
    │
    │ 1:N
    ├── study_sessions ───────── one exam, one chat thread, one file folder
    │       │
    │       ├── messages ─────── user + assistant turns, blocks jsonb, served_from
    │       ├── files ────────── uploaded notes, status pipeline
    │       │     └── file_chunks ── indexed text (tsvector) for retrieval
    │       └── study_plans ──── the timetable (plan jsonb)
    │             └── plan_checkpoints ── tickable milestones
    │
    ├── generated_content ────── notes / questions / quiz / flashcards, cached
    │       ├── quiz_attempts
    │       └── flashcard_reviews
    │
    └── (storage) user-files/{user_id}/{session_id}/{file_id}/{safe_name}

syllabi ──1:N── syllabus_topics      shared reference data, read-only to students
waitlist                              teacher interest, API-only

internal.llm_cache · internal.rate_limits · internal.audit_log · internal.usage_events
                                      service role only, never exposed
```

---

## 3. Tables

Every table has `id uuid primary key default gen_random_uuid()` (except where noted), `created_at timestamptz not null default now()`, and **RLS enabled**.

### 3.1 `profiles` — the student

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id`, cascade on delete |
| `username` | citext unique | 3–30 chars, `[A-Za-z0-9.|]`, no leading/trailing `.` or `|`, no `..` or `||`, not a reserved word. Case-insensitive unique |
| `full_name` | text | ≤ 100 |
| `university` | text | default `Bengaluru City University`, ≤ 120 |
| `course` | text | `BCA` · `BCom` · `BSc` · `PU` · `Other` |
| `semester` | smallint | 1–10 |
| `scheme` | text | `SEP` · `NEP` · `Other` |
| `language` | text | `en` · `kn` · `hi` — the language of **generated content** |
| `style` | text | `short` · `detailed` |
| `formats` | text[] | subset of quiz, flashcards, notes, important_questions, pyq, timetable |
| `consent_at` | timestamptz | set once, at onboarding. Required before the row can be created |
| `onboarded_at` | timestamptz | set once |

**Access:** owner reads. Owner inserts their own row *only with consent recorded*. Owner updates preferences, username, and the two stamps. The reserved-word list is a CHECK constraint, so even a direct query cannot take `admin`.

> UI language is separate from content language. It lives in a cookie (`vl_ui_lang`) and `localStorage`, not here — a student may want English menus with Kannada notes, and it must not cost a database write to change.

### 3.2 `study_sessions` — one exam

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | default `auth.uid()` so a client cannot set it |
| `title` | text | 1–120, auto-generated locally from the first message |
| `subject` | text | ≤ 120, matched against the syllabus |
| `deadline_at` | timestamptz | the exam |
| `mode` | text | `sprint` · `crash` · `steady` · `deep` |
| `updated_at`, `deleted_at` | timestamptz | |

Index: `(user_id, updated_at desc)` — the sidebar's query.

**Access:** owner creates, reads, renames. **Delete goes through the API** (`DELETE /api/v1/sessions/{id}`), which removes the session's storage objects first; clients have no DELETE grant (migration `20261016100000`).

### 3.3 `messages` — the thread

| Column | Type | Notes |
|---|---|---|
| `session_id`, `user_id` | uuid | `user_id` defaults to `auth.uid()` |
| `role` | text | `user` · `assistant` |
| `content` | text | ≤ 20000 |
| `blocks` | jsonb | rich reply: plan card, notes, questions, quiz, flashcards, sources |
| `intent` | text | what the parser decided |
| `served_from` | text | `ml` · `cache` · `llm` — the token-saving metric |

**Access:** owner reads. **Only the API writes** (`POST /api/v1/sessions/{id}/messages`): a client that could insert here could invent assistant replies or fake the `served_from` metric (migration `20261016120000`).

### 3.4 `files` and `file_chunks`

`files`: `session_id`, `user_id`, `storage_path` (unique), `original_name` (≤255, shown escaped), `display_name` (≤120), `mime`, `size_bytes`, `sha256` (`^[0-9a-f]{64}$`), `status` (`uploaded → scanning → processing → ready | failed`), `pages`, `error` (≤500).

`file_chunks`: `file_id`, `session_id`, `user_id`, `idx`, `content`, `page`, and
`tsv tsvector generated always as (to_tsvector('simple', content)) stored` with a GIN index.
Unique on `(file_id, idx)`.

> `'simple'` not `'english'`: a chunk may be Kannada, Hindi or code. English stemming would damage all three.

**Access:** owner reads. **Only the API writes**, because a row here means "these bytes were verified" — magic bytes checked, size confirmed, quota applied ([SECURITY.md](SECURITY.md) §8).

### 3.5 `syllabi` and `syllabus_topics` — shared reference data

`syllabi`: unique on `(university, course, semester, scheme, subject, version)`, plus `source` — a citation for where the data came from.

`syllabus_topics`: `syllabus_id`, `unit`, `unit_title`, `ord`, `topic`, `subtopics text[]`, and the three columns that drive the whole product:

| Column | Range | Meaning |
|---|---|---|
| `weightage` | 1–10 | exam priority; 10 = almost always asked |
| `difficulty` | 1–3 | used to break ties, easier first |
| `est_minutes` | 5–600 | first-pass study time, the scheduler's unit of work |

**Access:** every signed-in student reads; nobody writes except migrations and seeds.

This is the table that makes the product *flexible*: a new subject is rows, not code. Current seed is `draft-v1` and is **not yet verified** against the official BCU PDF — `source` says so, and the UI must keep showing it as unverified until a human checks it.

### 3.6 `study_plans` and `plan_checkpoints`

`study_plans`: `session_id`, `user_id`, `subject`, `deadline_at`, `mode`, `hours_available numeric(5,1)`, `language`, `style`, `formats`, **`plan jsonb`** (the steps), `cache_key`, `version`.

The timetable is one jsonb document on purpose: it is always read whole, always written whole, and its shape changes as the scheduler improves. Splitting steps into rows would buy nothing and cost a join on every render.

`plan_checkpoints`: `plan_id`, `user_id`, `ord`, `title`, `due_at`, `done_at`, unique `(plan_id, ord)`.

**Access:** owner reads plans and updates `plan` and `updated_at` (tick, replan). **Only the API creates or replaces plans**, from the deterministic scheduler, so a tampered browser cannot store a plan the scheduler never produced. On checkpoints the client has a **column grant on `done_at` only** — a student may tick a step, never retitle one.

### 3.7 `generated_content`, `quiz_attempts`, `flashcard_reviews`

`generated_content`: `user_id`, optional `session_id` / `plan_id` / `file_id`, `topic`, `kind` (`notes` · `important_questions` · `pyq` · `quiz` · `flashcards`), `language`, `payload jsonb`, `cache_key`.

`quiz_attempts`: `answers jsonb` (`{question: first choice}`), `score`, `total`, with `score <= total`. Written by the API so the client cannot grade itself. The answer key is in `internal.quiz_keys`, because `generated_content` is owner-readable.

`flashcard_reviews`: `card_idx`, `box` 1–5 (Leitner), `next_due_at`, unique `(user_id, content_id, card_idx)`. Owner CRUD, and the insert policy also checks the content belongs to them.

### 3.8 `waitlist`

`email citext unique`, `kind` (`teacher`), `source`. RLS on with **no client policy at all** — deny. Only the API inserts, `on conflict do nothing`, so a double submit is harmless and nobody can test whether an address is already on the list.

### 3.9 `internal.*` — never exposed

| Table | Holds |
|---|---|
| `llm_cache` | `cache_key` PK, `kind`, `model`, `prompt_version`, `response jsonb`, `hits`, `expires_at` (30 days) |
| `rate_limits` | `(subject, bucket, window_start)` PK, `count` — one atomic upsert per request |
| `audit_log` | `user_id`, `action`, `ip_hash` (salted, never a raw IP), `meta jsonb` |
| `usage_events` | `kind`, `served_from`, `tokens_in`, `tokens_out`, `latency_ms` |

The schema has `revoke all … from public, anon, authenticated`, RLS on every table, and no policies. Two locks, because one day someone will expose a schema by accident.

### 3.10 Storage

Bucket `user-files`: **private**, 50 MB limit, mime allowlist.
Path: `{user_id}/{session_id}/{file_id}/{safe_name}`.

| Operation | Who |
|---|---|
| SELECT | owner, via `(storage.foldername(name))[1] = auth.uid()::text` |
| INSERT | **nobody** — removed on 15 Oct. Uploads go through server-issued signed upload URLs after validation |
| UPDATE | nobody — a changed file is a new upload |
| DELETE | owner |

### Live classes (v0.5, migration `20261016170000_live_classes`)

| Table | Client access | Notes |
|---|---|---|
| `public.teachers` | SELECT verified teachers + own row | `status` pending/verified/suspended, set by service role only |
| `public.classes` | SELECT (signed in) | min 10, max 40, status scheduled/cancelled/done |
| `public.class_signups` | SELECT own | interest queue, `seated_at` |
| `public.class_attendance` | SELECT own | join times |
| `internal.class_rooms` | none | Jitsi room `vl-<32 hex>` |
| `internal.moderation_warnings` | none | no-show warnings |
| `internal.teacher_payouts` | none | 80% of ₹2,000, status `to_be_paid`/`paid` |

All writes go through the API. Verify a teacher by hand (service role):
`update public.teachers set status = 'verified', verified_at = now() where user_id = '<uuid>';`

---

## 4. Conventions

- `snake_case`, plural table names, `timestamptz` always (never `timestamp`), `uuid` keys.
- Index every foreign key and every `user_id`. RLS turns an unindexed `user_id` into a sequential scan per query.
- Wrap `auth.uid()` as `(select auth.uid())` in policies so it is evaluated once.
- Constrain enums with CHECK rather than Postgres `enum` types — adding a value later is a one-line migration, not a type rewrite.
- Prefer a column grant over a trigger when only part of a row should be client-editable.
- Views, if ever added: `with (security_invoker = true)`.
- Functions: `SECURITY INVOKER`. If `SECURITY DEFINER` is genuinely unavoidable it lives in `internal`, sets `search_path = ''`, checks `auth.uid()` inside, and has EXECUTE revoked from `public`.

### Migrations

- **Append-only.** Never edit a migration that has been pushed; write a new one.
- Name them `YYYYMMDDHHMMSS_what_it_does.sql`.
- Every migration that adds a table also adds: RLS, policies, grants, indexes, and a pgTAP assertion.
- After every schema change: `supabase db push --linked` → `supabase test db --linked` → `supabase db advisors --linked --fail-on error` → regenerate types.

Current migrations:

| File | What it did |
|---|---|
| `20261008143209_init_schema.sql` | All tables, RLS, grants, storage bucket and policies |
| `20261008172845_client_owned_writes.sql` | Let signed-in students write their own profile, messages and plans directly while the API is unhosted; added the reserved-username CHECK |
| `20261008173310_client_ids.sql` | Client-generated UUIDs for sessions and messages, so navigation is instant |
| `20261015180000_lock_storage_uploads.sql` | Removed the client INSERT policy on storage; uploads are server-validated only |
| `20261016100000_sessions_delete_via_api.sql` | Revoked client DELETE on `study_sessions`; the API deletes stored files, then the row |
| `20261016150000_quiz_keys.sql` | `internal.quiz_keys`: quiz answer keys the API grades against, never client-readable |
| `20261016120000_server_owns_messages_and_plans.sql` | Revoked client INSERT on `messages` and INSERT/DELETE on `study_plans`; the message endpoint writes them |

---

## 5. Testing the access model

`supabase/tests/rls.test.sql` — **38 pgTAP assertions**, run with `supabase test db --linked`.

It creates two users, A and B, with a full set of rows each, then asserts:

- A sees exactly one of everything, never B's
- A cannot rename or reassign B's session, and cannot delete any session directly (the API does it)
- A cannot insert a message, plan or flashcard review into B's data
- A cannot change a checkpoint title, only `done_at`
- A cannot upload straight to storage, even into their own folder
- A cannot read `waitlist` or anything in `internal`
- anon reads nothing, not even the syllabus
- the username rules reject short, dotted-start, HTML-ish and case-duplicate names

**Any new table adds an assertion here before it ships.** The RLS tests are the only proof that one student cannot read another's notes, and that claim is the product's licence to exist.

---

## 6. Extending the schema

Before writing a migration, read [ARCHITECTURE.md](ARCHITECTURE.md) §4 — the first question is always whether the change can be data instead.

When it must be schema:

1. New table → `user_id` + `created_at`, RLS on, owner policies with both `USING` and `WITH CHECK`, column grants for exactly what the client may write, indexes on every FK.
2. If the client must never write it, grant nothing and let the API own it.
3. If the client must never read it, put it in `internal`.
4. Add pgTAP assertions for both the allowed and the forbidden case.
5. Run advisors. Zero errors, or it does not ship.

### The teacher side (v0.5)

Planned tables, for reference while designing today's: `classes`, `class_signups`, `class_attendance`, `teacher_payouts`, `ratings`, `moderation_flags`, `warnings`. Roles go in `app_metadata` or a service-role-owned `user_roles` table — **never** `user_metadata`, which the user can edit, and never a boolean on `profiles` the client can update. Payouts and moderation flags belong in `internal`. None of this requires a change to the student schema; see [ROADMAP.md](ROADMAP.md).
