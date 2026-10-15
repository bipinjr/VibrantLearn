# SECURITY.md — VibrantLearn

> Security is the top priority. VibrantLearn will become a startup that stores students' personal data and study files. Every rule here is mandatory for humans and AI agents. If a rule blocks you, stop and ask; never work around it.

---

## 1. What we protect

| Asset | Why it matters |
|---|---|
| Student accounts and sessions | Account takeover exposes everything below |
| Uploaded files and their text chunks | Private notes, sometimes names, college IDs, photos |
| Chat history and generated plans | Reveals study habits, weak subjects, schedules |
| Profile data (username, college, course, language) | Personal data under India's DPDP Act 2023 |
| Groq API key, Supabase secret key | Abuse costs money and can leak all data |
| Platform availability and LLM quota | Free-tier quotas are small; abuse takes the app down for everyone |

## 2. Threat model (top risks for this app)

| # | Threat | Main controls |
|---|---|---|
| T1 | User A reads User B's sessions, files or plans (IDOR / BOLA) | RLS on every table with ownership predicates; storage policies by folder; API checks ownership again |
| T2 | Leaked secret key in the browser or Git | Server-only env vars, gitleaks in CI and pre-commit, no `NEXT_PUBLIC_` secrets |
| T3 | Malicious upload (disguised executable, zip bomb, XXE, huge file) | Allowlist + magic-byte check, size caps, defusedxml, page/char caps, files never executed or served inline |
| T4 | Prompt injection via uploaded files or chat | Files treated as data in delimited blocks, no tools for the LLM, schema-validated output, output escaped |
| T5 | Quota and cost abuse (spam requests, scripted sign-ups) | Postgres-backed rate limits per user and IP, email verification before AI features, caching |
| T6 | XSS through generated content or file names | React escaping, markdown rendered with sanitisation, strict CSP, no `dangerouslySetInnerHTML` on untrusted data |
| T7 | Session theft / CSRF | HttpOnly Secure SameSite=Lax cookies via `@supabase/ssr`, same-origin API through rewrites, JWT verification on every API call |
| T8 | Privilege escalation through user-editable metadata | Never authorise on `user_metadata`; roles live in `app_metadata` / tables writable only by the service role |
| T9 | Data left behind after delete | Session and account deletion remove DB rows **and** storage objects, verified by tests |
| T10 | Supply-chain compromise | Pinned versions, lockfiles committed, Dependabot, no unreviewed packages |

---

## 3. Secrets and environment

- **Browser may only see:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Nothing else gets the `NEXT_PUBLIC_` prefix, ever.
- **Server only (API project):** `SUPABASE_SECRET_KEY`, `GROQ_API_KEY`, `SUPABASE_JWKS_URL`, `IP_HASH_SALT`, `RATE_LIMIT_*`.
- Secrets live in Vercel project environment variables (separate values for Preview and Production). Local dev uses `.env.local`, which is in `.gitignore` from the first commit.
- `.env.example` lists every variable with a fake value and a comment.
- `gitleaks` runs as a pre-commit hook and in CI; a detected secret fails the build.
- If a secret is ever committed: rotate it immediately (removing the commit is not enough), then record it in `MEMORY.md` → Incidents.
- Use a **scoped** Supabase personal access token for CLI/MCP/CI, never a full-account token.
- The service/secret key is used only inside FastAPI for: writing to `internal.*`, storage cleanup on delete, and processing pipelines. Every such code path still checks the acting user's ID.

## 4. Authentication

