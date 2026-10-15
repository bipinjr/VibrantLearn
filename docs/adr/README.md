# Architecture Decision Records

A decision worth writing down is one where a reasonable person would later ask *"why on earth is it done this way?"*. Write the answer once, here, instead of re-deriving it in six months.

---

## Where decisions live

| Kind | Where |
|---|---|
| Day-to-day decisions | `MEMORY.md` → *Decisions* — one line, dated, with the reason |
| Decisions with real consequences | A numbered ADR in this folder |

A one-line entry is enough for "we use pnpm". An ADR is for anything that is expensive to reverse, constrains future work, or was chosen over a serious alternative — the kind of thing a new teammate or an examiner will ask about.

**Write an ADR when the decision:**
- changes the shape of the data or the trust boundaries
- trades one real downside for another (there is no obviously right answer)
- was taken under a constraint that will not be obvious later ("the disk was full", "the API wasn't hosted yet")
- would otherwise be quietly undone by someone who did not know why

## How

1. Copy `0000-template.md` to `NNNN-short-title.md`, next number, kebab-case.
2. Fill it in. Half a page. If it needs three pages, the decision is probably two decisions.
3. Add a line to the index below and to `MEMORY.md` → *Decisions*.
4. Commit it with the change it describes.

**Never edit an accepted ADR to change the decision.** Write a new one that supersedes it, and mark the old one `Superseded by NNNN`. The record of what we once believed is the point.

## Status values

`Proposed` · `Accepted` · `Superseded by NNNN` · `Deprecated`

---

## Index

*(Empty. The decisions below are currently recorded as one-liners in `MEMORY.md` → Decisions, and are the strongest candidates for being written up properly.)*

| # | Title | Status |
|---|---|---|
| — | — | — |

### Candidates, from `MEMORY.md`

| Decision | Why it deserves an ADR |
|---|---|
| Supabase for database, auth and storage | Shapes the whole trust model; migrating later is expensive |
| Reads go browser → Postgres under RLS; writes that need judgement go through the API | The core access-control decision. Everything else follows from it |
| Signed-in students write their own messages and plans directly, while the API is unhosted | A temporary compromise that must be revisited, not inherited silently |
| The scheduler is deterministic code, never an LLM | Correctness, cost and speed, all at once |
| Local parser and scheduler before any LLM call, with aggressive caching | The reason the product works on a free tier |
| Demo mode with its own store, off in production by construction | A second data path is a real risk; the reasoning should outlive the author |
| Notes written in three Groq calls (write → examiner check → translate) | Chosen after a one-shot version produced a factually wrong example |
| Nonce-based CSP on every page, which turns off Partial Prerendering | A real performance cost accepted for a security gain |
| Uploads go browser → Storage via signed URL | Forced by a platform limit that will not be obvious later |
| Full-text search plus TF-IDF instead of embeddings | Cheaper and explainable; revisit when pgvector is affordable |
| Interface language separate from content language | Looks like duplication until you meet a student who wants English menus and Kannada notes |
