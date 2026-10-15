# CONTRIBUTING.md — how we work on VibrantLearn

For Bipin, Darshan, and any AI agent working in this repo. Agents also read [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).

---

## 1. First time here

```bash
git clone <repo> && cd Code

# web
cd apps/web && pnpm install
cp ../../.env.example .env.local        # fill in the values, see docs/setup/

# api
cd ../api && uv sync

# database (cloud project, see docs/setup/SETUP_SUPABASE.md)
npx supabase link --project-ref <ref>
npx supabase db push --linked
```

Just want to see it run? `START-DEMO.bat` — no database, no keys, sample data.

Human-only setup (keys, Supabase email, deploy) is in [docs/setup/MANUAL_STEPS.md](docs/setup/MANUAL_STEPS.md).

---

## 2. Before you write code

1. Read [CLAUDE.md](CLAUDE.md) (rules), [MEMORY.md](MEMORY.md) (what was decided and why), and the handbook page for the area you are touching.
2. Check [BUILD_PLAN.md](BUILD_PLAN.md) — the work is already ordered. Take the next unfinished task rather than inventing one.
3. If the change touches the database, auth, uploads, money or another person's data, re-read [docs/handbook/SECURITY.md](docs/handbook/SECURITY.md) first.

Ask before: adding a dependency over 20 MB, any paid service, changing the stack, or a migration that drops data.

---

## 3. Branches and commits

```
main            always deployable, always green
feat/<task>     one task from BUILD_PLAN, e.g. feat/c1-signed-upload-urls
fix/<thing>     fix/open-redirect
sec/<thing>     security fixes, reviewed first
```

Conventional commits, with the task id when there is one:

```
feat(C1): issue signed upload URLs after validation
fix(A2): replace plan upsert with insert, client lacks update grants
sec: reject control characters in the next= parameter
test(A0): cover the 10:40 PM crash-plan case
docs: add DATABASE.md
chore: bump dependencies
```

One task per commit where you can. A commit that touches the schema, the API and the UI at once is hard to review and harder to revert.

---

## 4. Definition of done

A change is done when **all** of these are true:

- [ ] Lint, typecheck and tests pass on web and api
- [ ] New table → RLS, policies, grants, indexes, pgTAP assertion, advisors clean
- [ ] New endpoint → auth, validation, ownership re-check, rate limit, standard error shape, cross-user test
- [ ] New screen or state → loading (skeleton matching the real layout), empty, error, success
- [ ] New animation → reduced-motion fallback
- [ ] No secret in code, logs, the client bundle or a committed file
- [ ] No invented statistics, testimonials or logos in the UI
- [ ] `MEMORY.md` session log updated; `HANDOFF.md` status markers still accurate
- [ ] A decision that future-you would question is written down in `MEMORY.md` → *Decisions*

---

## 5. Code style

Tooling decides formatting, so nobody argues about it: `eslint` + `tsc` for web, `ruff` + `mypy --strict` for Python. Run them before pushing; CI runs them again.

**TypeScript**
- Strict mode. No `any` — use `unknown` and narrow.
- Server Components by default; `"use client"` only where interaction needs it.
- Reads go through `lib/account/`; components never build Supabase queries.
- Anything with a key starts with `import "server-only"`.
- Zod on the client mirrors the Pydantic rules on the server. Two layers, same rules.

**Python**
- Type hints everywhere, `mypy --strict` clean.
- Routers are thin: validate, authorise, delegate, respond. Logic lives in `services/`, ML in `ml/`, prompts in `llm/prompts/` with a version string.
- Pydantic models use `extra="forbid"` and explicit max lengths.

**SQL**
- `snake_case`, plural tables, `timestamptz`, `uuid` keys.
- Index every foreign key and `user_id`.
- Migrations are append-only. Never edit one that has been pushed.

**Naming**
Use the words students and teachers use: *study session*, *learning path*, *checkpoint*, *block*. Not `thread_v2`, not `item`, not `data2`.

---

## 6. Comments

Comment the **why**, never the what. The code already says what it does.

```ts
// Good: explains a decision the reader cannot infer
// 'simple' not 'english': a chunk may be Kannada, Hindi or code, and English
// stemming would damage all three.

// Bad: restates the code
// loop over the topics
```

Mark genuine shortcuts so they can be found later:

```ts
// ponytail: in-memory limiter, fine for one local process;
// production uses the Postgres limiter (SECURITY.md §11).
```

---

## 7. Pull requests

Even working solo, open a PR — it is the record of why a change happened.

**Title:** the conventional-commit line.

**Body:**
```md
## What
One or two sentences.

## Why
The task id from BUILD_PLAN, or the bug.

## How to check
The commands you ran, and what they printed.

## Risk
What could break, and what you did about it.
```

Screenshots for any UI change: 360 px, 768 px and 1280 px, light and dark.

**Review checklist**
- Does it do what the PR says, and nothing else?
- Could another student's data leak through this path?
- Are the loading, empty and error states handled?
- Would a new reader understand *why* in six months?
- Is there a test that would fail if this regressed?

Security changes get a second pair of eyes — and for a milestone, a reviewer who did not write the code ([AGENTS.md](AGENTS.md) role 7).

---

## 8. Keeping the docs true

Documentation that lies is worse than none. When you change behaviour, update the page that describes it **in the same commit**:

| You changed | Update |
|---|---|
| A table, policy or migration | [DATABASE.md](docs/handbook/DATABASE.md) |
| An endpoint | [API.md](docs/handbook/API.md) |
| A module boundary or data flow | [ARCHITECTURE.md](docs/handbook/ARCHITECTURE.md) |
| A security control | [SECURITY.md](docs/handbook/SECURITY.md) |
| A screen, motion or copy rule | [FRONTEND.md](docs/handbook/FRONTEND.md) |
| A deploy step or env var | [DEPLOYMENT.md](docs/ops/DEPLOYMENT.md) |
| Anything you decided | [MEMORY.md](MEMORY.md) → *Decisions* |
| Progress against the spec | [HANDOFF.md](HANDOFF.md) |

The full map is [docs/README.md](docs/README.md).

---

## 9. Secrets

Never commit one. `gitleaks` runs as a pre-commit hook and in CI.

If a key is ever exposed — even in a chat message or a screenshot — **rotate it first**, then investigate. Removing the commit is not enough; assume it was copied. Steps for each service: [docs/setup/MANUAL_STEPS.md](docs/setup/MANUAL_STEPS.md).
