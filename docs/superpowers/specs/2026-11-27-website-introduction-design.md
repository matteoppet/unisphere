# UniSphere One-Page Website Introduction & Legal Foundations Design (Milestone 1)

**Date:** 2026-11-27
**Size:** Project (Milestone 1 of 2; Milestone 2 covers GDPR Art. 32 `firestore.rules` hardening and GDPR Art. 17 self-serve account deletion in `pages/settings.html`)

## Intent & Why

Currently, `index.html` is a duplicate of the authenticated Dashboard (`pages/dashboard.html`) and immediately bounces signed-out visitors to `pages/login.html`. New students arriving at `unispherelife.me` never see what UniSphere is, who built it, or why it exists before hitting a login wall.

Milestone 1 replaces `/` with a calm, minimal, distraction-free one-page introduction modeled on `muesli.ing`'s editorial rhythm and rendered in UniSphere's existing monochrome border-and-ink light/dark aesthetic. Right above the fold, a first-time visitor sees that UniSphere is **built by students, for students**, **100% free and MIT open-source** (`https://github.com/matteoppet/unisphere`), and **minimal and distraction-free** (explicitly rejecting bloated SaaS and "AI-slop" tropes). It showcases the finished 24.2-second walkthrough video (`C:\Users\matte\orca\workspaces\unisphere\video-promotion\brag-output\brag.mp4`), previews the three core pillars—**Courses**, **Session Logs**, and especially **tracking with Friends and creating Groups (Squads)**—guides new users via **"Start Your New Life"** into registration, offers returning users an immediate **Skip to Login** path, and ships English EU/Italian legal pages (`Privacy & Storage Policy` and `Terms & Conditions`) plus click-wrap compliance on `pages/login.html`.

## Goals, Non-Goals, Anti-Goals

### Goals
- Turn `index.html` into a standalone, lightweight public landing page paired with `src/intro.css` and `src/intro.js` (zero Firebase SDK, zero `src/app.js`).
- Keep all new pages (`index.html`, `pages/privacy.html`, `pages/terms.html`) strictly in **English**.
- Redirect already-signed-in visitors (`localStorage.getItem('unisphere_workspace_session_email')` truthy) visiting `/` straight to `/pages/dashboard.html` before paint, with `/?intro=1` as an explicit bypass so signed-in students can still inspect or share the intro page.
- Provide an always-visible **Log in** skip link in the top header and a quiet *"Skip directly to login"* link under the hero CTA, targeting `/pages/login.html#login`, while **"Start Your New Life"** targets `/pages/login.html#register`.
- Self-host the finished intro video at `public/media/intro.mp4` (copied from `C:\Users\matte\orca\workspaces\unisphere\video-promotion\brag-output\brag.mp4`) with an extracted poster frame at `public/media/intro-poster.jpg` and user-initiated playback with native audio controls inside a clean 16:9 editorial stage frame.
- Present a 3-pillar Muesli-style editorial bento grid (**Courses & Credits**, **Session Logs**, and an emphasized full-width **Friends & Study Groups (Squads)** card) built from lightweight static HTML/CSS UI vignettes matching UniSphere's real light/dark interface, followed by a 4-item native `<details>` FAQ, closing CTA, and minimal footer.
- Publish standalone minimal English legal pages at `pages/privacy.html` (GDPR Reg. (EU) 2016/679 Art. 13 + Italian Privacy Code D.Lgs. 196/2003 + ePrivacy / Garante 2021 Cookie & Local Storage disclosure) and `pages/terms.html` (Terms & Conditions + Italian Civil Code Art. 1229/1341–1342 + EU DSA Art. 11–16 contact and Squads acceptable use).
- Add an unchecked required Terms & minimum-age checkbox (`#auth-reg-terms`) + separate Privacy Policy acknowledgment link to `#form-auth-register` in `pages/login.html`, a concise Terms/Privacy notice beneath `#btn-google-sso`, a header link back to `/?intro=1`, and hash-based card focus/highlight (`#register` vs `#login`) in `src/app.js`.
- Sync light/dark theme (`unisphere_theme` in `localStorage`, `prefers-color-scheme`, and `#btn-theme-toggle`) seamlessly across `index.html`, `pages/privacy.html`, `pages/terms.html`, and the authenticated app.
- Update CSP (`media-src 'self'`), media cache headers (`/media/(.*)`), `vite.config.ts` multi-page inputs, and existing test suites so `npm test` and `npm run build` pass cleanly.

