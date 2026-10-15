# Changelog

Notable changes to VibrantLearn. Newest first.

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/) once v1.0 ships; until then the minor number tracks the prototype phase.

Day-to-day work is logged in [MEMORY.md](MEMORY.md) → *Session log*. This file is the readable summary: what a student or a reviewer would notice.

---

## [Unreleased]

Work in progress is tracked in [BUILD_PLAN.md](BUILD_PLAN.md).

### Added
- Full documentation set: architecture, database, API, testing, accessibility, privacy, content style, glossary, roadmap, deployment, runbook, ADR convention, contributing guide.

---

## [0.4.1] — 2026-10-15

Security and correctness pass after an external review of the whole repository.

### Fixed
- **Open redirect in the `next=` parameter.** Browsers strip control characters before resolving a URL, so `/<tab>/evil.com` became `//evil.com` and sent a student to another site after sign-in. The guard now rejects control characters and re-checks the resolved path, which also closes the `/..//evil.com` normalisation case.
- **Crash plans with no topics in them.** A student opening the app late at night, with an exam the next morning, got a plan containing only "Redo the questions you got wrong" and a mock test — no syllabus topics at all, and three unused hours. The exam-day morning now schedules real topics first, keeps 20 minutes for the closing mock test, and only offers to redo wrong answers once a quiz has actually happened.
- **Direct uploads to storage.** A signed-in client could write any file into their own storage folder, bypassing the extension allowlist, size cap, magic-byte check and quota. The client INSERT policy is gone; uploads go through server-issued signed URLs after validation.
- **Rate limits keyed on a spoofable header.** The username check used the first `x-forwarded-for` entry, which a client controls, and which could also collapse to one shared bucket behind the API rewrite. It is now keyed by user id.

### Added
- Regression tests for all of the above: 16 for the redirect guard, 2 for the scheduler (including the exact late-night case), 1 pgTAP assertion for storage uploads — **37 database tests** in total.
- `expectRealTopics()` test helper, so "the plan actually teaches something" is asserted rather than assumed.
- `BUILD_PLAN.md` — the remaining work as an ordered, verifiable task list.
- `docs/setup/MANUAL_STEPS.md` — the steps only a human can do.

### Known issues
Three latent problems are documented rather than fixed, because each needs the real backend running to test properly: the plan upsert against partial column grants, session deletion not yet removing storage objects, and proxy-header handling. Tracked as A1–A3 in `BUILD_PLAN.md`.

---

## [0.4.0] — 2026-10-09

The prototype becomes a real application.

### Added
- **Supabase connected.** Project `vibrantlearn-dev`, three migrations applied, syllabus seeded with 6 subjects and 82 topics, 36 Row Level Security tests passing, advisors clean.
- **Real accounts.** Signed-in students read and write their own sessions, messages, plans and profile, every write owner-checked by the database.
- **AI is on.** Notes for any syllabus topic, written in three steps for accuracy — write in English, a strict examiner checks and corrects it, then translate that exact text to Kannada and Hindi keeping technical terms in English. Open questions answered in the student's language.
- **Kannada and Hindi throughout.** Students can type in native script or in English letters (Kanglish, Hinglish) and get answers in that language; the whole interface switches in Settings.
- `HANDOFF.md`, a PRD-shaped status document.

### Changed
- Richer, app-like motion across the product, still compositor-only with reduced-motion fallbacks.
- Specs reorganised into `docs/handbook/`, setup into `docs/setup/`.

---

## [0.3.0] — 2026-10-08

The first working application.

### Added
- Monorepo, CI, Dependabot, gitleaks pre-commit hook.
- Database schema with Row Level Security on every table, storage policies, the `internal` schema, syllabus seed and pgTAP tests.
- FastAPI core: JWT verification against JWKS, Postgres rate limiting, profile and username endpoints, waitlist.
- The full student interface: landing page with a live plan demo, auth, onboarding, dashboard, chat sessions, plans, quizzes, flashcards, files and settings.
- Demo mode: the whole app on sample data with a local parser and scheduler, no account needed. Off in production by construction.
- The logo and brand: the wordmark **vibrantlearn.** with an Ember full stop, and the **v.** app icon.
- `PRD.md`, `SECURITY.md`, `FRONTEND.md`, `CLAUDE.md`, `AGENTS.md`, `MEMORY.md`, `BRAND.md`.

---

## [0.1.0] — 2026-10-08

The idea, written down: a dual-dashboard learning platform for Indian college students, with a student study planner and a teacher marketplace. The teacher side was scoped out of v0.4 and lives in [ROADMAP.md](docs/handbook/ROADMAP.md).
