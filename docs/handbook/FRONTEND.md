# FRONTEND.md — VibrantLearn UI, motion and quality bar

Read with `brand/BRAND.md` before writing any UI. This file decides how the product looks, moves and feels. If a screen you build could be mistaken for a generic AI-generated SaaS template, it is not done.

---

## 1. What "AI slop" means here (banned)

These are the tells of generated UI. None of them ship.

**Layout and decoration**
- Hero = big headline + subtext + two buttons + floating gradient blob. Banned.
- Grids of identical rounded cards with the same grey shadow and an icon in a tinted circle on top.
- Gradient washes, glowing orbs, mesh backgrounds, glassmorphism panels as decoration.
- "Bento grid" feature sections with fake mini-screenshots.
- Fake logos ("Trusted by students at…"), fake testimonials, fake stats ("10,000+ students", "98% pass rate"). We have no users yet; do not invent proof.
- Section after section that fades and slides up as you scroll.
- Emoji used as icons; sparkles ✨ anywhere; robot or brain illustrations for "AI".

**Typography and copy**
- ALL-CAPS tracked eyebrow labels above headings.
- One word of a headline in a gradient or a different colour.
- "→" glued onto every link and button.
- Words: *supercharge, unlock, unleash, seamless, revolutionize, journey, empower, elevate, effortless, cutting-edge, game-changer, AI-powered* (in UI copy), *Let's dive in*.
- Middle-dot meta strings everywhere ("Fast · Smart · Free").

**Components**
- Default shadcn look left untouched (same radius, same grey, same focus ring as every other app).
- Spinners for page loads; centred spinner on a blank screen.
- Modals for things that should be inline.
- Toasts for every action, including ones the user can already see happened.
- Chat bubbles that look like a messaging app for an AI tool that produces structured study material.

**Test before merging any screen:** cover the logo. If it could be any other AI startup's page, redo it.

---

## 2. What makes VibrantLearn look like itself

1. **The plan is the hero.** The most distinctive thing we make is a timed study path with checkpoints. Show real plans (realistic BCA content: "Unit 3: Inheritance and polymorphism, 45 min") instead of abstract illustrations.
2. **Ink and paper, with one hot accent.** Mist paper, Ink text, Ember for "now / next / act". Violet for links and focus. Leaf only for "done". Colour carries meaning; it is never decoration.
3. **Type does the talking.** Bricolage Grotesque headlines set large and tight. Figtree for everything you read. Kannada and Devanagari set with care (Noto, larger line-height).
4. **Student-real copy.** Written like a senior who has survived the same internals: "Java internal at 10 tomorrow? You have about 6 usable hours. Here's how to spend them."
5. **Calm density.** The app is a tool used under stress. Generous spacing, clear hierarchy, nothing blinking.

---

## 3. Screen-by-screen direction

### Landing `/`
- **Above the fold:** left: headline (Bricolage 800, ~64–88 px desktop), one sentence, one primary button ("Build my study plan"), one quiet text link ("See how it works"). Right: the **live plan demo**: a real-looking input types "Java internal tomorrow 10am, BCA SEP" and a study path draws itself with timed blocks and checkpoints. This is the page's one orchestrated animation (see §5.4).
- **How it works:** three steps, numbered because they are a sequence: Tell us the exam → Get your hours planned → Study, quiz, tick off. Each step shows the actual UI fragment, not an icon.
- **What you get:** one wide example plan opened up, with notes in Kannada, an important-questions list and a quiz card. Annotations in the margin, not cards.
- **Your notes, your answers:** upload demo with a file chip and a sourced answer.
- **Privacy, plainly:** three short statements (we don't sell data, you can delete everything, we don't train on your files).
- **Teachers, coming soon:** one line + email field.
- **Footer:** wordmark, links, "Made in Bengaluru".
- No testimonials, no stats, no logos until they are real.

