# PRIVACY.md — what we store, why, and for how long

VibrantLearn holds students' notes, chat history and study habits. Some of them are minors. This page is the engineering commitment behind the privacy notice students actually read.

Legal frame: India's **Digital Personal Data Protection Act, 2023 (DPDP)**. We are the Data Fiduciary; the student is the Data Principal.

> Not legal advice. Before taking real money or real scale, have a lawyer read the privacy notice and the terms.

---

## 1. Principles

1. **Collect only what the product needs.** Every field must earn its place.
2. **Say so before collecting.** Consent is recorded once, at onboarding, as `profiles.consent_at`.
3. **Use it only for what we said.** Study help. Not advertising, not resale, not model training.
4. **Let them take it and leave.** Export and delete are features, not support requests.
5. **Protect it properly.** [SECURITY.md](SECURITY.md) is the other half of this page.

---

## 2. What we store

| Data | Why | Where | Kept |
|---|---|---|---|
| Email, password hash | Sign in | Supabase Auth | Until the account is deleted |
| Google profile (if used) | Sign in | Supabase Auth | Same |
| Username | Identity in the app | `profiles` | Same |
| Course, semester, university, scheme | Picking the right syllabus | `profiles` | Same |
| Language, style, formats | Shaping replies | `profiles` | Same |
| Consent timestamp | Proof of lawful basis | `profiles.consent_at` | Same |
| Chat messages | The product | `messages` | Until the session or account is deleted |
| Study plans, checkpoints | The product | `study_plans`, `plan_checkpoints` | Same |
| Uploaded files | The student's own notes | Storage, private bucket | Same |
| Extracted text chunks | Answering from their notes | `file_chunks` | Same |
| Quiz attempts, flashcard reviews | Progress and revision | own tables | Same |
| Generated notes and questions | Caching, so we do not pay twice | `generated_content` | Same |
| Salted IP hashes | Abuse limits | `internal.rate_limits`, `audit_log` | 180 days |
| Usage events (tokens, latency, `served_from`) | Cost and performance | `internal.usage_events` | 90 days |
| Waitlist email | Telling teachers when we launch | `waitlist` | Until they ask to be removed |

### What we deliberately do **not** store

- Raw IP addresses — only a salted hash, and the salt is not in the database.
- Chat text or file contents in logs. Ever.
- Payment details — there are none yet; when there are, a payment provider holds them, not us.
- Location, contacts, device identifiers, analytics cookies, third-party trackers.
- Anything about a student's performance shared with anyone else.

---

## 3. Who can see a student's data

| Who | Can see |
|---|---|
| The student | Everything of their own |
| Another student | **Nothing.** Enforced by Row Level Security, proven by 37 pgTAP tests |
| Teachers (v0.5) | Only what a student submits to their class — never private sessions |
| Us (the team) | Technically yes, through the Supabase dashboard. We do not read student content except when a student asks for help with a specific problem |
| Groq | Only what is sent in a prompt (see §4) |
| Anyone else | No. We do not sell, share or rent data |

The honest line in the privacy notice: *"Only you can see your sessions and files. Our team can technically access the database to keep the service running, and we don't read your notes."*

---

## 4. What goes to the AI, and what does not

Groq is a processor. Keep what reaches it to the minimum.

**Sent:** the topic name (looked up server-side from the syllabus, not typed by the student), the question text for an open question, and up to six retrieved chunks from the student's own files when they ask about those files.

**Never sent:** email, username, real name, course, college, other students' content, anything from the database that is not part of this answer.

Retrieved file text is wrapped in delimiters and marked as untrusted data, with an instruction to ignore any instructions inside it ([SECURITY.md](SECURITY.md) §9).

**We do not train models on student data.** The intent classifier trains only on `data/intents.csv`, which is written by the team and contains no student content. If that ever changes it needs separate, explicit, opt-in consent — and it should not change.

---

## 5. Student rights, and how each is met

| Right (DPDP) | How |
|---|---|
| Notice before collection | Privacy page linked at sign-up; consent checkbox at onboarding step 1 |
| Access and portability | Settings → Export my data (JSON: profile, sessions, messages, plans, content, attempts, file metadata) |
| Correction | Settings edits the profile; any message or plan can be deleted with its session |
| Erasure | Settings → Delete my account: sessions revoked, every storage object removed, the auth user deleted, rows cascade |
| Withdraw consent | Deleting the account withdraws it; a narrower withdrawal means deleting the sessions concerned |
| Grievance redressal | A named contact address, answered within a stated time |

**Deletion is real deletion.** No soft-delete flag that keeps the data. The one exception is `internal.audit_log`, which keeps the fact that an account was deleted (with the user id, no content) because a security log that can be erased by the subject is not a security log.

---

## 6. Minors

Some users will be under 18. Under DPDP, processing a child's data needs verifiable parental consent, and tracking or targeted advertising at children is prohibited.

What we do today:
- No advertising, no tracking, no profiling for anything other than study help.
- No behavioural data sold or shared.
- We do not ask for date of birth, so we do not knowingly hold a child's age.

Before taking payments or launching publicly, decide and write down: do we set a minimum age, or do we build parental consent? Until that is decided, the product stays free of anything that would count as tracking or targeting.

---

## 7. Retention and clean-up

| Data | Removed |
|---|---|
| Account and everything in it | Immediately on deletion |
| A session and its files | Immediately on deletion |
| `internal.llm_cache` | 30 days (`expires_at`) |
| `internal.usage_events` | 90 days |
| `internal.audit_log` | 180 days |
| Waitlist email | On request, or when the teacher side launches and they are contacted |

A scheduled job (`pg_cron` or a daily function) should enforce the three `internal` windows. Until it exists, do it manually at the weekly check and note it in the runbook.

---

## 8. Sub-processors

| Who | What they hold | Where |
|---|---|---|
| Supabase | Database, auth, files | Tokyo today, Mumbai before launch |
| Vercel | Hosting, request logs | Global edge |
| Groq | Prompt contents in transit | US |
| Resend (planned) | Email addresses for auth mail | US/EU |

This list belongs in the public privacy notice too. Moving the database to Mumbai is both a latency fix and a data-residency improvement.

---

## 9. Engineering checklist

Before any change that touches student data:

- [ ] Is this field necessary, or just interesting?
- [ ] Is it covered by the privacy notice? If not, update the notice **before** shipping
- [ ] Does it appear in the export?
- [ ] Is it removed on account deletion?
- [ ] Could it end up in a log, an error message or an AI prompt?
- [ ] Does it have a retention period?
- [ ] Is it protected by RLS, with a test?

Before launch:

- [ ] Privacy notice reviewed by a lawyer
- [ ] Grievance contact named and monitored
- [ ] Retention jobs running
- [ ] Breach-notification steps rehearsed ([RUNBOOK.md](../ops/RUNBOOK.md) §7)
