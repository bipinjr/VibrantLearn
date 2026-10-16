# Build the teacher dashboard (VibrantLearn v0.5)

Read `CLAUDE.md`, `docs/handbook/SECURITY.md`, `docs/handbook/FRONTEND.md`,
`docs/handbook/DATABASE.md`, `docs/handbook/PRIVACY.md` and `docs/README.md` first.
Save this spec as `docs/handbook/TEACHER.md` before you start, then work through it
one screen at a time, stopping to report after each.

## Who this is for

Licensed teachers, tutors and final-year students who are free after 5–6 PM and want
extra income. They are not our students' adversaries and not employees — they are
deciding, each evening, whether this is worth their time.

A teacher asks four questions, in this order:
1. Will I get paid, how much, and when?
2. Will anyone actually show up?
3. How much effort is this to set up?
4. Can I get in trouble, and is my reputation safe?

Build for those four. Everything else is secondary.

## Scope for now

Build a **separate teacher dashboard** at `/teach/*`, with its own sign-in, its own
shell and its own navigation. Keep it visually part of VibrantLearn (same brand, same
tokens, same motion rules) but a distinctly different room.

**Design it so it can merge into one account later.** That means:
- Never assume a teacher cannot also be a student.
- Put the teacher's identity in its own table keyed by the auth user id, not in a
  parallel copy of `profiles`.
- Role and verification status live where the user cannot edit them: a service-role
  table or `app_metadata`. **Never `user_metadata`.**
- No teacher-only column added to `profiles`.

Record this in `MEMORY.md` → Decisions: separate dashboard now, single account later,
and what would have to change.

---

## Screens

### T1. Sign in and role
- Email + password, and Google if enabled. Same auth stack as the student side.
- After sign-in, route by role: no teacher record → onboarding; unverified →
  limited dashboard (can browse demand, cannot post); verified → full dashboard.
- Teacher onboarding: name, college or organisation, subjects they can teach
  (**picked from `syllabus_topics`, not free text**), a short bio, upload of a
  certificate or college ID, UPI ID or bank details for payouts, consent.
- Verification is manual by the team at this stage. Show status plainly:
  "Under review — usually within 2 days." Never leave it ambiguous.

### T2. Home — money first, then demand
Two things above the fold, nothing else.

**Earnings strip**
- Earned this month, pending vs paid, and the **next payout date as an actual date**,
  not "soon". Payment vagueness is what kills trust in gig work.
- Last class: subject, attendance, amount.

**Tonight's demand** — the thing no other platform can show
- Cards like: *"23 students have a DBMS exam within 48 hours. 14 flagged
  normalization as weak. Teach this → est. ₹1,400–2,000."*
- Each card has one button: **Post this class**, pre-filled.
- Sorted by (students × urgency), showing the soonest exams first.

Empty state is never "Create your first class." It is always a demand card, because
we already know what students are panicking about.

### T3. Post a class — under 60 seconds
- Pre-filled from the demand card, editable.
- Subject and topics come from `syllabus_topics` so the class attaches to real topics
  and surfaces to the right students automatically.
- Fields: subject, topics (1–4), date and time, duration, seat cap (10–40), level.
- Before confirming, show: **"If 10 join you earn ₹X. If 40 join you earn ₹Y."**
  Platform fee shown here, before posting — never revealed afterwards.
- Show the auto-cancel rule on this screen, not as a later surprise.

### T4. Runway — between posting and starting
- Live interested count with a plain state: **"7 of 10 needed to run."**
- A shareable link so a teacher can pull in their own students.
- Below 10 an hour before start: prompt to extend, lower the threshold or cancel.
- Five minutes before: a pre-flight check — mic, camera, join link works.
- At start time: interested students join first, then remaining seats open to
  everyone after a 1–2 minute grace period.

### T5. During class — almost nothing
They are teaching. Only: attendance list, a question queue, and a report button.
No analytics, no popups, no chrome.

### T6. After class
- Attendance → payout calculation, shown immediately.
- Ratings received.
- **Teaching feedback from our own quiz data:** *"11 of 23 students got transitive
  dependencies wrong."* No other platform can tell a teacher this — it is the reason
  they come back.
- One tap: **Run this again Thursday.**

### T7. Earnings and payouts
- Per class: date, subject, students, gross, fee, net, status.
- Filter by month. Downloadable statement — they need it for their ITR.
- Payout schedule and method, stated plainly. TDS handling once real money moves.

