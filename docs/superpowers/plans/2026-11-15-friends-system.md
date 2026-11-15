# Friends System & Squads Dual-View Layout (#44) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Discord-style Friends system on `/pages/squads.html` matching the Issue #44 sketch, featuring a left-hand Friends sidebar (search/filter, send/accept/decline friend requests, and friends list) and a right-hand main pane that displays the **Current Squad View** by default and switches to **Friend Infos and Stats** when a friend is selected.

**Architecture:** Pure helper functions in `src/utils/telemetry.js` handle canonical friendship IDs, request/friend partitioning, search filtering, and privacy-safe friend telemetry computation from user documents. `src/lib/squadService.js` manages Firestore (`friendships/{uidA__uidB}` and `users/{friendUid}`) plus local-storage fallback operations. `pages/squads.html`, `src/index.css`, and `src/app.js` implement the two-column sidebar + main view layout and real-time listeners with full cleanup.

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5, CSS3 Grid/Flexbox, Firebase Firestore (`onSnapshot`), Node.js native test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-15-friends-system-design.md`

## Global Constraints

- Solo-user isolation: all Friends and Squads UI, state, and Firestore listeners live strictly inside `/pages/squads.html` and the `squads` route in `src/app.js`.
- Privacy preservation: `buildFriendTelemetrySummary` must never expose a friend's course grades (`grade`, `cfu`), personal notes (`quickNotes`, `checklist`), or `passwordHash`.
- Every `onSnapshot` listener (`friendships` and selected friend profile) must be unsubscribed in `cleanupSquadListeners()` when leaving `/pages/squads.html` or logging out.
- `firestore.rules` modifications must be authored via the `firestore-rules-author` specialist subagent.
- All user-supplied strings rendered into HTML must be sanitized with `sanitizeTextInput` and escaped with `escapeHtml`.
- `npm test` and `npm run build` must pass with exit code 0.

## Review Focus

- **Self-friending prevention:** Attempting to send a friend request to one's own email or UID must be rejected cleanly with a user-facing notice rather than creating a self-friendship document.
- **Duplicate request / auto-accept handling:** Sending a friend request to a user who has already sent you a pending request (or is already your friend) must update the existing `uidA__uidB` document (auto-accepting if they already requested you, or reporting already friends) without creating duplicate documents.
- **Privacy of friend course grades and notes:** Rendering a friend's stats from `users/{friendUid}` must strip exam scores/grades and personal notes, exposing only course titles, subject study durations, weekly hours, streaks, and academic profile metadata.
- **Switching between Current Squad View and Friend Infos & Stats:** Selecting a friend when the user is NOT in any squad (empty squad state) must still show the friend's Infos & Stats cleanly, and clicking `← Back to Squad View` (or deselecting the friend) must restore the appropriate Squad view (`#squads-empty-state` or `#squads-active-widgets`).
- **Prior-week study log reset on Friend Infos & Stats:** If a friend has `studyLogs` from previous weeks only, their current-week total hours, 7-day calendar, and subjects studied this week must compute as `0h` for the current week.

---

### Task 1: Friends Pure Utilities & Privacy-Safe Telemetry (`src/utils/telemetry.js`)

**Files:**
- Modify: `src/utils/telemetry.js`
- Modify: `src/utils/squads.test.js`

**Interfaces:**
- Produces in `src/utils/telemetry.js`:
  - `getFriendshipId(uidA, uidB) -> string` (normalizes both IDs to lowercase trimmed strings; returns `''` if either is empty or if `normA === normB`; otherwise returns `[normA, normB].sort().join('__')`)
  - `partitionFriendships(friendships = [], myUid = '') -> { acceptedFriends: Array, incomingRequests: Array, outgoingRequests: Array }`
  - `filterFriendsByQuery(friends = [], queryStr = '') -> Array`
  - `buildFriendTelemetrySummary(userDocData = {}, fallbackFriend = {}, referenceDate = new Date()) -> { uid, displayName, email, institution, degreeName, degreeType, academicYear, status, weeklyGoalHours, weekTotalMinutes, weekTotalHours, weeklyGoalPercent, currentStreak, tasksCompletedThisWeek, xp, elo, weekDays, subjects, courses }`

- [ ] **Step 1: Write failing unit tests in `src/utils/squads.test.js`**

