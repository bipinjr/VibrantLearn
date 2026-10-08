# Supabase cloud setup (one time, ~10 minutes)

Local Docker Supabase is blocked because C: is full, so we use a free cloud project for now.
Never paste keys into chat; put them only in the two env files below.

## 1. Create the project
1. Go to supabase.com, then New project. Name: `vibrantlearn-dev`. Region: **Mumbai (ap-south-1)**.
2. Save the database password in your password manager.

## 2. Security settings in the dashboard
- Project Settings → JWT Keys → **switch to asymmetric signing keys** (SECURITY.md §4). Required: the API verifies tokens with JWKS.
- Authentication → Sign In / Providers → Email: keep **Confirm email** on.

## 3. Fill the env files (already created, gitignored)
- `apps/web/.env.local`: Project URL and **publishable** key (`sb_publishable_…`).
- `apps/api/.env`: Project URL, **secret** key (`sb_secret_…`), the JWKS URL (`https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`),
  and the **Transaction pooler** connection string (Connect button → port 6543) with your DB password.
  Set `IP_HASH_SALT` to any long random string.

## 4. Log in the CLI with a scoped token (not the browser login)
Dashboard → Account → Access Tokens → create a token limited to this project. Then in a terminal at `E:\Startup\VibrantLearn\Code`:

```powershell
npx supabase login --token <your-scoped-token>
npx supabase link --project-ref <your-project-ref>
```

If it asks for the DB password, type it there, not in chat. (Claude reads the DB URL from `apps/api/.env` without printing it.)

Then tell Claude "supabase linked". Claude will run `db push` (migrations + seed), `config push` (auth settings),
`test db --linked` (RLS tests) and `db advisors --linked`.