### Non-Goals
- Modifying `firestore.rules` or implementing in-app self-serve "Delete My Account" (explicitly Milestone 2).
- Introducing React, Tailwind CSS, Astro, external font CDNs, third-party analytics, or cookie banners.
- Redesigning authenticated workspace pages (`dashboard`, `courses`, `logs`, `assignments`, `squads`, `settings`) or altering solo-user isolation inside the app.
- Adding an Italian translation or multi-language switcher.

### Anti-Goals
- "AI-slop" visual clichés: neon/purple gradients, decorative glows, fake testimonials, hype buzzwords, popups, or unsolicited autoplaying audio.
- Loading Firebase or the 6,000-line `src/app.js` bundle on the public `/` intro page.
- Adding any third-party script, CDN font, or third-party video embed that leaks visitor IPs/cookies and would trigger a mandatory Garante cookie consent banner.
- Breaking existing authenticated routing, deep-links to `/pages/*.html`, or `src/app.js` SPA navigation.

## Constraints

- **Vanilla HTML/CSS/JS + Vite Multi-Page (`vite.config.ts`):**
  - `vite.config.ts` currently registers `main` (`index.html`), `login`, `dashboard`, `courses`, `logs`, `assignments`, `squads`, and `settings` under `build.rollupOptions.input`. Milestone 1 must add `privacy` (`pages/privacy.html`) and `terms` (`pages/terms.html`) so Vite builds and emits both static HTML pages into `dist/pages/`.
  - `public/` does not exist yet. Placing `intro.mp4` and `intro-poster.jpg` under `public/media/` lets Vite serve them at `/media/*` in dev and copy them directly into `dist/media/*` on build.
- **Vercel & Express Routing and Security Headers (`vercel.json`, `server.ts`, `src/lib/authService.js`):**
  - Add `media-src 'self'` to Content-Security-Policy in all three places: `vercel.json`, `server.ts`, and `getSecurityHeaders()` in `src/lib/authService.js`.
  - Add a dedicated cache header rule for `/media/(.*)` in `vercel.json` and `server.ts` using `Cache-Control: public, max-age=86400` (avoiding `immutable` because `intro.mp4` is unhashed and may be replaced later).
  - Keep existing `/api/(.*)`, `/pages/(.*)`, and fallback `/(.*) -> /index.html` rewrites intact; static files in `dist/media/` resolve before fallback rewrites on Vercel and via `express.static` in `server.ts`.
- **Existing Test Suite (`npm test`):**
  - Five existing test files currently assume `index.html` is a copy of `pages/dashboard.html`:
    - `src/utils/assignmentsView.test.js`: keep `pages/assignments.html` and `pages/dashboard.html`, drop `index.html` from the `#modal-assignment` check.
    - `src/utils/checklist.test.js`: check `pages/dashboard.html` for `#dash-goals-card` / `#modal-goal`, drop `index.html`.
    - `src/utils/focusTime.test.js`: check `pages/dashboard.html` and `pages/logs.html` for `.table-scroll-sm`, `#modal-log`, and `.week-switcher`, drop dashboard checks on `index.html`.
    - `src/utils/navigation.test.js`: check the 7 `pages/*.html` app/login pages for `#nav-list`, drop `index.html`.
    - `src/utils/uiState.test.js`: drop `index.html` from the `#dash-undo-banner` check; **keep** `index.html` in the `#btn-theme-toggle` + `unisphere_theme` boot-script check and **add** `pages/privacy.html` and `pages/terms.html` to it.
  - Keep `src/utils/security.test.js` green and verify `media-src 'self'` in `getSecurityHeaders()`.
  - Add `src/utils/introPage.test.js` verifying intro page structure, video tags/assets, skip-to-login links, signed-in redirect script, legal pages, and login Terms checkbox wiring.
- **Solo-User Isolation:** Squads & Friends remain exclusively inside `/pages/squads.html` in the app; the intro page explicitly communicates that solo tracking stays distraction-free.
- **Zero Tracking / Cookie-Banner-Free:** Use system fonts only, self-hosted `/media/intro.mp4`, and strictly necessary `localStorage` (`unisphere_theme` and reading `unisphere_workspace_session_email`) so no cookie consent banner is required under EU/Italian law.

