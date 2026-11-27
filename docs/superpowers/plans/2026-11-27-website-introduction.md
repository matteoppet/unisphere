# UniSphere One-Page Website Introduction & Legal Foundations (Milestone 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace root `index.html` with a minimal, English, Muesli-inspired one-page introduction featuring UniSphere's self-hosted walkthrough video, skip-to-login flow, standalone EU/Italian Privacy Policy and Terms & Conditions pages, and click-wrap registration compliance on `pages/login.html`.

**Architecture:** `index.html`, `pages/privacy.html`, and `pages/terms.html` are standalone, zero-Firebase HTML entries sharing a lightweight monochrome editorial stylesheet (`src/intro.css`), a tiny public script (`src/intro.js` reusing `src/utils/uiState.js`), and pure routing/validation helpers (`src/utils/introRouting.js`). Signed-in visitors hitting `/` redirect immediately to `/pages/dashboard.html` (unless `/?intro=1` is passed), while `pages/login.html` gains `#login`/`#register` hash targeting, a required unchecked Terms checkbox, and legal links without disturbing the existing authenticated workspace.

**Tech Stack:** Vanilla HTML5, CSS3, ES Modules (JavaScript), Vite 8 multi-page build, Node built-in test runner (`node --test`), Express (`server.ts`), Vercel (`vercel.json`), `ffmpeg` (one-time poster extraction).

**Spec:** `docs/superpowers/specs/2026-11-27-website-introduction-design.md`

## Global Constraints

- Zero new frontend frameworks or runtime dependencies (no React, Tailwind, Astro, external font CDNs, analytics, or third-party embeds).
- All new pages (`index.html`, `pages/privacy.html`, `pages/terms.html`) are strictly in **English**.
- `index.html`, `pages/privacy.html`, and `pages/terms.html` must never import Firebase or `src/app.js`.
- Light/dark monochrome palette (`unisphere_theme` in `localStorage` + `prefers-color-scheme` + `#btn-theme-toggle` + pre-paint `data-theme` boot script) must stay consistent across `index.html`, `pages/privacy.html`, `pages/terms.html`, and the app.
- Zero AI-slop visuals: no neon/purple gradients, decorative glows, fake testimonials, popups, or autoplaying audio.
- Solo-user isolation remains intact inside the app; Squads & Friends stay inside `/pages/squads.html` and the intro page states this explicitly.
- Legal placeholders kept for now: Data Controller `UniSphere Project Maintainer`, contact email `privacy@unispherelife.me`, last updated date `27 November 2026`, minimum age `16+` EU (`14+` Italy per Art. 2-quinquies D.Lgs. 196/2003).
- Do NOT modify `firestore.rules` or add self-serve account deletion (deferred to Milestone 2).
- Verify all checks pass on Windows PowerShell (`npm test`, `npm run lint`, `npm run build`).

## Review Focus

- Whitespace-only `unisphere_workspace_session_email` or query strings like `/?intro=0` / `/?ref=onepagelove` vs `/?intro=1` on `/` — blank emails must never trigger redirect, `/?intro=1` (even alongside other params) must bypass redirect, and `/?intro=0` or unrelated params must still redirect signed-in users to `/pages/dashboard.html` (pinned in Task 1 & Task 3).
- Signed-in users opening `pages/privacy.html` or `pages/terms.html` and visitors with blocked `localStorage` (private browsing) on `/` — legal pages must never auto-redirect away to the dashboard, and `index.html`'s pre-paint script must wrap `localStorage` reads in `try/catch` (pinned in Task 3 & Task 4).
- Register form submitted programmatically or via keyboard with `#auth-reg-terms` unchecked — `src/app.js` must reject submission with an inline error in `#auth-reg-error` before any Firebase call fires, and `#auth-reg-terms` must never carry a default `checked` attribute (pinned in Task 1 & Task 5).
- Clicking `UniSphere` brand on `pages/login.html` to return to `/?intro=1`, plus mixed-case or unknown hashes (`#REGISTER`, `#Login`, `#other`) — the brand link must NOT have `data-nav` so `src/app.js` doesn't hijack it, and hash resolution must normalize case and ignore unknown hashes safely (pinned in Task 1 & Task 5).
- Self-hosted video playback failure or missing CSP/cache header — `<video id="intro-video">` must use `controls playsinline preload="metadata" poster="/media/intro-poster.jpg"`, reveal an accessible fallback notice on media error, and all 3 CSP definitions (`vercel.json`, `server.ts`, `src/lib/authService.js`) must explicitly allow `media-src 'self'` while `/media/` caches with `public, max-age=86400` (not `immutable`) (pinned in Task 2 & Task 3).

