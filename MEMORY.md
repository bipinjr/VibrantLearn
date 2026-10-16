# MEMORY.md — VibrantLearn project memory

Living record for humans and AI agents. Read at the start of every session; update at the end. Newest entries at the top of each section. Keep it factual and short.

---

## Current status

- **Phase:** Student side prototype v0.4 (target ~40% of full product)
- **Milestone:** Supabase connected (project `vibrantlearn-dev`, Tokyo region), migrations + seed applied, 36/36 RLS tests pass; real accounts read/write Supabase; AI notes + open questions live via Groq; app UI in en/kn/hi
- **Last updated:** 2026-10-09 by Bipin A + Claude. See HANDOFF.md for the PRD-format status.

### Milestone tracker

| # | Milestone | Status |
|---|---|---|
| M0 | Repo, tooling, CI, env, Vercel + Supabase linked | ◐ Supabase linked; Vercel not yet |
| M1 | Schema, RLS, storage policies, seed, pgTAP | ✅ applied on cloud; 36/36 pgTAP pass; advisors clean |
| M2 | Design system, landing, auth, onboarding | ◐ email sign-in wired; real sign-up not yet tested end to end; Lighthouse not run |
| M3 | Dashboard shell, sessions, streaming chat | ◐ real accounts load/save via Supabase; SSE pending |
| M4 | ML intake (intent, entities, urgency) | ☐ |
| M5 | Scheduler, plan view, checkpoints, replan | ☐ |
| M6 | Uploads, validation, extraction, FTS, file mentions | ☐ |
| M7 | Groq, prompts, cache, notes/questions/quiz/flashcards | ☐ |
| M8 | Rate limits, usage meter, export, delete, audit | ☐ |
| M9 | Security review, a11y pass, load test, demo seed | ☐ |

---

## Product facts (do not change without the team)

- Name **VibrantLearn**; official title *Web - AI-Powered Personalized Learning Path Generator [Smart EdTech Learning System]*.
- College project at KLE Society's S. Nijalingappa College (BCA), Academic Year 2026-27; planned to become a startup.
- Owners: **Bipin A** (lead) and **Darshan H.S.** The product belongs to them.
- Username rule: 3–30 chars, letters, digits, `.` and `|` only.
- Languages for generated content: English, Kannada, Hindi.
- Full product (later): teacher marketplace, live classes of 10–40 students (₹2,000 per class), moderation bot (3 warnings → suspension), notifications, referrals, analytics.

---

## Decisions (ADR-lite)