### Auth and onboarding
- Split layout: form on the left, on the right a single large plan fragment that updates as they choose preferences (pick Kannada → sample note switches to Kannada; pick Short → it shortens). The preview *is* the explanation.
- Username field validates live with a calm inline message, never a red flash on the first keystroke.

### Dashboard `/app`
- Left rail (collapsible) + main column. No widget soup.
- Top of main: "Next up" strip: the next checkpoint, time left until the deadline, one action ("Start block").
- Then active plans as **horizontal path previews** (miniature timelines), then recent sessions as a simple list with subject and deadline chips.
- Empty state: one input, "What's your next test?", with 3 suggestion chips drawn from their profile.

### Study session `/app/s/[id]`
- Not a messenger. User messages are compact right-aligned lines; assistant output is **document-like blocks** full width: plan card, notes, question list, quiz, flashcards, each with a small toolbar (Copy, Regenerate in another language, Add to plan).
- Right side panel (or bottom sheet on mobile): this session's files with status, and the active plan.
- Source chips under grounded answers ("Unit3_Inheritance.pdf · p. 4").
- Composer: multi-line, `@` file mentions with autocomplete, attach button, drag-and-drop overlay that names the session ("Drop to add to Java internal").

### Plan view
- Vertical route line on the left, blocks to the right. Current block highlighted in Ember; done blocks in Leaf with a tick; future blocks muted.
- Time labels in the student's real clock time ("9:30 PM – 10:15 PM"), not durations only.
- "Replan from now" when behind schedule, explaining what moved.

### Quiz
- One question at a time, large, options as full-width buttons with keyboard shortcuts 1–4.
- After answering: correct option fills Leaf, chosen wrong option outlined Rose, explanation slides open below. Score summary at the end with "Revise these" linking back to the topics.

### Flashcards
- Single card centred, flip on click/Space, swipe or ←/→ for Again / Know it. Progress as a thin line, not a percentage badge.

### Files
- Table on desktop (name, session, size, status, added), list on mobile. Status chips: Uploading (real %), Checking, Processing, Ready, Failed with the reason.

### Settings
- Plain grouped form. Usage meter as a slim bar with numbers. Danger zone at the bottom with typed confirmation for account deletion.

---

## 4. Motion system

> **Update 2026-10-08 (Bipin A):** the product should feel app-like with richer motion than §4.1 #2–3 allow. Now in use: scroll-driven landing reveals (`.scroll-in`, `.scroll-recede`, scroll progress line), staggered entrances (`.rise` with `--i`), page view transitions, tick bursts, quiz fills, flashcard flip/swipe. Everything stays compositor-only, declares `--animation-reduced`, and nothing loops except loading indicators. The rest of this section still applies.

### 4.1 Principles
1. **Motion explains change.** It shows where something came from, where it went, or what just happened. If it does none of these, cut it.
2. **One showpiece.** The landing hero path drawing. Everything else is quick and quiet.
3. **Responds to the user.** After the hero, nothing moves unless the user did something (or content they asked for is arriving).
4. **Fast.** Most UI motion is 120–240 ms. Nothing in the app over 400 ms except the hero.
5. **Compositor-only.** Animate `transform`, `opacity`, `clip-path`, `filter` (sparingly). Never animate `width`, `height`, `top`, `left`, `margin` on the main thread. For height changes use `grid-template-rows: 0fr → 1fr` or `interpolate-size: allow-keywords`.
6. **Reduced motion is a first-class design**, not an afterthought (§4.5).

### 4.2 Tokens (put in `globals.css`)

```css
:root {
  --dur-instant: 90ms;   /* press feedback */
  --dur-fast: 150ms;     /* hovers, toggles, chips */
  --dur-base: 220ms;     /* panels, menus, accordions */
  --dur-slow: 320ms;     /* route transitions, sheets */
  --dur-hero: 1600ms;    /* landing path draw only */

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);      /* entering */
  --ease-in: cubic-bezier(0.55, 0, 1, 0.45);       /* leaving */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* moving on screen */
  /* gentle spring for confirmations (ticks, correct answers); fallback first */
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --ease-spring: linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077 22.4%, 1.121 25.5%, 1.14 28.6%, 1.129 32.6%, 1.04 41.2%, 1.008 46.4%, 0.985 52.8%, 0.996 70.8%, 1);
}
```

