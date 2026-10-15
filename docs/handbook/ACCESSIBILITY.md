# ACCESSIBILITY.md — WCAG 2.2 AA, and what it means here

The target is **WCAG 2.2 Level AA**. Not for a badge: a student using a screen reader, a keyboard, or a phone at 200% zoom on a cracked screen at midnight is exactly who this product is for.

Companion to [FRONTEND.md](FRONTEND.md) (motion, states) and [CONTENT_STYLE.md](CONTENT_STYLE.md) (clear language is an accessibility feature).

---

## 1. Non-negotiables

| Requirement | How |
|---|---|
| Keyboard reaches everything | Real `<button>`, `<a href>`, `<input>` + `<label>`. Never a click handler on a `div` — Tab skips it |
| Focus is visible | 2 px Violet ring with 2 px offset, on every interactive element, in both themes. Never `outline: none` without a replacement |
| Text contrast ≥ 4.5:1 | 3:1 for text 24 px+ or 19 px bold. Ink on Mist and Mist on Ink pass AAA |
| Buttons readable | Primary is Ember fill with **Ink** text (~6:1). White on Ember fails — never use it |
| Colour is never the only signal | Correct/wrong also carry an icon and text; the plan's "now" marker has a label, not just a tint |
| Reduced motion respected | Every animation has a fallback ([FRONTEND.md](FRONTEND.md) §4.5) |
| Touch targets ≥ 44 px | Including chips, the bottom bar and flashcard controls |
| Page language declared | `<html lang>` matches the interface language, and generated content in another language carries its own `lang` |
| Zoom to 200% | No horizontal scrolling, no clipped text, at 360 px width |
| No flashing | Nothing flashes more than three times per second, anywhere |

---

## 2. Screens that need extra care

### The chat
The assistant's reply arrives in pieces, which can either be announced well or spam a screen reader.

- The reply region is `aria-live="polite"` with `aria-busy` while streaming — so it is announced once, when it settles, not per token.
- The streaming caret is decorative: `aria-hidden`.
- Each block (plan, quiz, notes) is a landmark or heading so a screen-reader user can jump between them instead of listening to everything.
- `@file` mention autocomplete is a real combobox: `aria-expanded`, `aria-activedescendant`, arrow keys, Escape to close.

### The plan timeline
- It is a list, marked up as one — not a stack of divs.
- Each step announces its time, title and state: "9:30 PM to 10:15 PM, Inheritance and method overriding, 45 minutes, not done."
- Ticking a checkpoint is a checkbox with a real label, and the state change is announced.
- Progress rings have an accessible name and value, or are `aria-hidden` when a text equivalent sits beside them.

### The quiz
- Options are radio buttons in a `fieldset` with the question as the `legend`.
- Number keys 1–4 are a shortcut, not the only way in.
- The result is announced: "Correct. super refers to the immediate parent class." Not just a colour change.
- The explanation is associated with the question, not floating text.

### Flashcards
- Flip is a button with a label that changes: "Show answer" / "Show question".
- Swipe has keyboard equivalents (← / →) and visible buttons.
- The 3D flip reduces to a cross-fade under reduced motion.

### Forms (auth, onboarding, settings)
- Every input has a visible `<label>`. Placeholders are not labels.
- Errors are tied to the field with `aria-describedby` and `aria-invalid`, announced with `role="alert"`.
- The username field validates on blur or after a pause, never red on the first keystroke.
- Autocomplete attributes are set (`email`, `current-password`, `new-password`).

### Navigation
- A "Skip to content" link is the first focusable element.
- After a route change, focus moves to the new page's `<h1>` (`tabindex="-1"`) so a screen reader announces where it is — already handled by `PageHeader`.
- The mobile sheet traps focus while open, returns it to the trigger on close, and closes on Escape.

---

## 3. Three languages

- `<html lang>` follows the interface language.
- A note rendered in Kannada inside an English interface carries `lang="kn"` so a screen reader switches voice. The same for `lang="hi"`.
- Noto Sans Kannada and Noto Sans Devanagari get more line-height (1.7); cramped line spacing is a readability problem, not a style choice.
- Kannada and Hindi labels run 20–30% longer — check nothing clips at 360 px in all three languages.

---

## 4. Testing

**Automated, every UI pull request**
```bash
# axe via Playwright, on every changed screen, light and dark
# Lighthouse accessibility score ≥ 90 on the landing page
```
Automated tools catch perhaps a third of real problems. They are the floor, not the goal.

**By hand, before a release**
- [ ] Unplug the mouse. Complete the whole demo script with Tab, Enter, Space and arrows.
- [ ] Is focus visible at every step, and does the order follow the visual layout?
- [ ] Turn on a screen reader (NVDA on Windows, VoiceOver on Mac) and send one message, generate a plan, take a quiz.
- [ ] Turn on "reduce motion" in the OS and reload. Nothing should move except what the user is doing.
- [ ] Zoom to 200% and to 400%. Still usable?
- [ ] Check contrast of any new colour pair.
- [ ] Phone at 360 px, one hand: is anything hidden behind the composer or the bottom bar?

---

## 5. Known gaps

Tracked honestly; fix before launch.

| Gap | Where |
|---|---|
| Composer can cover controls (the quiz's "Next question" on desktop; a third of a phone screen) | [BUILD_PLAN.md](../../BUILD_PLAN.md) G1 |
| Lighthouse and axe have not been run on the current build | BUILD_PLAN G3 |
| Screen-reader pass not yet done on quiz and flashcards | this page, §4 |
| Kannada/Hindi interface not yet checked at 360 px for clipping | BUILD_PLAN G1 |

---

## 6. Why this is not optional

Nobody will turn on a screen reader to use VibrantLearn before an exam — but a student with low vision, a broken trackpad, a cheap phone, or motion sensitivity will. The same work makes the product better for everyone: visible focus helps fast typists, real buttons work with password managers, good contrast survives sunlight, and reduced motion makes the app feel calmer at midnight.
