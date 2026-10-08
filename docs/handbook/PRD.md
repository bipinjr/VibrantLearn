# VibrantLearn — PRD & Build Prompt (Student Side, Prototype v0.4)

> **How to use this file:** Paste this whole file into Claude Code as the first prompt, after `CLAUDE.md`, `SECURITY.md`, `AGENTS.md` and `MEMORY.md` are in the repo root. Claude Code must read those four files before writing any code.

---

## 0. Instruction to Claude Code

You are the lead engineer on **VibrantLearn**, an AI-powered personalized learning path generator for Indian college students. Build the **student side** to a working, deployed prototype (~40% of the full product) exactly as specified below.

Rules for this build:

1. Read `CLAUDE.md`, `SECURITY.md`, `AGENTS.md`, `MEMORY.md` and `FRONTEND.md` (+ `brand/BRAND.md`) first. They override anything in this file if they conflict on security or design.
2. Work milestone by milestone (Section 12). After each milestone: run tests, run lint/typecheck, run Supabase advisors, update `MEMORY.md`, then stop and summarise what was built and what is next.
3. Never skip a security control to "get it working". If something blocks you, write it into `MEMORY.md` under *Open questions* and ask.
4. Ask before adding any paid service, any new third-party SDK, or any dependency over 20 MB.
5. Use the real content in this file (syllabus, copy, flows). No lorem ipsum.

---

## 1. Product summary

**One line:** A student types what they need to study and by when ("Java internal tomorrow, 2nd year BCA, SEP, explain in Kannada, I like quizzes"), or uploads their own notes, and VibrantLearn returns a personal study path: timetable, checkpoints, short notes, important questions, quizzes and flashcards.

**Official title:** Web - AI-Powered Personalized Learning Path Generator [Smart EdTech Learning System]
**Product name:** VibrantLearn
**Team (owners):** Bipin A (lead) and Darshan H.S.
**Long-term:** This becomes a startup. Build with production habits from day one.

### Out of scope for v0.4 (show as "Coming soon" only)
Teacher dashboard, live classes, video, moderation bot, earnings, payments, notifications, referrals, analytics dashboard. Design the database so these can be added without migrations that break student data.

---

## 2. Users

| Persona | Situation | What they need from us |
|---|---|---|
| **Crammer** (primary) | 2nd-year BCA, internal test in 2–24 hours | A tight, realistic plan and the most likely questions, fast |
| **Planner** | Semester exam in 2–8 weeks | Week-by-week path with checkpoints and revision loops |
| **Notes-holder** | Has the lecturer's PDF / photos of notes | Summary, important questions and a quiz from *their* material |
| **Regional-language learner** | Understands concepts better in Kannada or Hindi | Explanations in their language, technical terms kept in English |

---

## 3. Goals and success criteria for v0.4

| Goal | Measured by |
|---|---|
| Plan from one sentence | A plan appears in under 8 s for a cached-miss request, under 1 s for a cache hit |
| Works for urgent requests | "Test in 2 hrs" produces a ≤ 2 h plan with priority topics only |
| Uses the student's own files | Mentioning a file by name answers from that file, with the chunk shown as a source |
| Saves tokens | ≥ 40% of requests in the demo script are answered from cache or local ML without a Groq call (logged) |
| Secure | Zero Supabase advisor errors, RLS tests pass, no secret in the client bundle |
| Looks top notch | Lighthouse ≥ 90 on Performance, Accessibility, Best Practices for the landing page |

---

## 4. Feature specification (student side)

Every feature below is **in scope**. Each has acceptance criteria Claude Code must test.

### F1. Landing page (public)
- Separate from the app. Route: `/`.
- Hero is a **live, scripted demo**: a typed request animates into a learning path (route line with checkpoint nodes). This is the one bold moment on the page. Respects `prefers-reduced-motion` (shows the final state instantly).
- Sections: how it works (3 real steps, these *are* a sequence so numbering is allowed), what you can make (plan, notes, important questions, quiz, flashcards), languages supported, uploads, privacy promise, sign-up CTA, footer.
- Teacher marketplace shown as "Teaching on VibrantLearn — coming soon" with an email waitlist field (stores email only, rate limited, double-submit safe).
- **AC:** Server-rendered, no client JS needed to read content, Lighthouse targets met, works at 360 px width.

