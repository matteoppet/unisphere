Dr. Unslopovich's follow-up diagnosis
Verdict: Sync telemetry, future weekday cells, modal guards, keyboard/screen-reader semantics, mobile touch targets, and card layout are repaired across Login and Dashboard; three user-owned design choices remain open under Ask first.
Stack: Plain HTML/CSS + vanilla ES modules JS, Vite 8.3.8 multi-page app, Express (`server.ts`) + Vercel Serverless (`/api/send-email.ts`), Firebase 13.2.0 (Auth + Firestore) — Web app (desktop + mobile responsive)
Reviewed: Post-treatment follow-up on `/` -> `pages/login.html` and `pages/dashboard.html` / `index.html` (`#modal-course`, `#modal-log`, `#modal-resource`, `#modal-goal`), commits `0c82d36` through `3d1d361` on `matteoppet/unslop`. Inspected via `npm test` (154/154 across 53 suites), `tsc --noEmit`, `vite build`, `detect.js --platform web`, headless Chrome screenshots + DOM/computed-style checks at 375, 768, 1280, 1920, 200% zoom, `prefers-color-scheme: dark`, and empty state (local static server with Firebase imports stubbed), plus a fresh-context subagent review of 4 after screenshots.

Score: 21/24 Discharged  Task path 3 · Truth 4 · Native fit 3 · States 4 · Access 3 · Specificity 4

Score deltas (vs 2026-11-23-2110-login-dashboard.md):
Task path 2 -> 3
Truth 1 -> 4
Native fit 2 -> 3
States 2 -> 4
Access 1 -> 3
Specificity 3 -> 4

Performance: Not profiled (no Lighthouse or DevTools Performance trace). Completed static cleanups: Dashboard `Session Logs` capped at 15 newest rows (`sliceRecentLogsForDashboard` in `src/utils/uiState.js`), `updateScrollableTablesMaxHeight()` refactored to separate DOM reads from style writes inside a `requestAnimationFrame`-throttled `resize` listener (`src/app.js`), and `transition: all` replaced with explicit properties (`src/index.css`). Remaining static leads outside this scope: monolithic single `src/app.js` bundle across routes (`735.77 kB` JS chunk) and Cache Storage clearing on boot (`src/main.js`, `vercel.json`).

What changed by screen
- Login (`pages/login.html`, `src/app.js`, `src/index.css`):
  - Prevented authenticated Dashboard chrome flash on `/` with `.auth-booting`, switched auth redirect to `history.replaceState`, and synced `document.title` across SPA transitions (`794479c`).
  - Added `autocomplete` attributes across sign-in/registration inputs, raised inputs to `16px`, added `#btn-forgot-password` (`sendPasswordResetEmail`), scoped errors to the active form without directional wording, and replaced admin `.env` jargon with student-facing guidance (`90f70b8`).
  - Added skip-to-main-content link (`c49dbbe`) and capped `.login-grid` width to `960px` on wide viewports (`30a377f`).
- Dashboard (`index.html`, `pages/dashboard.html`, `src/app.js`, `src/index.css`, `src/utils/uiState.js`, `src/utils/telemetry.js`):
  - Replaced hardcoded sync text with live `formatSyncStatus` (`Not Signed In`, `Local only`, `Offline`, `Offline — unsaved changes`, `Sync failed` + Retry trigger) (`0c82d36`).
  - Guarded dynamic listeners with `bindOnce` (`WeakSet`) and modal `showModal()` calls with `!dialog.open` (`f3a56a5`).
  - Marked future weekdays (`d.isFuture`) in the 7-day tracker with neutral `–` (`.study-hours-future`) instead of crimson `0h`, and prevented weekday header/duration wrapping (`9b0a3ad`, `0695e51`).
  - Converted Dashboard log/resource `Open` & `Delete` row actions to `<button type="button">` with a 10-second Undo banner (`#dash-undo-banner`) (`65cb455`).
  - Fixed Dashboard Session Logs row clipping and capped recent rendered rows (`sliceRecentLogsForDashboard`) (`4c2e9e1`).
  - Added accessible names for `#dash-quick-notes` and Duration controls (`<fieldset><legend>`, labels, `aria-label`) plus `role="status"` / `role="alert"` live regions (`4592e54`).
  - Added initial cloud hydration `Loading…` state, distinct zero-courses empty state, and bullet-free `.resource-list-empty` (`b301f6d`).
  - Raised inactive tab (`#555555`) and completed goal (`#595959`) contrast and enlarged `@media (max-width: 720px)` button/nav/checkbox touch targets to >= 44px (`0a39661`).
  - Fixed heading outline (`h1` -> `h2`), `aria-current="page"`, roving `tabindex` + Left/Right arrow navigation on Resources/Notes tabs, and debounced/blur/nav-flushed Quick Notes autosave (`e7e30f0`).
  - Added `:focus-visible` outlines, `@media (prefers-reduced-motion: reduce)`, skip-to-main-content link, `Session Logs` / `Resources` / `Add Goal` copy consistency, 768px 3rd-card full-row span, URL query param sync (`?status=&panel=`), 560px goal tag stacking, and non-link ink `#333333` on valid `#log-duration-preview` text (`aa23634`, `ecb3097`, `c49dbbe`, `f24e5d4`, `30a377f`, `9ea28c6`, `3d1d361`).
