# VibrantLearn

Personal study plans for Indian college students: tell it your exam and deadline (or upload your notes) and get a timed plan, short notes, likely questions, quizzes and flashcards in English, Kannada or Hindi.

Built by **Bipin A** and **Darshan H.S.**, BCA, KLE Society's S. Nijalingappa College, Bengaluru.

## Show the demo (any computer with Node.js 20+)

| Option | Do this |
|---|---|
| Double-click | `START-DEMO.bat` |
| Any IDE terminal | `npm run demo` |

The first run installs and builds (a few minutes); after that it starts in seconds and opens http://localhost:3000. Press **Try the demo**. No account or database is needed.

- Rebuild after code changes: `npm run demo:rebuild`
- Let the chat answer any question: put `GROQ_API_KEY=...` (free key from console.groq.com) in `apps/web/.env.local`, then rebuild.
- Full feature walkthrough with screenshots: **[VibrantLearn_Features.pdf](VibrantLearn_Features.pdf)**
- What's done and what's left: **[HANDOFF.md](HANDOFF.md)**
- The remaining work, as an ordered task list: **[BUILD_PLAN.md](BUILD_PLAN.md)**
- Steps only a human can do (keys, Supabase, deploy): **[docs/setup/MANUAL_STEPS.md](docs/setup/MANUAL_STEPS.md)**

## What's in this folder

```
Code/
├── START-DEMO.bat              Double-click to run the demo
├── VibrantLearn_Features.pdf   Feature guide with screenshots (for reviewers)
├── HANDOFF.md                  Status in PRD format: done, left, next steps
├── README.md                   This file
├── CLAUDE.md, AGENTS.md        Rules for AI coding agents (must stay at the root)
├── MEMORY.md                   Running log: decisions, facts checked, session history
│
├── apps/
│   ├── web/                    The website and app (Next.js 16, React, Tailwind)
│   │   ├── app/(marketing)/      Landing page and privacy notice
│   │   ├── app/(auth)/           Sign in, sign up, demo sign-in
│   │   ├── app/onboarding/       3-step profile setup
│   │   ├── app/app/              The student app: dashboard, sessions, plans, files, settings
│   │   ├── app/api/demo/chat/    Server-side AI answers for the demo (Groq)
│   │   ├── components/           Reusable UI: app shell, plan timeline, quiz, flashcards
│   │   ├── lib/demo/             Demo engine: request parser, scheduler, replies, data store
│   │   ├── e2e/                  smoke.py (17-step check) and screenshots.py
│   │   └── proxy.ts              Security headers and sign-in guard
│   └── api/                    Backend API (Python FastAPI): auth, rate limits, profile, waitlist
│
├── supabase/                   Database: schema + security rules, syllabus seed, RLS tests
├── brand/                      Logo files and brand guide
├── docs/
│   ├── handbook/               PRD.md, SECURITY.md, FRONTEND.md (the specs)
│   ├── setup/                  SETUP_SUPABASE.md (connecting the cloud database)
│   └── features-guide/         Source of the PDF: features.html, build_pdf.py, screenshots/
├── scripts/                    start-demo.mjs (what START-DEMO.bat runs)
└── .github/                    CI checks and Dependabot
```

## Checks

```bash
cd apps/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build
cd apps/api && uv run ruff check . && uv run mypy app && uv run pytest -q
```

With the demo running, the end-to-end check (uses your installed Chrome, no download):

```bash
uv run --no-project --with playwright python apps/web/e2e/smoke.py
```

Regenerate the PDF after UI changes:

```bash
uv run --no-project --with playwright python apps/web/e2e/screenshots.py
uv run --no-project --with playwright python docs/features-guide/build_pdf.py
```