---

### Task 1: Pure Intro & Login Routing Helpers + Test Baseline

**Files:**
- Create: `src/utils/introRouting.js`
- Create: `src/utils/introPage.test.js`

**Interfaces:**
- Consumes: none (pure ES module, zero DOM/Firebase dependencies)
- Produces (`src/utils/introRouting.js`):
  - `shouldRedirectFromIntro({ sessionEmail, search } = {}) -> boolean`
  - `resolveLoginFocusTarget(hash = '') -> 'login' | 'register' | null`
  - `resolveLegalHeaderCta(sessionEmail = '') -> { label: string, href: string }`
  - `validateRegistrationTermsAccepted(isAccepted) -> { valid: boolean, error: string }`

- [ ] **Step 1: Ensure workspace `node_modules` are installed**

Run: `if (-not (Test-Path node_modules)) { npm install }`
Expected: `node_modules` exists and `npm test` executes without `ERR_MODULE_NOT_FOUND` for `firebase`.

- [ ] **Step 2: Write failing unit tests in `src/utils/introPage.test.js`**

Write a `describe('Intro & Login Routing Helpers (Milestone 1)', ...)` block asserting:
- `shouldRedirectFromIntro`:
  - returns `true` for `{ sessionEmail: 'student@uni.it', search: '' }`
  - returns `true` for `{ sessionEmail: 'student@uni.it', search: '?ref=onepagelove' }`
  - returns `true` for `{ sessionEmail: 'student@uni.it', search: '?intro=0' }`
  - returns `false` for `{ sessionEmail: 'student@uni.it', search: '?intro=1' }`
  - returns `false` for `{ sessionEmail: 'student@uni.it', search: '?ref=onepagelove&intro=1' }`
  - returns `false` for `{ sessionEmail: '', search: '' }`, `{ sessionEmail: '   ', search: '' }`, and `{ sessionEmail: null, search: '' }`
- `resolveLoginFocusTarget`:
  - `'#register'` and `'#REGISTER'` -> `'register'`
  - `'#login'` and `'#Login'` -> `'login'`
  - `''`, `'#'`, `'#unknown'` -> `null`
- `resolveLegalHeaderCta`:
  - `'student@uni.it'` -> `{ label: 'Open App', href: '/pages/dashboard.html' }`
  - `''` or `'   '` -> `{ label: 'Log in', href: '/pages/login.html#login' }`
- `validateRegistrationTermsAccepted`:
  - `true` -> `{ valid: true, error: '' }`
  - `false` / `undefined` -> `{ valid: false, error: 'You must agree to the Terms & Conditions and confirm the minimum age requirement to register.' }`

- [ ] **Step 3: Run the new test file to verify it fails**

Run: `node --test src/utils/introPage.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../utils/introRouting.js`.

- [ ] **Step 4: Implement `src/utils/introRouting.js`**

Implement the 4 exported pure functions matching the exact signatures above. For `shouldRedirectFromIntro`, trim `sessionEmail`, parse `search` with `new URLSearchParams`, and bypass redirect only when `params.get('intro') === '1'`.

- [ ] **Step 5: Run tests to verify pass**

Run: `node --test src/utils/introPage.test.js`
Expected: PASS (all helper tests green).

- [ ] **Step 6: Commit**

Run:
```powershell
git add src/utils/introRouting.js src/utils/introPage.test.js
git commit -m "feat(intro): add pure intro redirect, login hash, and terms validation helpers"
```

---

### Task 2: Self-Hosted Video Assets, Vite Multi-Page Inputs, CSP & Media Cache Headers