| Date | Decision | Why |
|---|---|---|
| 2026-10-16 | **Scope change (Bipin):** build every roadmap version (v0.5 teachers + live classes, v0.6, v1.0), in order: finish v0.4 first | Owner wants the full product now; v0.4 first keeps the college submission safe and gives teachers students to teach |
| 2026-10-16 | Live video: Jitsi embed (meet.jit.si for the prototype; self-host or 8x8 JaaS later) | Free, open source, no account needed to start |
| 2026-10-16 | Payments: none in the prototype. Classes are free; teacher earnings tracked as "to be paid" | Owner's call; avoids a payment provider and KYC for now. Add Razorpay later |
| 2026-10-16 | Class rules: platform fee 20% shown before posting; under 10 students at start -> auto-cancel; teacher no-show -> refund + warning; mobile = installable PWA with offline plans | Owner accepted the proposed defaults for the roadmap's open questions |
| 2026-10-16 | DOCX/PPTX read with zipfile + defusedxml, not python-docx/python-pptx (removed) | Those parse with lxml, which defusedxml does not protect from XXE; also dropped Pillow/XlsxWriter |
| 2026-10-16 | Text/code uploads stored as `text/plain`, chosen by the server from the extension | Browsers report unreliable types (.ts as video/mp2t); files are always downloaded, never rendered |
| 2026-10-16 | **Server owns messages and plans.** Signed-in chat goes through `POST /api/v1/sessions/{id}/messages` (SSE); clients lost INSERT on `messages` and INSERT/DELETE on `study_plans`. Supersedes the 2026-10-08 interim client-writes decision for those two tables | BUILD_PLAN B3: a tampered client must not invent replies, `served_from` numbers or plans |
| 2026-10-16 | Phase E (Python intake) done before B2/B3 | The streaming endpoint needs the Python parser/scheduler; building it in TS first would be throwaway |
| 2026-10-16 | Intent: classifier first, rules only below confidence 0.15 | Holdout: classifier 0.75, rules 0.36; higher thresholds let the weaker rules override |
| 2026-10-16 | AI calls moved into FastAPI (`app/llm/`): shared `internal.llm_cache`, `internal.usage_events` per call; the Next `/api/notes` route stays only for the demo | D1 groundwork; one cache across instances and students |
| 2026-10-15 | **Security fixes applied after an external code review**: `safeNext` rejects control characters and re-checks the resolved path; the client INSERT policy on `storage.objects` is dropped (uploads go through server-issued signed URLs only); the username rate limit is keyed by user id instead of a spoofable `x-forwarded-for` | Three real holes found by review; see Security review log |
| 2026-10-15 | **Crash-plan scheduler fills the exam-day morning with real syllabus topics** and only offers "Redo the questions you got wrong" after a quiz actually happened; 20 minutes are reserved so the closing mock test always fits | A student opening the app at 10:40 PM got a plan with zero topics |
| 2026-10-15 | `BUILD_PLAN.md` (ordered task list for Claude Code) and `docs/setup/MANUAL_STEPS.md` (human-only steps) are the two documents that drive the rest of v0.4 | One place to resume from |
| 2026-10-09 | **Signed-in students write their own messages, plans and profile directly to Supabase** (column grants + RLS owner checks), not through the Python API, until the API is hosted. AI content and files stay server-only | Python API isn't hosted yet; every write still limited to the student's own rows |
| 2026-10-09 | AI routes live in Next for now: `/api/notes` (syllabus topic → notes en/kn/hi) and `/api/demo/chat` (open questions), allowed for signed-in users (verified JWT) or the local demo; shared helper `lib/server/groq.ts` (timeout, one 429 retry, status-only error logs) | Python API not hosted; same server-only key rule |
| 2026-10-09 | Notes are written in 3 Groq calls: write English → strict examiner review/correct → translate that exact text to kn/hi keeping technical terms in English. Cached per process per topic (`notes-v4`) | One-shot 3-language output had a factual error (lossy 2NF example) and translated terms (ಪ್ರಾಥಮಿಕ ಕೀ) |
| 2026-10-09 | Groq models: `openai/gpt-oss-20b` (chat), `openai/gpt-oss-120b` (notes); override with GROQ_MODEL / GROQ_NOTES_MODEL. Python config updated to match | This project's key returns `model_not_found` for the Llama IDs |
| 2026-10-09 | Parser reads Kannada/Devanagari script + digits and Kanglish/Hinglish (`toLatin`, `detectRomanLang` in `lib/demo/parse.ts`); replies use the language the student typed in | Owner: Kannada typed in English letters must be recognised |
| 2026-10-09 | App interface in en/kn/hi: `t("English text")` from `lib/i18n/ui.ts` (missing key = English), switch in Settings → Appearance, cookie `vl_ui_lang` so the server renders it on first paint. Separate from the notes language | Some students want English menus with Kannada notes; no DB change |
| 2026-10-08 | Demo-only Next route `/api/demo/chat` calls Groq server-side for open questions (cookie + DEMO_MODE gated, in-memory limit, 20 s timeout) | Owner wants any question answered in the demo; production path stays FastAPI app/llm |
| 2026-10-08 | Specs moved to docs/handbook/, setup to docs/setup/, PDF source to docs/features-guide/; HANDOFF.md tracks PRD status | Owner asked for a clearly organised folder |
| 2026-10-08 | Code lives in `E:StartupVibrantLearnCode` (monorepo root); original docs folder left untouched | Bipin A's choice |
| 2026-10-08 | Cloud Supabase project for dev instead of local Docker | Local C: drive full, Docker couldn't pull images |
| 2026-10-08 | **Demo mode**: "Try the demo" opens the full app on sample data with a local parser + scheduler (no Supabase, no LLM). Server-only `DEMO_MODE=true`, httpOnly cookie, always off on Vercel production | Bipin A wants a working, dynamic demo now; real login later |
| 2026-10-08 | **Motion direction changed** by Bipin A: richer, app-like motion (scroll-driven landing, page transitions, staggered entrances, tick bursts, flip/swipe cards). Still compositor-only with reduced-motion fallbacks. Overrides FRONTEND.md "one orchestrated moment" | Owner wants it to look superb and professional |
| 2026-10-08 | Nonce CSP in `proxy.ts` for every page; `cacheComponents`/PPR turned off | Nonces need per-request rendering (Next docs: PPR incompatible with nonce CSP) |
| 2026-10-08 | Consent checkbox lives on onboarding step 1 (recorded as `profiles.consent_at`), privacy notice linked at sign-up | One honest consent record before any profile data is stored |
| 2026-10-08 | Client writes limited by column grants: profiles (prefs only), study_sessions (insert/update, no delete), plan_checkpoints (done_at only). Session delete, quiz attempts and username go through the API | Storage cleanup on delete; server-scored quizzes; reserved-word check lives in API |
| 2026-10-08 | Tailwind turbopack loader scoped to `globals.css` only; semantic colours in `@theme inline` | Loader on `*.css` broke CSS modules; `inline` lets `data-theme="dark"` panels re-theme |
| 2026-10-08 | Next.js 16 for web, FastAPI for API, both on Vercel from one GitHub monorepo | Team preference; one host; same-origin via rewrites |
| 2026-10-08 | Supabase for Postgres + Auth + Storage (described as PostgreSQL in documents) | Free tier, RLS, auth built in |
| 2026-10-08 | Upload limit 50 MB on free plan (config `MAX_UPLOAD_MB`), 100 MB after moving to Supabase Pro | Supabase free plan caps file size at 50 MB |
| 2026-10-08 | Uploads go browser → Storage via signed URL | Vercel functions reject request bodies over 4.5 MB |
| 2026-10-08 | Image OCR in the browser with Tesseract.js | Groq had no production vision model when checked |
| 2026-10-08 | Retrieval with Postgres full-text search + TF-IDF re-rank, no embeddings in v0.4 | Free, no extra API, explainable; pgvector is a future upgrade |
| 2026-10-08 | Local ML + deterministic scheduler before any LLM call; aggressive caching | Groq free tier ≈ 30 requests/min per model; token cost |
| 2026-10-08 | Rate limits stored in Postgres | Serverless instances share no memory |
| 2026-10-08 | Logo: wordmark "vibrantlearn." (Bricolage Grotesque 800, Ember full stop), app icon "v." on Ink | Chosen by Bipin (direction 4 of 4 on the logo canvas); earlier gradient V logo rejected as corny |
| 2026-10-08 | UI palette: Ink + Mist base, Ember single accent (Ink text on Ember buttons), gradient only on the plan route line | Matches the wordmark; white on Ember fails contrast |
| 2026-10-08 | Motion: CSS first, React `<ViewTransition>` for routes, Motion library only for gestures; strict anti-slop rules in FRONTEND.md | Bipin wants smooth animations without AI-template look |
| 2026-10-08 | PYQ feature generates questions *in the style of* past papers; no scraping of copyrighted papers | Legal safety |