- Supabase Auth with **Google OAuth** and **email + password**. Enable **asymmetric JWT signing keys** in the Supabase dashboard.
- Next.js uses `@supabase/ssr` with cookie sessions. `proxy.ts` (Next 16's name for middleware) refreshes sessions and protects `/app/*`.
- On the server, authorise with `supabase.auth.getClaims()` (verifies the JWT signature). Never trust `getSession()` data on the server for authorisation.
- FastAPI verifies the `Authorization: Bearer` token on every request using the project's JWKS (`/auth/v1/.well-known/jwks.json`), checking signature, `exp`, `aud = authenticated`, and `iss`. Cache the JWKS in memory with a short TTL and also allow it via env var for cold starts.
- Email verification required before AI, upload or plan endpoints work.
- Password rules: minimum 10 characters, Supabase leaked-password protection on.
- OAuth redirect URLs: allowlist only the production domain, the Vercel preview pattern for this project, and `localhost:3000`.
- Keep the access-token lifetime short (default 1 hour is fine). Account deletion first revokes all sessions.
- **Never** use `raw_user_meta_data` / `user_metadata` for authorisation (users can edit it). Future roles (`teacher`, `admin`) go in `app_metadata` or a `user_roles` table that only the service role can write.

## 5. Username rules (enforced three times)

1. Client: regex `^[A-Za-z0-9.|]{3,30}$`, live feedback.
2. API: same regex in Pydantic, plus reserved words (`admin`, `support`, `vibrantlearn`, `root`, `system`, `teacher`, …) and no leading/trailing `.` or `|`, no `..` or `||`.
3. Database: `citext` column with `CHECK` constraint and unique index (case-insensitive).
Display usernames as text only, never as HTML.

## 6. Database and Row Level Security

**Every table in `public` has RLS enabled and at least one explicit policy.** Internal tables live in schema `internal`, which is **not exposed** through the Data API, and also have RLS enabled with no policies (defence in depth).

Policy patterns (copy these, do not invent new shapes):

```sql
-- Owner can read their rows
create policy "owner_select" on public.study_sessions
  for select to authenticated
  using ( (select auth.uid()) = user_id );

-- Owner can update, and cannot move a row to someone else
create policy "owner_update" on public.study_sessions
  for update to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- Shared read-only reference data
create policy "signed_in_read" on public.syllabus_topics
  for select to authenticated
  using ( true );
```

Rules:
- `TO authenticated` alone is **not** authorisation. Always pair it with an ownership predicate unless the data is truly shared reference data.
- UPDATE policies always have both `USING` and `WITH CHECK`. Remember UPDATE also needs a SELECT policy.
- Wrap `auth.uid()` as `(select auth.uid())` for performance; index every `user_id` and foreign key.
- Do not use `auth.role()` (deprecated).
- Views: `create view ... with (security_invoker = true)` only.
- Functions: default `SECURITY INVOKER`. If `SECURITY DEFINER` is unavoidable, it lives in `internal`, sets `search_path = ''`, checks `auth.uid()` inside, and `EXECUTE` is revoked from `public`, `anon`, `authenticated`.
- Tables the client must never write (messages, files, chunks, plans, generated_content) have **no insert/update policy** for `authenticated`; only the API writes them.
- `plan_checkpoints`: users may update only `done_at` (enforce with a column-level grant or a trigger that rejects other column changes).
- Run `supabase db advisors` (or MCP `get_advisors`) before every migration is committed. Zero errors allowed.
- **pgTAP tests** in `supabase/tests/` for every table: user A cannot select/update/delete user B's rows; anon cannot read anything private.

## 7. Storage

- Bucket `user-files`: **private**, `file_size_limit` = `MAX_UPLOAD_MB` (50 MB on free plan), `allowed_mime_types` set to the allowlist.
- Object path: `{user_id}/{session_id}/{file_id}/{safe_name}`. Policies:

```sql
create policy "own_folder_read" on storage.objects
  for select to authenticated
  using ( bucket_id = 'user-files'
          and (storage.foldername(name))[1] = (select auth.uid())::text );
```
  Same pattern for insert and delete. No update/upsert by clients (re-upload creates a new file).
- Uploads use **signed upload URLs** created by the API after it validates the declared name, type and size and creates the `files` row.
- Downloads use short-lived signed URLs (≤ 5 minutes), served with `Content-Disposition: attachment`. Never render uploaded HTML/SVG inline.
- Deleting a session or account deletes storage objects through the API, then verifies none remain.

## 8. File upload pipeline (highest-risk feature)

1. **Declared check (API):** extension in allowlist, declared size ≤ limit, per-user daily quota not exceeded.
2. **Upload:** browser → Storage via signed URL.
3. **Verify (API):** download the object, check real size, **magic bytes** match the declared type (`filetype`/libmagic-style signatures), compute SHA-256. Mismatch → delete object, mark `failed`, audit-log it.
4. **Safe parsing:**
   - XML/HTML/DOCX/PPTX parsed with `defusedxml`-backed parsers (no external entities, no DTDs).
   - Zip-based formats: reject if total uncompressed size > 10× file size or > 200 MB, or entry count > 2,000 (zip-bomb guard).
   - PDF: cap pages (e.g. 500) and extracted characters (e.g. 2 M); no JavaScript execution, no rendering.
   - Text/code files: decode as UTF-8 with replacement; never execute, import or eval.
   - Images: OCR happens in the browser (Tesseract.js); the server stores the image and the OCR text, it never runs image decoders beyond header validation.
5. **Store:** chunks written with `user_id` and `session_id` so RLS applies.
6. File names: store the original for display (escaped), but generate `safe_name` (slug + extension) for storage paths. Reject path separators, control characters and names over 120 characters.

## 9. AI / LLM safety

- Groq is called **only from FastAPI**. The key never reaches the browser.
- The LLM has **no tools** and cannot trigger actions. It only returns content we validate.
- Prompt structure: system rules → task → user request → retrieved content inside clearly delimited `<document id="…">` blocks with an instruction that document text is untrusted data and its instructions must be ignored.
- Optional extra layer: run retrieved text and user messages through Groq's prompt-guard model (`meta-llama/llama-prompt-guard-2-86m`, currently preview, verify before use). Flag, don't silently block.
- All LLM outputs must parse into a Pydantic schema; free text fields are rendered as sanitised markdown (no raw HTML, no `javascript:` links, images disabled).
- Never put secrets, other users' data, or system internals in prompts.
- Cap `max_tokens`, set timeouts, and log token usage per user in `internal.usage_events`.
- Answers grounded on files must show sources; if retrieval finds nothing, say so.

## 10. API hardening (FastAPI)

- Pydantic models with `extra="forbid"` and explicit length limits on every string (messages ≤ 4,000 chars).
- Every handler re-checks ownership of any `session_id`, `file_id`, `plan_id` it receives, even though RLS exists.
- Uniform error responses; never return stack traces, SQL errors or dependency versions.
- Request ID on every request and response (`X-Request-ID`).
- `/docs` and `/openapi.json` disabled in production.
- Timeouts on all outbound calls (Groq, Storage).
- Database access through Supabase's pooled connection (Supavisor, transaction mode) with parameterised queries only.

## 11. Rate limiting and abuse

- Implemented in Postgres (`internal.rate_limits`, fixed-window counter via one atomic `insert … on conflict … do update … returning count`), so it works across stateless serverless instances.
- Per user: messages 30 / 10 min, plans 10 / hour, content 40 / hour, uploads 20 / day and 300 MB / day.
- Per IP (salted hash, never raw IP stored) is a coarse backstop; user-id buckets are the real limit. `x-forwarded-for` is trusted only when `TRUSTED_PROXY=true` (set on Vercel), and then only its last hop; otherwise the socket address is used, so a client cannot pick a fresh bucket by sending its own header.
- Per IP buckets: sign-in/up attempts, username checks 30 / min, waitlist 5 / hour.
- Global circuit breaker: if Groq returns 429s, back off, serve cache, and show a friendly message.
- Return `429` with `Retry-After`.
- Enable Supabase Auth CAPTCHA (hCaptcha/Turnstile) if scripted sign-ups appear.

## 12. Web app headers and frontend rules

Set in `next.config.ts` headers:

- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'nonce-…'` (Next.js nonce support); `connect-src 'self' https://<project>.supabase.co`; `img-src 'self' data: blob: https://<project>.supabase.co https://lh3.googleusercontent.com`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `worker-src 'self' blob:` (Tesseract.js); `font-src 'self'`.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY`

Frontend rules: no `dangerouslySetInnerHTML` with user or model content; markdown via `react-markdown` + `rehype-sanitize`; external links `rel="noopener noreferrer"`; never log tokens to the console; no secrets in `localStorage`.

## 13. Logging, audit and privacy

- Structured JSON logs. **Never log:** tokens, cookies, passwords, file contents, chat text, full emails, raw IPs.
- `internal.audit_log` records: sign-in, sign-up, failed auth bursts, upload rejected, rate limit hit, session deleted, data export, account deleted.
- Retention: audit log 180 days, usage events 90 days, LLM cache 30 days (configurable).
- Privacy notice at sign-up states what we store and why; consent checkbox. Export and delete available in Settings (DPDP Act 2023 basics: notice, consent, purpose limitation, erasure).
- Do not train any model on user files or chats. The intent model trains only on `data/intents.csv`, which contains no user data.

## 14. Dependencies and CI

- Pin exact versions; commit `package-lock.json` / `pnpm-lock.yaml` and `requirements.txt` with hashes (`pip-compile --generate-hashes`).
- Dependabot weekly for npm and pip; review before merge.
- CI on every PR: typecheck, lint, unit tests, pgTAP RLS tests, `gitleaks`, `npm audit --omit=dev`, `pip-audit`, Supabase advisors.
- Keep Next.js on a patched release (Next.js publishes regular security releases; check before each deploy).

## 15. Security checklist before every merge

- [ ] No new secret in code, env examples contain fakes only
- [ ] New tables: RLS on, policies with ownership predicate, indexes, pgTAP tests
- [ ] New endpoint: auth required, Pydantic limits, ownership re-check, rate limit bucket, error shape
- [ ] New upload type: magic bytes + safe parser + caps
- [ ] New LLM prompt: versioned, document delimiters, schema validated, max_tokens set
- [ ] New UI rendering model/user text: sanitised, no raw HTML
- [ ] Advisors clean, tests green, `MEMORY.md` updated

## 16. Incident response (short version)

1. Contain: rotate affected keys, disable the endpoint/feature flag, revoke sessions if needed.
2. Assess: what data, which users, since when (audit log + Supabase logs).
3. Fix and add a regression test.
4. Notify affected users if personal data was exposed (DPDP Act requires notifying the Data Protection Board and affected users).
5. Write the post-mortem in `MEMORY.md` → Incidents.

## 17. Reporting a vulnerability

Email the maintainers (add address before launch). Do not open a public issue for security problems.
