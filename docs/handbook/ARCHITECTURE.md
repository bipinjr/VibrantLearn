# ARCHITECTURE.md — how VibrantLearn is built

How the pieces fit, what happens on a request, where each kind of code lives, and how to add a subject, a language or a feature **without touching code**.

Read with: [PRD.md](PRD.md) (what to build) · [DATABASE.md](DATABASE.md) (data) · [API.md](API.md) (contracts) · [SECURITY.md](SECURITY.md) (rules).

---

## 1. The shape of the system

```
                         ┌───────────────────────────────┐
  Student's browser      │  Next.js 16 (apps/web)        │
  ───────────────────────┤  • landing, auth, onboarding  │
                         │  • student app (/app/*)       │
                         │  • Server Components render   │
                         │    the first paint            │
                         └───────┬───────────────┬───────┘
                                 │               │
             reads own rows      │               │  /api/v1/* (same origin,
             (publishable key,   │               │   rewritten by next.config)
              RLS enforced)      │               │
                                 ▼               ▼
                    ┌────────────────────┐   ┌──────────────────────────────┐
                    │ Supabase           │   │ FastAPI (apps/api)           │
                    │ • Postgres + RLS   │◄──┤ • verifies the JWT (JWKS)    │
                    │ • Auth (JWT, JWKS) │   │ • re-checks ownership        │
                    │ • Storage (private)│   │ • rate limits (Postgres)     │
                    └────────────────────┘   │ • ML intake + scheduler      │
                                             │ • file pipeline              │
                                             │ • LLM calls + cache          │
                                             └──────────┬───────────────────┘
                                                        │ server-only key
                                                        ▼
                                                 ┌─────────────┐
                                                 │  Groq API   │
                                                 └─────────────┘
```

**One origin.** The browser only ever talks to the web app's domain. `next.config.ts` rewrites `/api/v1/*` to the API project, so there is no CORS, cookies stay first-party, and the CSP `connect-src` stays tight.

**Two trust zones.** Anything the browser can reach is untrusted. The API and the database are the only places that decide what is allowed.

### Why this split

| Decision | Reason |
|---|---|
| Reads go browser → Supabase directly | RLS already answers "whose row is this?"; adding an API hop would only add latency |
| Writes that involve AI, files, money, limits or other users go through the API | Those need checks RLS cannot express |
| The LLM key lives only in the API | A key in the browser is a public key |
| Rate limits live in Postgres | Serverless instances share no memory |
| The scheduler is deterministic code, not an LLM | A timetable must be correct, fast, free and identical every time |

---

## 2. What happens when a student sends a message

```
 1  Client    POST /api/v1/sessions/{id}/messages        { text }
 2  API       verify JWT (signature, exp, aud, iss) ──────────────► 401 if bad
 3  API       does this session belong to this user? ─────────────► 404 if not
 4  API       rate limit bucket (user id) ───────────────────────► 429 if over
 5  Intake    normalise → intent → entities → urgency
 6  Intake    missing something? ──► ask ONE follow-up with chips, stop here
 7  Cache     look up (prompt_version, model, kind, source hash)
 8  Local     can we answer without the LLM?
               • make_plan      → scheduler (deterministic)
               • make_quiz      → stored/generated bank
               • ask_about_file → retrieval, then LLM only to phrase
 9  LLM       build the smallest prompt that works, call Groq, validate
10  Persist   message + blocks + served_from, usage_events row
11  Stream    SSE: one event per block as it is ready
```

Steps 5–8 are the product's economics. Most replies never reach step 9, which is what keeps the app usable on a free Groq tier and what the dashboard's "answered without an AI call" number measures.

**`served_from`** is recorded on every assistant message as `ml`, `cache` or `llm`. It is the single metric that proves the token-saving claim in the PRD.

---

## 3. Module map

