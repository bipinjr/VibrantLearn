# CONTENT_STYLE.md — voice, copy and the three languages

Every word a student reads: interface labels, errors, empty states, and AI-written notes. If the product sounds like a textbook or a marketing deck, it has failed.

Companion to [FRONTEND.md](FRONTEND.md) §7 (copy checklist) and [BRAND.md](../../brand/BRAND.md) (voice).

---

## 1. Who we sound like

A sharp final-year senior who has sat the same exams, two days before yours. They are calm, specific, slightly blunt, and they never pretend an exam is more fun than it is.

| We are | We are not |
|---|---|
| Direct | Curt |
| Encouraging | Cheerful about cramming |
| Specific | Vague or hedging |
| Honest about time | Falsely reassuring |

The student is often tired, anxious and short of time. Respect that: say the useful thing first.

---

## 2. Rules

**Sentence case everywhere.** Not Title Case, not ALL CAPS. Headings, buttons, labels, chips.

**Buttons name the action, and keep that name.** "Build my plan", "Upload notes", "Start quiz", "Replan from now". Never "Submit", "OK", "Continue" where a real verb exists. A button that says *Publish* produces a toast that says *Published*.

**Numbers are real or absent.** No "10,000+ students", no "98% pass rate", no invented testimonials. We have no users yet, and inventing proof is both dishonest and the fastest way to look like every AI landing page.

**Say time the way students do.** "9:30 PM – 10:15 PM", "11 h 16 min left", "Exam tomorrow morning". Not "in 40,560 seconds". Clock times, not just durations — a plan is something you follow by looking at a clock.

**Never shame.** No "You're behind", no streak-breaking guilt, no red warnings about time left. "Replan from now" is the whole message.

**Banned words:** supercharge, unlock, unleash, seamless, revolutionize, journey, empower, elevate, effortless, cutting-edge, game-changer, dive in, leverage, AI-powered (in UI copy — the product is AI-powered, it does not need to say so on a button).

**No emoji as icons.** No sparkles anywhere.

---

## 3. The four moments that matter most

### Errors
What happened, then how to fix it. No apology, no "Oops", no exclamation mark.

| Bad | Good |
|---|---|
| "Oops! Something went wrong 😢" | "Couldn't read this PDF. It may be scanned or locked. Try a clearer copy, or upload photos of the pages." |
| "Error 413" | "This file is over 50 MB. Split it into parts (for example by chapter) and upload each part." |
| "Rate limit exceeded" | "You've hit today's upload limit. It resets at 12:00 AM." |
| "Failed to save" | "Couldn't save that. Your work is still here — try again." |

### Empty states
An invitation, never a dead end. "No sessions yet. Start one with your next test." — with the input right there.

### Loading
Skeletons that match the real layout. If words are needed, say what is happening: "Building your plan…", not "Loading…".

### The AI's own voice
The assistant explains its reasoning in one sentence, like a person would:

> "3 blocks, about 2 hours in total, highest-mark topics first. I kept 11 PM to 6 AM free for sleep. Inheritance comes first because you said it's a weak spot."

Not: "Your personalized learning path has been generated successfully!"

---

## 4. Three languages

Two separate settings, on purpose:

| Setting | Controls | Lives in |
|---|---|---|
| **Interface language** | menus, buttons, labels | `vl_ui_lang` cookie + `localStorage` |
| **Content language** | notes, questions, explanations | `profiles.language` |

A student may want English menus with Kannada notes. That combination is common and must keep working.

### Interface text

Written as `t("English text")` from `lib/i18n/ui.ts`. The English string **is** the key, so a missing translation falls back to readable English instead of showing `nav.home.label`.

- Translate meaning, not words. A literal translation of "Build my plan" usually reads wrong; write what a Kannada or Hindi speaker would actually say.
- Keep product nouns consistent across the whole interface. Pick one word for *session*, one for *plan*, one for *checkpoint*, and never vary them.
- Leave room: Kannada and Hindi often run 20–30% longer than English. Buttons must not clip.

### Generated content

Produced in three steps so all three languages say the same checked thing: write in English → a strict examiner checks and corrects → translate that exact text.

**Technical terms stay in English, in Latin script.** This is the rule students care about most, because their exam paper and textbook use the English terms.

| Right | Wrong |
|---|---|
| `primary key ಅನ್ನು` | `ಪ್ರಾಥಮಿಕ ಕೀ` |
| `atomic values` | `ಅಟಾಮಿಕ್` |
| `functional dependency के कारण` | `प्रकार्यात्मक निर्भरता` |

Keep every identifier, keyword, code snippet and abbreviation exactly as written. Surrounding grammar is natural Kannada or Hindi; the terms are English.

### Input, in any form

Students type four ways, and all four must work:

| They type | Example | Reply in |
|---|---|---|
| English | "Java internal tomorrow 10am" | English |
| Kanglish | "nale Java test ide" | Kannada |
| Hinglish | "kal DBMS ka exam hai" | Hindi |
| Native script | "ನಾಳೆ ಜಾವಾ ಪರೀಕ್ಷೆ ಇದೆ" | Kannada |

Native digits (೧೨೩, १२३) are read as numbers. The reply uses the language the student typed in — not a setting they have to find.

### Signing off a translation

Machine translation is a draft. Before any release, a fluent speaker reads the interface and one full set of notes and answers: does this sound like a person, and are the technical terms still English? Track it in `MEMORY.md` → *Open questions* until both languages are signed off.

---

## 5. Vocabulary

One word per concept, everywhere — UI, docs, code, commits. Full list in [GLOSSARY.md](GLOSSARY.md).

| Use | Not |
|---|---|
| study session | chat, thread, conversation |
| learning path / plan | schedule, roadmap, curriculum |
| block | task, item, slot |
| checkpoint | milestone, goal, quiz point |
| notes | summary, content, material |
| important questions | likely questions, predicted questions |
| exam / test | assessment, evaluation |

---

## 6. Before you ship copy

- [ ] Sentence case
- [ ] The button names the action, and the result uses the same word
- [ ] Errors say what happened and what to do
- [ ] No invented numbers, testimonials or logos
- [ ] No banned words, no emoji, no "→" glued to a label
- [ ] Wrapped in `t()` if it appears in the interface
- [ ] Still fits at 360 px in Kannada and Hindi
- [ ] A tired student at 11 PM understands it on the first read