**Files:**
- Create: `public/media/intro.mp4`
- Create: `public/media/intro-poster.jpg`
- Modify: `vite.config.ts:14-26`
- Modify: `vercel.json:21-59`
- Modify: `server.ts:145-157,316-330`
- Modify: `src/lib/authService.js:364-377`
- Modify: `src/utils/security.test.js:130-140`
- Modify: `src/utils/introPage.test.js`

**Interfaces:**
- Consumes: source video at `C:\Users\matte\orca\workspaces\unisphere\video-promotion\brag-output\brag.mp4`
- Produces:
  - Public media assets at `/media/intro.mp4` and `/media/intro-poster.jpg`
  - Vite build entries `privacy` (`pages/privacy.html`) and `terms` (`pages/terms.html`)
  - CSP directive `media-src 'self'` across `vercel.json`, `server.ts`, and `getSecurityHeaders()`
  - Cache header `Cache-Control: public, max-age=86400` for `/media/` in `vercel.json` and `server.ts`

- [ ] **Step 1: Add failing asset, CSP, cache, and Vite-input tests**

In `src/utils/security.test.js` (inside `returns standard security headers...`), assert:
- `headers['Content-Security-Policy'].includes("media-src 'self'")`

In `src/utils/introPage.test.js`, add a `describe('Intro Video Assets, Vite Config, CSP & Cache Headers', ...)` block asserting:
- `public/media/intro.mp4` exists and has size > 100,000 bytes
- `public/media/intro-poster.jpg` exists and has size > 5,000 bytes
- `vite.config.ts` registers both `pages/privacy.html` and `pages/terms.html`
- `vercel.json` CSP includes `media-src 'self'` and has a `/media/(.*)` header entry with `public, max-age=86400` (and NOT `immutable`)
- `server.ts` CSP includes `media-src 'self'` and sets `public, max-age=86400` for `/media/` paths

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `node --test src/utils/security.test.js src/utils/introPage.test.js`
Expected: FAIL on missing media assets, missing `media-src 'self'`, missing `/media/` cache header, and missing `privacy`/`terms` inputs in `vite.config.ts`.

- [ ] **Step 3: Copy `brag.mp4` and extract `intro-poster.jpg` via `ffmpeg`**

Run:
```powershell
New-Item -ItemType Directory -Force -Path public/media | Out-Null
Copy-Item "C:\Users\matte\orca\workspaces\unisphere\video-promotion\brag-output\brag.mp4" "public/media/intro.mp4" -Force
ffmpeg -y -ss 00:00:02 -i "public/media/intro.mp4" -frames:v 1 -q:v 2 "public/media/intro-poster.jpg"
```
Inspect `public/media/intro-poster.jpg` (using `read_file` on the image) to confirm the frame is clear, non-blank, and representative; if frame at `00:00:02` is a fade-in/title transition, pick a clearer timestamp (e.g., `00:00:04` or `00:00:06`) and re-extract.

- [ ] **Step 4: Update `vite.config.ts`, `vercel.json`, `server.ts`, and `src/lib/authService.js`**

- `vite.config.ts`: add `privacy: path.resolve(import.meta.dirname || '.', 'pages/privacy.html')` and `terms: path.resolve(import.meta.dirname || '.', 'pages/terms.html')` inside `build.rollupOptions.input`.
- `vercel.json`: add `media-src 'self';` to the `Content-Security-Policy` value; add a header block for `"source": "/media/(.*)"` setting `"Cache-Control": "public, max-age=86400"`.
- `server.ts`: add `"media-src 'self'"` to `cspDirectives`; inside `express.static` `setHeaders`, add `else if (filePath.replace(/\\/g, '/').includes('/media/')) { res.setHeader('Cache-Control', 'public, max-age=86400'); }`.
- `src/lib/authService.js`: add `"media-src 'self'"` to `cspDirectives` inside `getSecurityHeaders()`.

- [ ] **Step 5: Run targeted tests to verify pass**