### F2. Authentication and onboarding
- Google OAuth and email + password via Supabase Auth (`@supabase/ssr`, cookie sessions).
- Email verification required before using AI features.
- Onboarding (3 short steps, skippable after step 1):
  1. **Username** (required): 3–30 chars, letters, digits, `.` and `|` only. Unique, case-insensitive. Live availability check (debounced, rate limited).
  2. **Study profile**: university/board (default: Bengaluru City University), course (BCA, BCom, BSc, PU, Other), year/semester, syllabus scheme (SEP / NEP / Other).
  3. **Preferences**: language (English, ಕನ್ನಡ Kannada, हिन्दी Hindi), style (Short / Detailed), favourite formats (Quiz, Flashcards, Short notes, Important questions, PYQ-style questions, Timetable). Multi-select.
- **AC:** Invalid usernames rejected on client *and* server *and* by a DB CHECK constraint. Users can edit preferences later in Settings.

### F3. Student dashboard shell
- Route group `/app`. Left sidebar: New study session, list of sessions (title + subject + deadline chip), Plans, Files, Settings. "Coming soon" entries for Live classes.
- Home shows: active plan with next checkpoint, upcoming deadlines, recent sessions, quick-start prompts based on profile (e.g. "Java internal tomorrow").
- Skeleton loaders for every async region (no spinners on full pages, no layout shift).
- Empty states that tell the user what to do next.
- **AC:** Keyboard navigable, visible focus, dark and light themes, works on mobile with a bottom sheet nav.

### F4. Study session (chat workspace)
- Each session = one chat thread + its **own file folder**. Route `/app/s/[sessionId]`.
- Chat input supports: text, `@` mention of files in this session (autocomplete), attach button, drag-and-drop.
- Assistant replies stream (SSE). Each reply can contain rich blocks: plan card, checkpoint list, notes, question list, quiz, flashcard deck, source chips (which file + chunk was used).
- Session title auto-generated locally from the first message (no LLM call).
- **AC:** Reloading the page restores the full thread. Another user can never load the session (RLS test).

### F5. Request understanding (local ML first, no LLM)
The backend parses every message **before** deciding whether an LLM is needed:
- **Intent** (classifier): `make_plan`, `ask_about_file`, `summarize_file`, `important_questions`, `make_quiz`, `make_flashcards`, `pyq_style`, `explain_topic`, `edit_plan`, `smalltalk`, `out_of_scope`.
- **Entities**: subject, course, year/semester, syllabus scheme, exam type (internal/semester/unit test), deadline, available hours, language, style, formats, file mentions.
- **Urgency parser**: "in 2 hrs", "tonight", "tomorrow 10am", "next Monday", "in 2 weeks", "2 months", "15/11" → absolute deadline in Asia/Kolkata plus a mode: `sprint` (≤ 6 h), `crash` (≤ 3 days), `steady` (≤ 4 weeks), `deep` (> 4 weeks).
- If key info is missing, ask **one** short follow-up with tappable chips instead of guessing (e.g. "Which subject?" with chips from their syllabus).
- **AC:** Parser unit tests cover ≥ 40 phrasings including Kanglish/Hinglish ("nale Java test ide", "kal DBMS ka exam hai").

### F6. Learning path generation
- **Deterministic scheduler** (no LLM) builds the timetable from `syllabus_topics` (weightage, difficulty, estimated minutes) and the deadline:
  - `sprint`: top-priority topics only, 25/5 focus blocks, ends with a 15-min mock quiz.
  - `crash`: daily blocks, revision on the last evening, one checkpoint per day.
  - `steady` / `deep`: weekly milestones, spaced revision (1, 3, 7 days), weekend checkpoints.
- The LLM is used only to write the short content inside each block (notes, examples), in the chosen language and style, and only for topics the student opens or the first two blocks (lazy generation).
- Plan view: route-line timeline with checkpoint nodes; tick to complete; progress ring; "Replan from now" if they fall behind (re-runs the scheduler only).
- **AC:** Same request twice returns the cached plan (log shows cache hit). Plans never exceed the time actually available.

