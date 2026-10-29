# 02 — Design System

> Source of truth for the visual language. If a screen deviates from this, either the spec is wrong (update it) or the screen is wrong (fix it). No third option.

Reference mock: `Docs/mocks/TechBase Windows Knowledge Article.png`.

---

## 1. What makes this feel like a 2026 enterprise product (not a vibe-coded demo)

A short list of things we **do** and things we **don't**:

**Do**
- Two-tone shell: deep navy sidebar, soft off-white canvas. Permanent, signature.
- Information-dense article views with a sticky in-page TOC and a right-rail of metadata.
- Monochrome type with a single disciplined accent (cobalt).
- Section headers that use a tinted icon tile, not an emoji or a bare icon.
- Numbered circular step badges with a cobalt fill and tight baseline alignment.
- Tinted-left callout panels with a 1px border matching the tint.
- Micro-interactions: 120–180ms spring on hover, 240ms slide for drawers.
- Keyboard affordances visible (chip-shaped `Ctrl + K` in the search bar).
- Real IT content in every surface, including empty states.

**Don't**
- No full-bleed hero gradients.
- No glassmorphism on content (only on the small Upload CTA card and tooltips).
- No stock shadcn radii/padding (default `rounded-md` = too tight; our card radius is 16–20px).
- No bouncy "attention-seeking" animations.
- No emoji in UI copy.
- No generic Unsplash photos. Hero imagery is either a product-OS artwork (like the Windows bloom in the mock) or a solid-with-grain panel.

---

## 2. Color tokens

Defined in CSS variables, consumed via Tailwind's `@theme`.

### 2.1 Semantic tokens (light)

```css
:root {
  /* surface */
  --canvas:            #F6F8FB;    /* page background */
  --surface:           #FFFFFF;    /* cards */
  --surface-muted:     #F1F4F9;    /* subtle fills, inputs */
  --surface-sunken:    #ECEFF4;    /* code block light variant (rare) */
  --border:            #E4E8EF;
  --border-strong:     #D4DAE4;

  /* text */
  --fg:                #0B1220;
  --fg-muted:          #475569;
  --fg-subtle:         #5E6B7C;    /* AA on --canvas at 11px */
  --fg-on-accent:      #FFFFFF;

  /* brand / accent */
  --accent:            #1A5AE0;    /* cobalt, AA on --canvas for 13px link text */
  --accent-hover:      #1548C4;
  --accent-soft:       #E7EFFF;    /* tinted fill */
  --accent-ring:       #93B4FF;

  /* status — bright = dots/icons; *-fg = label text on *-soft (AA) */
  --success:           #10B981;
  --success-fg:        #047857;
  --success-soft:      #E6F7F1;
  --warning:           #F59E0B;
  --warning-fg:        #B45309;
  --warning-soft:      #FEF3E2;
  --danger:            #EF4444;
  --danger-fg:         #B91C1C;
  --danger-soft:       #FDECEC;
  --info:              #3B82F6;
  --info-fg:           #1D4ED8;
  --info-soft:         #E8F0FE;

  /* sidebar (always dark, both themes) */
  --sidebar-bg-top:    #0F172A;
  --sidebar-bg-bot:    #0B1220;
  --sidebar-fg:        #CBD5E1;
  --sidebar-fg-active: #FFFFFF;
  --sidebar-active:    rgba(30,107,255,0.14);
  --sidebar-active-border: #1E6BFF;
}
```

### 2.2 Dark mode (opt-in)

```css
.dark {
  --canvas:            #0A0F1C;
  --surface:           #0F172A;
  --surface-muted:     #111A2E;
  --surface-sunken:    #0B1220;
  --border:            #1E293B;
  --border-strong:     #273449;

  --fg:                #E6EDF7;
  --fg-muted:          #94A3B8;
  --fg-subtle:         #64748B;    /* fine on dark canvas */

  --accent-soft:       rgba(30,107,255,0.14);
}
```

### 2.3 Usage rules

- `--accent` is for primary buttons, active nav, links, numbered badges, and the "Edit" / "Upload File" CTAs. **Nothing else.**
- Status colors never appear outside of their status chip, callout, or toast context. Chip/toast label text uses `*-fg` on `*-soft`; dots and icons keep the bright status hue.
- Tag chips use `--accent-soft` background with `--accent` text (see mock: Windows 11, Password, Local Admin tags).

---

## 3. Typography

### 3.1 Stack

- UI: **Geist Sans** → fallback `Inter var`, `system-ui`.
- Code / commands: **Geist Mono** → fallback `JetBrains Mono`, `ui-monospace`.
- Weights used: 400, 500, 600, 700. No 800/900.

### 3.2 Scale

