# Squads View UI Redesign, Live Library & Issues (#36, #42, #43) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/pages/squads.html` to match the reference screenshot while replacing "Squad Goal" with an interactive **Live Library**, adding a creator-only **Admin Panel** (#36), fixing the **Leave Squad** persistence bug (#42), adding a **Friend Weekly Calendar** popup modal (#43), bolding author names in the **Squad Feed**, and opening the **Create or Join a Squad** widget only when clicked.

**Architecture:** Pure telemetry and aggregation utilities in `src/utils/telemetry.js` compute per-member and squad-wide 7-day calendars, subject hour breakdowns, live elapsed timers, and creator permissions. `src/lib/squadService.js` encapsulates Firestore mutations for creating/joining/leaving squads, admin management, live presence, feed notes, and group sessions. `pages/squads.html`, `src/index.css`, and `src/app.js` render the redesigned layout and native `<dialog>` modals while maintaining strict solo-user isolation.

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5 `<dialog>` modals, CSS3 Grid/Flexbox, Firebase Firestore (`onSnapshot`), Node.js native test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-14-squads-redesign-and-issues-design.md`

## Global Constraints

- Solo-user isolation: all multiplayer state, listeners, and UI live strictly inside `/pages/squads.html` and squad handlers in `src/app.js`.
- Every `onSnapshot` listener must be cleaned up when switching squads, leaving the `/squads` route, or logging out.
- `firestore.rules` modifications must be authored by the `firestore-rules-author` specialist subagent.
- All user-supplied strings rendered in HTML must be sanitized via `sanitizeTextInput` and escaped via `escapeHtml`.
- `npm test` and `npm run build` must pass with exit code 0.

## Review Focus

- **Reloading after leaving the last squad (#42):** Leaving the only squad must set `activeSquadId: null` (not `undefined`, which `stripUndefinedDeep` strips before `setDoc(..., { merge: true })`) AND remove the user's UID from `squads/{id}.memberUids` and `squads/{id}/members/{uid}` so `fetchUserSquads` does not re-add the squad on reload.
- **Non-creator attempting Admin Panel access (#36):** `#btn-open-admin-panel` must remain `hidden` and `openSquadAdminModal()` must guard with `canManageSquad(activeSquad, myUid)` so non-creators cannot open or submit the Admin Panel.
- **Friend Calendar popup modal with zero or prior-week logs (#43):** Opening a friend's calendar when they were last active in a previous week must reset their current-week daily hours to `0h` across all 7 days (`Mon`–`Sun`) rather than displaying stale prior-week numbers.
- **Joining a teammate in Live Library:** Clicking `Go Live with [Name]` when a teammate is live on `Analisi 1` must immediately start a live session for the current user on `Analisi 1` (and update their status to `Live · Analisi 1`).
- **Squad Feed author name bolding & XSS safety:** Every note/activity in `#squad-feed-list` must wrap the escaped author display name in `<strong>...</strong>` while escaping note text and validating optional resource URLs with `sanitizeResourceUrl`.

---

### Task 1: Squad Telemetry, Live Timer & Calendar Utilities (`src/utils/telemetry.js`)

**Files:**
- Modify: `src/utils/telemetry.js`
- Create: `src/utils/squads.test.js`

**Interfaces:**
- Produces in `src/utils/telemetry.js`:
  - `getWeeklyDailyMinutesMap(studyLogs = [], referenceDate = new Date()) -> Record<string, number>` (maps `YYYY-MM-DD` for the 7 days of current week to minutes)
  - `getWeeklySubjectMinutesMap(studyLogs = [], referenceDate = new Date()) -> Record<string, number>` (maps subject name to minutes studied in current week)
  - `aggregateSquadWeeklyDays(members = [], referenceDate = new Date()) -> Array<{ shortDay, dateStr, formattedDate, minutes, hours }>`
  - `aggregateSquadSubjectHours(members = [], referenceDate = new Date()) -> Array<{ subject, minutes, hours }>`
  - `getMemberWeekDaysSummary(member = {}, referenceDate = new Date()) -> { weekDays: Array<{ shortDay, dateStr, formattedDate, minutes, hours }>, totalMinutes: number, totalHours: string, subjects: Array<{ subject, minutes, hours }> }`
  - `formatLiveElapsed(startedAt, nowMs = Date.now()) -> { elapsedMinutes: number, formatted: string }`
  - `canManageSquad(squad, currentUid) -> boolean`
  - `sortSquadMembers(members = [], sortBy = 'hours') -> Array`

- [ ] **Step 1: Write the failing unit tests in `src/utils/squads.test.js`**

Test all new pure functions in `src/utils/squads.test.js` covering:
- `canManageSquad` returns `true` only when `squad.createdBy === currentUid` (#36).
- `getWeeklyDailyMinutesMap` and `getWeeklySubjectMinutesMap` only count current-week logs (`Mon`–`Sun`).
- `getMemberWeekDaysSummary` builds a 7-day calendar (`Mon`–`Sun`) for a friend (#43) and resets to `0h` if the member's `updatedAt` is from a prior week.
- `aggregateSquadWeeklyDays` and `aggregateSquadSubjectHours` sum across active members in the current week.
- `formatLiveElapsed` calculates elapsed duration from `startedAt` timestamp.
- `sortSquadMembers` sorts by `'hours'`, `'streak'`, and `'name'`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing exports in `src/utils/telemetry.js`.

- [ ] **Step 3: Implement the functions in `src/utils/telemetry.js` and update `getMemberEffectiveTelemetry`**

Extend `getMemberEffectiveTelemetry` to also preserve `dailyMinutes` and `subjectMinutes` when `isCurrentWeek` is true (and reset them to `{}` when `isCurrentWeek` is false), and export all new helpers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

---

### Task 2: Update Firestore Security Rules (`firestore.rules`)

**Files:**
- Modify: `firestore.rules`
- Modify: `src/utils/security.test.js`

**Interfaces:**
- Delegate to `firestore-rules-author` subagent to update `firestore.rules`:
  - `squads/{squadId}`: allow optional `description` (string <= 500), `weeklyGoalHours` (number 1..1000), `nextSession` (map with `title`, `when`, `attendees`, `attendeeUids`, `updatedAt`).
  - `squads/{squadId}/members/{memberId}`: allow optional `dailyMinutes` (map), `subjectMinutes` (map), `status` (string <= 64), `liveSubject` (string <= 160), `liveStartedAt` (timestamp/string/number), and allow `delete` by the member OR the squad creator (`get(/databases/$(database)/documents/squads/$(squadId)).data.createdBy`).
  - `squads/{squadId}/activities/{activityId}`: allow optional `courseName` (string <= 160), `url` (string <= 2048), and allow `delete` when authenticated or matching author/creator.

- [ ] **Step 1: Invoke `firestore-rules-author` subagent to update `firestore.rules`**

- [ ] **Step 2: Add rules assertions in `src/utils/squads.test.js` and run `npm test`**

Run: `npm test`
Expected: PASS.

---

### Task 3: Squad Service Cloud & Local Operations (`src/lib/squadService.js`)

**Files:**
- Modify: `src/lib/squadService.js`
- Modify: `src/lib/authService.js` (ensure `sanitizeUserProfile` preserves `activeSquadId: null`)
- Modify: `src/utils/squads.test.js`

**Interfaces:**
- Produces in `src/lib/squadService.js`:
  - `leaveSquadCleanly(email, currentUid, squadId, nextActiveSquadId = null)` (#42 fix: updates user doc `squadIds` & `activeSquadId: null`, removes `currentUid` from `squads/{squadId}.memberUids`, and deletes `squads/{squadId}/members/{currentUid}` and `squads/{squadId}/presence/{currentUid}`)
  - `updateSquadAdminDetails(squadId, { name, description, weeklyGoalHours })` (#36)
  - `removeMemberFromSquad(squadId, memberUid)` (#36)
  - `deleteSquadCompletely(squadId, email, currentUid, nextActiveSquadId = null)` (#36)
  - `setMemberLiveStatus(squadId, { uid, displayName, subject, startedAt })`
  - `clearMemberLiveStatus(squadId, uid)`
  - `addSquadFeedNote(squadId, { id, uid, displayName, text, courseName, url, type, createdAt })`
  - `deleteSquadFeedNote(squadId, noteId)`
  - `updateSquadNextSession(squadId, nextSession)`

- [ ] **Step 1: Write unit tests for `sanitizeUserProfile` with `activeSquadId: null` and `squadService.js` exports in `src/utils/squads.test.js`**

- [ ] **Step 2: Update `src/lib/authService.js` and `src/lib/squadService.js`**

- [ ] **Step 3: Run `npm test` to verify pass**

---

### Task 4: Restyled Squads View HTML & CSS (`pages/squads.html`, `src/index.css`)

**Files:**
- Modify: `pages/squads.html`
- Modify: `src/index.css`

**Interfaces:**
- DOM IDs in `pages/squads.html`:
  - Header row: `#btn-open-create-join-squad`, `#btn-open-admin-panel` (hidden unless creator), `#btn-leave-active-squad` (hidden unless in a squad)
  - Summary bar: `#squad-summary-name` (or selector `#squad-active-select` when in multiple squads), `#squad-summary-description`, `#squad-summary-weekly-time`, `#squad-summary-my-time`, `#squad-summary-my-streak`, `#squad-summary-code`, `#btn-copy-squad-code-top`
  - Left Card (**Live Library**): `#btn-go-live-toggle`, `#squad-live-library-list`, `#squad-subject-hours-tbody`
  - Right Card (**Squad Members**): `#squad-members-sort`, `#btn-copy-squad-code-card`, `#squad-7day-thead`, `#squad-7day-tbody`, `#squad-members-tbody`
  - Bottom Card (**Squad Feed & Next Group Session**): `#btn-add-squad-note`, `#squad-feed-list`, `#squad-next-session-title`, `#squad-next-session-attendees`, `#btn-toggle-session-attending`, `#btn-edit-next-session`
  - Modals (`<dialog>`):
    - `#modal-squad-create-join` (`#form-create-squad`, `#form-join-squad`, `#modal-user-squads-tbody`)
    - `#modal-squad-admin` (`#form-squad-admin`, `#admin-squad-name`, `#admin-squad-description`, `#admin-squad-goal`, `#admin-members-tbody`, `#btn-delete-squad-confirm`)
    - `#modal-friend-calendar` (`#friend-calendar-title`, `#friend-calendar-7day-thead`, `#friend-calendar-7day-tbody`, `#friend-calendar-subjects-tbody`)
    - `#modal-go-live` (`#form-go-live`, `#live-study-subject`)
    - `#modal-squad-note` (`#form-squad-note`, `#squad-note-text`, `#squad-note-course`, `#squad-note-url`)
    - `#modal-group-session` (`#form-group-session`, `#group-session-location`, `#group-session-datetime`)

- [ ] **Step 1: Add Squads layout, Live Library, Feed, Next Session, and Modal styles to `src/index.css`**

- [ ] **Step 2: Update `pages/squads.html` with the new layout and `<dialog>` modals**

- [ ] **Step 3: Verify build succeeds with `npm run build`**

---

### Task 5: Wire Interactive Squads View, Live Library, Modals & Tests (`src/app.js`, `src/utils/squads.test.js`)

**Files:**
- Modify: `src/app.js`
- Modify: `src/utils/squads.test.js`

- [ ] **Step 1: Write structural & behavioral tests in `src/utils/squads.test.js`**

Verify:
- `pages/squads.html` contains the new header links (`#btn-open-create-join-squad`, `#btn-open-admin-panel`), summary bar, Live Library card, Squad Members 7-day tracker & table, Squad Feed with `Add Note`, Next Group Session box, and all 6 `<dialog>` modals (`#modal-squad-create-join`, `#modal-squad-admin`, `#modal-friend-calendar`, `#modal-go-live`, `#modal-squad-note`, `#modal-group-session`).
- `src/app.js` wires real-time listeners with cleanup, bold author names (`<strong>`) in Squad Feed, `leaveSquadCleanly` (#42), `canManageSquad` check for Admin Panel (#36), Friend Calendar modal (#43), and Live Library ("Go Live" and "Go Live with" teammate).

- [ ] **Step 2: Implement full Squads logic and modal handlers in `src/app.js`**

- [ ] **Step 3: Run full test suite and production build**

Run: `npm test && npm run build`
Expected: All tests pass, build exits with 0.