---

## Platform facts checked (re-verify before relying on them)

| Date checked | Fact | Source |
|---|---|---|
| 2026-10-08 | Supabase 2026-04 change: new public tables are NOT exposed to the Data API by default; grant explicitly | supabase.com/changelog |
| 2026-10-08 | Next 16.4: `setAll(cookies, headers)` in @supabase/ssr 0.12 must also forward cache headers; ViewTransition works in App Router with no config; `Link`/`router.push` take `transitionTypes` | node_modules/next/dist/docs, @supabase/ssr types |
| 2026-10-08 | Supabase CLI 2.120: `db advisors --local/--linked --fail-on`, `test db --linked`, `config push` exist | `npx supabase <cmd> --help` |
| 2026-10-08 | Supabase free plan global file size limit: 50 MB; Pro up to 500 GB | supabase.com/docs/guides/storage/uploads/file-limits |
| 2026-10-08 | Vercel Functions: 4.5 MB request/response body; Hobby max duration 300 s; Python bundle 500 MB; Hobby memory 2 GB | vercel.com/docs/functions/limitations |
| 2026-10-08 | Next.js latest stable 16.4; `middleware.ts` renamed to `proxy.ts` in v16 | nextjs.org/blog, nextjs.org/docs/messages/middleware-to-proxy |
| 2026-10-08 | Groq production models include `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`; prompt-guard models in preview; no production vision model listed | console.groq.com/docs/models |
| 2026-10-08 | Groq free tier for `llama-3.1-8b-instant` reported at ~30 RPM, 14,400 RPD, 6,000 TPM | Third-party summary; confirm in Groq console |
| 2026-10-08 | Supabase `getClaims()` verifies JWTs locally with asymmetric signing keys; JWKS at `/auth/v1/.well-known/jwks.json` | supabase.com/docs/guides/auth/jwts |

