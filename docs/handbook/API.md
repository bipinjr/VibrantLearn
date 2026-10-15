# API.md — endpoint contracts

Every HTTP surface in VibrantLearn: what it takes, what it returns, who may call it, and what limits it.

Read with: [SECURITY.md](SECURITY.md) (auth and limits) · [DATABASE.md](DATABASE.md) (what the rows mean) · [ARCHITECTURE.md](ARCHITECTURE.md) §2 (the request walk-through).

---

## 1. Rules that apply to every endpoint

**Base path** `/api/v1`. The browser calls it same-origin; `next.config.ts` rewrites to the API project, so there is no CORS and cookies stay first-party.

**Auth.** Everything except `/health` and `/waitlist` requires `Authorization: Bearer <Supabase access token>`. The API verifies the signature against the project's JWKS and checks `exp`, `aud = authenticated`, `iss`, and that the token is not anonymous. A valid token is not authorisation: every handler re-checks that the `session_id`, `file_id` or `plan_id` in the request belongs to the caller, even though RLS would also catch it.

**Validation.** Pydantic models with `extra="forbid"` and an explicit max length on every string. Unknown fields are an error, not ignored.

**Errors.** One shape, always:

```json
{ "error": { "code": "rate_limited", "message": "Wait a moment and try again.", "request_id": "a1b2c3…" } }
```

`message` is written for a student to read. No stack traces, no SQL, no dependency versions. Every response carries `X-Request-ID`.

| Status | `code` values |
|---|---|
| 401 | `unauthorized` |
| 403 | `forbidden` |
| 404 | `not_found`, `unknown_topic` |
| 409 | `username_taken` |
| 413 | `file_too_large` |
| 422 | `invalid_input`, `consent_required` |
| 429 | `rate_limited`, `llm_busy` (with `Retry-After`) |
| 502 / 504 | `llm_error`, `llm_empty`, `llm_invalid`, `llm_timeout` |
| 500 | `internal` |

**Rate limits.** Fixed-window counters in `internal.rate_limits`, keyed by **user id** for signed-in calls and by a salted IP hash for anonymous ones. Over the limit → `429` with `Retry-After`.

**Logging.** Structured JSON with `request_id`, path, status, duration. Never the query string, file contents, chat text, tokens or raw IPs.

**Docs.** `/api/v1/docs` and `/api/v1/openapi.json` exist in development only.

---

## 2. Status

| State | Meaning |
|---|---|
| ✅ | built and tested |
| 🟡 | partly built |
| ⬜ | specified here, not built — see [BUILD_PLAN.md](../../BUILD_PLAN.md) |

---

## 3. Endpoints

### Health

**`GET /health`** ✅ — no auth. `{ "status": "ok" }`. Nothing else: no versions, no dependency status.

---

### Account

**`GET /me`** ⬜
Returns the profile plus remaining allowances.
```json
{ "profile": { "username": "bipin.jr", "course": "BCA", "semester": 3,
               "language": "kn", "style": "short", "formats": ["quiz"],
               "onboarded": true },
  "limits": { "messages": { "used": 4, "limit": 30, "resets_at": "…" },
              "uploads":  { "used": 2, "limit": 20, "bytes_left": 268435456 } } }
```

**`PATCH /me`** ✅
Partial profile update. Any subset of `username`, `consent`, `full_name`, `university`, `course`, `semester`, `scheme`, `language`, `style`, `formats` (max 6), `finish_onboarding`.

- Creating the row requires a `username` **and** `consent: true` → otherwise `422 consent_required`.
- `username` is validated against the shared rules (pattern, edges, doubles, reserved words) before it reaches SQL.
- Duplicate → `409 username_taken`.
- Returns `{ "profile": { … } }`.

**`GET /usernames/available?u=<name>`** ✅
`{ "available": true, "reason": null }` or `{ "available": false, "reason": "That name is taken." }`.
Limit: 30/min per user. Never reveals *whose* name it is.

**`GET /me/export`** ⬜
The student's whole record as JSON: profile, sessions, messages, plans, generated content, quiz attempts, file metadata (not file bytes). DPDP erasure/portability basics.

**`DELETE /me`** ⬜
Revoke all sessions → delete every storage object under `{user_id}/` → delete the auth user (cascade clears the rest) → sign out. Irreversible; the UI requires a typed confirmation. Writes `account_deleted` to `internal.audit_log`.

---

### Study sessions

**`POST /sessions`** 🟡 *(client writes directly today)*
`{ "id"?: uuid, "title"?: string }` → the created session. The client may supply the id so navigation is instant; `user_id` always comes from the token.

**`POST /sessions/{id}/messages`** ⬜ — the main endpoint
`{ "text": string (≤ 4000), "language"?: "en"|"kn"|"hi" }`

Returns **`text/event-stream`**, one event per block as it is produced:

```
event: block
data: {"type":"text","text":"Got it: DBMS, tomorrow. How many hours can you study?"}

event: block
data: {"type":"followup","field":"hours","chips":["2 hours","3 hours","4 hours"]}

event: done
data: {"messageId":"…","servedFrom":"ml"}
```

Block types: `text`, `followup`, `plan`, `notes`, `questions`, `quiz`, `flashcards`, `sources`.