Run: `node --test src/utils/security.test.js src/utils/introPage.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

Run:
```powershell
git add public/media/intro.mp4 public/media/intro-poster.jpg vite.config.ts vercel.json server.ts src/lib/authService.js src/utils/security.test.js src/utils/introPage.test.js
git commit -m "feat(intro): self-host intro video with poster, CSP media-src, media cache, and legal Vite entries"
```

---

### Task 3: Standalone Editorial CSS, Intro Script, One-Page `index.html`, and Existing Test Migration

**Files:**
- Create: `src/intro.css`
- Create: `src/intro.js`
- Modify: `index.html` (full replacement from dashboard duplicate to standalone intro page)
- Modify: `src/utils/assignmentsView.test.js:431-438`
- Modify: `src/utils/checklist.test.js:154-162`
- Modify: `src/utils/focusTime.test.js:173-185,249-260,295-303,544-555`
- Modify: `src/utils/navigation.test.js:35-41`
- Modify: `src/utils/uiState.test.js:171-176`
- Modify: `src/utils/introPage.test.js`

**Interfaces:**
- Consumes:
  - `src/utils/uiState.js` (`THEME_STORAGE_KEY`, `normalizeThemePreference`, `resolveEffectiveTheme`, `getNextTheme`, `getThemeToggleDisplay`)
  - `src/utils/introRouting.js` (`resolveLegalHeaderCta`)
  - `/media/intro.mp4` and `/media/intro-poster.jpg` from Task 2
- Produces:
  - `src/intro.css` (shared editorial monochrome light/dark stylesheet including `.legal-article` rules for Task 4)
  - `src/intro.js` (public-page bootstrapper binding `#btn-theme-toggle`, cross-tab `storage` + `prefers-color-scheme` sync, `#intro-video` error fallback to `#intro-video-fallback`, and `[data-legal-app-cta]` label/href update)
  - `index.html` (standalone Muesli-style intro page with pre-paint theme + redirect scripts)

- [ ] **Step 1: Add failing intro-page markup & CSS tests in `src/utils/introPage.test.js`**

Add a `describe('One-Page Introduction Markup, Theme & Assets (index.html)', ...)` block asserting:
- `index.html` links `/src/intro.css` and `/src/intro.js` and does **NOT** reference `/src/main.js`, `/src/app.js`, or `firebase`.
- `index.html` contains `try{` pre-paint `unisphere_theme` script AND pre-paint `unisphere_workspace_session_email` redirect to `/pages/dashboard.html` guarded by `params.get('intro') === '1'` (or equivalent `URLSearchParams` `intro=1` bypass).
- `index.html` contains:
  - `id="btn-theme-toggle"`
  - Eyebrow promise mentioning `Built by students, for students` and `Free` + `Open Source` linking to `https://github.com/matteoppet/unisphere`
  - Distraction-free / anti-bloat messaging
  - Primary CTA text `Start Your New Life` linking to `/pages/login.html#register`
  - Skip-to-login links (`Log in` in header and skip link in hero) linking to `/pages/login.html#login`
  - `<video` with `id="intro-video"`, `controls`, `playsinline`, `preload="metadata"`, `poster="/media/intro-poster.jpg"`, `<source src="/media/intro.mp4" type="video/mp4"`, and `id="intro-video-fallback"`
  - Three feature pillars covering **Courses**, **Session Logs**, and **Friends** / **Groups** (Squads), with explicit note that Squads lives in its own tab so solo study stays distraction-free
  - At least 4 native `<details>` FAQ items
  - Footer links to `/pages/privacy.html`, `/pages/terms.html`, `/pages/login.html#login`, and `https://github.com/matteoppet/unisphere`
- `src/intro.css` declares `color-scheme: light dark`, `html[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`, `.legal-article`, and contains **zero** external `@import` / `fonts.googleapis.com` URLs and **zero** `linear-gradient` / `radial-gradient` declarations.

- [ ] **Step 2: Run `node --test src/utils/introPage.test.js` to verify failure**

Run: `node --test src/utils/introPage.test.js`
Expected: FAIL on `index.html` still being the old dashboard copy and missing `src/intro.css` / `src/intro.js`.

- [ ] **Step 3: Create `src/intro.css` and `src/intro.js`**

