# GLOSSARY.md — the words we use

One word per concept, in the interface, the code, the database and the docs. When a feature is named differently in three places, every conversation about it costs five minutes.

---

## Product vocabulary

| Term | Means | Not |
|---|---|---|
| **study session** | One exam's worth of work: a chat thread, its files, its plan. The unit a student starts | chat, thread, conversation, room |
| **learning path** / **plan** | The timetable built for one exam | schedule, roadmap, curriculum, syllabus |
| **block** | One timed piece of study inside a plan ("9:30–10:15 PM, Inheritance, 45 min") | task, item, slot, event |
| **checkpoint** | A tickable milestone in a plan, usually a quiz | milestone, goal, target |
| **mode** | How aggressive a plan is: `sprint`, `crash`, `steady`, `deep` | type, level, intensity |
| **notes** | AI-written study notes for one topic, in one language | summary, content, material, article |
| **important questions** | Questions likely to be asked, in 2/5/10-mark BCU style | predicted questions, question bank |
| **PYQ-style** | Questions written *in the style of* previous year papers. We never reproduce real papers | previous year questions |
| **quiz** | Multiple choice with explanations, scored on the server | test, assessment |
| **flashcards** | Front/back cards with Leitner boxes | cards, revision cards |
| **topic** | One row of `syllabus_topics`, with weightage, difficulty and estimated minutes | chapter, lesson, concept |
| **unit** | A group of topics, as the university numbers them | module, section |
| **weightage** | 1–10, how likely a topic is to be examined. Drives what the scheduler puts first | importance, priority score |
| **demo mode** | The whole app on sample data, no account, no database. Off in production, always | guest mode, trial |

## Technical vocabulary

| Term | Means |
|---|---|
| **RLS** | Row Level Security. Postgres decides which rows a student may see; the app never filters by hand |
| **`served_from`** | How an assistant reply was produced: `ml` (local code), `cache`, or `llm`. The token-saving metric |
| **intake** | Everything that happens to a message before an answer: normalise, intent, entities, urgency |
| **intent** | What the student is asking for: `make_plan`, `make_quiz`, `ask_about_file`, … |
| **urgency** | How long until the exam, which picks the mode |
| **the scheduler** | Deterministic code that builds a plan. Never an LLM — a timetable must be correct and identical every time |
| **retrieval** | Finding the right chunks of a student's own files to answer from |
| **chunk** | ~800 characters of an uploaded file, indexed for search |
| **source chip** | The "Unit3_Inheritance.pdf, p. 4" label under a grounded answer |
| **block (reply)** | One renderable piece of an assistant message: text, plan, notes, questions, quiz, flashcards, sources. Distinct from a plan block |
| **prompt version** | A string like `notes-v4`, part of every cache key, so changing a prompt invalidates exactly the right entries |
| **the internal schema** | `internal.*` — cache, rate limits, audit, usage. Never exposed to any client |
| **signed upload URL** | A one-time URL the API issues after validating a file, so bytes go browser → Storage without passing through a function |

## Languages

| Term | Means |
|---|---|
| **interface language** | The language of menus and buttons. Cookie `vl_ui_lang` |
| **content language** | The language of notes and explanations. `profiles.language` |
| **Kanglish** | Kannada written in English letters: "nale Java test ide" |
| **Hinglish** | Hindi written in English letters: "kal DBMS ka exam hai" |
| **native script** | Kannada (ಕನ್ನಡ) or Devanagari (हिन्दी) characters |

## Indian education terms

For anyone reading this who is not from the system.

| Term | Means |
|---|---|
| **internal** | A small test during the term, set by the college. Usually what a student is panicking about |
| **semester exam** | The big university exam at the end of a semester |
| **unit test** | A test on one unit of the syllabus |
| **BCA / BCom / BSc** | Three-year undergraduate degrees. BCA is Computer Applications |
| **PU** | Pre-University, the two years before a degree |
| **BCU** | Bengaluru City University |
| **SEP / NEP** | State and National Education Policy syllabus schemes |
| **PYQ** | Previous Year Questions |
| **2/5/10-mark question** | Indian exam papers label questions by marks, which sets how long the answer should be |

## People

| Term | Means |
|---|---|
| **student** | The person the product is for. Not "user" in UI copy |
| **teacher** | Someone who teaches a live class (v0.5). Not "instructor", "tutor" or "creator" |
| **the team** | Bipin A and Darshan H.S. |

---

Adding a word? Put it here in the same commit, and use it everywhere — including commit messages and table names.