Pipeline: parse → entities → urgency → one follow-up if something essential is missing → cache → local answer → LLM only if needed. The finished message is persisted with `served_from`. A dropped connection must not leave a half-written row.
Limit: 30 per 10 minutes.

**`DELETE /sessions/{id}`** ⬜
Verify ownership → delete storage objects under `{user_id}/{session_id}/` → delete the row (cascade clears messages, files, chunks, plans). Returns `204`.

---

### Files

**`POST /sessions/{id}/files/upload-url`** ⬜
`{ "name": string, "mime": string, "size_bytes": int }`

Validates extension allowlist, mime, `size_bytes ≤ MAX_UPLOAD_MB`, daily count and byte quota. Creates the `files` row with status `uploaded`. Returns a one-time signed upload URL:

```json
{ "file_id": "…", "upload_url": "https://…", "expires_in": 300,
  "path": "{user_id}/{session_id}/{file_id}/unit3-inheritance.pdf" }
```

Over the size cap → `413` with the split-the-file message. The browser PUTs the bytes directly to Storage; they never pass through a function (Vercel caps a request body at 4.5 MB).

**`POST /files/{id}/process`** ⬜
Downloads the object and verifies it before trusting anything: real size, **magic bytes** against the declared type, SHA-256, dedupe on `(session_id, sha256)`. Then extracts text with hardened parsers (`defusedxml`; zip-bomb and page caps), chunks it, and writes `file_chunks`.

Returns `{ "status": "ready", "pages": 18, "chunks": 42 }` or `{ "status": "failed", "error": "…" }`. A mismatch deletes the object, marks the row `failed` and writes an audit entry.

**`GET /files/{id}/download-url`** ⬜
Short-lived signed URL (≤ 5 min), `Content-Disposition: attachment`. Uploaded HTML and SVG are never rendered inline.

**`DELETE /files/{id}`** ⬜ — removes the object, the row and its chunks.

---

### Plans

**`POST /plans`** ⬜
`{ "session_id": uuid, "subject": string, "deadline_at": iso, "hours_available"?: number, "weak"?: string[] }`
Runs the deterministic scheduler — no LLM — and returns the plan with its steps. Identical input returns the cached plan.
Limit: 10/hour.

**`POST /plans/{id}/replan`** ⬜
Re-runs the scheduler from now. Finished steps stay ticked; everything else is rescheduled, highest-weightage first. Returns the updated plan and one sentence explaining what moved.

**`PATCH /plans/{id}/checkpoints/{ord}`** 🟡 *(client writes `done_at` directly today)*
`{ "done": true }`. Only `done_at` is writable, enforced by a column grant.

---

### Study content

**`POST /content`** 🟡 *(`/api/notes` in Next covers notes only)*
`{ "kind": "notes"|"important_questions"|"pyq"|"quiz"|"flashcards",
   "subject": string, "topic": string,
   "language"?: "en"|"kn"|"hi", "style"?: "short"|"detailed",
   "file_id"?: uuid }`

The client names a **topic from the syllabus**, never free text — the server looks it up, so nothing from the browser reaches the prompt. With `file_id`, the student's own chunks are retrieved and passed as delimited, explicitly-untrusted data.

Generation is three steps for accuracy: write in English → a strict examiner checks and corrects → translate that exact text, keeping technical terms in English. Output is schema-validated with one repair retry, then a graceful fallback to the syllabus-derived version.

```json
{ "content_id": "…", "kind": "notes", "servedFrom": "llm",
  "payload": { "en": "…", "kn": "…", "hi": "…" },
  "sources": [{ "file": "Unit3_Inheritance.pdf", "page": 4 }] }
```
Limit: 40/hour. Unknown topic → `404 unknown_topic`.

**`POST /quiz/{content_id}/attempts`** ⬜
`{ "answers": [{ "q": 0, "choice": 2 }] }` → `{ "score": 4, "total": 5, "wrong_topics": ["Interfaces"] }`.
**Scored on the server.** The client never decides the score.

---

### Public

**`POST /waitlist`** ✅
`{ "email": string, "source"?: string }` → `202 { "ok": true }`.
Same answer whether or not the address was already there — safe on double submit, and no way to probe who has signed up. Limit: 5/hour per IP.

---

## 4. Next.js route handlers (interim)

These live in `apps/web/app/api/` only while the FastAPI service is unhosted. They move to `/api/v1` in [BUILD_PLAN.md](../../BUILD_PLAN.md) D1.

| Route | Who may call | Notes |
|---|---|---|
| `POST /api/notes` ✅ | signed-in (verified JWT) or local demo | Syllabus topic → notes in en/kn/hi. Caches per process (a shared DB cache is the upgrade) |
| `POST /api/demo/chat` ✅ | same | Open questions. 20/min, 20 s timeout, one 429 retry |

Both use `lib/server/groq.ts`: the key is server-only, errors are logged as status and code only — never the key or the prompt.

---

## 5. Contract checklist for a new endpoint

- [ ] Auth required, and ownership re-checked in the handler
- [ ] Pydantic model with `extra="forbid"` and max lengths
- [ ] A rate-limit bucket, keyed by user id
- [ ] The standard error shape, with messages a student can read
- [ ] No secret, no other user's data, no internal detail in the response
- [ ] Tests: happy path, unauthenticated, **cross-user**, over-limit, malformed body
- [ ] Listed in this file with its status marker