```
apps/web/
  app/(marketing)/      public pages; no auth, no personal data
  app/(auth)/           sign in, sign up, server actions
  app/onboarding/       username, study profile, preferences, consent
  app/app/              the student app; everything here needs a session
  app/api/              Next route handlers (AI routes while the API is unhosted)
  components/app/       shell, composer, page chrome
  components/learn/     plan timeline, quiz, flashcards, blocks  ← product vocabulary
  components/marketing/ hero demo, waitlist
  lib/account/          load.ts / persist.ts — the ONLY place that talks to Supabase
                        about a signed-in student's own rows
  lib/demo/             demo-mode engine: parse, scheduler, respond, store, syllabus
  lib/i18n/             UI translation; t("English text")
  lib/server/           server-only helpers (groq.ts, caller.ts)
  lib/supabase/         client.ts (browser) / server.ts (RSC + actions)
  proxy.ts              session refresh, route protection, per-request CSP nonce

apps/api/
  app/routers/          thin HTTP layer: validate, authorise, call a service
  app/services/         business logic, no HTTP types
  app/ml/               intent model, entities, urgency, scheduler, retrieval
  app/llm/              prompts (versioned), schemas, cache, model routing
  app/files/            validation, extraction, chunking
  app/core/             config, auth, db, errors, ratelimit

supabase/
  migrations/           append-only; never edit a migration that has been pushed
  seed/                 syllabus data
  tests/                pgTAP RLS tests
```

### Layer rules

- A **router** never contains business logic. It validates, authorises, delegates, and shapes the response.
- A **service** never imports FastAPI types. It can be called from a test or a script.
- **`lib/account/`** is the only module in the web app allowed to write to Supabase. Components call it; they never build queries.
- **`lib/demo/`** must never be imported by a signed-in code path except through an explicit demo check. It is the sample-data engine, not the product.
- **`lib/server/`** files start with `import "server-only"` so a stray client import fails the build instead of leaking a key.

---

## 4. Flexible code and data

**The rule: content is data, behaviour is code.** Adding a subject, a language, a university or a content type must not require a code change. If it does, that is a bug in the design.

### 4.1 Extension points

| To add… | Change this | Code change? |
|---|---|---|
| A **subject** (e.g. Software Engineering) | Rows in `syllabi` + `syllabus_topics` (via `supabase/seed/`) | No |
| A **topic** or reordered unit | Rows in `syllabus_topics` (`unit`, `ord`, `weightage`, `difficulty`, `est_minutes`) | No |
| A **university or scheme** (VTU, NEP, PU board) | Rows in `syllabi` keyed by `(university, course, semester, scheme, subject, version)` | No |
| A **UI language** | A column in `lib/i18n/ui.ts` + the font in `app/layout.tsx` | Data + one font line |
| A **content language** | Add the code to the `language` CHECK constraint and the translate prompt | One migration, one prompt |
| A **content type** (e.g. "one-page revision sheet") | A `kind` value in `generated_content` + a prompt + a zod schema + a renderer in `components/learn/Blocks.tsx` | Yes, by design |
| A **plan mode** | A branch in the scheduler + a `mode` CHECK value | Yes, by design |
| **Syllabus corrections** | A new seed version; bump `version`, keep the old rows | No |

### 4.2 How that is enforced

- **No subject names in code.** The scheduler, parser and prompts all take the subject as data. `SUBJECTS` is derived from the syllabus table, never hand-written in a component.
- **Weightage drives priority.** "What should I study first?" is answered by `weightage`, `difficulty` and `est_minutes` columns, so a teacher can retune the product by editing rows.
- **Prompts are versioned strings**, not scattered literals. The version is part of the cache key, so changing a prompt invalidates exactly the right cache entries and nothing else.
- **Model IDs live in config** (`groq_model_small`, `groq_model_large`, `GROQ_MODEL`, `GROQ_NOTES_MODEL`). When a model is retired, you change an env var, not code.
- **UI copy is `t("English text")`.** A missing translation falls back to English rather than crashing or showing a key.
- **Syllabus rows carry `source` and `version`** so unverified data can be shown as unverified instead of being silently trusted.

### 4.3 The seam for the teacher side

v0.5 adds teachers, live classes and payments ([ROADMAP.md](ROADMAP.md)). The current design already leaves room:

- `profiles` is the one identity row; a teacher is a profile with a role, not a second user table.
- Roles will live in `app_metadata` or a `user_roles` table the service role owns — **never** in `user_metadata`, which the user can edit.
- Class, booking, payout and moderation tables are new tables with their own RLS; nothing in the student schema needs to change.
- The `internal` schema already exists for anything the client must never read (payouts, moderation flags, audit).

---

## 5. State and caching

| State | Lives in | Survives | Notes |
|---|---|---|---|
| Session (auth) | HttpOnly-ish cookies via `@supabase/ssr` | Browser restart | Refreshed in `proxy.ts` |
| A student's sessions, messages, plans | Postgres | Everywhere | Loaded by `lib/account/load.ts` |
| Demo data | `localStorage` | That browser only | Never the product's source of truth |
| Theme, UI language | `localStorage` + `vl_ui_lang` cookie | That browser | Cookie so the server renders the right language on first paint |
| LLM results | `internal.llm_cache` | 30 days | Keyed by prompt version + model + source hash |
| Rate counters | `internal.rate_limits` | Window length | Fixed-window, one atomic upsert |
| Uploaded files | Supabase Storage, private | Until deleted | Served via short-lived signed URLs |

**Cache key shape:** `{prompt_version}|{model}|{kind}|{sha256(source)}|{language}|{style}`. Anything that would change the output must be in the key, or students get another student's answer.

---

## 6. Failure behaviour

The app is used the night before an exam. It degrades, it does not break.

| When this fails | The student sees |
|---|---|
| Groq is down or rate limited | The cached or syllabus-derived version, plus a quiet note. Plans, quizzes and flashcards keep working — they are local |
| Supabase write fails | The screen keeps what is on it and shows "couldn't save", with a retry. Nothing is lost |
| A file fails to process | That file's row shows why (scanned PDF, locked, too big) and the rest of the session is unaffected |
| The network drops mid-stream | The partial reply stays, with a retry. No half-written row is persisted |
| A rate limit is hit | The reset time, in plain words |

Never: a blank screen, a stack trace, an "Oops", or a spinner with no end.

---

## 7. Environments

| | Local demo | Local real | Preview | Production |
|---|---|---|---|---|
| `DEMO_MODE` | `true` | unset | unset | **never set** |
| Supabase | not used | `vibrantlearn-dev` | dev | prod project |
| Groq key | optional | yes | yes | yes |
| Data | `localStorage` | real rows | real rows | real rows |

`demoEnabled()` requires `DEMO_MODE === "true"` **and** `VERCEL_ENV !== "production"`, so demo mode cannot become a way around sign-in even if the variable is set by mistake.

---

## 8. Performance model

- **First paint** comes from the server. The student app renders its first screen in the HTML, so a slow phone on college Wi-Fi still shows content fast.
- **The hero demo** is SVG plus CSS, not a video or a JS animation library.
- **Fonts** are loaded by `next/font`; Kannada and Devanagari are not preloaded so English pages do not pay for them.
- **Motion** animates only `transform`, `opacity` and `clip-path`.
- **Database**: every foreign key and `user_id` is indexed; `auth.uid()` is wrapped as `(select auth.uid())` in policies so Postgres evaluates it once per query, not once per row.
- **Connections**: the API uses Supabase's pooled connection in transaction mode with `prepare_threshold=None`.

Budgets and how to measure them: [FRONTEND.md](FRONTEND.md) §4.6.

---

## 9. Where a new feature goes

Ask in this order:

1. **Can it be data?** → a row in `syllabi`, `syllabus_topics` or a translation entry. Done.
2. **Does it need the student's own rows only?** → `lib/account/` plus RLS. No API work.
3. **Does it touch AI, files, limits, money or another person's data?** → a service in `apps/api`, with a router, Pydantic models, ownership checks, a rate-limit bucket and tests.
4. **Does it change what is stored?** → a migration, policies, a pgTAP test, then the code.

Never reach for a `SECURITY DEFINER` function to make a permission error go away. That hides the problem instead of fixing it ([SECURITY.md](SECURITY.md) §6).