- **`src/intro.css`:**
  - Light tokens (`--bg: #ffffff`, `--surface: #fafafa`, `--ink: #111111`, `--ink-muted: #555555`, `--border: #e2e2e2`, `--border-strong: #111111`, `--btn-bg: #111111`, `--btn-fg: #ffffff`, `--status-green: #008000`) and dark tokens under `html[data-theme="dark"]` & `@media (prefers-color-scheme: dark)` (`--bg: #121316`, `--surface: #1a1c20`, `--ink: #e6e8ec`, `--ink-muted: #a3aab5`, `--border: #2e323a`, `--border-strong: #e6e8ec`, `--btn-bg: #e6e8ec`, `--btn-fg: #121316`, `--status-green: #5cd67d`).
  - Editorial typography: `"Times New Roman", Times, Georgia, serif` for display headings (`h1`, `h2`, `h3`, `.intro-brand`) and `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for UI labels, buttons, metadata, and body copy.
  - Layout primitives: `.intro-header` (`max-width: 1040px`, sticky-free minimal top bar), `.intro-hero` (centered editorial rhythm, generous vertical spacing), `.intro-video-stage` (hairline-bordered browser-frame shell + 16:9 `<video>`), `.bento-grid` (2-column desktop, 1-column `<= 760px`, with `.bento-card-wide { grid-column: 1 / -1; }` and crisp static UI vignette subcomponents), `.faq-section` (`max-width: 680px` native `<details>` dividers), `.closing-cta`, `.intro-footer`, and `.legal-article` (`max-width: 720px` clean typographic spacing for `pages/privacy.html` and `pages/terms.html`).
  - Accessible `:focus-visible` ring and `.skip-link`. No gradients, no glow blobs.
- **`src/intro.js`:**
  - Imports `THEME_STORAGE_KEY`, `normalizeThemePreference`, `resolveEffectiveTheme`, `getNextTheme`, `getThemeToggleDisplay` from `./utils/uiState.js` and `resolveLegalHeaderCta` from `./utils/introRouting.js`.
  - Exports `initIntroPage()` (and invokes it automatically when `typeof document !== 'undefined'`):
    - Applies initial theme to `document.documentElement` and updates `#btn-theme-toggle` text & `aria-label`.
    - Binds click on `#btn-theme-toggle` to toggle and persist `THEME_STORAGE_KEY` in `localStorage`.
    - Listens to `window` `storage` event for `THEME_STORAGE_KEY` and `matchMedia('(prefers-color-scheme: dark)')` changes when no explicit preference is stored.
    - If `#intro-video` and `#intro-video-fallback` exist, listens to `error` on `#intro-video` and its `<source>` elements to reveal `#intro-video-fallback` and hide the broken player gracefully.
    - If `[data-legal-app-cta]` exists, reads `unisphere_workspace_session_email` inside `try/catch`, calls `resolveLegalHeaderCta(sessionEmail)`, and updates `textContent` and `href`.

- [ ] **Step 4: Replace `index.html` with the standalone English one-page introduction**