| Token             | Size / Line  | Weight | Usage                              |
|-------------------|--------------|--------|------------------------------------|
| `text-display`    | 36 / 44      | 700    | Page-level hero (rare)             |
| `text-h1`         | 28 / 36      | 700    | Article title                      |
| `text-h2`         | 20 / 28      | 600    | Section headers (Overview, etc.)   |
| `text-h3`         | 16 / 24      | 600    | Sub-headers, step titles           |
| `text-body`       | 15 / 24      | 400    | Article prose                      |
| `text-ui`         | 14 / 20      | 500    | Buttons, nav, labels               |
| `text-caption`    | 12 / 16      | 500    | Metadata row, chip text            |
| `text-micro`      | 11 / 14      | 600    | UPPERCASE eyebrows, badge text     |
| `text-code`       | 13 / 20      | 500    | Inline code                        |
| `text-codeblock`  | 13.5 / 22    | 500    | Multi-line code blocks             |

### 3.3 Rules

- Article prose uses `--fg` for body, `--fg-muted` for the summary line.
- Links in prose are `--accent` with no underline until hover; hover adds a 1px underline with 2px offset.
- Numeric content (IDs, versions) uses `font-variant-numeric: tabular-nums`.
- Never center body text. Center only short titles in empty states.

---

## 4. Spacing & layout

### 4.1 Scale

Multiples of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. Avoid 6, 10, 14 — be disciplined.

### 4.2 Grid

- App shell: sidebar fixed `280px`, main area fluid.
- Main content max width: `1120px` centered when no right rail; **split 1 / `320px`** when right rail present.
- Article detail (per mock): three regions inside main area:
  - **TOC rail** `220px` sticky
  - **Content** fluid
  - **Meta rail** `320px` sticky

### 4.3 Radii

```css
--radius-xs: 6px;    /* chips */
--radius-sm: 8px;    /* inputs, small buttons */
--radius-md: 12px;   /* callouts, code blocks */
--radius-lg: 16px;   /* cards, callout containers */
--radius-xl: 20px;   /* big feature cards (Upload CTA, meta rail cards) */
--radius-pill: 999px;
```

### 4.4 Elevation

Layered shadows only:

```css
--shadow-sm:  0 1px 2px rgba(15,23,42,.05);
--shadow-md:  0 1px 2px rgba(15,23,42,.06), 0 6px 16px rgba(15,23,42,.06);
--shadow-lg:  0 2px 4px rgba(15,23,42,.06), 0 16px 32px rgba(15,23,42,.08);
--shadow-focus: 0 0 0 3px var(--accent-ring);
```

No single-blur `box-shadow`. No colored shadows except focus ring.

---

## 5. Motion

- Default easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` ("gentle out").
- Default duration: `180ms` for hover/press, `240ms` for enter/exit, `320ms` for route transitions.
- Reduced motion: honor `prefers-reduced-motion: reduce` by disabling translate/scale, keeping opacity.
- Framer Motion only where RSC-safe; prefer CSS transitions for stateless hover/press.

---

## 6. Core components (restyled shadcn)

Every shadcn primitive must be overridden to match these specs. The default looks fine; it also looks like every demo. Not acceptable.

### 6.1 Button

| Variant     | Bg                 | Fg               | Border             | Notes                        |
|-------------|--------------------|------------------|--------------------|------------------------------|
| `primary`   | `--accent`         | white            | none               | Shadow-sm, hover darken 6%   |
| `secondary` | `--surface`        | `--fg`           | `--border-strong`  | Hover `--surface-muted`      |
| `ghost`     | transparent        | `--fg-muted`     | none               | Hover `--surface-muted`      |
| `danger`    | `--danger`         | white            | none               |                              |
| `link`      | transparent        | `--accent`       | none               | Underline on hover           |

- Padding: `px-3.5 py-2` (height ~36). Compact `px-2.5 py-1.5` (~28).
- Radius `--radius-sm`.
- Icon spacing `gap-2`. Icon size 16.
- Focus: `--shadow-focus`, never `outline: auto`.

### 6.2 Input / Search

- Height 40, radius `--radius-sm`.
- Border `--border-strong`, focus adds `--shadow-focus` + border `--accent`.
- Search input hosts a trailing `Ctrl + K` chip (right-aligned, `--surface-muted` bg, 11px micro type).

### 6.3 Chip / Badge

- Pill, height 22–24.
- **Category chip** (e.g. `Windows`): `--accent-soft` bg, `--accent` text, no border.
- **Tag chip**: `--accent-soft` bg, `--accent` text, `1px solid --accent-soft` (looks like a subtle outline).
- **Status chip** (`Published`, `Draft`, `In Review`): status-soft bg, status fg, dot indicator on the left.

### 6.4 Callout

Four variants: `info`, `important`, `warning`, `success`.

Layout:

```
┌─ (4px tinted left border) ──────────────────────────┐
│ (icon tile 32×32, tinted) │  Title (text-h3)        │
│                           │  Body (text-body)       │
└─────────────────────────────────────────────────────┘
```

- Bg: `*-soft` token.
- Border: `1px solid` with 40% alpha of the status color.
- Radius `--radius-md`.
- Padding `p-4`.

### 6.5 Numbered step

- 28×28 circle, `--accent` fill, white digit `text-ui` 600.
- Title: `text-h3`.
- Body: `text-body`, left-aligned with the title text, not the circle.
- Vertical spacing between steps: `24px`.

### 6.6 Code block

- Bg `#0B1220` (constant across themes).
- Fg `#E6EDF7`.
- Monospace, `text-codeblock`.
- Top-right: copy icon button, 28×28, ghost on dark.
- Language tag optional top-left (micro, muted).
- Padding `p-4`.
- Radius `--radius-md`.
- Scroll shadow on overflow-x.

