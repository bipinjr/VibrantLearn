# VibrantLearn brand & design system

## The idea

The product's character is confident and plain: a tool for students under exam pressure. The logo is a wordmark, **vibrantlearn.**, set heavy and tight in Bricolage Grotesque 800, ending in an Ember full stop. The full stop says "done, sorted": the feeling of walking into the exam prepared. The app icon is **v.** on an Ink tile.

The learning *path* (route line with checkpoints) is the product's visual motif inside the app: landing hero, plan timeline, progress. It is not part of the logo.

## Logo files

| File | Use |
|---|---|
| `logo-wordmark.svg` / `.png` | Primary logo on light backgrounds |
| `logo-wordmark-dark.svg` / `.png` | On Ink or dark backgrounds |
| `logo-wordmark-mono.svg` | One colour (Ink full stop): print, stamps, single-colour contexts |
| `app-icon.svg`, `app-icon-512/192/180.png` | PWA icon, Apple touch icon (180), social avatar |
| `favicon.svg`, `favicon-48/32/16.png` | Browser tab; drops the full stop because it disappears at 16 px |
| `make_logo.py` | Rebuilds every file from the Bricolage Grotesque 800 font |

Glyphs are converted to outlines, so the SVGs need no font installed. Bricolage Grotesque is SIL Open Font License: commercial and logo use is allowed.

**Rules**
- Always lowercase, always with the Ember full stop (except the mono and favicon versions).
- Clear space: the height of the "v" on every side.
- Minimum width: 96 px for the wordmark; below that use the app icon.
- Don't change the letter spacing, swap the font, recolour letters, add gradients, shadows or outlines, or put the light version on a photo without a solid backing.
- In running text the name is written "VibrantLearn".

## Colour tokens

| Token | Hex | Role |
|---|---|---|
| `--ember` | `#FF6A3D` | The one hot accent: logo full stop, primary buttons, "now / next" on a timeline |
| `--orchid` | `#C2389B` | Middle stop of the plan route line only |
| `--violet` | `#6A3BE4` | Links, focus ring, selected states (`#8B6CF2` on dark) |
| `--ink` | `#1C1633` | Text on light, dark surfaces |
| `--mist` | `#F5F2FB` | Light background (cool lilac paper) |
| `--leaf` | `#14A37F` | Completed checkpoints, success |
| `--amber` | `#E8A317` | Warnings (rate limit, file too big) |
| `--rose` | `#D93D5C` | Errors |

Route gradient: `linear-gradient(180deg, #FF6A3D 0%, #C2389B 50%, #6A3BE4 100%)`, used **only** on the plan route line (landing hero and plan view), running from "now" (Ember) to "exam" (Violet). Nowhere else: not on buttons, text, backgrounds or the logo.

Primary button: Ember fill with **Ink** text (about 6:1 contrast). White on Ember fails contrast, never use it. Secondary button: Ink outline on Mist.

Contrast: Ink on Mist and Mist on Ink pass AAA.

### Starter CSS (Tailwind v4 `@theme`)

```css
@theme {
  --color-ember: #FF6A3D;
  --color-orchid: #C2389B;
  --color-violet: #6A3BE4;
  --color-ink: #1C1633;
  --color-mist: #F5F2FB;
  --color-leaf: #14A37F;
  --color-amber: #E8A317;
  --color-rose: #D93D5C;

  --font-display: "Bricolage Grotesque", system-ui, sans-serif;
  --font-sans: "Figtree", system-ui, sans-serif;

  --radius-chip: 999px;
  --radius-input: 12px;
  --radius-card: 16px;
  --radius-sheet: 24px;
}

:root {
  --bg: var(--color-mist);
  --surface: #FFFFFF;
  --text: var(--color-ink);
  --muted: #5E5675;
  --line: #E4DEF0;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #120E22;
    --surface: #1C1633;
    --text: #F5F2FB;
    --muted: #B2A9C9;
    --line: #2E2650;
  }
}
:root[data-theme="dark"] {
  --bg: #120E22; --surface: #1C1633; --text: #F5F2FB; --muted: #B2A9C9; --line: #2E2650;
}
```

## Typography

| Use | Font | Notes |
|---|---|---|
| Display, headings | Bricolage Grotesque (600–800) | Tight tracking on large sizes (−1% to −2%) |
| UI and body | Figtree (400–600) | 16 px base, line-height 1.55 |
| Kannada content | Noto Sans Kannada | Line-height 1.7 |
| Hindi content | Noto Sans Devanagari | Line-height 1.7 |

Scale (1.25 ratio): 13 · 16 · 20 · 25 · 31 · 39 · 49 · 61 px. Body line length under 72 characters. Sentence case everywhere.

## Shape, depth, motion

- Radii by hierarchy: chips full, inputs 12, cards 16, sheets/modals 24. Don't put one radius on everything.
- Depth: surfaces separate by tone and a 1 px `--line` border first; shadows only for floating layers (menus, sheets), tinted with Ink, not grey.
- Motion: one orchestrated moment, the landing hero drawing the path. Everything else moves only in response to the user (checkpoint ticks fill with Leaf, quiz cards flip, sheets slide). All motion off under `prefers-reduced-motion`.

## Voice

Plain, direct, encouraging, never hype. Speak like a senior who has been through the same exam.

| Instead of | Write |
|---|---|
| "Supercharge your learning journey!" | "Tell us your exam. We'll plan the hours you have." |
| "Submit" | "Build my plan" |
| "Oops! Something went wrong 😢" | "Couldn't read this PDF. It may be scanned or locked. Try a clearer copy or upload photos of the pages." |
| "No data" | "No sessions yet. Start one with your next test." |

## Don'ts (they make the product look generic)

- All-caps eyebrow labels above headings
- "→" glued onto every button or link
- Grids of identical rounded cards with the same grey shadow
- Gradient washes as background decoration
- Emoji as icons
- Highlighting one word of a headline in a different colour
