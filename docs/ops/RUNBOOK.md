# RUNBOOK.md — when something is wrong

What breaks, how to tell, and what to do. Written for 11 PM on a weeknight, when a hundred students are trying to pass an exam in the morning.

Start here, work down. **Stop the bleeding first, understand it second.**

---

## 1. First moves, in order

1. **Is it everyone or one person?** Open the app yourself in a private window.
2. **Is it the web app or the API?** `curl https://vibrantlearn-api.vercel.app/api/v1/health`.
3. **Did we just deploy?** If yes → **Instant Rollback in Vercel**, then investigate. A rollback costs a minute; a broken exam night costs trust.
4. **Is it the database?** Supabase dashboard → Project health.
5. Write what you see in `MEMORY.md` → *Incidents* as you go, not afterwards.

---

## 2. Severity

| Level | Looks like | Response |
|---|---|---|
| **S1** | Data exposed to the wrong student, or auth bypassed | Stop everything. Disable the path, rotate keys, §7 |
| **S2** | Nobody can sign in, or the app is down | Roll back, then diagnose |
| **S3** | One feature is broken (AI, uploads) but study plans still work | Degrade gracefully, fix within the day |
| **S4** | Cosmetic or slow | Normal queue |

Plans, quizzes and flashcards are local and deterministic. If the AI is down, the core of the product still works — say so in the UI rather than failing the whole screen.

---

## 3. Symptoms and causes

### "Nobody can sign in"

| Check | Likely cause |
|---|---|
| Supabase → Authentication → Logs | Provider misconfigured, or a rate limit |
| `NEXT_PUBLIC_SITE_URL` matches the real domain | Redirect mismatch after a domain change |
| Supabase redirect URL allowlist | A new preview or domain is not listed |
| JWKS reachable from the API | Signing keys rotated; `getClaims` and the API both fail |
| Clock skew | Tokens rejected as expired |

### "I signed in but my sessions are gone"

Almost always RLS or onboarding, not data loss.

1. Supabase SQL editor: `select count(*) from study_sessions where user_id = '<uid>';` — if rows exist, the data is fine.
2. Does `profiles` have a row with a `username`? `loadAccount` returns `null` until onboarding is finished, which looks like an empty account.
3. Check policies were not dropped by a migration: `select * from pg_policies where tablename = 'study_sessions';`

**Never "fix" this by loosening a policy.** That turns a display bug into a data breach.

### "The AI isn't answering"

| Check | Then |
|---|---|
| Logs for `groq_error` with status | 401 → key revoked or wrong; rotate and set it |
| | 429 → rate limited; the retry already waits once, cached answers still serve |
| | 404 `model_not_found` → the model was retired; set `GROQ_MODEL` / `GROQ_NOTES_MODEL` to a current id from console.groq.com/docs/models |
| `GROQ_API_KEY` set in the right project | A key in the web project instead of the API does nothing |

The app must keep working: plans, quizzes and flashcards are local. If it does not, that is the bug to fix.

### "Uploads fail"

1. File over `MAX_UPLOAD_MB`? The student should see the split-it message, not an error.
2. Mime type in the bucket allowlist? A rejected `.md` or `.csv` means the allowlist is behind the PRD.
3. Signed URL expired (5 minutes) — a slow connection on a large file.
4. Status stuck at `processing` → the process step failed; check logs for the `files` row id.

### "Everything is slow"

| Check | Likely cause |
|---|---|
| Supabase → Query performance | A missing index on a new `user_id` or foreign key |
| Connection count | Direct connection string instead of the pooled one |
| Region | Tokyo adds ~100–150 ms per query from India ([DEPLOYMENT.md](DEPLOYMENT.md) §8) |
| Vercel function duration | An AI chain blocking instead of streaming |

### "Rate limits are hitting everyone"

Check whether the bucket is keyed by user id. If limits are keyed by IP and every request arrives through the Next rewrite, the whole app can share one bucket. Signed-in endpoints key by user id; only anonymous ones use a salted IP hash.

---

## 4. Useful queries

```sql
-- Is a student's data actually there?
select count(*) from study_sessions where user_id = '<uid>';
select username, onboarded_at, consent_at from profiles where id = '<uid>';

-- Are the policies still in place?
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' order by tablename;

-- Any table in public without RLS? (should return nothing)
select tablename from pg_tables t where schemaname = 'public'
and not exists (select 1 from pg_class c
                where c.relname = t.tablename and c.relrowsecurity);

-- Who is hitting limits?
select subject, bucket, count, window_start from internal.rate_limits
order by window_start desc limit 20;

-- AI usage and how much was answered without a call
select served_from, count(*), avg(latency_ms)::int
from internal.usage_events
where created_at > now() - interval '1 day' group by served_from;

-- Recent security-relevant events
select created_at, action, meta from internal.audit_log
order by created_at desc limit 50;
```

---

## 5. Monitoring

Until there is a paid monitoring tool, this is the weekly check — ten minutes, every Monday:

- [ ] Vercel → both projects: error rate, p95 duration, failed builds
- [ ] Supabase → database health, connection count, slow queries, storage used
- [ ] `supabase db advisors --linked` — still clean?
- [ ] Groq console → usage against the free tier
- [ ] `internal.audit_log` — any burst of failed auth or rejected uploads?
- [ ] `internal.usage_events` — is the "answered without an AI call" share still healthy?

**Alarms worth setting up before launch:** API error rate above 2%, a spike in failed sign-ins, storage above 80% of the plan, Groq quota above 80%.

---

## 6. Logging rules

Logs are JSON with `request_id`, path, status and duration.

**Never logged:** tokens, cookies, passwords, file contents, chat text, full email addresses, raw IP addresses (only salted hashes), prompts, the Groq key.

If you need to debug a specific student's problem, use their user id and the request id. That is enough.

---

## 7. Security incident (S1)

1. **Contain.** Rotate the affected key. Disable the endpoint or feature flag. Revoke sessions if tokens may be involved.
2. **Assess.** What data, whose, since when — `internal.audit_log` plus Supabase logs. Write it down with timestamps.
3. **Fix**, and add a regression test that would have caught it.
4. **Notify.** If personal data was exposed, India's DPDP Act requires notifying the Data Protection Board and the affected users. Do not delay this while you finish the fix. See [PRIVACY.md](../handbook/PRIVACY.md).
5. **Write the post-mortem** in `MEMORY.md` → *Incidents*: what happened, why, how it was found, what changed. No blame; the system let it happen.

**Rotate a key** (any service): create the new one → update the environment variable → redeploy → delete the old one → confirm the old one fails. Removing a leaked key from git history is not rotation.

---

## 8. Recovering data

| Situation | Action |
|---|---|
| A student deleted a session by mistake | Nothing to do — the delete is immediate by design. Say so honestly |
| A migration damaged data | Restore from the dump taken before the migration ([DEPLOYMENT.md](DEPLOYMENT.md) §5) |
| Storage objects orphaned | List objects with no matching `files` row and delete them |
| A whole account must be erased | `DELETE /api/v1/me` — rows cascade and storage objects go with them |

Take a dump before anything irreversible. The free plan's automatic backups are limited and are not a plan.

---

## 9. Contacts

| | |
|---|---|
| Lead | Bipin A |
| Second | Darshan H.S. |
| Security reports | *(set an address and put it in SECURITY.md §17)* |
| Supabase project | `vibrantlearn-dev` — Tokyo, moving to Mumbai |
| Hosting | Vercel: `vibrantlearn-web`, `vibrantlearn-api` |