## Approaches Considered

1. **Approach 1 (Selected): Standalone Muesli-style editorial page (`index.html` + `src/intro.css` + `src/intro.js`)**
   - Fast, zero-Firebase landing entry following `muesli.ing`'s editorial rhythm (minimal header -> centered hero + self-hosted video stage -> 3-pillar monochrome UI preview bento -> native `<details>` FAQ -> closing CTA & legal footer) with zero CSS conflicts against `src/index.css`.
   - **Tradeoffs:** Introduces a dedicated `src/intro.css` and `src/intro.js` alongside `src/index.css` and `src/app.js` and requires updating the 5 existing tests that checked dashboard markup in `index.html`. Selected because it delivers `muesli.ing`'s calm editorial layout cleanly, loads instantly without Firebase overhead, and showcases Courses, Logs, and Friends/Groups visually even before a visitor clicks play.
2. **Approach 2: Ultra-spare single-beat intro (no bento previews or FAQ)**
   - Same standalone architecture, but removes the preview cards and FAQ in favor of a hero, video stage, and 3-item text strip.
   - **Tradeoffs:** Fewer lines of markup, but less faithful to `muesli.ing` and gives visitors who scan without playing the video no visual preview of Courses, Session Logs, or Friends/Groups.
3. **Approach 3: Unified app-shell route inside `src/app.js` & `src/index.css` (`pages/intro.html`)**
   - Keeps `index.html` booting `src/app.js` and verifies Firebase Auth live on `/`.
   - **Tradeoffs:** Forces every first-time landing visitor to download Firebase and the 6,000-line `src/app.js` bundle and couples editorial landing CSS to workspace shell rules.

## Decided Design (How Milestone 1 Works)

### A. Entry, Redirect & Skip-to-Login Flow
- **Pre-paint `<head>` scripts in `index.html`:**
  1. **Theme hydration:** Read `localStorage.getItem('unisphere_theme')` (falling back to `prefers-color-scheme: dark`) and set `data-theme="light"|"dark"` on `<html>` before first paint.
  2. **Instant signed-in redirect:** If `localStorage.getItem('unisphere_workspace_session_email')` is truthy **and** `!new URLSearchParams(window.location.search).has('intro')`, execute `window.location.replace('/pages/dashboard.html')` immediately.
- **Public navigation targets on `index.html`:**
  - Top-bar **Log in** -> `/pages/login.html#login`
  - Top-bar compact **Start Your New Life** -> `/pages/login.html#register`
  - Hero primary **Start Your New Life** -> `/pages/login.html#register`
  - Hero quiet skip link (*"Already have an account? Skip to login"*) -> `/pages/login.html#login`
  - Closing CTA **Start Your New Life** -> `/pages/login.html#register` and **Log in** -> `/pages/login.html#login`
- **`pages/login.html` & `src/app.js` behavior:**
  - Replace the static `<span class="site-brand">UniSphere</span>` in `pages/login.html` header with `<a href="/?intro=1" class="site-brand">UniSphere</a>` (without `data-nav`, so `src/app.js` does not intercept it as an in-app route).
  - Update `populateLoginPage()` in `src/app.js` to inspect `window.location.hash`:
    - `#register`: add `.auth-card-targeted` to the Register card, remove it from Sign In, scroll the Register card into view on narrow viewports if needed, and focus `#auth-reg-name`.
    - `#login`: add `.auth-card-targeted` to the Sign In card, remove it from Register, and focus `#auth-login-email`.
    - No hash: clear `.auth-card-targeted` from both cards.
  - Logout (`handleLogout`) stays unchanged: clears `unisphere_workspace_session_email` and loads `/pages/login.html`.