### 6.7 Card (right rail)

- Bg `--surface`, border `1px solid --border`, radius `--radius-xl`, padding `p-5`.
- Card title `text-h3`, muted, with optional trailing action (`View All`).
- Rows inside: 36 min height, left icon, label `text-ui`, right chip or chevron.

### 6.8 Sidebar nav

- Width 280.
- Vertical padding 20, horizontal padding 16.
- Each item: 40 tall, gap 12 between icon and label, radius `--radius-sm`.
- **Active**: background `--sidebar-active`, left-border 3px `--sidebar-active-border`, label white, icon full-opacity.
- Section labels (`ADMIN`): `text-micro`, letter-spacing 0.08em, `--fg-subtle`, 24 top margin.
- Collapsible groups (`Knowledge Base`): chevron right side, animated 180° on open.
- Children indented 16, with a 1px vertical rail at left (`--border` at 20% alpha on dark).

### 6.9 Top bar

- Height 64, dark variant on the sidebar side (seamless), light variant on the main side.
- Center: search input (max 640 wide), with `Ctrl + K` chip.
- Right: bell with count badge, theme toggle, user menu with avatar, name, role.

### 6.10 Avatar

- 32 default. Initials fallback uses `--accent` bg, white text, `text-caption` 600.
- Group avatars (for authors) stack with `-ml-2` and a white 2px ring.

### 6.11 Table (list view, admin)

- Row height 48.
- Zebra off by default. Hover row: `--surface-muted`.
- Header: `text-micro` uppercase, `--fg-subtle`.
- Column sort: chevron, animated.
- Density toggle: `comfortable` (48) / `compact` (36).

---

## 7. Iconography

- **Lucide** for 95% of icons.
- Custom icons live in `apps/web/components/ui/icons/`:
  - `BrandMark` — the isometric cobalt polyhedron from the mock. Always rendered with its inner-face highlight (two SVG gradients). Minimum size 20.
  - `SectionMark/*` — small tinted tile icons for article sections (Overview, Prerequisites, Steps, Verification, Troubleshooting, Related). Each is Lucide-at-core inside a `--surface-muted` rounded tile with `--accent` stroke.
- Standard icon size 16 inline, 20 in buttons, 24 in section tiles.

---

## 8. Voice & microcopy

- **Imperative, concise.** "Reset the password", not "You can reset the password".
- **Numeric specificity.** "5 min read", "248 articles", "KB-IT-1024".
- **No fluff empty states.** Empty state for All Articles: "No articles yet. Upload a Word or PDF, or start one from scratch." + two primary actions.
- **Errors are human.** "We couldn't parse that PDF — it looks like scanned images. Enable OCR in Import Settings or try a text-based PDF."
- **No AI-ness.** Never "AI-generated". Prefer "Drafted from `filename.docx`" with a small icon.

---

## 9. Theming

- Default theme is **light**. Dark theme is opt-in via the top-bar toggle; persisted in `localStorage` and respected by server via a cookie (`theme=light|dark|system`) to avoid flash.
- The **sidebar is always dark**, both themes. This is intentional and signature.

---

## 10. Imagery

- Hero image on an article is optional. If present:
  - Aspect ratio locked `16/10` on desktop, `3/2` on mobile.
  - Radius `--radius-lg`.
  - Max width `420` in the title block.
  - Right-aligned next to the title (see mock).
- Approved sources: product OS artwork (bundled), abstract gradient panels with 1% film grain generated at build time, or user-provided screenshots.
- Never Unsplash / stock photography.

---

## 11. Accessibility floor

- All interactive elements reachable via Tab in logical order.
- Visible focus always. `--shadow-focus` on inputs and buttons; outline fallback on exotic widgets.
- Minimum contrast 4.5:1 for body, 3:1 for large text and non-text UI.
- No color-only state (every status chip has an icon or label).
- Motion respects `prefers-reduced-motion`.
- Form fields always have an associated label; placeholder is **not** a label.
- Tested with VoiceOver (macOS), NVDA (Windows), and keyboard-only navigation on each PR touching a shell/nav component.