### F7. Uploads and per-session file folder
- Accepted formats (allowlist): PDF, DOCX, PPTX, TXT, MD, CSV, JSON, XML, HTML, CSS, JS/TS/PY/JAVA/C/CPP source files, JPG, PNG, WEBP.
- **Size:** `MAX_UPLOAD_MB` config. **50 MB on the Supabase free plan** (hard platform limit), raise to 100 MB on Pro. Files over the limit show: "This file is over 50 MB. Split it into parts (for example by chapter) and upload each part."
- Upload goes **directly from the browser to Supabase Storage** using a signed upload URL issued by the backend (Vercel functions reject bodies over 4.5 MB).
- After upload the backend verifies magic bytes, size and SHA-256, then extracts text, chunks it and indexes it. Status: `uploaded → scanning → processing → ready | failed`.
- **Images:** OCR runs in the browser with Tesseract.js (eng + kan + hin), and the recognised text is uploaded alongside the image. (Groq has no production vision model at the time of writing; re-check before changing this.)
- Duplicate upload (same SHA-256 in the same session) reuses the existing processed file.
- **AC:** Renaming `evil.exe` to `notes.pdf` is rejected. A 49 MB PDF processes successfully. Files are never publicly readable.

### F8. Talk to your files (RAG)
- File mentions are detected two ways: explicit `@filename` and fuzzy name match in plain text ("in unit3 notes what is polymorphism").
- Retrieval: Postgres full-text search over `file_chunks` (scoped to the user and session) + TF-IDF re-rank; send only the top 4–6 chunks to the LLM.
- Every answer shows source chips (file name, page/section). If nothing relevant is found, say so instead of inventing.
- **AC:** Questions about a file never retrieve chunks from another user's files (test).

### F9. Study content generation
For a topic, a plan block or a file:
- **Short notes** (short or detailed, chosen language; technical terms stay in English with the local explanation).
- **Important questions**: extractive key-phrase scoring (YAKE/TF-IDF) picks candidate concepts locally, the LLM phrases them as 2-mark / 5-mark / 10-mark questions in the BCU exam style.
- **PYQ-style questions**: questions *in the style of* previous year papers, generated from the syllabus and the student's files. We do not scrape or reproduce copyrighted question papers. If the student uploads their own past papers, we can tag and organise those.
- **Quiz**: MCQ with explanation, instant scoring, stored attempts; wrong answers feed into "Revise these".
- **Flashcards**: front/back, flip, "Know it / Again" (simple Leitner boxes).
- All generated content is stored and cached by a key built from (source hash, topic, kind, language, style, prompt version, model).
- **AC:** Output from the LLM is validated against a Pydantic schema; invalid output is retried once with a repair prompt, then fails gracefully.

### F10. Settings and data control
- Edit profile and preferences, connected login methods, delete a session (deletes its files and chunks), **export my data** (JSON), **delete my account** (removes all rows and storage objects, then signs out everywhere).
- **AC:** Deleting a session removes its storage objects (verified by test).

### F11. Rate limiting and usage meter
- Limits per user (configurable): chat messages 30/10 min, plan generations 10/hour, uploads 20/day and 300 MB/day, content generations 40/hour. Per-IP limits on auth endpoints and the waitlist.
- Friendly UI when limited: "You've hit today's upload limit. It resets at 12:00 AM."
- Small usage meter in Settings (messages, uploads today).
- **AC:** Limits enforced server-side in Postgres (works across serverless instances).

---

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Everything in `SECURITY.md`. RLS on every table. No service key in the browser. |
| Performance | Landing LCP < 2.0 s on 4G; app route transitions < 200 ms; streaming first token < 1.5 s |
| Scale target | Architecture must not block 10,000 concurrent users: stateless functions, Supavisor pooled connections, indexed queries, caching. Load-test a smaller number and document it honestly. |
| Accessibility | WCAG 2.2 AA: contrast, focus, labels, reduced motion, screen-reader friendly streaming (aria-live polite) |
| i18n | UI copy in English for v0.4; generated content in en / kn / hi. Fonts must render Kannada and Devanagari. |
| Reliability | Graceful degradation: if Groq fails or is rate limited, show cached content or a clear retry message; scheduler and quizzes still work offline from Groq |
| Privacy | Follow India's DPDP Act 2023 basics: clear consent at sign-up, purpose-limited data, export and delete available |
| Observability | Structured JSON logs with request IDs, no PII or file content in logs; `audit_log` table for security events |

---

## 6. Architecture

```
Browser (Next.js 16 app, React, Tailwind)
   │  supabase-js (publishable key) — reads under RLS
   │  /api/v1/*  ──rewrite──►  FastAPI on Vercel Python functions
   │                               │  verifies Supabase JWT (JWKS)
   │                               │  rate limits (Postgres)
   │                               │  local ML (sklearn, rapidfuzz, yake)
   │                               │  Groq API (server only)
   ▼                               ▼
Supabase: Auth · Postgres (RLS, FTS) · Storage (private buckets)
```