### B. One-Page Intro Structure (`index.html`, `src/intro.css`, `src/intro.js`)
- **Visual System (`src/intro.css`):**
  - Monochrome light palette (`#ffffff` background, `#fafafa` card/stage surface, `#111111` primary ink, `#555555` muted ink, `#e2e2e2` hairline borders, `#008000` semantic green only inside static passed/live vignette badges) and dark palette (`#121316` background, `#1a1c20` surface, `#e6e8ec` primary ink, `#a3aab5` muted ink, `#2e323a` hairline borders, `#5cd67d` semantic green inside vignettes), toggled via `html[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`.
  - Classic serif (`"Times New Roman", Times, Georgia, serif`) for display headlines and brand mark paired with clean system sans (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) for compact labels, buttons, and metadata. Zero external font requests.
  - Generous vertical breathing room (`max-width: 1040px` main stage/bento container, `max-width: 680px` editorial FAQ/legal column), crisp 1px borders, zero neon accents, gradients, or decorative glow effects.
- **Section 1 — Minimal Header:**
  - Left: `UniSphere` wordmark link (`/?intro=1`).
  - Right: `Open Source` link (`https://github.com/matteoppet/unisphere`, `target="_blank" rel="noopener noreferrer"`), `#btn-theme-toggle` (`Dark Theme` / `Light Theme`), `Log in` (`/pages/login.html#login`), and compact `Start Your New Life` button (`/pages/login.html#register`). Responsive on mobile so `Log in` and `#btn-theme-toggle` stay clearly accessible without horizontal overflow.
- **Section 2 — Centered Hero & Video Stage:**
  - **Top Eyebrow Badge (first visible element):** *"Built by students, for students · 100% Free & Open Source"* linking to GitHub.
  - **Display `<h1>` & Subline:** Clear statement that UniSphere organizes your university life in one minimal, distraction-free workspace—zero ads, zero paywalls, zero AI-slop.
  - **Primary CTA & Skip Line:** Prominent **"Start Your New Life"** link button (`/pages/login.html#register`) followed directly by *"Already have an account? [Skip to login](/pages/login.html#login)"*.
  - **16:9 Editorial Video Stage:** Window-framed container (`unispherelife.me` minimal top bar) holding `<video id="intro-video" controls playsinline preload="metadata" poster="/media/intro-poster.jpg">` with `<source src="/media/intro.mp4" type="video/mp4">` (copied from `C:\Users\matte\orca\workspaces\unisphere\video-promotion\brag-output\brag.mp4`, 2.27 MB, 1920x1080 H.264/AAC, 24.2s) and a graceful static fallback caption/notice if the video fails to load. Quiet caption underneath (e.g., *"24s walkthrough · Sound on when you press play"*).
- **Section 3 — 3-Pillar Muesli-Style Feature Bento Grid:**
  - 2-column desktop / 1-column mobile grid of hairline-bordered cards, each pairing a static HTML/CSS UI vignette (with `aria-hidden="true"` on purely decorative mock elements or clean semantic markup) with concise editorial copy:
    1. **Courses & Credits (half-width):** Compact table vignette showing realistic university courses (`Analisi 1`, `Fisica 1`, etc.), `Active` / `Passed` status, CFU total (`120 / 180 CFU`), and weighted average (`28.4 / 30`), explaining course, exam, and deadline tracking in one view.
    2. **Session Logs (half-width):** Compact 7-day study hours strip (`Mon–Sun`) and recent study session log rows (`Deep Work`, `Exam Prep`), explaining calm session logging without noisy timers or gamified clutter.
    3. **Friends & Study Groups (Squads) (full-width featured card across both columns):** Side-by-side vignette showing a live Study Squad (`Live` studying members, weekly shared goal progress bars) alongside a Friends study activity list, explaining how students track together, race sessions, and keep each other accountable—while explicitly noting that Squads lives strictly inside its own tab so solo study stays completely distraction-free.
- **Section 4 — Compact Native FAQ (`<details>` / `<summary>`):**
  - Centered `max-width: 680px` reader column with 4 concise, honest Q&As:
    1. *Is UniSphere really free?* (Yes, 100% free, no paywalls or ads.)
    2. *Is it open-source?* (Yes, MIT-licensed on GitHub at `matteoppet/unisphere`.)
    3. *Do I have to join a group or use Squads?* (No—solo users get zero social clutter; Squads & Friends stay isolated in the Squads tab.)
    4. *What happens to my data?* (Synced for your workspace and Squads with Firebase, zero tracking cookies or ads, JSON/CSV export anytime, links to Privacy Policy & Terms.)