- Docs (`README.md`):
  - Updated README stack badges to reflect HTML5 & CSS3 + Vanilla JS + Vite (`d76bb6e`).

Self-check (treatment.md)
1. **Cover the logo:** Distinctive Times New Roman serif, bare `#0000ee` links, Italian university primitives (`CFU`, `/30`, `/110`), and 7-day study tracker remain unmistakably UniSphere.
2. **The neighbor test:** Competitors default to sans-serif SaaS templates with sidebar shells and violet gradients; UniSphere keeps its plain-HTML academic ledger character while aligning the 7-day header strip and keeping the bottom tablet card full-width.
3. **Count the containers:** Card count unchanged on desktop; removed bullet markers and cramped inner scroll clipping in Session Logs (`3` seeded rows fit without inner scrolling; `15` cap only activates on long histories), and removed `+ ` prefix / stray error-vs-info link tint inside the modal.
4. **Count the colors:** Only `#0000ee` navigation/open links, `#008000` positive study time, `#990000`/`#cc0000` destructive/missed states, and subtle amber sync-offline indicator carry state; static duration preview (`#log-duration-preview`) now uses neutral `#333333` instead of blue.
5. **Find the dots:** Goal course tags are full pill text (`Algoritmi e Strutture Dati`, `Skill`) stacked cleanly on narrow mobile; completed goals have both `#595959` ink and line-through plus checked box; future weekdays have both muted gray `#595959` and `–` (`aria-label="Upcoming day"`).
6. **Find the task:** Primary Login (`Log-In`) and Dashboard (`Add Course`, `Add Log`, `Add Goal`, `Add Resource`) controls stay in expected headers with keyboard Left/Right tabs, skip link to `#app-main`, and >= 44px mobile targets.
7. **Run the detector:** Ran `detect.js --platform web --json` across all 8 core source files -> `findings: []` (0 hits).
8. **The fresh look:** Fresh-context UI reviewer inspected the 4 after screenshots without prior context; it flagged weekday date/duration wrapping (`Mon 23 Nov` vs `Tue`–`Sun` 3-line wrap and `3h` / `15m` split), inconsistent `+ Add Goal` prefix, and `#2b5d95` hyperlink-blue styling on static `Calculated: 1h 30m (90 min)` text — all 3 fixed in commits `0695e51`, `9ea28c6`, and `3d1d361` and confirmed in the final screenshot + DOM run. Other reviewer suggestions (dark/theme overhaul, `#3B77BC` segmented pill, mobile summary/nav collapse) match the 3 deferred `Ask first` items or intentional plain-HTML identity (`tells` waived in visual identity).
9. **Say what you did not check:** Performance profiling (Lighthouse / DevTools Performance trace), live Firebase Auth/Firestore sync, Google SSO popup/redirect, `/api/send-email` Resend dispatch, real screen readers / physical phones, and out-of-scope routes (`/pages/courses.html`, `/pages/logs.html`, `/pages/assignments.html`, `/pages/squads.html`, `/pages/settings.html`).

Ask first
- `src/index.css`: Keep the plain-HTML light-only paper aesthetic + `box-shadow` (currently locked by `focusTime.test.js:189-193`) and mark dark mode explicitly light-only in `chart.md`, or design a dedicated `prefers-color-scheme: dark` palette?
- `src/index.css`: Keep the `#3B77BC` segmented pill bar exclusively in `#modal-log`, adopt `#3B77BC` consistently on active tabs/focus rings, or convert `#modal-log` to monochrome border-and-ink styling?
- `index.html`, `pages/dashboard.html`: Keep the 5-item `.dashboard-summary` card expanded at the top on 375px mobile, or condense static degree/institution metadata above the fold so `Courses` and `Add Log` appear higher?

Worth keeping
- Real Italian university primitives (`CFU`, `/30`, `/110` laurea scale), `<dialog>` modals, native form inputs, and solo-user isolation (`squadIds` telemetry isolated to `/pages/squads.html`).
- Clean 154/154 unit test suite (`tsc --noEmit` 0 errors, `vite build` 0 errors) protecting regression invariants.

Not checked
- Performance not profiled (no Lighthouse or DevTools Performance trace run).
- Live Firebase Auth, Firestore real-time listeners, Google SSO, and `/api/send-email` Resend delivery were not exercised against live endpoints (verified locally with Firebase SDK imports stubbed in headless Chrome).
- Real screen readers (NVDA/VoiceOver/TalkBack) and physical iOS/Android hardware were not tested.
- Out-of-scope pages (`courses.html`, `logs.html`, `assignments.html`, `squads.html`, `settings.html`) were not audited end-to-end.