- **Monorepo on GitHub**, two Vercel projects from the same repo:
  - `apps/web` — Next.js 16 (App Router, TypeScript strict).
  - `apps/api` — FastAPI deployed with Vercel's Python runtime (bundle limit 500 MB, 300 s max duration on Hobby).
- `apps/web/next.config.ts` rewrites `/api/v1/:path*` to the API project so the browser only talks to one origin (no CORS, cookies stay first-party).
- **Reads** (sessions, messages, plans, files list) go straight from the browser to Supabase under RLS.
- **Writes that involve AI, files, limits or other users' data** go through FastAPI only.
- Supabase is presented in the synopsis as PostgreSQL + Auth + Storage. It is still Postgres; that statement is true.

### Repo layout
```
vibrantlearn/
  apps/
    web/                 # Next.js 16
      app/(marketing)/   # landing, privacy, terms
      app/(auth)/        # login, signup, callback, onboarding
      app/app/           # dashboard, sessions, plans, files, settings
      components/ui/     # design-system primitives
      components/learn/  # plan timeline, quiz, flashcards, chat blocks
      lib/supabase/      # server + browser clients
      lib/api/           # typed fetch client for /api/v1
      proxy.ts           # session refresh + route protection (Next 16 name for middleware)
    api/
      app/main.py
      app/routers/       # intake, sessions, plans, files, content, quiz, me
      app/core/          # config, auth, ratelimit, logging, errors
      app/ml/            # intent model, entities, urgency, scheduler, retrieval, keyphrases
      app/llm/           # groq client, prompts (versioned), schemas, cache
      app/files/         # validation, extractors, chunker
      models/            # trained intent model artifacts (joblib) + version file
      tests/
  supabase/
    migrations/
    seed/                # syllabus seed data (SQL / CSV)
    tests/               # pgTAP RLS tests
  data/
    intents.csv          # labelled training phrases
  docs/                  # this PRD, ADRs
  CLAUDE.md  SECURITY.md  AGENTS.md  MEMORY.md
```

---

## 7. Data model (Postgres, schema `public` unless noted)

All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, RLS **enabled**. Foreign keys indexed.

| Table | Key columns | Access |
|---|---|---|
| `profiles` | `id = auth.users.id`, `username citext unique check (username ~ '^[A-Za-z0-9.|]{3,30}$')`, `full_name`, `university`, `course`, `semester smallint`, `scheme`, `language` (`en`/`kn`/`hi`), `style` (`short`/`detailed`), `formats text[]`, `onboarded_at` | Owner select/update |
| `study_sessions` | `user_id`, `title`, `subject`, `deadline_at`, `mode`, `updated_at`, `deleted_at` | Owner CRUD |
| `messages` | `session_id`, `user_id`, `role` (`user`/`assistant`), `content`, `blocks jsonb`, `intent`, `served_from` (`ml`/`cache`/`llm`) | Owner select; insert via API only |
| `files` | `session_id`, `user_id`, `storage_path`, `original_name`, `display_name`, `mime`, `size_bytes`, `sha256`, `status`, `pages`, `error` | Owner select/delete; insert/update via API |
| `file_chunks` | `file_id`, `user_id`, `session_id`, `idx`, `content`, `page`, `tsv tsvector generated` (GIN index) | Owner select; write via API |
| `syllabi` | `university`, `course`, `semester`, `scheme`, `subject`, `version` | Read for all signed-in users |
| `syllabus_topics` | `syllabus_id`, `unit`, `topic`, `subtopics text[]`, `weightage`, `difficulty`, `est_minutes`, `keywords text[]` | Read for all signed-in users |
| `study_plans` | `session_id`, `user_id`, `subject`, `deadline_at`, `mode`, `hours_available`, `language`, `style`, `formats`, `plan jsonb`, `cache_key`, `version` | Owner select; write via API |
| `plan_checkpoints` | `plan_id`, `user_id`, `ord`, `title`, `due_at`, `done_at` | Owner select + update `done_at` only |
| `generated_content` | `user_id`, `session_id`, `plan_id?`, `file_id?`, `topic`, `kind`, `language`, `payload jsonb`, `cache_key` | Owner select; write via API |
| `quiz_attempts` | `user_id`, `content_id`, `answers jsonb`, `score`, `total` | Owner select/insert |
| `flashcard_reviews` | `user_id`, `content_id`, `card_idx`, `box`, `next_due_at` | Owner CRUD |
| `waitlist` | `email citext unique`, `kind` (`teacher`), `source` | Insert via API only |
| `internal.llm_cache` | `cache_key pk`, `kind`, `model`, `prompt_version`, `response jsonb`, `hits`, `expires_at` | Service role only (unexposed schema) |
| `internal.rate_limits` | `subject` (user id or ip hash), `bucket`, `window_start`, `count` | Service role only |
| `internal.audit_log` | `user_id`, `action`, `ip_hash`, `meta jsonb` | Service role only |
| `internal.usage_events` | `user_id`, `kind`, `served_from`, `tokens_in`, `tokens_out`, `latency_ms` | Service role only |

