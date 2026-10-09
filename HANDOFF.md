# VibrantLearn: Handoff (PRD status)

| | |
|---|---|
| **Product** | VibrantLearn, *Web: AI-Powered Personalized Learning Path Generator (Smart EdTech Learning System)* |
| **Owners** | Bipin A (lead), Darshan H.S. |
| **Phase** | Student-side prototype v0.4 |
| **Status date** | 9 October 2026 |
| **Full spec** | [docs/handbook/PRD.md](docs/handbook/PRD.md) (this file tracks progress against it) |
| **Demo** | `START-DEMO.bat` → http://localhost:3000 → *Try the demo* |
| **Feature guide** | [VibrantLearn_Features.pdf](VibrantLearn_Features.pdf) |

Status key: ✅ done and tested · 🟡 built, but on demo data or not yet verified against the real backend · ⬜ not started

---

## 1. Problem and goal

Indian college students (BCA/BCom/BSc/PU) cram for internals and semester exams with no plan, in a language that isn't always their strongest. VibrantLearn turns one sentence ("Java internal tomorrow 10am") or their own notes into a timed study path with notes, likely questions, quizzes and flashcards, in English, Kannada or Hindi.

## 2. Where things stand (summary)

- **A complete, working front end** runs on localhost in demo mode. Every screen works end to end on sample data: landing, sign-in, dashboard, chat sessions, plans, quizzes, flashcards, files and settings.
- **Real intelligence for the demo is local.** A request parser (Kanglish/Hinglish) and a plan scheduler for all four plan types run in TypeScript, so most replies need no AI call. Open questions go to Groq when a key is set.
- **The database is connected.** Cloud Supabase project `vibrantlearn-dev` (Tokyo region): 3 migrations applied, syllabus seeded (6 subjects, 82 topics), 36/36 security tests pass, advisors clean. Signed-in students load and save their own sessions, messages, plans and profile.
- **AI is on.** Notes for every syllabus topic are written by Groq (write → examiner check → translate to Kannada/Hindi) and cached; open questions are answered in the student's language.
- **Kannada and Hindi everywhere.** Students can type in Kannada/Hindi script or in English letters (Kanglish/Hinglish) and get answers in that language; the whole interface switches to ಕನ್ನಡ/हिन्दी in Settings.

## 3. Success criteria (PRD §3)

| Goal | Target | Status |
|---|---|---|
| Plan from one sentence | < 8 s (miss), < 1 s (cache hit) | ✅ ~1 s in demo (local scheduler) · ⬜ not measured on real API |
| Urgent requests | "Test in 2 hrs" gives a ≤ 2 h plan, top topics only | ✅ sprint mode, tested |
| Uses the student's own files | Mention a file, answer from it with source shown | 🟡 UI and source chips work; real text extraction not built |
| Saves tokens | ≥ 40% answered without an LLM call | ✅ shown live on dashboard (~78% in demo) |
| Secure | Zero advisor errors, RLS tests pass, no secret in client | 🟡 34 RLS tests written, not yet run; no secrets in client ✅ |
| Looks top notch | Lighthouse ≥ 90 | 🟡 professional UI, AA contrast ✅; Lighthouse not run yet |

## 4. Features (PRD §4)

