# Manual steps — things only a human can do

Claude Code cannot do these: they need a password, a browser login, a card, or a human judgement call. Everything here blocks something in [BUILD_PLAN.md](../../BUILD_PLAN.md).

Owner: **Bipin A** unless noted.

---

## 1. Rotate the Groq key — do this first

The current key was pasted into a chat, so treat it as public. Anyone who has it can spend the quota.

1. Open <https://console.groq.com/keys>.
2. Delete the existing key.
3. **Create API Key**, name it `vibrantlearn-dev`, copy it once.
4. Put it in `apps/web/.env.local`:
   ```
   GROQ_API_KEY=gsk_your_new_key_here
   ```
5. Never put it in `.env.demo`, `.env.example`, or anything committed. `.gitignore` already covers `.env.local`.
6. Check it works: `npm run demo:rebuild`, then ask the chat an open question.

> If the key ever leaks again: rotate first, then look for the cause. Removing the commit is not enough.

---

## 2. Supabase — make real sign-up work

The project is `vibrantlearn-dev`. Supabase's built-in email only delivers to members of your own Supabase org, so nobody else can confirm an account yet.

**Option A — quickest, for testing only**
1. Supabase dashboard → **Authentication** → **Sign In / Providers** → **Email**.
2. Turn **Confirm email** off.
3. Sign up with your own email and check the dashboard shows the user.
4. Turn it back on before anyone outside the team uses it.

**Option B — proper, needed before launch**
1. Create a free Resend account (<https://resend.com>) and verify a sending domain.
2. Supabase → **Project Settings** → **Authentication** → **SMTP Settings** → enable custom SMTP, paste the Resend host, port 587, user and password.
3. Set the sender name to `VibrantLearn`.
4. Send yourself a test sign-up.

**Redirect URLs** (needed for Google sign-in and email links): Supabase → **Authentication** → **URL Configuration** → add `http://localhost:3000/auth/callback`, your Vercel preview pattern, and the production domain. Nothing else.

**Region:** the project sits in **Tokyo**. Every query from Bengaluru pays roughly 100–150 ms extra. Before launch, create a new project in **Mumbai (ap-south-1)** and move: `npx supabase db dump --linked -f dump.sql`, then link the new project and push. Do it while the data is still disposable.

---

## 3. Check the Kannada and Hindi

Two files hold language that students will read. Machine translation is not good enough for a product.

| File | What to check |
|---|---|
| `apps/web/lib/i18n/ui.ts` | Every menu, button and message. Does it read like normal college Kannada/Hindi, or like a translation? |
| `apps/web/lib/demo/notes-i18n.ts` | Study notes. Are technical terms still in English (`primary key`, not `ಪ್ರಾಥಮಿಕ ಕೀ`)? |

Ask one fluent Kannada speaker and one fluent Hindi speaker to read through and mark anything that sounds wrong. Fix, then tick the line in `MEMORY.md` → *Open questions*.

---

## 4. Vercel deployment (blocks BUILD_PLAN G5)

1. Push the repo to GitHub (private).
2. Vercel → **Add New Project** → import the repo **twice**:
   - Project `vibrantlearn-web`, root directory `apps/web`.
   - Project `vibrantlearn-api`, root directory `apps/api`.
3. Environment variables on **vibrantlearn-web** (Production and Preview):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NEXT_PUBLIC_SITE_URL=https://<your-domain>
   API_ORIGIN=https://vibrantlearn-api.vercel.app
   GOOGLE_AUTH_ENABLED=false
   ```
   **Do not add `DEMO_MODE` here.** Demo mode must never exist in production.
4. Environment variables on **vibrantlearn-api** (server-only, all of them):
   ```
   ENV=production
   DATABASE_URL=<Supabase connection pooling URI, transaction mode>
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   SUPABASE_JWKS_URL=https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
   IP_HASH_SALT=<40+ random characters, generate once>
   GROQ_API_KEY=<the rotated key>
   MAX_UPLOAD_MB=50
   TRUSTED_PROXY=true
   ```
   Use the **pooled** connection string (port 6543, transaction mode), not the direct one — serverless functions exhaust direct connections.
5. After the first deploy, add the production URL to Supabase redirect URLs (§2).

---

## 5. Enable Google sign-in (optional, after §2)

1. Google Cloud Console → **APIs & Services** → **Credentials** → OAuth client ID → Web application.
2. Authorised redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google → paste client ID and secret.
4. Set `GOOGLE_AUTH_ENABLED=true` in the web env.

---

## 6. Verify the syllabus (blocks an honest claim in the report)

`supabase/seed/01_syllabus.sql` holds 6 subjects and 82 topics, compiled from the usual BCU BCA structure. It is marked `draft-v1` and is **not** checked against the official PDF.

1. Get the official BCU SEP BCA syllabus PDF.
2. Compare unit titles, topic lists and ordering for Java, Python, DBMS, Data Structures, Computer Networks, Operating Systems.
3. Fix differences in the seed, change `source` to cite the PDF and its date, bump `version` to `v1`.
4. Re-run `npx supabase db reset --linked` (dev data is disposable) or write a small update migration.

Until this is done, do not claim the syllabus is official in the project report.

---

## 7. Decisions still waiting on the team

| Question | Who | Why it matters |
|---|---|---|
| Darshan H.S.'s role | Bipin + Darshan | `AGENTS.md` and the report both need it |
| Production domain name | Bipin | Vercel, Supabase redirect URLs, the logo lockup |
| Faculty guide's name | Bipin | Synopsis and report cover pages |
| Security contact email | Bipin | `SECURITY.md` §17 is blank |
| Supabase cookies: accept JS-readable, or route every call server-side? | Bipin | `SECURITY.md` T7 says HttpOnly; `@supabase/ssr` does not. Logged as an open question since 8 Oct — pick one and write it down |

---

## 8. Before the college demo

- [ ] `START-DEMO.bat` runs on a clean machine with Node installed, nothing else.
- [ ] The smoke test prints **All 18 steps passed.**
- [ ] Sign in with a real account on your phone and your laptop; the same sessions appear on both.
- [ ] Demo the 10:40 PM case: *"DBMS test tomorrow 10am, normalization weak"* — the plan must contain real topics (this was broken until 15 Oct; the test `crash: late at night…` guards it).
- [ ] Switch the interface to ಕನ್ನಡ in Settings and walk one screen.
- [ ] Show the Supabase dashboard: 37/37 security tests passing, advisors clean.