**Storage:** bucket `user-files` (private). Path: `{user_id}/{session_id}/{file_id}/{safe_name}`. Policies restrict every operation to `(storage.foldername(name))[1] = auth.uid()::text`.

**Seed data (do this well, it makes the demo):** Full unit/topic breakdown with weightage for 4 BCU SEP BCA subjects: **Java Programming, Python Programming, Database Management Systems, Data Structures**. Plus 2 generic subjects (Computer Networks, Operating Systems). Mark the seed with its source and version.

---

## 8. API (FastAPI, prefix `/api/v1`)

All endpoints except `/health` and `/waitlist` require `Authorization: Bearer <supabase access token>`. All bodies validated by Pydantic with `extra="forbid"`. Errors use one shape: `{ "error": { "code", "message", "request_id" } }`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness (no secrets, no versions of dependencies) |
| GET | `/me` | Profile + limits remaining |
| GET | `/usernames/available?u=` | Availability check (rate limited) |
| POST | `/sessions` | Create session |
| POST | `/sessions/{id}/messages` | Send message → SSE stream of blocks |
| POST | `/sessions/{id}/files/upload-url` | Validate declared name/type/size, create `files` row, return signed upload URL |
| POST | `/files/{id}/process` | Verify bytes, extract, chunk, index |
| DELETE | `/sessions/{id}` | Delete session, files, chunks, storage objects |
| POST | `/plans` | Generate plan (scheduler + optional lazy content) |
| POST | `/plans/{id}/replan` | Re-run scheduler from now |
| POST | `/content` | Generate notes / questions / quiz / flashcards for a topic, block or file |
| POST | `/quiz/{content_id}/attempts` | Score and store attempt |
| GET | `/me/export` | Data export (JSON) |
| DELETE | `/me` | Account deletion |
| POST | `/waitlist` | Teacher waitlist (IP rate limited) |

---

## 9. ML and token-saving pipeline

Order of operations for every message:

```
message ─► normalise (lowercase, transliteration hints, emoji strip)
        ─► intent classifier (TF-IDF char+word n-grams → LogisticRegression)
        ─► entity extraction (regex + rapidfuzz against syllabus + user's files)
        ─► urgency parser (dateparser, Asia/Kolkata)
        ─► missing info? ─yes─► ask one follow-up with chips (no LLM)
        ─► cache lookup (internal.llm_cache) ─hit─► return
        ─► local answer possible? (scheduler, quiz scoring, file lookup) ─yes─► return
        ─► build minimal prompt (top-k chunks, extractive summary first)
        ─► route model: small model for short tasks, large for notes/questions
        ─► Groq call (max_tokens capped, timeout, 1 retry)
        ─► validate JSON schema ─► store + cache ─► stream to client
```

