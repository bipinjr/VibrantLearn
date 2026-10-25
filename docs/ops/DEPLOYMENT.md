# DEPLOYMENT.md — environments, deploys and rollback

How VibrantLearn gets from a laptop to a student's phone, and how to put it back when a deploy goes wrong.

Human-only account setup (creating the Vercel projects, pasting keys) is in [../setup/MANUAL_STEPS.md](../setup/MANUAL_STEPS.md) §4.

---

## 1. Environments

| | Local demo | Local real | Preview | Production |
|---|---|---|---|---|
| Started by | `START-DEMO.bat` | `pnpm dev` + `uv run uvicorn` | every pull request | merge to `main` |
| Supabase | none | `vibrantlearn-dev` | `vibrantlearn-dev` | `vibrantlearn-prod` |
| `DEMO_MODE` | `true` | unset | unset | **must never be set** |
| Groq key | optional | dev key | dev key | prod key |
| Data | `localStorage` | real rows, disposable | real rows, disposable | real student data |
| Who can see it | you | you | anyone with the link | everyone |

Preview deployments are public by default. Never point one at the production database.

---

## 2. Two projects, one repository

Live since 2026-10-25: web <https://vibrantlearn.vercel.app>, API <https://vibrantlearn-api.vercel.app> (both in `hnd1`, Tokyo, next to the Supabase region). The web app reaches the API through the `/api/v1/*` rewrite (`API_ORIGIN`).

| Vercel project | Root directory | Runtime |
|---|---|---|
| `vibrantlearn` | `apps/web` | Next.js 16 |
| `vibrantlearn-api` | `apps/api` | Python (FastAPI) |

The browser only talks to the web domain. `next.config.ts` rewrites `/api/v1/*` to `API_ORIGIN`, so there is no CORS and cookies stay first-party.

---

## 3. Environment variables

### `vibrantlearn-web`

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | public by design |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | public by design; RLS is what protects data |
| `NEXT_PUBLIC_SITE_URL` | `https://vibrantlearn.app` | used for auth redirects |
| `API_ORIGIN` | `https://vibrantlearn-api.vercel.app` | **server-only**, no `NEXT_PUBLIC_` |
| `GOOGLE_AUTH_ENABLED` | `false` | flip when OAuth is configured |

Exactly three variables may carry `NEXT_PUBLIC_`. Anything else with that prefix is a leak.

### `vibrantlearn-api` — all server-only

| Variable | Notes |
|---|---|
| `ENV` | `production` — hides `/docs` and `/openapi.json` |
| `DATABASE_URL` | **pooled** connection, transaction mode (port 6543). The direct connection exhausts quickly under serverless |
| `SUPABASE_URL` | |
| `SUPABASE_SECRET_KEY` | full database access — never in the web project |
| `SUPABASE_JWKS_URL` | `…/auth/v1/.well-known/jwks.json` |
| `TRUSTED_PROXY` | `true` on Vercel (it sets `x-forwarded-for`); leave unset anywhere the API is reachable directly |
| `IP_HASH_SALT` | 40+ random characters, generated once, never rotated casually (rotating resets all IP buckets) |
| `GROQ_API_KEY` | |
| `GROQ_MODEL`, `GROQ_NOTES_MODEL` | optional overrides |
| `MAX_UPLOAD_MB` | `50` on the Supabase free plan |
| `TRUSTED_PROXY` | `true` on Vercel only, so `x-forwarded-for` may be trusted |

Set Production and Preview separately. Preview must point at the dev database.

---

## 4. Deploying

**Normal path:** merge to `main`. Vercel builds both projects. CI must be green first.

**Before a release that includes a migration**, order matters:

```bash
# 1. schema first, and it must be backwards compatible with the running code
npx supabase db push --linked
npx supabase test db --linked                      # 37/37
npx supabase db advisors --linked --fail-on error  # clean

# 2. then merge, which deploys the code that uses it
```

A migration that drops or renames a column breaks the currently running deployment. Do it in two releases: add the new column and write to both, deploy, backfill, then remove the old one in a later release.

**After deploying**

```bash
curl -s https://vibrantlearn-api.vercel.app/api/v1/health      # {"status":"ok"}
curl -sI https://vibrantlearn.app | grep -i content-security   # nonce CSP present
```

Then by hand: sign in, open a session, generate a plan, run the quiz. Two minutes, catches most of what tests miss.

---

## 5. Rolling back

Vercel keeps every deployment. **Instant Rollback** from the dashboard is the first move in almost every incident — do it first, investigate after.

Rolling back the **database** is not symmetrical. Migrations are append-only, so recovery is a new migration that reverses the change, not an undo. Before any destructive migration, take a dump:

```bash
npx supabase db dump --linked -f backup-$(date +%F).sql
```

Supabase's free plan keeps limited automatic backups. For anything irreversible, take your own first.

---

## 6. Pre-launch checklist

**Security**
- [ ] `DEMO_MODE` absent from both production projects
- [ ] No `NEXT_PUBLIC_` variable other than the three listed
- [ ] `ENV=production` on the API, so `/docs` is gone
- [ ] CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` present on a production response
- [ ] Supabase redirect URLs list only localhost, the preview pattern and the production domain
- [ ] Email confirmation **on**, with real SMTP configured
- [ ] Leaked-password protection on
- [ ] `supabase db advisors --linked` clean
- [ ] 37/37 pgTAP pass against production
- [ ] A fresh-agent security review has been done ([SECURITY.md](../handbook/SECURITY.md) §15)

**Correctness**
- [ ] Smoke test passes against the production URL
- [ ] A real sign-up works end to end from a non-team email address
- [ ] The same account shows the same data on a phone and a laptop
- [ ] The 10:40 PM crash-plan case produces real topics

**Product**
- [ ] Kannada and Hindi signed off by native speakers
- [ ] Syllabus verified against the official PDF, or still labelled unverified in the UI
- [ ] Privacy notice reachable before sign-up; export and delete both work
- [ ] Lighthouse ≥ 90 on the landing page

**Operations**
- [ ] A support or security contact address exists and is monitored
- [ ] Someone knows how to roll back
- [ ] Load-test numbers recorded honestly in `MEMORY.md`

---

## 7. Known platform limits

| Limit | Value | What it means |
|---|---|---|
| Vercel request/response body | 4.5 MB | Files never pass through a function; the browser PUTs to Storage via a signed URL |
| Vercel function duration (Hobby) | 300 s | Long AI chains must stream, not block |
| Supabase file size (free) | 50 MB | `MAX_UPLOAD_MB=50`; 100 MB needs Pro |
| Supabase connections | small on free | Pooled connection, transaction mode, no prepared statements |
| Groq free tier | ≈ 30 requests/min | Cache and local-first answering are not optimisations, they are what makes the app work |

The architecture scales with paid tiers because it is stateless and cache-first. The free tier does not serve 10,000 concurrent AI users, and the project documents say so plainly.

---

## 8. Moving the database to Mumbai

The dev project is in **Tokyo**, which costs roughly 100–150 ms per query from Bengaluru. Before launch:

1. Create a new project in **Mumbai (ap-south-1)**.
2. `npx supabase db dump --linked -f dump.sql` from the old one.
3. Link the new project, `db push`, then load the dump.
4. Move Storage objects if any matter.
5. Update every environment variable and the Supabase redirect URLs.
6. Re-run the pgTAP suite and advisors against the new project.

Do it while the data is still disposable.