Add tests verifying:
- `getFriendshipId('alice@uni.it', 'bob@uni.it')` equals `getFriendshipId('bob@uni.it', 'alice@uni.it')` (`'alice@uni.it__bob@uni.it'`) and returns `''` for self (`'alice@uni.it', 'alice@uni.it'`).
- `partitionFriendships` separates `'accepted'` friendships, `'pending'` where `recipientUid === myUid` (`incomingRequests`), and `'pending'` where `requesterUid === myUid` (`outgoingRequests`), mapping each item to the counterparty's `uid`, `email`, and `displayName`.
- `filterFriendsByQuery` matches case-insensitively on `displayName` and `email`.
- `buildFriendTelemetrySummary` computes current-week 7-day calendar, subject breakdown, streak, ELO, and sanitized course list (`title`, `code`, `semester`, `status` — excluding `grade` and personal notes).

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing exports in `src/utils/telemetry.js`.

- [ ] **Step 3: Implement `getFriendshipId`, `partitionFriendships`, `filterFriendsByQuery`, and `buildFriendTelemetrySummary` in `src/utils/telemetry.js`**

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/telemetry.js src/utils/squads.test.js
git commit -m "feat(telemetry): add friendship partitioning, search filter, and friend stats summary (#44)"
```

---

### Task 2: Firestore Security Rules for `friendships` (`firestore.rules`)

**Files:**
- Modify: `firestore.rules`
- Modify: `src/utils/squads.test.js`

**Interfaces:**
- Delegate to `firestore-rules-author` subagent to add `/friendships/{friendshipId}` validation and rules in `firestore.rules`:
  - Allowed fields: `id`, `users`, `requesterUid`, `requesterEmail`, `requesterName`, `recipientUid`, `recipientEmail`, `recipientName`, `status`, `createdAt`, `updatedAt`.
  - `users` must be a list of 2 strings containing `requesterUid` and `recipientUid`, with `requesterUid != recipientUid`.
  - `status` must be `'pending'` or `'accepted'`.
  - Allow `get, list`, validated `create`, validated `update` (preserving `requesterUid`, `recipientUid`, and `users`), and `delete`.

- [ ] **Step 1: Invoke `firestore-rules-author` subagent to update `firestore.rules`**

- [ ] **Step 2: Add rule assertion tests in `src/utils/squads.test.js` and run `npm test`**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules src/utils/squads.test.js
git commit -m "feat(rules): add friendships collection security rules (#44)"
```

---

### Task 3: Friend Request & Telemetry Service (`src/lib/squadService.js`)

**Files:**
- Modify: `src/lib/squadService.js`
- Modify: `src/utils/squads.test.js`

**Interfaces:**
- Produces in `src/lib/squadService.js`:
  - `sendFriendRequest({ fromUid, fromEmail, fromName, toEmailOrUid, toName = '' }) -> Promise<{ ok: boolean, status?: string, friendship?: object, error?: string }>`
  - `acceptFriendRequest(friendshipId, currentUid) -> Promise<object | null>`
  - `declineOrRemoveFriendship(friendshipId, currentUid) -> Promise<boolean>`
  - `fetchUserFriendships(currentUid) -> Promise<Array<object>>`
  - `fetchFriendProfileTelemetry(friendUid, fallbackFriend = {}) -> Promise<object>`

- [ ] **Step 1: Write failing tests in `src/utils/squads.test.js`**

Test:
- `sendFriendRequest` rejects empty or self email/UID (`ok: false`).
- `sendFriendRequest` creates a `'pending'` friendship record, and if an incoming pending request from that target already exists, transitions it to `'accepted'`.
- `acceptFriendRequest` updates status to `'accepted'`.
- `declineOrRemoveFriendship` deletes the friendship record.

- [ ] **Step 2: Implement friend service functions in `src/lib/squadService.js`**

Support both Firestore (`collection(db, 'friendships')` and `doc(db, 'users', friendUid)`) and local storage fallback (`unisphere_workspace_friendships_v1`) so offline/test modes work seamlessly. When sending a request by email, look up `users/{targetUid}` if available to populate `recipientName` (or derive a readable fallback name from the email prefix).