- **Intent model:** trained offline from `data/intents.csv` (target ≥ 600 labelled lines across intents, English + Kanglish + Hinglish). Report precision/recall per intent in `docs/ml-report.md`. Ship as a joblib artifact with a version file; load once per warm instance.
- **Libraries (keep the API bundle lean):** scikit-learn, numpy, rapidfuzz, dateparser, yake, pypdf, python-docx, python-pptx, defusedxml. No spaCy models, no torch.
- **Extractive summary first:** TextRank-style sentence scoring on the retrieved chunks reduces what we send to the LLM.
- **Model routing (verify IDs against Groq's current model list before coding):** `llama-3.1-8b-instant` for short/structured tasks, `llama-3.3-70b-versatile` or `openai/gpt-oss-120b` for notes and question writing. Model IDs live in config, never hard-coded in prompts.
- **Prompt versioning:** every prompt template has a version; the version is part of the cache key.
- **Metrics:** log `served_from` for every reply so the "≥ 40% without LLM" goal can be shown in the demo.

---

## 10. Design direction (frontend must be top notch)

Full rules live in **`FRONTEND.md`** (anti-slop rules, screen-by-screen direction, motion system, review loop) and **`brand/BRAND.md`** (logo, tokens). Both are mandatory. Summary:

- **Logo:** the wordmark **vibrantlearn.** (Bricolage Grotesque 800, Ember full stop); app icon **v.** on an Ink tile. Files in `brand/`.
- **Idea:** the *path*. A study plan is drawn as a route line with checkpoint nodes. That motif appears in the landing hero, the plan view and progress, nowhere else as decoration.
- **Palette:** Ink `#1C1633` and Mist `#F5F2FB` (cool lilac paper) carry the UI; Ember `#FF6A3D` is the one hot accent (primary buttons with Ink text, "now"); Violet `#6A3BE4` for links and focus; Leaf `#14A37F` for "done". The Ember→Orchid→Violet gradient appears only on the plan route line.
- **Motion:** one orchestrated moment (the hero plan drawing itself); everything else is fast (120–320 ms) and only responds to what the user does. React `<ViewTransition>` for route changes, CSS for most UI motion, Motion only for flashcard swipes and drag. Full table in `FRONTEND.md` §4.
- **Type:** Bricolage Grotesque (display, headings), Figtree (UI and body), Noto Sans Kannada and Noto Sans Devanagari for generated content. Load with `next/font`.
- **Rules:** sentence case everywhere; no all-caps eyebrows; no "→" glued onto buttons; varied radii by hierarchy (cards 16, inputs 12, chips full); one orchestrated motion moment (the hero), everything else responds to user action only; no identical card grids with the same shadow.
- **Copy voice:** plain, direct, encouraging without hype. Buttons say exactly what happens ("Build my plan", "Upload notes", "Start quiz"). Errors say what happened and how to fix it.
- **Components:** use shadcn/ui primitives as a base, restyled to the tokens, not left at defaults.

---

## 11. Demo script (what the reviewer will see)

1. Landing page hero plays the demo; sign up with Google.
2. Onboarding: username `bipin.jr`, BCU, BCA, Sem 3, SEP, Kannada, short, quizzes.
3. Type: "Java internal tomorrow 10am, help me". → follow-up chip asks hours available → plan appears (crash mode).
4. Open block 1 → short notes in Kannada with English terms.
5. Upload `Unit3_Inheritance.pdf` → ask "in unit3 notes, explain method overriding" → answer with source chip.
6. "Give me important questions from unit3 notes" → 2/5/10-mark list.
7. Start quiz → score → "Revise these".
8. Same request again in a new session → instant (cache hit badge in dev mode).
9. Settings → export data, show usage meter.
10. Show advisors clean + RLS tests passing.

---

## 12. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Repo, tooling, CI, env, Vercel + Supabase projects linked | Empty apps deploy; CI runs lint, typecheck, tests, gitleaks |
| M1 | Schema, RLS, storage policies, seed syllabus, pgTAP tests | Advisors clean; RLS tests pass |
| M2 | Design system, landing page, auth, onboarding | Lighthouse targets met; username rules enforced 3 ways |
| M3 | Dashboard shell, sessions, chat with streaming (echo + intent only) | Thread persists; skeletons everywhere |
| M4 | ML intake: intent model, entities, urgency, follow-up chips | ≥ 40 parser tests pass; ml-report written |
| M5 | Scheduler + plan view + checkpoints + replan | All four modes tested |
| M6 | Uploads, validation, extraction, chunking, FTS, file mentions | Magic-byte and cross-user tests pass |
| M7 | Groq integration, prompts, schemas, cache, content generation, quiz, flashcards | Cache-hit metric visible |
| M8 | Rate limits, usage meter, export, delete, audit log | Limits enforced; delete verified |
| M9 | Hardening and polish: security review (see AGENTS.md), accessibility pass, load test, demo seed | Demo script runs end to end on production URL |

---

## 13. Definition of done (every PR)

- Types strict, lint clean, tests added and passing.
- No new table without RLS + policies + pgTAP test.
- No secret, key or token in code, logs or the client bundle.
- UI states covered: loading (skeleton), empty, error, success.
- `MEMORY.md` updated with decisions and status.