| # | Feature | Status | Notes |
|---|---|---|---|
| F1 | Landing page | ✅ | Live plan hero, scroll motion, language switch, privacy, teacher waitlist (demo saves locally; API endpoint ✅ with tests) |
| F2 | Auth + onboarding | 🟡 | Email sign-in wired to live Supabase, onboarding saves to the profile. Real sign-up not yet run end to end. Demo sign-in ✅. **Missing:** forgot-password flow |
| F3 | Dashboard shell | ✅ | Sidebar, mobile menu and bottom bar, next-up with live countdown, active plans, recent sessions |
| F4 | Study session chat | 🟡 | Document-style replies, `@file` mentions, drag-drop, follow-up chips, retry on failure, every message type handled. Saved in browser only; server SSE streaming not built |
| F5 | Request understanding | 🟡 | TypeScript parser: intent, subject, deadline (IST), hours, language, weak topics; Kannada/Hindi script, native digits, Kanglish/Hinglish with language detection; 80+ test phrasings (more needed for the PRD's 40). **Not built:** Python scikit-learn intent model + `data/intents.csv` + `docs/ml-report.md` (M4) |
| F6 | Learning path generation | 🟡 | Scheduler for sprint/crash/steady/deep, weak topics first, never past the exam, tick + replan ✅. **Not built:** Python version in API, lazy LLM block content |
| F7 | Uploads | 🟡 | UI, allowlist, 50 MB cap, progress, statuses ✅ (simulated pipeline). **Not built:** signed upload URLs, magic-byte check, text extraction, chunking, Tesseract OCR |
| F8 | Talk to your files (RAG) | ⬜ | Full-text index exists in schema; retrieval + re-rank not built |
| F9 | Study content | 🟡 | AI notes for every syllabus topic in en/kn/hi (write → review → translate, zod-validated, retry, cache) ✅; open questions via Groq ✅. **Not built:** AI-written questions/quizzes, shared DB cache |
| F10 | Settings + data control | 🟡 | Preferences, theme, usage meter, JSON export ✅. **Not built:** account deletion backend, session delete with storage cleanup on server |
| F11 | Rate limits + usage | 🟡 | Postgres limiter in API (username checks, waitlist) ✅ tested; demo chat limiter ✅. **Not built:** limits on messages/plans/uploads/content in API |

## 5. Non-functional requirements (PRD §5)

| Area | Status |
|---|---|
| Security headers (nonce CSP, frame-ancestors, nosniff, HSTS, no X-Powered-By) | ✅ verified in production build |
| Row level security on every table, storage folder policies, internal schema | ✅ 36/36 pgTAP pass on the live database |
| No secrets in the browser; demo mode impossible in production | ✅ |
| Accessibility (WCAG 2.2 AA) | ✅ scan clean, text contrast ≥ 4.5:1, keyboard focus, reduced motion, aria-live chat |
| Phone / tablet / laptop | ✅ checked automatically at 360, 768 and 1280 px |
| Languages (en / kn / hi) | ✅ notes, input (script + English letters), whole interface. **Needs a native-speaker sign-off** (`lib/i18n/ui.ts`, AI notes) |
| Performance (LCP < 2 s, Lighthouse ≥ 90) | ⬜ not measured yet |
| Observability (JSON logs, request IDs, audit log) | 🟡 API logs + request IDs ✅; audit log table only |
| Privacy (DPDP basics) | 🟡 notice, consent at onboarding, export ✅; account erasure backend ⬜ |

## 6. Milestones (PRD §12)

| # | Milestone | Status |
|---|---|---|
| M0 | Repo, tooling, CI, env | ✅ monorepo, CI workflow, Dependabot, gitleaks hook · ⬜ Vercel + Supabase linking |
| M1 | Schema, RLS, storage, seed, pgTAP | ✅ applied on cloud, 36/36 |
| M2 | Design system, landing, auth, onboarding | 🟡 built; auth needs a live check |
| M3 | Dashboard, sessions, chat | 🟡 UI complete on demo data |
| M4 | ML intake (Python) | ⬜ (TypeScript version done for the demo) |
| M5 | Scheduler, plan view, replan | 🟡 UI + TS scheduler done; Python port ⬜ |
| M6 | Uploads pipeline + file search | ⬜ server side |
| M7 | Groq content + cache | ⬜ (demo open-question route only) |
| M8 | Rate limits, usage, export, delete | 🟡 partial |
| M9 | Security review, a11y, load test, demo seed | 🟡 a11y + E2E done; security review and load test ⬜ |

## 7. What's left, in order

| Priority | Task | Done when | Who |
|---|---|---|---|
| P0 | Test a real sign-up: `npm run demo:rebuild`, sign up with your email. For other people: turn off "Confirm email" or add SMTP in the Supabase dashboard | Account created, data visible on a second device | Bipin A |
| P0 | Rotate the Groq key (posted in chat) and put the new one in `apps/web/.env.local` | Old key revoked | Bipin A |
| P0 | Native-speaker check of Kannada and Hindi text in `apps/web/lib/demo/notes-i18n.ts` | Signed off by a Kannada and a Hindi speaker | Bipin A / Darshan H.S. |
| P1 | Wire real reads/writes: sessions, messages, plans from Supabase instead of the demo store | A real account sees its data on any device; RLS tests pass | Agent |
| P1 | Groq key + server LLM pipeline in FastAPI (prompts, schemas, cache, usage log) | Notes/questions written by AI, cached, `served_from` logged | Agent (key from team) |
| P1 | Upload pipeline: signed URLs, magic bytes, extraction, chunking, full-text search | 49 MB PDF processes; renamed .exe rejected; cross-user test passes | Agent |
| P2 | Port parser + scheduler to Python (`apps/api/app/ml`) with intent model and ml-report | ≥ 40 parser tests in pytest; precision/recall reported | Agent |
| P2 | Forgot-password flow, account deletion, session delete with storage cleanup | Deletion verified by test | Agent |
| P2 | Lighthouse ≥ 90 on landing; load test numbers in MEMORY.md | Scores recorded | Agent |
| P3 | Deploy to Vercel (two projects), production env vars, domain | Demo script runs on the live URL | Team |
| Later | Teacher side, live classes, payments, moderation, notifications | Out of scope for v0.4 | Team |

## 8. Risks and open questions

- Supabase project is in **Tokyo**, not Mumbai: higher latency from India. Move before launch.
- **Syllabus seed is unverified** against the official BCU SEP PDF (marked "draft-v1" in the data).
- **Supabase SSR cookies are readable by page scripts by design**, but SECURITY.md T7 asks for HttpOnly. Decide: accept, or route all API calls through the Next server.
- Open: Darshan H.S.'s role, production domain, faculty guide name, security contact email.

## 9. How to verify (takes 3 minutes)

1. `START-DEMO.bat`, then wait for the browser.
2. In another terminal: `uv run --no-project --with playwright python apps/web/e2e/smoke.py`. Expect **"All 17 steps passed."**
3. Unit tests: `cd apps/web && pnpm test` (135). With a Groq key set, run the smoke test with `EXPECT_AI=1` · `cd apps/api && uv run pytest -q` (33 + 5 that need the database).

## 10. Key decisions (full log in [MEMORY.md](MEMORY.md))

- Demo mode with local parser and scheduler, so the app is fully usable before the backend is connected. It's off in production by design.
- Cloud Supabase instead of local Docker (disk space).
- Richer, app-like motion (owner's call), always compositor-only with reduced-motion fallbacks.
- Nonce-based CSP on every page, so Partial Prerendering is off.
- One source file for all translated notes (`notes-i18n.ts`).