- [ ] **Step 3: Run `npm test` to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/squadService.js src/utils/squads.test.js
git commit -m "feat(friends): implement friend request send/accept/remove service (#44)"
```

---

### Task 4: Squads Dual-View Layout & Friends Sidebar HTML/CSS (`pages/squads.html`, `src/index.css`)

**Files:**
- Modify: `pages/squads.html`
- Modify: `src/index.css`

**Interfaces:**
- DOM structure in `pages/squads.html`:
  - `.squads-workspace-layout` wrapping:
    1. `<aside class="card friends-sidebar-card" id="friends-sidebar" aria-label="Friends Sidebar">`:
       - Header with `Friends` title and `#btn-view-current-squad` (`Squad View` button/pill)
       - `<form id="form-friend-search-add">` with `<input type="text" id="friend-search-input" placeholder="Search or add by email..." />` and `<button type="submit" id="btn-send-friend-request">Add</button>`
       - `<div id="friend-action-notice" class="notice-box" hidden></div>`
       - `<div id="friends-requests-section" hidden>` containing `#friends-incoming-list` and `#friends-outgoing-list`
       - `<ul class="friends-sidebar-list" id="friends-sidebar-list"></ul>`
    2. `<div class="squads-main-pane">`:
       - `<div id="squads-current-view-container">` (contains existing `#squads-empty-state` and `#squads-active-widgets`)
       - `<div id="friend-info-stats-view" hidden>`:
         - Top bar: `#friend-view-name`, `#friend-view-meta`, `#btn-back-to-squad-view`, `#btn-remove-friend`
         - Summary bar (`.dashboard-summary`): `#friend-summary-weekly-time`, `#friend-summary-goal-pct`, `#friend-summary-streak`, `#friend-summary-tasks`, `#friend-summary-elo`
         - Main 2-column grid (`.squads-main-grid`):
           - Left Card (`7-Day Study Calendar & Subjects`): `#friend-view-7day-thead`, `#friend-view-7day-tbody`, `#friend-view-subjects-tbody`
           - Right Card (`Friend Infos & Enrolled Courses`): `#friend-view-profile-tbody`, `#friend-view-courses-tbody`

- [ ] **Step 1: Add `.squads-workspace-layout`, `.friends-sidebar-card`, `.friends-sidebar-list`, and `#friend-info-stats-view` styling in `src/index.css`**

- [ ] **Step 2: Update `pages/squads.html` with the left Friends sidebar and right `#friend-info-stats-view` container**

- [ ] **Step 3: Run `npm run build` to verify clean HTML/CSS bundling**

Run: `npm run build`
Expected: PASS (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add pages/squads.html src/index.css
git commit -m "feat(ui): add friends sidebar and friend info/stats view to squads page (#44)"
```

---

### Task 5: Wire Real-Time Friends State, Event Handlers & Tests (`src/app.js`, `src/utils/squads.test.js`)

**Files:**
- Modify: `src/app.js`
- Modify: `src/utils/squads.test.js`

**Interfaces:**
- Consumes from `src/lib/squadService.js` and `src/utils/telemetry.js`:
  - `sendFriendRequest`, `acceptFriendRequest`, `declineOrRemoveFriendship`, `fetchUserFriendships`, `fetchFriendProfileTelemetry`
  - `getFriendshipId`, `partitionFriendships`, `filterFriendsByQuery`, `buildFriendTelemetrySummary`

- [ ] **Step 1: Add integration & DOM wiring tests in `src/utils/squads.test.js`**

Verify:
- `pages/squads.html` contains `#friends-sidebar`, `#friend-search-input`, `#friends-sidebar-list`, `#friends-requests-section`, `#squads-current-view-container`, and `#friend-info-stats-view`.
- `src/app.js` subscribes to `friendships` on the `squads` route, cleans up `friendshipsUnsub` and `selectedFriendDocUnsub` in `cleanupSquadListeners()`, and handles friend request send, accept, decline, remove, sidebar search, and switching between Current Squad View and Friend Infos & Stats.

- [ ] **Step 2: Wire Friends state, Firestore `onSnapshot` listeners, rendering, and event delegation in `src/app.js`**

Also add a quick `+ Friend` action link in `#squad-members-tbody` for squadmates who are not yet friends so users can easily friend squadmates too.

- [ ] **Step 3: Run full test suite and production build**

Run: `npm test && npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app.js src/utils/squads.test.js
git commit -m "feat(app): wire friends sidebar, friend-request workflow, and friend stats view (#44)"
```