---

## Known limits and honest notes

- Free tiers cannot actually serve 10,000 concurrent AI users (Groq RPM, Supabase connections). The architecture is stateless and cache-first so it *can* scale with paid tiers; document load-test numbers honestly.
- Syllabus seed covers a few BCU SEP BCA subjects first; other subjects fall back to LLM-generated topic lists marked "unverified".
- OCR quality on handwritten notes will be weak.

---

## Open questions

- [ ] Darshan H.S.'s role
- [ ] Real sign-up end to end with Bipin's email (`npm run demo:rebuild`). Supabase's built-in email only reaches org members: turn off "Confirm email" or add SMTP before others sign up
- [ ] Native-speaker check of the Kannada/Hindi UI text (`apps/web/lib/i18n/ui.ts`) and AI notes
- [ ] **Rotate the Groq key** (it was posted in chat) — steps in `docs/setup/MANUAL_STEPS.md` §1
- [ ] Free disk space on C: so local Supabase (Docker) works
- [ ] Forgot-password flow (not built yet)
- [ ] Verify syllabus seed against the official BCU SEP PDF (marked unverified)
- [ ] `@supabase/ssr` auth cookies are readable by JS by design; SECURITY.md T7 says HttpOnly. Decide: accept, or move all API calls server-side
- [ ] Production domain name
- [ ] Faculty guide name for documents
- [ ] Security contact email for `SECURITY.md` §17

## Handoffs

- **2026-10-16 → next session:** see [NEXT_SESSION.md](NEXT_SESSION.md). E1/E2/E5 on disk, uncommitted (lint + hybrid threshold to tune). Blocked on Bipin: `apps/api/.env` secret key + DB password.

_None yet._

## Security review log

### 2026-10-15 — external review of the whole repo (read-only), fixes applied the same day

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | `safeNext` allowed `/<tab>/evil.com`: browsers strip control characters before resolving, so it became `//evil.com` and redirected off-site after sign-in | High | Fixed, 16 tests |
| 2 | Crash plans scheduled no syllabus topics when the student started late at night; the exam-day morning only ever held fixed revision items | High (product) | Fixed, 2 regression tests |
| 3 | `own_folder_insert` on `storage.objects` let a signed-in client upload any file straight to the bucket, bypassing extension/size/magic-byte checks and the `files` row | Medium | Fixed, migration `20261015180000_lock_storage_uploads.sql` + pgTAP test 37 |
| 4 | Username rate limit keyed on the first `x-forwarded-for` entry, which the client controls; behind the Next rewrite it could also collapse to one shared bucket | Medium | Keyed by user id; proxy handling tracked as BUILD_PLAN A1 |
| 5 | `savePlan` uses `.upsert()` while the client holds only `update (plan, updated_at)` grants — would fail `42501` on an existing plan id | Low (latent) | Tracked as BUILD_PLAN A2 |
| 6 | Session delete removes the row but not storage objects; will orphan files once uploads are real | Low (latent) | Tracked as BUILD_PLAN A3 |
| 7 | Scheduler tests all started at 8:30 PM IST and never asserted that a plan contains a real topic, which is why #2 survived | Process | `expectRealTopics()` helper added |

Not re-checked (unchanged since the 8 Oct review): CSP and security headers, JWT verification, error shape, no secrets in the client bundle.

## Incidents

_None._

## Session log

