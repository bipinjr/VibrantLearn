# Documentation map

Everything written down about VibrantLearn, and when to read it.

**New here?** [../README.md](../README.md) to run it → [handbook/PRD.md](handbook/PRD.md) for what it is → [handbook/ARCHITECTURE.md](handbook/ARCHITECTURE.md) for how it is built.

**Picking up the work?** [../BUILD_PLAN.md](../BUILD_PLAN.md). It is ordered; take the next unfinished task.

---

## The handbook — how the product works

| Page | Read it when |
|---|---|
| [PRD.md](handbook/PRD.md) | You need to know what a feature is supposed to do. The spec |
| [ARCHITECTURE.md](handbook/ARCHITECTURE.md) | You are adding anything, and need to know where it goes. Includes the extension points: adding a subject or a language without code |
| [DATABASE.md](handbook/DATABASE.md) | You are touching a table, a policy or a migration |
| [API.md](handbook/API.md) | You are adding or calling an endpoint |
| [SECURITY.md](handbook/SECURITY.md) | **Before** anything touching auth, uploads, the database, AI prompts or another person's data |
| [FRONTEND.md](handbook/FRONTEND.md) | You are building UI. Banned patterns, screen direction, motion, the review loop |
| [ACCESSIBILITY.md](handbook/ACCESSIBILITY.md) | You are building UI, and before any release |
| [CONTENT_STYLE.md](handbook/CONTENT_STYLE.md) | You are writing words a student will read, in any of the three languages |
| [TESTING.md](handbook/TESTING.md) | You are writing a test, or wondering what must be covered |
| [PRIVACY.md](handbook/PRIVACY.md) | You are storing a new field, or anything leaves the system |
| [GLOSSARY.md](handbook/GLOSSARY.md) | You are naming something, or met a word you do not know |
| [ROADMAP.md](handbook/ROADMAP.md) | You are wondering whether something is in scope. Teacher side, live classes, what we deliberately will not build |

## Operations — running it

| Page | Read it when |
|---|---|
| [ops/DEPLOYMENT.md](ops/DEPLOYMENT.md) | Deploying, rolling back, or setting an environment variable |
| [ops/RUNBOOK.md](ops/RUNBOOK.md) | Something is broken. Start at §1 |
| [setup/SETUP_SUPABASE.md](setup/SETUP_SUPABASE.md) | Setting up the database for the first time |
| [setup/MANUAL_STEPS.md](setup/MANUAL_STEPS.md) | A task needs a password, a browser login or a human decision |

## Decisions and history

| Page | What it holds |
|---|---|
| [../MEMORY.md](../MEMORY.md) | Current status, every decision with its reason, platform facts with dates, open questions, security review log, session log |
| [adr/](adr/) | Architecture Decision Records: the decisions big enough to deserve a page |
| [../CHANGELOG.md](../CHANGELOG.md) | What changed in each version, written for a human |
| [../HANDOFF.md](../HANDOFF.md) | Progress against the PRD, in the format the college reads |

## Working here

| Page | What it holds |
|---|---|
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Setup, branches, commits, code style, pull requests, definition of done |
| [../CLAUDE.md](../CLAUDE.md) | Rules for AI agents: stack, commands, non-negotiables |
| [../AGENTS.md](../AGENTS.md) | Agent roles and hand-off format for multi-agent work |
| [../BUILD_PLAN.md](../BUILD_PLAN.md) | The remaining work, ordered, with acceptance criteria |
| [../brand/BRAND.md](../brand/BRAND.md) | Logo, colour tokens, typography, voice |

## Reference

| | |
|---|---|
| [features-guide/](features-guide/) | Screenshots and the source of `VibrantLearn_Features.pdf` |
| [../supabase/migrations/](../supabase/migrations/) | The real schema. Source of truth over any document |

---

## Which page is the truth?

When two documents disagree:

1. **Code and migrations** beat every document.
2. **SECURITY.md** beats any other document on anything security-related.
3. **PRD.md** beats other documents on what a feature should do.
4. **MEMORY.md** records why something is the way it is, even when it contradicts the ideal written elsewhere.

If you find a contradiction, fix the document in the same commit. Documentation that lies is worse than none.

## Keeping this true

Every page is maintained by whoever changes the thing it describes, in the same commit — the table in [CONTRIBUTING.md](../CONTRIBUTING.md) §8 says which page goes with which change.
