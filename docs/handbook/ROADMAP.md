# ROADMAP.md — where VibrantLearn goes after v0.4

v0.4 is the student side: a plan, notes, questions, quizzes and flashcards in three languages. This page holds everything we have agreed comes after it, so today's schema and architecture leave room for it.

> **16 Oct 2026, owner decision:** every version below is now being built, in order, after v0.4 is finished. Choices made for the open questions: Jitsi for video, **no payments in the prototype** (earnings tracked as "to be paid"), 20% platform fee, auto-cancel under 10 students, refund + warning on teacher no-show, and the mobile app as an installable web app (PWA). See MEMORY.md → Decisions.

The college submission is still v0.4. Anything marked **Later** has no date.

---

## v0.4 — Student side *(current)*

Finishing it is [BUILD_PLAN.md](../../BUILD_PLAN.md). Done when: uploads and file search are real, AI writes questions and quizzes, the Python ML intake exists, limits and account deletion work, and it is deployed with a security review behind it.

---

## v0.5 — Teachers and live classes

**Status (16 Oct):** MVP built: apply to teach (manual verification), post class, interested queue, Jitsi room, auto-cancel under 10, no-show warnings, earnings tracked "to be paid". Not yet: ratings, reports, moderation bot, certificate upload, payouts.

The second half of the original idea: college teachers, tutors and professionals who are free after 5 PM and want to teach, and students who currently search YouTube at midnight.

### How it works

A teacher posts a class — subject, topic, time, level. Students see it and mark **Interested**. At the start time, interested students join first (first-interested, first-served), with a 1–2 minute grace period before the remaining seats open to anyone.

| Rule | Value |
|---|---|
| Minimum students for a class to run | 10 |
| Maximum | 40 students + 1 teacher |
| Teacher earns | about ₹2,000 per class, minus the platform fee |
| Recording | none — live only |

### What has to be built

| Area | Work |
|---|---|
| Teacher identity | A role in `app_metadata` or a service-role `user_roles` table. **Never** `user_metadata`, which the user can edit |
| Certification | Upload and manual verification before a teacher may post |
| Class lifecycle | `classes`, `class_signups`, `class_attendance` tables with their own RLS |
| Interest queue | Ordered signup, grace period, seat release |
| Live video | Jitsi embedded, with a second provider configured as a fallback |
| Earnings | A dashboard a teacher trusts: per class, per month, pending vs paid |
| Payments | A provider (Razorpay or similar) holds card data; we never do |
| Payouts | `teacher_payouts` in the `internal` schema; TDS and invoicing need an accountant |
| Ratings | Students rate teachers, teachers rate students; both visible and both affecting standing |
| Moderation | A bot watching live classes for abuse: 3 warnings, then suspension. Flagged by username, never by IP |
| Reporting | A student or teacher can report a session; a human reviews |

### Decisions still open

- Is the platform fee a percentage or flat? Shown to teachers before they post, either way.
- Refunds when a class is cancelled or a teacher does not appear.
- What happens to a class that does not reach 10 students — auto-cancel, or run at lower pay?
- Who is liable for what a teacher says in a live class. This needs the terms of service written properly.

### Why it is not v0.4

It is a two-sided marketplace. It needs real teachers, real money and real moderation, and every one of those is a product on its own. The student side has to be good enough that students come back daily first — otherwise there is nobody for a teacher to teach.

---

## v0.6 — Making it stick

| Feature | Why |
|---|---|
| Adaptive difficulty | Quiz results feed back into what the plan schedules next |
| Score prediction | "At this pace you'll cover 70% of the high-weightage topics" — honest, not flattering |
| Spaced repetition across subjects | The flashcard boxes already exist; schedule across sessions, not within one |
| Peer study groups | Two or three students preparing for the same exam share a plan |
| Notifications | Class reminders, checkpoint nudges, suspension notices. Email and push. Easy to switch off, never guilt-based |
| Referrals | Students and teachers invite others for a small bonus |
| Teacher analytics | Which topics the class struggled with, so the next session can fix it |

---

## v1.0 — Beyond one university

| Feature | Notes |
|---|---|
| More universities and boards | VTU, Bangalore University, state PU boards. Rows, not code ([ARCHITECTURE.md](ARCHITECTURE.md) §4) |
| More languages | Tamil, Telugu, Marathi, Bengali. The i18n and prompt structure already allow it |
| Mobile app | Native, with offline plans and notes — the single most requested thing in a country with patchy data |
| Institutional accounts | A college buys it for a department; bulk onboarding, teacher dashboards, cohort reporting |
| Verified syllabus partnerships | Working with departments so the syllabus data is official, not compiled |

---

## Later — only if the product earns the right

- Recorded class library and on-demand playback
- Peer tutoring between students
- Question banks contributed by teachers
- An API for colleges to embed VibrantLearn
- International syllabi (IB, A-Levels, AP)

---

## Deliberately not doing

| Not doing | Why |
|---|---|
| Tab-locking or watching a student's screen during a class | Invasive, trivially bypassed, and it breaks trust with the people we are supposed to help. Measure attention gently or not at all |
| Selling or sharing student data | [PRIVACY.md](PRIVACY.md). It would end the product |
| Training models on student notes | Same |
| Scraping copyrighted question papers | We generate questions *in the style of* past papers. A student may upload their own papers |
| Streaks, shame mechanics, loss aversion | Exam stress is already enough |
| Ads | Especially with minors using the product |
| Promising exam scores | We can promise a plan and good material. We cannot promise marks |

---

## How this shapes v0.4

Design decisions made now so none of the above needs a rewrite:

- `profiles` is the one identity row. A teacher is a profile with a role, not a parallel user system.
- Roles will live where the user cannot edit them.
- The `internal` schema already exists for payouts, moderation flags and audit.
- The syllabus is data, so new universities and subjects are rows.
- Content generation is already language-parameterised, so a fourth language is a prompt and a font.
- `served_from` and `usage_events` already record cost per answer — which is what tells us whether any of this can be afforded at scale.
