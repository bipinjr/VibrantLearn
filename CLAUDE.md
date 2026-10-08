# CLAUDE.md — VibrantLearn

Read this file, `docs/handbook/SECURITY.md`, `AGENTS.md`, `MEMORY.md` and `HANDOFF.md` at the start of every session, and `docs/handbook/FRONTEND.md` + `brand/BRAND.md` before any UI work. The PRD lives in `docs/handbook/PRD.md`.

## Project in one paragraph

VibrantLearn (official title: *Web - AI-Powered Personalized Learning Path Generator [Smart EdTech Learning System]*) turns a student's request ("Java internal tomorrow, BCA SEP, Kannada, quizzes") or their uploaded notes into a personal learning path: timetable, checkpoints, notes, important questions, quizzes and flashcards. Current phase: **student side prototype (v0.4)**. Teacher marketplace, live classes, moderation, payments and notifications are out of scope and appear only as "Coming soon". It belongs to Bipin A and Darshan H.S. and will become a startup, so security and code quality are non-negotiable.

## Stack (do not change without asking)

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router), React, TypeScript strict, Tailwind CSS, shadcn/ui primitives restyled to our tokens |
| Auth client | `@supabase/ssr`, `@supabase/supabase-js` (publishable key only) |
| API | Python 3.12, FastAPI, Pydantic v2, deployed as Vercel Python functions |
| Data | Supabase: Postgres (RLS, full-text search), Auth (Google + email), Storage (private buckets) |
| ML | scikit-learn, rapidfuzz, dateparser, yake, numpy (no spaCy models, no torch) |
| LLM | Groq API, server-side only, model IDs from config |
| OCR | Tesseract.js in the browser |
| Hosting | GitHub monorepo → two Vercel projects (`apps/web`, `apps/api`) |
| Tests | Vitest + Testing Library (web), Playwright (e2e), pytest (api), pgTAP (RLS) |

## Commands

```bash
# web
cd apps/web && pnpm dev            # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e

# api
cd apps/api && uv sync             # or: pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000
uv run pytest -q
uv run python -m app.ml.train      # retrain intent model from data/intents.csv

# database
supabase start                     # local stack
supabase migration new <name>
supabase db reset                  # applies migrations + seed
supabase test db                   # pgTAP RLS tests
supabase db advisors               # must be clean before commit
supabase gen types typescript --local > apps/web/lib/supabase/types.ts
```

Always discover Supabase CLI flags with `--help`; do not guess.

## Non-negotiable rules

1. **Security first.** Follow `docs/handbook/SECURITY.md`. RLS on every table, ownership predicates, storage folder policies, no secret in the browser, no `NEXT_PUBLIC_` secrets.
2. **Verify, don't assume.** Supabase, Next.js, Vercel and Groq change often. Check current docs before using an API you are unsure of; note what you checked in `MEMORY.md`.
3. **Local ML before LLM.** Every message goes through intent → entities → urgency → cache → local answer before any Groq call. Log `served_from`.
4. **One concern per PR**, small commits, conventional commit messages (`feat:`, `fix:`, `sec:`, `chore:`).
5. **Tests with every feature.** RLS change → pgTAP test. Parser change → pytest cases. UI flow → component or e2e test.
6. **Ask before** adding dependencies > 20 MB, paid services, new third-party SDKs, or changing the stack.
7. **Update `MEMORY.md`** at the end of every working session: what changed, decisions, open questions.
8. **Never** disable lint, type checks, RLS or tests to make something pass.

## Code conventions

- TypeScript strict, no `any` (use `unknown` + narrowing). Zod for client-side form validation that mirrors the API's Pydantic rules.
- Server Components by default; `"use client"` only where interaction needs it.
- Data reads from the browser go through Supabase under RLS; AI, uploads, limits and cross-table writes go through `/api/v1`.
- Python: type hints everywhere, `ruff` + `mypy --strict` clean, routers thin, logic in `services/`, ML in `ml/`, prompts in `llm/prompts/` with a version string.
- SQL: snake_case, plural table names, `timestamptz`, `uuid` keys, index every FK and `user_id`, migrations are append-only.
- Names describe user concepts: "study session", "learning path", "checkpoint", not "thread_v2".

## Design system (frontend must be top notch)

Full spec in **`docs/handbook/FRONTEND.md`** (read it before touching any UI: banned AI-slop patterns, screen-by-screen direction, motion system, review loop) and `brand/BRAND.md` (logo, tokens). Key points:

- **Logo:** wordmark **vibrantlearn.** with an Ember full stop; app icon **v.** Use the files in `brand/`, never retype or restyle it.
- **Motif:** the learning *path* (route line + checkpoint nodes). Used in the hero, plan timeline and progress only.
- **Colours:** Ink `#1C1633` and Mist `#F5F2FB` carry the UI; Ember `#FF6A3D` is the single hot accent (primary button = Ember fill + Ink text, "now"); Violet `#6A3BE4` links and focus; Leaf `#14A37F` done. Ember→Orchid→Violet gradient on the plan route line only. Define as CSS variables with light and dark themes; check contrast (AA).
- **Motion:** tokens and the "where motion happens" table in `FRONTEND.md` §4. Compositor-only properties, reduced-motion version for every animation, `<ViewTransition>` for routes with focus moved to the new `h1`.
- **Type:** Bricolage Grotesque (display), Figtree (body/UI), Noto Sans Kannada + Noto Sans Devanagari for generated content, via `next/font`.
- **Do:** sentence case, varied radii by hierarchy, skeleton loaders, purposeful empty states, motion only for the hero and in response to user actions, `prefers-reduced-motion` respected.
- **Don't:** all-caps eyebrow labels, "→" glued to buttons, identical card grids with one shadow, decorative gradients everywhere, emoji as icons, lorem ipsum.
- Copy: plain and direct. Buttons name the action ("Build my plan"). Errors explain what happened and how to fix it.
- Quality floor: 360 px mobile, keyboard focus visible, aria-live for streaming replies, Lighthouse ≥ 90.

## Working with Supabase

- Prefer migrations under `supabase/migrations/`; iterate locally, then commit a clean migration.
- Never use `SECURITY DEFINER` to "fix" a permission error.
- Internal tables go in schema `internal` (not exposed).
- After schema changes: regenerate types, run advisors, run pgTAP tests.

## Working with Groq

- Model IDs and limits in `apps/api/app/core/config.py`. Free tier is roughly 30 requests/minute per model, so caching and local answers are required, not optional.
- All calls through `app/llm/client.py` (timeouts, retry once, usage logging, cache).

## Definition of done

Lint, types and tests green; advisors clean; loading/empty/error states present; no secrets; `MEMORY.md` updated.
