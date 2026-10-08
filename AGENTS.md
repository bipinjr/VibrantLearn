# AGENTS.md — VibrantLearn

Instructions for any AI coding agent (Claude Code, Codex, Cursor, etc.) and for splitting work between sub-agents. Project rules live in `CLAUDE.md`; security rules in `SECURITY.md`; current state in `MEMORY.md`. Read all three first.

## Shared rules for every agent

- Work only inside your role's file scope. If you need a change outside it, write a note in `MEMORY.md` → *Handoffs* and stop.
- Never commit secrets, never weaken RLS, never disable tests or lint.
- Keep changes small and reviewable. One feature or fix per branch/PR.
- When unsure about a library or platform API, check current documentation first.
- Finish every task by updating `MEMORY.md` (status, decisions, handoffs).

## Roles

### 1. Architect (planning, no code)
- **Owns:** `docs/`, ADRs in `MEMORY.md` → *Decisions*.
- **Does:** breaks milestones into tasks, defines interfaces between web, api and db, reviews scope against `docs/handbook/PRD.md`.
- **Output:** task list with acceptance criteria and file paths before implementation starts.

### 2. Database & security agent
- **Owns:** `supabase/migrations/`, `supabase/seed/`, `supabase/tests/`.
- **Does:** schema, indexes, RLS policies, storage policies, rate-limit SQL, syllabus seed, pgTAP tests.
- **Must:** run advisors and `supabase test db` before handing off; zero advisor errors.

### 3. Backend (API) agent
- **Owns:** `apps/api/app/` except `ml/` and `llm/prompts/`.
- **Does:** FastAPI routers, JWT verification, ownership checks, file pipeline, rate limiting, SSE streaming, export/delete.
- **Must:** Pydantic `extra="forbid"`, uniform errors, pytest coverage for each endpoint including unauthorised and cross-user cases.

### 4. ML agent
- **Owns:** `apps/api/app/ml/`, `apps/api/models/`, `data/intents.csv`, `docs/ml-report.md`.
- **Does:** intent classifier, entity extraction, urgency parser, scheduler, retrieval and re-ranking, key-phrase extraction, extractive summary.
- **Must:** keep the bundle lean (no torch/spaCy models), version model artifacts, report per-intent precision/recall, ≥ 40 parser test phrasings including Kanglish/Hinglish.

### 5. LLM agent
- **Owns:** `apps/api/app/llm/`.
- **Does:** Groq client, versioned prompts, output schemas, repair-retry, cache keys, model routing, usage logging.
- **Must:** document delimiters for untrusted text, `max_tokens` on every call, no secrets or other users' data in prompts.

### 6. Frontend agent
- **Owns:** `apps/web/`, `brand/`.
- **Does:** landing page, auth and onboarding, dashboard, session chat, plan timeline, quiz, flashcards, files, settings.
- **Must:** follow `docs/handbook/FRONTEND.md` and `brand/BRAND.md`; Server Components by default; skeleton, empty, error states; accessibility (keyboard, focus, aria-live, reduced motion); Lighthouse ≥ 90 on the landing page; sanitised markdown only; run the review loop in `FRONTEND.md` §6 (Playwright screenshots at 360/768/1280, light and dark, three written critiques fixed) before handing off.

### 6b. Design reviewer (read-only, before each UI milestone closes)
- **Owns:** nothing; writes findings to `MEMORY.md` → *Handoffs*.
- **Checks:** every screen against the banned list in `docs/handbook/FRONTEND.md` §1 ("cover the logo" test), the motion table (§4.4) and reduced-motion fallbacks, copy rules (§7), token use (no raw hex or ms values in components).
- **Rule:** a fresh agent that did not build the screens.

### 7. Security reviewer (read-only, runs before each milestone closes)
- **Owns:** nothing; writes findings to `MEMORY.md` → *Security review log*.
- **Checks:** the `docs/handbook/SECURITY.md` §15 checklist, secrets scan, RLS tests, cross-user API tests, upload abuse cases (renamed executable, zip bomb, XXE sample, 51 MB file), prompt-injection sample file, CSP headers, client bundle for leaked env vars.
- **Rule:** must be a fresh agent that did not write the code under review.

### 8. QA agent
- **Owns:** `apps/web/e2e/`, test fixtures.
- **Does:** runs the PRD demo script (§11) end to end on a preview deployment, records failures with steps to reproduce.

## Hand-off format (write in `MEMORY.md` → Handoffs)

```
[date] from <role> to <role>
Need: <what>
Why: <reason / blocking task>
Files: <paths>
Status: open | done
```

## Human team

| Person | Role |
|---|---|
| Bipin A | Co-founder, project lead, architecture, final review of all merges |
| Darshan H.S. | Co-founder (role details to record in `MEMORY.md`) |

Humans approve: dependency additions, paid services, schema changes that delete data, anything touching auth configuration, and production deploys.