- **Section 5 — Closing CTA & Minimal Footer:**
  - Centered closing beat repeating **"Start Your New Life"** + *"Skip to login"*.
  - Single-line footer: `UniSphere · MIT Open Source` · `GitHub` · `Privacy Policy` (`/pages/privacy.html`) · `Terms & Conditions` (`/pages/terms.html`) · `Log in` (`/pages/login.html#login`).

### C. Standalone English Legal Pages (`pages/privacy.html` & `pages/terms.html`)
- **Shared Chrome & Script:** Both pages load `src/intro.css` (using `.legal-article` constrained to `max-width: 720px`) and `src/intro.js` (binding `#btn-theme-toggle` and theme sync only—`pages/privacy.html` and `pages/terms.html` **never** run the signed-in dashboard auto-redirect, so signed-in users can always read legal policies).
- **Minimal Legal Header:** `UniSphere` (`/?intro=1`), `#btn-theme-toggle`, and `Log in` (`/pages/login.html#login`, dynamically updated by `src/intro.js` to `Open App` -> `/pages/dashboard.html` if `unisphere_workspace_session_email` is present in `localStorage`).
- **`pages/privacy.html` (Privacy & Storage Policy — GDPR Art. 13, D.Lgs. 196/2003, ePrivacy / Garante 2021):**
  - Last updated date (`27 November 2026`).
  - Data Controller & contact block (`UniSphere Project Maintainer`, `privacy@unispherelife.me`).
  - Exact inventory of data collected:
    - *Account & Profile:* email, display name, hashed password (PBKDF2) or Google SSO ID, optional student ID (*matricola*), institution, degree program & target CFU.
    - *Academic Workspace:* courses, grades, study session logs, exam/assignment deadlines, goals, quick notes, resource links.
    - *Social (Optional — Squads & Friends):* display name, email, live study status/subject, weekly study totals, squad notes/activities, friendship links.
    - *Technical Security Data:* IP address held transiently in server memory (up to 15 minutes) for email OTP rate-limiting, plus standard hosting/DNS logs.
  - Purposes & Lawful Bases (GDPR Art. 6): `Art. 6(1)(b)` contract performance for account creation, cloud sync, OTP email delivery, and optional Squads/Friends features; `Art. 6(1)(f)` legitimate interest for abuse prevention/rate-limiting and service security. Explicit statement of **zero advertising, zero behavioral profiling, zero sale of data, and zero AI model training**.
  - Sub-processors & International Transfers (GDPR Chapter V): **Google LLC** (Firebase Auth & Cloud Firestore), **Vercel Inc.** (hosting & serverless functions), **Resend Inc.** (transactional OTP email), and **Cloudflare Inc.** (DNS), noting reliance on Data Processing Addenda and the EU–US Data Privacy Framework / Standard Contractual Clauses.
  - Cookies & Local Storage (ePrivacy Directive / Art. 122 D.Lgs. 196/2003 / Garante Guidelines 2021): Exact disclosure that UniSphere uses **zero tracking or analytics cookies** and stores only strictly necessary technical keys in `localStorage`/`sessionStorage` (`unisphere_workspace_session_email`, offline workspace caches, `unisphere_theme`, and temporary OTP state), which are exempt from prior cookie-banner consent.
  - Retention Periods: Active workspace data kept while the account exists; in-memory rate-limit IP buckets discarded after 15 minutes; temporary OTP verification records expire after 15 minutes.
  - User Rights (GDPR Art. 15–22) & Supervisory Authority: Access, rectification, restriction, objection, and portability (pointing directly to instant JSON/CSV export in Settings), erasure via `privacy@unispherelife.me` (noting self-serve in-app account deletion is scheduled in Milestone 2), and right to lodge a complaint with the **Garante per la protezione dei dati personali** (`garanteprivacy.it`) or the user's local EU supervisory authority.
  - Minimum Age: Service intended for users aged **16+** across the EU (**14+** in Italy under Art. 2-quinquies D.Lgs. 196/2003).