### T8. Public profile
What students see: name, subjects, bio, rating, classes taught, attendance rate,
verification badge. The teacher previews exactly what a student sees.

### T9. Account health
- Warnings received, with the reason and the evidence.
- A real appeal path. The three-strike rule cuts both ways; good teachers will leave
  the first time they are reported unfairly and cannot respond.
- Report a student, with an outcome they can see.

### T10. Settings
Payout details, notification preferences, subjects taught, availability, sign out.

---

## The demand signal

Computed from existing student data: `study_sessions.subject`, `deadline_at` and weak
topics, aggregated across all students.

**Privacy rules — non-negotiable:**
- Aggregates only. Never a username, never a name, never an individual row.
- Suppress any bucket below **5 students**. Below that it identifies people.
- Never expose which student flagged which topic.
- Computed server-side and returned already aggregated. The browser never receives
  per-student rows.

## What a teacher must never see

A teacher must never see a student's private sessions, notes, chat history, plans,
weak topics or quiz answers — not by name, not "to help better", not ever. The moment
a student suspects a teacher can read their 11 PM panic, our core promise is gone.

After a class, a teacher sees only class-level aggregates for students who joined.
Before a class, a teacher sees only the number of signups — **username only once the
class starts, nothing else.**

Add pgTAP assertions proving a teacher cannot read any student table.

## Rules and numbers

| Rule | Value |
|---|---|
| Minimum students for a class to run | 10 |
| Maximum | 40 students + 1 teacher |
| Teacher earns | ~₹2,000 per class, minus the platform fee |
| Fee | Shown before posting, always |
| Grace period for interested students | 1–2 minutes |
| Recording | None. Live only |
| Warnings before suspension | 3 |

## Data model

New tables, each with RLS, owner policies, indexes and pgTAP tests:

- `teachers` — keyed by auth user id: verification status, subjects, bio, payout
  details, rating. Payout details may be a separate restricted table.
- `classes` — teacher, subject, topic ids, start, duration, seat cap, status
  (`draft`, `open`, `running`, `done`, `cancelled`), fee snapshot.
- `class_signups` — class, student, `interested_at`, `joined_at`. Ordered signup is
  what makes the priority queue work.
- `class_attendance` — who was present, for how long.
- `ratings` — both directions, with the class id.
- `warnings`, `moderation_flags` — in the `internal` schema.
- `teacher_payouts` — **`internal` schema only.** Never client-readable.

A teacher reads their own classes and signups. A student reads open classes and their
own signups. Neither reads the other's private data.

## Decide these before writing code

Ask me, do not guess:
1. Only 8 students join — auto-cancel, or run at lower pay?
2. Teacher no-show — refund, rating hit, after how many?
3. Is the platform fee a percentage or flat?
4. What exactly does a teacher see about who signed up before the class starts?
5. Who reviews certificates, and how fast do we promise?

## Do not build

- Any view of a student's private study data.
- Tab-locking, screen monitoring, or attention tracking of students.
- Vanity analytics for teachers.
- Recording or storage of class video.
- Payment processing before we know teachers show up at all (see below).

## Build order

Build the smallest thing that answers *"will teachers actually show up?"*:

1. Teacher sign-in, onboarding, manual verification
2. Demand board (T2)
3. Post a class (T3)
4. Student-side: browse classes, mark interested, join
5. Runway + join link (T4)
6. Attendance (T5, T6)
7. Earnings view — **manual payouts over UPI for the first 50 classes**

Stop there and test with real teachers. Do not build Razorpay, automated payouts,
TDS or invoicing until the model is proven. Manual payment from a spreadsheet costs a
week; the full stack costs two months.

## Done when

- A teacher signs up, is verified, sees demand, posts a class, students join, the
  class runs, attendance is recorded and earnings are shown.
- A student browses classes, marks interested, and joins at start time with the
  priority queue working.
- pgTAP proves a teacher cannot read any student's private data, and a student cannot
  read payouts or moderation tables.
- Demand aggregates suppress buckets under 5 students.
- Every screen has loading, empty and error states; reduced-motion fallbacks; works at
  360 px.
- `docs/handbook/TEACHER.md`, `DATABASE.md`, `API.md` and `ROADMAP.md` updated;
  decisions logged in `MEMORY.md`.