| Date | Who | What changed |
|---|---|---|
| 2026-10-16 | Bipin A + Claude | D1: AI calls in FastAPI share internal.llm_cache (prompt version|model|kind|source hash) and log every call to internal.usage_events; same topic twice = one Groq call (test); dashboard % from real served_from rows; Next AI routes now demo-only |
| 2026-10-16 | Bipin A + Claude | C4: answers from own notes: @mention/fuzzy file match, FTS scoped to user+session, TF-IDF top 5, <document> delimiters + ignore-instructions rule, source chips, honest not-found with no AI call, cached; 7 tests incl. cross-user + injection |
| 2026-10-16 | Bipin A + Claude | C2: POST /api/v1/files/{id}/process: real size, magic bytes, SHA-256, dedupe, zip-bomb guard, defusedxml, PDF caps; rejects delete object + audit; extraction + chunking (C3 server half) done; 15 hostile-fixture tests |
| 2026-10-16 | Bipin A + Claude | C1: POST /api/v1/sessions/{id}/files/upload-url: allowlist, 120-char/no-path names, safe slug, 50 MB cap (413), 20 files/300 MB per IST day (429), server-chosen content type, audit on rejection; 14 tests |
| 2026-10-16 | Bipin A + Claude | B1: session page loads its thread on the server (newest 500, in order) so a refresh paints it at once; layout no longer loads every message (old oldest-first limit(2000) silently dropped a heavy user's newest messages); files loaded; SSR test; E2E 17/17 |
| 2026-10-16 | Bipin A + Claude | B3: signed-in intake server-side (Python parser + intent model + scheduler); client INSERT on messages/study_plans revoked, RLS 37/37; demo keeps TS engine |
| 2026-10-16 | Bipin A + Claude | B2: SSE POST /api/v1/sessions/{id}/messages: status/plan/session/block/done/error; plan+reply commit after last block; 15 API tests incl. disconnect + failure |
| 2026-10-16 | Bipin A + Claude | E2/E5: TF-IDF word+char -> LogisticRegression, holdout accuracy 0.75 (rules alone 0.36); threshold swept to 0.15; artifact hash-checked before load; docs/ml-report.md generated |
| 2026-10-16 | Bipin A + Claude | E1: data/intents.csv: 765 synthetic lines, 11 intents, en/Kanglish/Hinglish/script; + 75-line hand-written holdout |
| 2026-10-16 | Bipin A + Claude | E4: Python scheduler port (app/ml/scheduler.py): 22 parity cases incl. 10:40 PM regression match TS step-for-step |
| 2026-10-16 | Bipin A + Claude | E3: Python entities/urgency port (app/ml/parse.py): script + Kanglish/Hinglish, IST deadlines, modes; 40 phrasings match TS exactly |
| 2026-10-16 | Bipin A + Claude | A3: DELETE /api/v1/sessions/{id}: ownership 404, storage objects removed + verified, then row, audit; client DELETE revoked (migration applied, RLS 37/37); 4 API tests with in-memory fakes |
| 2026-10-16 | Bipin A + Claude | A2: savePlan uses insert, not upsert (client lacks UPDATE on most columns); persist.test.ts asserts create -> replan -> create never upserts |
| 2026-10-16 | Bipin A + Claude | A1: `ip_hash` trusts `x-forwarded-for` only with `TRUSTED_PROXY=true` (last hop); 4 new pytest cases; docs + .env.example |
| 2026-10-15 | Bipin A + Claude | Security review; fixed open redirect, crash-plan scheduler, storage upload policy, rate-limit key; added BUILD_PLAN.md and docs/setup/MANUAL_STEPS.md |
| 2026-10-09 | Bipin A + Claude | Kannada/Hindi script + Kanglish/Hinglish input with language detection; AI notes route (write → review → translate); Groq models switched to gpt-oss; app UI in kn/hi with Settings switch; Flashcards hydration fix; docs + PDF say Supabase connected. 135 web tests, 17/17 E2E with AI on |
| 2026-10-08 | Bipin A + Claude | Demo packaging (START-DEMO.bat, npm run demo, .env.demo), 17-step E2E smoke (Chrome, 3 screen sizes), chatbot handling for any message + Groq demo route, weak-topic-first scheduling, AA contrast fixes, one source for kn/hi notes, folder reorganised (docs/handbook, docs/setup, docs/features-guide), HANDOFF.md, VibrantLearn_Features.pdf |
| 2026-10-08 | Bipin A + Claude | Monorepo in Code/, CI, Supabase schema + RLS + seed + pgTAP (unapplied), FastAPI core (auth, rate limits, profile, waitlist; 33 tests), landing, auth, onboarding, full demo app (dashboard, sessions, plans, quiz, flashcards, files, settings), local parser + scheduler (73 web tests) |
| 2026-10-08 | Bipin + Claude | Final logo set (wordmark), FRONTEND.md (anti-slop + motion), brand/palette updates |
| 2026-10-08 | Bipin + Claude | Created PRD prompt, SECURITY, CLAUDE, AGENTS, MEMORY, brand guide and logo |
