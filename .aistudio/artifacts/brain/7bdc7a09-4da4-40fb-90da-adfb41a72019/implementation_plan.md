# Implementation Plan: Slite-Inspired Warm Minimalist UI Refactor

Transition UniSphere from the dark theme to a warm, minimalist aesthetic inspired by Slite, with warm cream canvas (`#fdf9f4`), dust cream surfaces (`#f9efe4`), charcoal typography (`#2d2f34` / `#3f434a`), ember orange primary accents (`#f67748`), hairline silver borders (`#ecedef`), pill buttons, and dust chips, while retaining full functionality and maintaining a compact, data-primary layout.

---

## User Review Required

> [!IMPORTANT]
> - **Theme Default & Toggle**: As selected, Warm Slite will be the default theme for all users (`#fdf9f4` canvas), with the dark mode kept available via the QuickToolbar/Settings theme toggle.
> - **Data Density Balance**: Section margins will provide distinct visual breathing room (`gap-8` to `gap-12`) without wasting vertical space, preserving UniSphere's high-efficiency academic workstation feel.
> - **Zero Logic Alterations**: All Firestore sync hooks, telemetry, exam boss math, timers, ghost races, and audio systems remain 100% untouched.

---

## Proposed Changes

### 1. Global Tokens, Tailwind CSS, & Base Styles (`src/index.css`, `index.html`)
- Update `:root` variables in `src/index.css` to define the Slite warm token system:
  - `--canvas-bg`: `#fdf9f4` (Warm Cream page background)
  - `--surface-card`: `#ffffff` (Elevated product/bento card surface)
  - `--surface-dust`: `#f9efe4` (Secondary sections, chips, and tag backgrounds)
  - `--text-charcoal-primary`: `#2d2f34` (Primary headings and icons)
  - `--text-charcoal-secondary`: `#3f434a` (Secondary body & descriptive labels)
  - `--accent-ember`: `#f67748` (CTA buttons, active indicator, active states)
  - `--border-silver`: `#ecedef` (Hairline crisp borders)
  - Soft diffuse shadow utility: `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)`
- Configure `html, body` base background to `#fdf9f4` and text to `#2d2f34`.
- Ensure dark mode (`.dark`) continues to provide a clean fallback without breaking when toggled.
- Update `index.html` theme color meta tag to `#f67748` and canvas background to `#fdf9f4`.

### 2. Workspace Explorer Sidebar (`src/components/Sidebar.tsx`)
- Flatten the sidebar against the canvas using a seamless `#fdf9f4` background.
- Redesign navigation links to Slite ghost buttons:
  - Inactive state: Transparent background, `px-2.5 py-1.5`, `rounded-lg`, subtle text `#3f434a`, hovering to pure white `#ffffff` or `#f9efe4`.
  - Active state: `#ffffff` pill or card with subtle `#f67748` ember accent bar or ember text indicator.
- Remove dark borders and neon glows; apply crisp `border-r border-[#ecedef]`.
- Restyle user profile and bottom action items with dust chips and charcoal text.

### 3. Application Shell & Top Navigation (`src/App.tsx`, `src/components/QuickToolbar.tsx`)
- Set default theme initialization in `src/App.tsx` to `'light'` (Warm Slite aesthetic).
- Wrap the main workspace layout with `bg-[#fdf9f4] min-h-screen text-[#2d2f34]`.
- Refactor `QuickToolbar.tsx` to sit flat on `#fdf9f4` with hairline border `#ecedef`, ember accent on active indicators, and dust cream pills for shortcuts.
- Update header status badge and breadcrumb tokens to charcoal and ember orange.

### 4. Dashboard View & Bento Grid (`src/components/DashboardView.tsx`)
- Transform Bento cards from dark glassmorphic containers to Slite card geometry:
  - `bg-white border border-[#ecedef] rounded-2xl shadow-xs`
  - Subtle diffuse hover elevation instead of neon ring/glow.
  - Headings styled with `#2d2f34` font-semibold.
- Replace primary action buttons with full pill buttons:
  - Primary CTA: `bg-[#f67748] hover:bg-[#e46435] text-white rounded-full font-medium px-4 py-2`
  - Secondary CTA: Outlined pill `border-2 border-[#2d2f34] text-[#2d2f34] hover:bg-[#2d2f34] hover:text-white rounded-full`
- Category labels, badges, and stats converted to "Dust Chips": `bg-[#f9efe4] text-[#2d2f34] rounded-full px-3 py-1 font-medium text-xs`.
- Course badges updated to subtle warm-tinted badges on `#f9efe4`.

### 5. Squads & Friends View (`src/components/SquadsView.tsx`)
- Refactor top hero Live Study Lobby card:
  - Surface: `bg-white border border-[#ecedef] rounded-2xl`
  - Action buttons: "Lock In" button as ember orange pill (`bg-[#f67748] text-white rounded-full`).
  - Online member presence cards: `bg-[#fdf9f4] border border-[#ecedef] rounded-xl`.
- Refactor Weekly Sprint Podium & Ranked Leaderboard:
  - Surfaces in pure white with dust cream secondary highlights.
  - Rank tags and ELO badges converted to dust chips (`bg-[#f9efe4] text-[#2d2f34] rounded-full`).
  - Podium cards with warm amber and ember accents instead of neon rings.
- Refactor GitHub-style Study Contribution Heatmap:
  - Cells tinted in warm amber/ember palette scale (cream `#f9efe4` -> warm sand -> terracotta -> ember `#f67748`).
- Refactor Live Squad Feed & Ghost Racing Hub:
  - Filter tabs as ghost/pill dust chips.
  - Ghost challenge cards in pure white `#ffffff` with silver border `#ecedef`.

### 6. Curriculum & Course Cards (`src/components/CurriculumView.tsx`, `src/components/AssignmentsView.tsx`, `src/components/Modals.tsx`)
- Course cards updated to generous `rounded-2xl` pure white cards with `#ecedef` border.
- CFU, Grade, and Status badges styled with subtle warm tints on `#f9efe4` surfaces.
- Modal dialogs refactored with clean white surface, soft diffuse multi-layer shadow, charcoal headers, and ember orange primary buttons.

---

## Verification Plan

### Automated Compilation & Linting
- Run `npm run lint` via `lint_applet` to verify no TypeScript or lint regressions.
- Run `compile_applet` to verify Vite bundle builds cleanly with zero errors.

### Visual & Functional Checks
1. **Initial Page Load**: Verify UniSphere loads with the warm cream background (`#fdf9f4`), crisp charcoal typography, and ember orange accents.
2. **Theme Switcher**: Click the theme toggle in QuickToolbar to verify seamless transition between Warm Slite and dark mode.
3. **Workspace Explorer**: Verify sidebar items are ghost buttons on flat background, active item highlights with ember accent, and navigation between views works smoothly.
4. **Dashboard Bento Cards**: Confirm cards are pure white with hairline silver borders, rounded-2xl corners, dust chips for tags, and full pill primary buttons.
5. **Squads/Friends Page**: Test Live Study Lobby lock-in toggle, online presence cards, podium, contribution heatmap, and ghost race cards.
6. **Modals & Workflows**: Open course detail, new course, and export modals to check diffuse shadows and pill button interactions.