Build `index.html` with:
- `<head>`: title `UniSphere — Built by Students, for Students`, meta description, pre-paint `try/catch` theme script (`unisphere_theme`), pre-paint `try/catch` redirect script matching `shouldRedirectFromIntro` (`localStorage.getItem('unisphere_workspace_session_email')` trimmed truthy AND `new URLSearchParams(window.location.search).get('intro') !== '1'` -> `window.location.replace('/pages/dashboard.html')`), and `<link rel="stylesheet" href="/src/intro.css" />`.
- `<header class="intro-header">`: `UniSphere` link (`/?intro=1`), `Open Source` (`https://github.com/matteoppet/unisphere`), `#btn-theme-toggle`, `Log in` (`/pages/login.html#login`), and `Start Your New Life` (`/pages/login.html#register`).
- `<main id="intro-main">`:
  1. **Hero + Video Stage:** Eyebrow badge *"Built by students, for students · 100% Free & Open Source"* (linking to GitHub) -> serif `<h1>` -> concise distraction-free, anti-bloat subline -> **"Start Your New Life"** primary CTA (`/pages/login.html#register`) -> quiet *"Already have an account? Skip directly to login"* (`/pages/login.html#login`) -> 16:9 stage frame (`unispherelife.me` top bar) holding `<video id="intro-video" controls playsinline preload="metadata" poster="/media/intro-poster.jpg">` + `<source src="/media/intro.mp4" type="video/mp4" />` + hidden `#intro-video-fallback` + caption *"24-second walkthrough · Press play with sound"*.
  2. **3-Pillar Bento Grid:**
     - Card 1: **Courses & Credits** (static mini table with `Analisi 1`, `Fisica 1`, `Algoritmi`, CFU progress `120 / 180 CFU`, weighted grade `28.4 / 30`).
     - Card 2: **Session Logs** (static 7-day study hours strip `Mon–Sun` + compact study log rows).
     - Card 3 (`.bento-card-wide`, featured full-width): **Friends & Study Groups** (side-by-side static mini vignettes of a Live Study Squad with active members & weekly goal progress bar + a Friends tracker list; copy highlights studying with friends and creating groups while explicitly noting Squads live strictly in their own tab so solo study stays 100% distraction-free).
  3. **FAQ (`<details>`):** 4 concise Q&As (Free forever? Open-source? Do I have to join a group? How is my data handled?).
  4. **Closing CTA:** Concise heading + **"Start Your New Life"** (`/pages/login.html#register`) + **"Skip to login"** (`/pages/login.html#login`).
- `<footer class="intro-footer">`: `UniSphere · MIT Open Source` · `GitHub` · `Privacy Policy` (`/pages/privacy.html`) · `Terms & Conditions` (`/pages/terms.html`) · `Log in` (`/pages/login.html#login`).
- `<script type="module" src="/src/intro.js"></script>`.

- [ ] **Step 5: Update the 5 existing dashboard-markup test files**