Leaving is faster than entering (exit ≈ 70% of enter duration).

### 4.3 Tools (in this order of preference)
1. **CSS** transitions and keyframes, `@starting-style` + `transition-behavior: allow-discrete` for elements appearing/disappearing (menus, toasts, popovers, `<dialog>`).
2. **React `<ViewTransition>`** (React 19.3, works in Next.js App Router with no config; check the Next.js view-transitions guide before using) for route changes and shared-element morphs. Always progressive enhancement.
3. **CSS scroll-driven animations** (`animation-timeline: view()`) for the few scroll-linked effects on the landing page, inside `@supports (animation-timeline: view())`.
4. **Motion** (`motion` package, `motion/react`) only for gesture-driven or physics work CSS can't do well: flashcard drag/swipe, drag-to-reorder plan blocks, `layout` animations of list reordering. Import only what's used.
5. Never: scroll-jacking or smooth-scroll libraries that take over native scrolling, parallax backgrounds, cursor followers, auto-playing carousels, typewriter effects that fake streaming.

### 4.4 Where motion happens (and exactly how)

| Moment | Motion | Duration / easing |
|---|---|---|
| **Landing hero** | The input types the request (real characters, ~35 ms each), then the route line draws top-to-bottom (`stroke-dashoffset`), each block fades in and slides 8 px as the line reaches it, checkpoints pop with `--ease-spring`. Plays once; a small "Replay" text button after. | 1.6 s total, then still |
| Landing sections | Product fragments (not whole sections) reveal with a short `clip-path` wipe as they enter, via `animation-timeline: view()`, entry 0–30% range only. Text never animates. | scroll-linked |
| Route change in app | `<ViewTransition>` cross-fade of the main column; sidebar and header persist (excluded with their own names). Forward vs back uses a 12 px directional slide via transition types. | `--dur-slow`, `--ease-out` |
| Session card → session page | Shared-element morph of the session title (`view-transition-name` set only on the clicked item, removed after). Focus moves to the page heading when the transition finishes. | `--dur-slow` |
| Streaming answer | Text appears as it streams; each new block (plan, quiz) fades in + rises 4 px once when it starts rendering. A blinking caret only while streaming. No fake typing. `aria-live="polite"` on the region. | `--dur-base` |
| Skeletons | Shapes match the real layout exactly. Subtle shimmer (a soft gradient moving left→right on a pseudo-element, `transform` only, 1.4 s loop). Reduced motion: static tint. Swap to content with a 120 ms fade, no layout shift. | 1.4 s loop |
| Checkpoint tick | Checkbox stroke draws (stroke-dashoffset), fill turns Leaf, row scales 1 → 1.02 → 1 with `--ease-spring`. Progress ring animates its arc to the new value. | 260 ms |
| Quiz answer | Correct: option background fills Leaf from the click point (`clip-path: circle()` grow). Wrong: chosen option gets Rose outline and a 2-cycle 3 px horizontal nudge; correct one highlights. Explanation expands with `grid-template-rows`. | 220–280 ms |
| Flashcard | 3D flip on Y (`rotateY`, `backface-visibility: hidden`, perspective 1000px). Swipe follows the finger (Motion drag), releases with spring; card exits toward the swipe direction. | flip 380 ms |
| Upload | Progress bar shows real bytes. On "Ready", the file chip's status dot morphs to a tick. Drag-over: dashed outline appears and the drop zone label changes; no bouncing. | `--dur-fast` |
| Menus, popovers, select | Scale 0.97 → 1 + opacity from the trigger's origin (`transform-origin` set to the trigger side), `@starting-style` entry, faster exit. | 160 ms in / 110 ms out |
| Sheets (mobile nav, file panel) | Slide from edge with `--ease-out`, backdrop fades. Drag-to-dismiss on mobile. | `--dur-slow` |
| Toasts | Only for things that happen out of view (export ready, upload failed in background). Slide up 8 px + fade, auto-dismiss 5 s, pause on hover/focus. | `--dur-base` |
| Buttons | Press: scale 0.98 for `--dur-instant`. Hover: colour shift only. No lifting shadows. | 90–150 ms |
| Rate limited / errors | Inline message appears with a height expand; no shake on the whole form. | `--dur-base` |