- **`pages/terms.html` (Terms & Conditions — Italian Civil Code & EU DSA):**
  - Last updated date (`27 November 2026`).
  - Nature of Service: Free, non-commercial, student-built open-source academic workspace provided "as is" without commercial SLA guarantees.
  - Eligibility & Accounts: 16+ EU / 14+ Italy requirement; keeping account credentials secure.
  - Acceptable Use & Moderation (Squads & Friends + EU DSA Art. 11–16): Prohibition on harassment, hate speech, impersonation, spam, illegal content, or automated scraping/abuse; single point of contact (`privacy@unispherelife.me`) for user reports and authority notices; right to remove offending Squad content or suspend abusive accounts with clear reasoning.
  - Intellectual Property: Source code is licensed under the MIT License (`github.com/matteoppet/unisphere`); students retain 100% ownership of their personal academic notes, logs, and data.
  - Availability & Limitation of Liability: No liability for academic outcomes or service downtime, explicitly preserving liability where exclusion is prohibited by law (including willful misconduct or gross negligence—*dolo o colpa grave*—under Art. 1229 of the Italian Civil Code and mandatory EU rights).
  - Changes, Termination & Governing Law: Transparent updates, user right to stop using/export data anytime, Italian/EU applicable framework, and contact email.

### D. Registration & Login Compliance Updates (`pages/login.html` & `src/app.js`)
- In `#form-auth-register` (`pages/login.html`):
  - Add an unchecked required click-wrap checkbox `#auth-reg-terms` before the `Register` submit button:
    *"I agree to the [Terms & Conditions](/pages/terms.html) and confirm I am at least 16 years old (or 14+ in Italy)."*
  - Add a separate, non-checkbox acknowledgment note directly beneath (not bundled as GDPR consent):
    *"By creating an account, you acknowledge our [Privacy & Storage Policy](/pages/privacy.html) (strictly necessary storage only, zero ads or tracking)."*
  - Enforce `#auth-reg-terms.checked` inside the `#form-auth-register` submit handler in `src/app.js`, displaying a clear message in `#auth-reg-error` if unchecked.
- In Sign In (`#form-auth-login` in `pages/login.html`):
  - Add a concise helper line beneath `#btn-google-sso`: *"Signing in with Google is governed by our [Terms & Conditions](/pages/terms.html) and [Privacy Policy](/pages/privacy.html)."*
- On `pages/login.html` bottom:
  - Add a minimal monochrome footer linking `Intro` (`/?intro=1`), `Privacy Policy` (`/pages/privacy.html`), `Terms & Conditions` (`/pages/terms.html`), and `GitHub`.

### E. Design Calls Made
1. **Data Controller Name & Contact Email:** Set to `UniSphere Project Maintainer` and `privacy@unispherelife.me` on `pages/privacy.html` and `pages/terms.html` — confirm or replace with your preferred legal name and monitored inbox before wide public launch.
2. **Video Playback:** User-initiated playback with native controls (`controls playsinline preload="metadata"`) and an extracted poster frame (`public/media/intro-poster.jpg`) rather than autoplay, because `brag.mp4` includes an AAC audio track and avoiding surprise audio matches the distraction-free ethos.
3. **Signed-In Bypass Parameter:** `/?intro=1` bypasses the instant dashboard redirect so authenticated users can still visit or share the intro page.
4. **Media Cache Policy:** `Cache-Control: public, max-age=86400` (not `immutable`) for `/media/(.*)` in `vercel.json` and `server.ts` so replacing the unhashed `intro.mp4` refreshes within 24 hours.
5. **Zero External Font CDN:** System serif and sans-serif font stacks only (no Google Fonts CDN) to avoid third-party IP requests and keep the site 100% cookie-banner-free under EU/Italian Garante guidelines.
6. **Google Sign-In Legal Notice:** Inline notice under `#btn-google-sso` linking Terms and Privacy rather than blocking returning Google users behind an extra checkbox on every sign-in.

## Left to the Builder

- Exact CSS class names, responsive layout rules, breakpoints, and `.auth-card-targeted` highlight styling in `src/intro.css` and `src/index.css`.
- Realistic academic sample values inside the 3 static bento UI vignettes (`Analisi 1`, `Fisica 1`, etc.).
- Selecting the cleanest frame timestamp from `brag.mp4` via `ffmpeg` when generating `public/media/intro-poster.jpg`.
- Internal helper decomposition of `src/intro.js` and specific unit/markup assertions in `src/utils/introPage.test.js`.