Remove `index.html` from dashboard-specific markup assertions (keeping `pages/dashboard.html` and other `pages/*.html` intact):
- `src/utils/assignmentsView.test.js:432`: `['pages/assignments.html', 'pages/dashboard.html']`
- `src/utils/checklist.test.js:155`: `['pages/dashboard.html']`
- `src/utils/focusTime.test.js:174,251,296,545`: drop `index.html` checks, keep `pages/dashboard.html` and `pages/logs.html`
- `src/utils/navigation.test.js:36`: keep the 7 `pages/*.html` files, drop `'index.html'`
- `src/utils/uiState.test.js:172`: `['pages/dashboard.html']` (keep `'index.html'` in line 277's `#btn-theme-toggle` + `unisphere_theme` test!)

- [ ] **Step 6: Run full test suite to verify pass**

Run: `npm test`
Expected: PASS (0 failing tests across all suites).

- [ ] **Step 7: Commit**

Run:
```powershell
git add index.html src/intro.css src/intro.js src/utils/introPage.test.js src/utils/assignmentsView.test.js src/utils/checklist.test.js src/utils/focusTime.test.js src/utils/navigation.test.js src/utils/uiState.test.js
git commit -m "feat(intro): build standalone Muesli-style intro page and migrate dashboard tests"
```

---

### Task 4: Standalone English Privacy Policy & Terms Pages

**Files:**
- Create: `pages/privacy.html`
- Create: `pages/terms.html`
- Modify: `src/utils/uiState.test.js:275-290`
- Modify: `src/utils/introPage.test.js`

**Interfaces:**
- Consumes: `/src/intro.css` (`.legal-article`), `/src/intro.js` (`#btn-theme-toggle`, `[data-legal-app-cta]`)
- Produces: public static pages `/pages/privacy.html` and `/pages/terms.html`

- [ ] **Step 1: Add failing tests for `pages/privacy.html` and `pages/terms.html`**

- In `src/utils/uiState.test.js` (line 275 test `wires #btn-theme-toggle and boot theme script across all HTML pages`), add `'pages/privacy.html'` and `'pages/terms.html'` to the checked file list.
- In `src/utils/introPage.test.js`, add a `describe('Standalone Legal Pages (privacy.html & terms.html)', ...)` block asserting:
  - Both files exist, link `/src/intro.css` and `/src/intro.js`, do **NOT** import `/src/main.js` or `src/app.js`, and do **NOT** contain `window.location.replace` (so signed-in users are never redirected away from legal pages).
  - Both include `data-legal-app-cta`, `UniSphere Project Maintainer`, `privacy@unispherelife.me`, and `27 November 2026`.
  - `pages/privacy.html` explicitly covers: `GDPR` (`2016/679`), `Art. 6(1)(b)`, `Art. 6(1)(f)`, `Google` / `Firebase`, `Vercel`, `Resend`, `Cloudflare`, `Data Privacy Framework`, `localStorage`, `zero tracking` / no cookie banner explanation, `Garante per la protezione dei dati personali`, `garanteprivacy.it`, JSON/CSV portability, and age `16` / `14` (`Art. 2-quinquies`).
  - `pages/terms.html` explicitly covers: `MIT License`, user ownership of study data, age `16` / `14`, Squads acceptable use & `Digital Services Act` reporting via `privacy@unispherelife.me`, and Italian Civil Code `Art. 1229` (*dolo o colpa grave* / willful misconduct or gross negligence).

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `node --test src/utils/uiState.test.js src/utils/introPage.test.js`
Expected: FAIL because `pages/privacy.html` and `pages/terms.html` do not exist yet.

- [ ] **Step 3: Create `pages/privacy.html` and `pages/terms.html`**

Author both standalone English pages using the exact spec sections:
- Minimal header (`UniSphere` -> `/?intro=1`, `#btn-theme-toggle`, `<a href="/pages/login.html#login" data-legal-app-cta>Log in</a>`), `<main class="legal-article">`, and minimal footer cross-linking Intro, Privacy Policy, Terms & Conditions, and GitHub.
- Pre-paint `unisphere_theme` script in `<head>` (NO dashboard redirect script!).
- Plain, readable, honest English legal copy matching UniSphere's real codebase data inventory and all Italian/EU compliance points from the spec.

- [ ] **Step 4: Run targeted tests to verify pass**

Run: `node --test src/utils/uiState.test.js src/utils/introPage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:
```powershell
git add pages/privacy.html pages/terms.html src/utils/uiState.test.js src/utils/introPage.test.js
git commit -m "feat(legal): add English GDPR/Garante Privacy Policy and EU/Italian Terms pages"
```

---

### Task 5: Login & Registration Compliance Notice, Hash Focus Targeting & Production Verification

**Files:**
- Modify: `pages/login.html:14-122`
- Modify: `src/app.js:124-136,1272-1307,4230-4265`
- Modify: `src/index.css` (login card highlight, legal checkbox/note, and footer styles in light + dark)
- Modify: `src/utils/introPage.test.js`

**Interfaces:**
- Consumes: `resolveLoginFocusTarget` and `validateRegistrationTermsAccepted` from `src/utils/introRouting.js`; `/pages/privacy.html` and `/pages/terms.html` from Task 4
- Produces: compliant registration flow (`#auth-reg-terms` unchecked by default + enforced in `src/app.js`), `#login` / `#register` hash targeting in `populateLoginPage()`, and return-to-intro header link on `pages/login.html`

- [ ] **Step 1: Add failing tests for `pages/login.html`, `src/app.js`, and `src/index.css` in `src/utils/introPage.test.js`**

Add a `describe('Login & Registration Legal Wiring and Hash Targeting', ...)` block asserting:
- `pages/login.html` header links `UniSphere` to `/?intro=1` WITHOUT `data-nav`.
- `pages/login.html` has `id="auth-card-login"` and `id="auth-card-register"`.
- `pages/login.html` has `<input type="checkbox" id="auth-reg-terms"` with `required` and WITHOUT a `checked` attribute, linking `/pages/terms.html`, plus a separate non-checkbox acknowledgment link to `/pages/privacy.html`.
- `pages/login.html` includes a concise legal notice referencing `/pages/terms.html` and `/pages/privacy.html` inside the Sign In card (under `#btn-google-sso`) and a minimal footer linking `/?intro=1`, `/pages/privacy.html`, `/pages/terms.html`, and `https://github.com/matteoppet/unisphere`.
- `src/app.js` imports and calls `resolveLoginFocusTarget` inside `populateLoginPage` and `validateRegistrationTermsAccepted` inside the `#form-auth-register` submit handler before calling Firebase.
- `src/index.css` styles `.auth-card-targeted`, `.auth-legal-note`, and `.auth-footer` for both light and dark themes.

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `node --test src/utils/introPage.test.js`
Expected: FAIL on missing login legal checkbox, hash targeting, and CSS selectors.

- [ ] **Step 3: Update `pages/login.html`, `src/app.js`, and `src/index.css`**

- **`pages/login.html`:**
  - Replace `<span class="site-brand">UniSphere</span>` with `<a href="/?intro=1" class="site-brand">UniSphere</a>` (no `data-nav`).
  - Add `id="auth-card-login"` on the Sign In `<section class="card">` and `id="auth-card-register"` on the Register `<section class="card">`.
  - Under Sign In's `.card-toolbar`, add `<p class="auth-legal-note">Signing in with Google is governed by our <a href="/pages/terms.html">Terms &amp; Conditions</a> and <a href="/pages/privacy.html">Privacy Policy</a>.</p>`.
  - Above `#auth-reg-error` in `#form-auth-register`, add the unchecked required click-wrap checkbox `#auth-reg-terms` (*"I agree to the Terms & Conditions and confirm I am at least 16 years old (or 14+ in Italy)."*) and a separate `<p class="auth-legal-note">` acknowledging `/pages/privacy.html` (*"By creating an account, you acknowledge our Privacy & Storage Policy (strictly necessary storage only, zero ads or tracking)."*).
  - Add a minimal `<footer class="auth-footer">` inside `#root` linking Intro (`/?intro=1`), Privacy Policy (`/pages/privacy.html`), Terms & Conditions (`/pages/terms.html`), and GitHub.
- **`src/app.js`:**
  - Import `{ resolveLoginFocusTarget, validateRegistrationTermsAccepted } from './utils/introRouting.js'`.
  - In `populateLoginPage()`: call `resolveLoginFocusTarget(window.location.hash)`, toggle `.auth-card-targeted` on `#auth-card-login` / `#auth-card-register`, focus `#auth-reg-name` (and scroll `#auth-card-register` into view when `window.innerWidth <= 720`) on `'register'`, or focus `#auth-login-email` on `'login'`.
  - In `#form-auth-register` submit handler (right before or alongside the required-fields check, before any Firebase call): read `document.getElementById('auth-reg-terms')?.checked`, call `validateRegistrationTermsAccepted(...)`, and on `!valid` set `authNotice = { type: 'error', scope: 'register', text: termsCheck.error }`, call `populateLoginPage()`, and `return`.
- **`src/index.css`:**
  - Add crisp monochrome light & dark styles for `.auth-card-targeted`, `.auth-legal-row`, `.auth-legal-note`, and `.auth-footer` (matching existing border-and-ink palette).

- [ ] **Step 4: Run full verification suite (tests, TypeScript lint, production build, dist check)**

Run:
```powershell
npm test; if ($LASTEXITCODE -eq 0) { npm run lint }; if ($LASTEXITCODE -eq 0) { npm run build }
```
Verify:
- `npm test` exits 0 with all suites passing.
- `npm run lint` (`tsc --noEmit`) exits 0.
- `npm run build` exits 0 and emits `dist/index.html`, `dist/pages/privacy.html`, `dist/pages/terms.html`, `dist/pages/login.html`, `dist/pages/dashboard.html`, `dist/media/intro.mp4`, and `dist/media/intro-poster.jpg`.
- Confirm `dist/index.html` references only the small intro JS/CSS assets (not Firebase or `main.js`).

- [ ] **Step 5: Commit**

Run:
```powershell
git add pages/login.html src/app.js src/index.css src/utils/introPage.test.js
git commit -m "feat(auth): add Terms click-wrap, Privacy notice, and intro hash targeting on login"
```