### 4.5 Reduced motion
- Use the custom-property pattern so each animation declares its reduced version next to it:

```css
@property --animation-reduced { syntax: "*"; inherits: false; initial-value: none; }
@media (prefers-reduced-motion: reduce) {
  * { animation: var(--animation-reduced) !important; }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```
- Do **not** set a global `animation-duration: 0.01ms` hack.
- Reduced versions: hero shows the finished plan instantly; skeletons are static; flips become cross-fades; swipes still work (they are user-driven) but release without spring overshoot.
- Motion's `useReducedMotion()` gates every Motion-based animation.
- Nothing flashes more than 3 times per second, anywhere.

### 4.6 Performance budget
- Landing: LCP < 2.0 s (4G), CLS < 0.05, INP < 200 ms. App routes: INP < 200 ms.
- Hero demo is SVG + CSS; total JS for the landing page under 90 KB gzipped (Motion not loaded on the landing page unless needed).
- Every animation tested at 6× CPU throttle in DevTools: no dropped-frame jank on a mid-range Android.
- Fonts via `next/font` with `display: swap` and size-adjusted fallbacks so text doesn't jump.

---

## 5. Implementation notes

1. **Tokens first.** `globals.css` holds colour, type, radius, spacing (4 px base: 4, 8, 12, 16, 24, 32, 48, 64, 96) and motion tokens. Components use tokens, never raw hex or ms values.
2. **shadcn/ui is a starting point, not the look.** After adding a component, restyle it: radius by hierarchy, our focus ring (2 px Violet with 2 px offset), our colours, our type. Delete variants we don't use.
3. **Icons:** Lucide at 1.75 stroke, 20 px default, `currentColor`. One icon set only.
4. **Charts/progress:** hand-built SVG (rings, route lines). No chart library for the student side.
5. **Hero demo implementation:** a Client Component that renders a static SVG plan (server-rendered for LCP), then progressively animates on mount with CSS classes; respects reduced motion by skipping straight to the final state.
6. **View transitions:** wrap the app layout's main column in `<ViewTransition>`; give persistent chrome its own `view-transition-name` so it doesn't cross-fade; always move focus to the new page's `h1` (`tabindex="-1"`) after navigation.
7. **Skeleton components** are built per screen from the same layout primitives as the real content (so shapes match).
8. **Dark mode** is designed, not inverted: Ink surfaces, Mist text, Ember stays Ember, Violet lightens to `#8B6CF2` for contrast.
9. **Mobile first:** 360 px is a real target. Bottom sheet nav, thumb-reachable composer, no hover-only affordances.

---

## 6. Review loop (required for every UI PR)

1. Run the app and capture screenshots with Playwright at 360, 768 and 1280 px, light and dark, for every changed screen, including loading, empty and error states.
2. Look at them as a design reviewer would and write three critiques in the PR: what looks generic, what is cluttered, what is inconsistent with BRAND.md. Fix them.
3. Remove one thing (an extra border, a label, an icon, a shadow) that the screen does not need.
4. Record a short screen capture of every animation you added; check it at 0.25× speed for jank and at reduced motion for the fallback.
5. Lighthouse and axe checks pass (targets in the PRD).

## 7. Copy checklist

- Sentence case. Buttons say the action ("Build my plan", "Upload notes", "Start quiz", "Replan from now").
- Same action, same word, everywhere (a button "Delete session" produces "Session deleted").
- Errors: what happened + how to fix, no apology, no "Oops".
- Empty states invite the next action.
- Numbers are real or absent. No invented stats.
