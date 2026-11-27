# UniSphere GDPR Art. 32 Hardening, Strict Firebase Auth, and Self-Serve Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Google Sign-In, enforce strict Firebase Authentication (`request.auth != null`) across all Firestore rules with automatic one-time email-to-UID legacy migration, separate friend-visible telemetry into `/friendProfiles/{uid}` with UID-keyed `/friendships`, implement GDPR Art. 17 self-serve account deletion with random Squad ownership transfer and shared-Squad cleanup, and update the English legal pages.

**Architecture:** UniSphere remains a pure client-side Firebase Auth + Cloud Firestore + Vercel static/serverless app (Approach 1 — zero `firebase-admin` secrets). Friend resolution (`sendFriendRequest`) and Squad joining (`joinSquadByCode`) use zero-list lookup documents (`/friendLookups/{sha256(email)}` and `/squadInvites/{code}`), accepted friends read grade-free `/friendProfiles/{uid}` validated via deterministic canonical UID pair checks, and permanent Settings deletion runs an idempotent 5-phase sequence with password re-authentication first and `deleteUser(auth.currentUser)` last.

**Tech Stack:** Vanilla HTML/CSS/ES Modules, Vite, TypeScript (`tsc --noEmit`), Firebase Auth & Cloud Firestore v11+, Express (`server.ts`), Vercel Serverless (`/api/send-email` via Resend), Node.js built-in test runner (`npm test` -> `node --test`).

**Spec:** [docs/superpowers/specs/2026-11-27-gdpr-hardening-and-account-deletion-design.md](file:///C:/Users/matte/orca/workspaces/unisphere/website-introdution/docs/superpowers/specs/2026-11-27-gdpr-hardening-and-account-deletion-design.md)

## Global Constraints

- Strict `@/` -> `./src` alias; root config files (`package.json`, `vite.config.ts`, `tsconfig.json`, `bun.lock`, `firestore.rules`, `.env.example`) stay at root; no server-only packages (`resend` or Node secrets) imported inside `src/`.
- Mandatory subagent delegation: any creation or modification of `firestore.rules` MUST be delegated to the `firestore-rules-author` subagent (never edited directly in the main agent).
- Case-sensitive Firebase Auth `uid` everywhere: `normalizeUserId(value)` trims whitespace and replaces `/` with `_`, lowercases ONLY email strings (`includes('@')`), and preserves exact case for Firebase Auth UIDs. Never call `.toLowerCase()` on Firebase Auth `uid`s.
- Canonical friendship document IDs: `${a}__${b}` sorted by exact ASCII `<` (`a < b ? `${a}__${b}` : `${b}__${a}``), max length **512** (remove all `.slice(0, 128)` truncation).
- Strict Firestore operation ordering:
  - Create Squad: write `squads/{squadId}` -> write `squadInvites/{code}` -> write `members/{uid}` & `presence/{uid}`.
  - Join Squad: read `squadInvites/{code}` -> read `squads/{squadId}` -> update `squads/{squadId}` (`memberUids: arrayUnion(uid)`) -> write `members/{uid}` & `presence/{uid}`.
  - Leave Squad / Account Deletion: delete user `activities`, `sessions`, `members/{uid}`, and `presence/{uid}` BEFORE removing `uid` from `squads/{squadId}.memberUids` or deleting `squads/{squadId}`.
- Deep Obsidian Glass monochrome UI consistency; solo-user isolation outside `/squads`; all copy strictly in English with legal placeholders `UniSphere Project Maintainer` and `privacy@unispherelife.me`.
- Production `firestore.rules` deployment is a manual operator instruction (`firebase deploy --only firestore:rules`), never automated in scripts or CI.
- On Windows PowerShell 5.1, chain shell commands using `; if ($LASTEXITCODE -eq 0) { ... }` (never `&&`).

## Review Focus

1. **Mixed-case Firebase Auth UID corruption** — Passing mixed-case UIDs such as `UidAlpha99` and `uidBeta12` through `getFriendshipId`, `partitionFriendships`, `canManageSquad`, and `buildFriendTelemetrySummary` must preserve exact case and sort in ASCII order matching Firestore rules `<` comparison (pinned in Task 2).
2. **Legacy email-keyed migration safety & idempotency** — Running `runOneTimeLegacyMigration` when `/users/{uid}` already exists (or re-running after partial squad migration) must not overwrite existing `/users/{uid}` data, must strip `passwordHash`, and must transfer both `createdBy` and `memberUids` before moving subdocs (pinned in Task 3).
3. **Wrong password or mid-teardown Firestore failure during Account Deletion** — Failed `reauthenticateWithCredential` must abort with zero Firestore writes and zero listener teardowns; a Firestore error in Phase 3/4 must abort BEFORE calling `deleteUser(authUser)` so the user is never orphaned and can retry cleanly (pinned in Task 5).
4. **Squad subcollection deletion order (`leaveSquadCleanly` & empty-squad cleanup)** — `members/{uid}` and `presence/{uid}` (plus `activities`, `sessions`, `squadInvites/{code}` on empty-squad delete) must be deleted BEFORE `arrayRemove(uid)` / `deleteDoc(squads/{squadId})` so `isSquadMember(squadId)` does not reject its own cleanup (pinned in Tasks 3 & 5).
5. **Zero-enumeration & zero-unauthenticated Firestore access** — `firestore.rules` must contain zero `if true` allow clauses, zero unauthenticated `isValidDocId(userId)` gets, `allow list: if false` on `/users`, `/friendLookups`, `/friendProfiles`, `/squadInvites`, and `allow read, write: if false` on `/emailVerifications`, `/mail`, `/test` (pinned in Task 4).

---

### Task 1: Remove Google Sign-In UI/Auth, Lock CSP Headers & Remove Unauthenticated Probes

**Files:**
- Modify: `pages/login.html:85-115`
- Modify: `src/lib/authService.js:1-35,360-395,795-1105`
- Modify: `src/lib/firebase.js:95-115`
- Modify: `vercel.json:20-24`
- Modify: `server.ts:144-160`
- Test: `src/utils/security.test.js`

**Interfaces:**
- Consumes: none
- Produces in `src/lib/authService.js`:
  - `hashEmailForLookup(email: string): Promise<string>` — trims & lowercases `email`, returns 64-char lowercase hex SHA-256 via `crypto.subtle.digest('SHA-256', ...)` (returns `''` for empty input).
  - Updated `getSecurityHeaders(): Record<string, string>` — CSP without `https://accounts.google.com` or `https://apis.google.com`; `frame-src 'self' https://*.firebaseapp.com`.
  - Updated `dispatchVerificationCode(email: string): Promise<{ ok: boolean, message?: string, previewCode?: string }>` and `verifyEmailCode(email: string, inputCode: string): Promise<{ ok: boolean, message?: string }>` using `/api/send-email` + `sessionStorage` (`unisphere_otp_*`) only (zero Firestore `emailVerifications`/`mail` calls).
  - Removed export: `formatGoogleAuthError`.

- [ ] **Step 1: Update security tests first to assert removal of Google SSO & unauthenticated Firestore auth calls**

In `src/utils/security.test.js`:
- Replace Google CSP / `formatGoogleAuthError` assertions with:
  - `getSecurityHeaders()['Content-Security-Policy']` MUST NOT match `/accounts\.google\.com|apis\.google\.com/`.
  - `'formatGoogleAuthError' in authService` MUST be `false`.
  - `hashEmailForLookup('Mat.Petrini@Stud.UniRoma3.it ')` MUST return a deterministic 64-char lowercase `[a-f0-9]{64}` SHA-256 hex digest equal to `hashEmailForLookup('mat.petrini@stud.uniroma3.it')`, and `''` for whitespace.
  - `pages/login.html` MUST NOT contain `btn-google-sso` or `Signing in with Google`, and MUST guide former Google users to `Forgot password?`.
  - `vercel.json` and `server.ts` CSP headers MUST NOT contain `accounts.google.com` or `apis.google.com`.
  - `src/lib/firebase.js` MUST NOT call `getDocFromServer(doc(db, 'test', 'connection'))` at startup, and `src/lib/authService.js` MUST NOT read/write `'emailVerifications'` or `'mail'`.

- [ ] **Step 2: Run security test file to verify it fails against current code**

Run: `node --test src/utils/security.test.js`
Expected: FAIL on Google CSP domains, `formatGoogleAuthError`, `hashEmailForLookup`, `btn-google-sso`, and `emailVerifications`/`testConnection` assertions.

- [ ] **Step 3: Implement `authService.js`, `firebase.js`, `login.html`, `vercel.json`, and `server.ts` changes**

- In `src/lib/authService.js`:
  - Remove `formatGoogleAuthError`.
  - Add `export async function hashEmailForLookup(email)`: normalize `const clean = String(email || '').trim().toLowerCase()`, return `''` if empty, hash UTF-8 bytes with `globalThis.crypto.subtle.digest('SHA-256', bytes)` to 64-char lowercase hex.
  - Strip `https://apis.google.com` and `https://accounts.google.com` from `script-src` and `frame-src` inside `getSecurityHeaders()` (retaining `https://www.gstatic.com` in `script-src` and `https://*.firebaseapp.com` in `frame-src` to match Firebase SDK/hosting across `vercel.json` and `server.ts`).
  - Remove `emailVerifications` and `mail` Firestore collection reads/writes from `dispatchVerificationCode` and `verifyEmailCode` (accept and ignore optional legacy second/third parameter cleanly so callers transitioning don't crash; persist OTP state strictly via `/api/send-email` and `sessionStorage`).
- In `src/lib/firebase.js`: remove `testConnection()` definition and its top-level invocation.
- In `pages/login.html:85-115`: remove `<button type="button" id="btn-google-sso"...>` and the Google governance `<p class="auth-legal-note">...`; replace with `<p class="auth-legal-note">Previously used Google Sign-In? Select <strong>Forgot password?</strong> above with your email to set a password and keep your workspace.</p>`.
- In `vercel.json:20-24` and `server.ts:144-160`: remove `https://apis.google.com` and `https://accounts.google.com` from `script-src` and `frame-src`.

- [ ] **Step 4: Run security tests to verify pass**

Run: `node --test src/utils/security.test.js`
Expected: PASS (excluding any pre-existing `firestore.rules` assertions only if those wait for Task 4—keep Task 1's `security.test.js` focused on auth/CSP/markup rules, deferring new `firestore.rules` structural assertions to Task 4 so Task 1 ends green on its own!).

- [ ] **Step 5: Commit Task 1**

```powershell
git add pages/login.html src/lib/authService.js src/lib/firebase.js vercel.json server.ts src/utils/security.test.js; if ($LASTEXITCODE -eq 0) { git commit -m "feat(auth): remove Google Sign-In, clean CSP headers, and drop unauthenticated probes" }
```

---

### Task 2: Case-Sensitive UID Telemetry Helpers, Canonical 512-Char Friendship IDs & Friend Profile Projection

**Files:**
- Modify: `src/utils/telemetry.js:1049-1363` (plus `canManageSquad`, `isCurrentUserRemovedFromSquad`, `deduplicateSquadMembers`)
- Test: `src/utils/squads.test.js`

**Interfaces:**
- Consumes: none (keeps `src/utils/telemetry.js` pure with zero Firebase imports)
- Produces in `src/utils/telemetry.js`:
  - `normalizeUserId(value: string): string` — trims string and replaces `/` with `_`; if it contains `@`, lowercases it; otherwise preserves exact Firebase Auth `uid` case.
  - `getFriendshipId(uidA: string, uidB: string): string` — uses `normalizeUserId`, rejects empty or identical IDs, sorts by ASCII `<` (`a < b ? `${a}__${b}` : `${b}__${a}``), allows up to 512 chars (returns `''` if exceeding 512 chars).
  - Updated `canManageSquad`, `isCurrentUserRemovedFromSquad`, `doesFriendshipMatchUser`, `partitionFriendships`, `buildFriendTelemetrySummary` preserving case-sensitive Firebase Auth UIDs (`normalizeUserId`) instead of lowercasing UIDs.
  - `buildFriendProfilePayload({ uid, profile, courses, studyLogs, assignments, referenceDate }): FriendProfile` returning the exact grade-free shape from Spec Section C.2 (`uid`, `name`, `displayName`, `institution`, `degreeName`, `degreeType`, `academicYear`, `status`, `weeklyGoalHours`, `minutesThisWeek`, `tasksThisWeek`, `currentStreak`, `xp`, `dailyMinutes`, `subjectMinutes`, grade-free `courses` with `{ id, title, code, semester, status }`, `updatedAt`).

- [ ] **Step 1: Write failing tests in `src/utils/squads.test.js` for Review Focus #1, 512-char IDs & `buildFriendProfilePayload`**

Add tests in `src/utils/squads.test.js` covering:
1. `normalizeUserId('  UidAlpha99/abc  ') === 'UidAlpha99_abc'` (exact case preserved) vs `normalizeUserId('  Matteo@Uni.IT ') === 'matteo@uni.it'`.
2. `getFriendshipId('uidBeta12', 'UidAlpha99') === 'UidAlpha99__uidBeta12'` (ASCII `'U' < 'u'`), and IDs > 128 chars (e.g. two 100-char UIDs -> 202 chars) are NOT truncated and remain `<= 512` chars.
3. `canManageSquad({ createdBy: 'UidCreator1' }, 'uidcreator1') === false` while `canManageSquad({ createdBy: 'UidCreator1' }, 'UidCreator1') === true` (mixed-case safety).
4. `partitionFriendships` and `doesFriendshipMatchUser` match mixed-case `requesterUid` / `recipientUid` / `users` accurately without lowercasing UIDs.
5. `buildFriendProfilePayload` strips `grade`, `cfu`, `passwordHash`, `quickNotes`, `checklist`, `studyLogs`, `assignments` while populating `dailyMinutes`, `subjectMinutes`, `minutesThisWeek`, `tasksThisWeek`, `currentStreak`, `xp`, `weeklyGoalHours`, and grade-free `courses`, and feeds cleanly into `buildFriendTelemetrySummary` preserving exact UID casing.

- [ ] **Step 2: Run squads test file to verify it fails**

Run: `node --test src/utils/squads.test.js`
Expected: FAIL (`normalizeUserId` and `buildFriendProfilePayload` not defined; `getFriendshipId` and `canManageSquad` currently lowercase UIDs).

- [ ] **Step 3: Implement `normalizeUserId`, case-safe helpers & `buildFriendProfilePayload` in `src/utils/telemetry.js`**

- Export `normalizeUserId(value = '')`.
- Update `getFriendshipId` to normalize with `normalizeUserId`, compare ASCII `<` (`normA < normB ? `${normA}__${normB}` : `${normB}__${normA}``), return `''` if combined length `> 512` (never slice).
- Update `canManageSquad`, `isCurrentUserRemovedFromSquad`, `doesFriendshipMatchUser`, `partitionFriendships`, and `buildFriendTelemetrySummary` to use `normalizeUserId` for UIDs (do NOT call `.toLowerCase()` on non-email UIDs; keep `.toLowerCase()` only for email comparisons and display-name search filtering).
- Export `buildFriendProfilePayload({ uid, profile = {}, courses = [], studyLogs = [], assignments = [], referenceDate = new Date() })` reusing existing helpers (`getWeekDaysSummary`, `getWeeklyDailyMinutesMap`, `getWeeklySubjectMinutesMap`, `calculateCurrentStreak`, `countCompletedTasksThisWeek`, `calculateElo`, `formatStudyDuration` as needed) to emit the Spec Section C.2 `FriendProfile` payload with strictly grade-free `courses` (`id`, `title`, `code`, `semester`, `status`).

- [ ] **Step 4: Run squads tests to verify pass**

Run: `node --test src/utils/squads.test.js`
Expected: PASS (keep `FRIENDS_HUB_SQUAD_ID` / hub assertions temporarily working until Task 3 swaps `squadService.js` and `squads.test.js` together cleanly).

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/utils/telemetry.js src/utils/squads.test.js; if ($LASTEXITCODE -eq 0) { git commit -m "feat(telemetry): preserve case-sensitive UIDs, 512-char friendship IDs, and FriendProfile builder" }
```

---

### Task 3: Privacy-Separated Friends Service, `/squadInvites`, Fixed Leave/Join Ordering & One-Time Migration Service

**Files:**
- Modify: `src/lib/squadService.js`
- Create: `src/lib/migrationService.js`
- Modify: `src/utils/squads.test.js`
- Create: `src/utils/migration.test.js`

**Interfaces:**
- Consumes: `normalizeUserId`, `getFriendshipId`, `buildFriendProfilePayload` from `src/utils/telemetry.js`; `getEmailDocId`, `hashEmailForLookup`, `sanitizeTextInput`, `sanitizeResourceUrl` from `src/lib/authService.js`.
- Produces in `src/lib/squadService.js`:
  - Removed: `FRIENDS_HUB_SQUAD_ID`, `friendshipToHubActivityDoc`, `hubActivityDocToFriendship`.
  - `getUserDocId(uid, emailFallback)`: returns `normalizeUserId(uid || auth?.currentUser?.uid || '')` first, falling back to `getEmailDocId(emailFallback)` only when no Firebase UID exists.
  - `syncFriendProfileAndLookup({ uid, email, friendProfile, ops })`: writes `/friendProfiles/{uid}` and `/friendLookups/{emailHash}` (using `hashEmailForLookup(email)`).
  - `createSquadInvite({ code, squadId, createdBy, ops })`, `resolveSquadByInviteCode(code, ops)`, `deleteSquadInvite(code, ops)`.
  - `joinSquadInCloud({ squadId, uid, member, ops })`: updates `squads/{squadId}` (`memberUids: arrayUnion(uid)`) BEFORE calling `saveSquadMemberToCloud(squadId, member)`.
  - `leaveSquadCleanly(email, currentUid, squadId, nextActiveSquadId, ops)`: deletes `members/{uid}` and `presence/{uid}` BEFORE updating `squads/{squadId}` (`arrayRemove(uid)`), updating user doc `squadIds`.
  - `deleteSquadCompletely(squadId, code, ops)`: deletes subcollections (`members`, `presence`, `activities`, `sessions`), deletes `/squadInvites/{code}`, then deletes `/squads/{squadId}`.
  - UID-keyed `/friendships` functions:
    - `sendFriendRequest({ fromUid, fromEmail, fromName, toEmailOrUid, toName, ops })`: if `toEmailOrUid` contains `@`, resolves target via `/friendLookups/{await hashEmailForLookup(toEmailOrUid)}` and fails cleanly with `{ ok: false, error: 'No UniSphere account found for that email address.' }` when missing; if given a direct `uid` (from Squad `+ Friend`), uses it directly. Checks canonical `getFriendshipId(senderUid, recipientUid)` (up to 512 chars, zero `.slice(0, 128)`), auto-accepts reverse pending request via `updateDoc` by recipient, or creates `/friendships/{friendshipId}` (`users: [sortedA, sortedB]`, `requesterUid`, `requesterName`, `recipientUid`, `recipientName`, `status: 'pending'`).
    - `acceptFriendRequest(friendshipId, currentUid, currentDisplayName, ops)`: updates `/friendships/{friendshipId}` (`status: 'accepted'`, `updatedAt`).
    - `declineOrRemoveFriendship(friendshipId, currentUid, ops)`: deletes `/friendships/{friendshipId}` (`deleteDoc`).
    - `fetchUserFriendships(currentUid, ops)`: queries `/friendships` with `where('users', 'array-contains', currentUid)`.
    - `fetchFriendProfileTelemetry(friendUid, fallbackFriend, ops)`: reads `/friendProfiles/{friendUid}` and transforms via `buildFriendTelemetrySummary`.
- Produces in `src/lib/migrationService.js`:
  - `migrateLegacyUserDoc({ uid, email, ops }): Promise<{ migrated: boolean, deletedLegacy: boolean }>` — idempotent; skips overwrite if `/users/{uid}` exists; strips `passwordHash` when copying from `/users/{emailSlug}`.
  - `migrateLegacySquadsForUser({ uid, email, ops }): Promise<{ migratedSquadIds: string[] }>` — finds squads matching `memberUids` `array-contains` `emailSlug`, adds `uid` to `memberUids` & transfers `createdBy` (if matching) BEFORE migrating `members/{emailSlug}` -> `members/{uid}`, `presence/{emailSlug}` -> `presence/{uid}`, deleting legacy subdocs, then removing `emailSlug` from `memberUids` and swapping `nextSession.attendeeUids`.
  - `runOneTimeLegacyMigration({ authUser, profile, courses, studyLogs, assignments, dbInstance, ops }): Promise<{ userMigrated: boolean, migratedSquadIds: string[] }>`.

- [ ] **Step 1: Write failing tests in `src/utils/migration.test.js` and update `src/utils/squads.test.js`**

- In `src/utils/migration.test.js` (Review Focus #2):
  - `migrateLegacyUserDoc` copies `/users/mat_uni_it` -> `/users/UidMatteo1`, deletes `passwordHash`, adds `uid`, `migratedFromEmailId`, deletes `/users/mat_uni_it`.
  - Running `migrateLegacyUserDoc` when `/users/UidMatteo1` ALREADY exists does NOT overwrite `/users/UidMatteo1` and returns `{ migrated: false }`.
  - `migrateLegacySquadsForUser` on a squad created by `mat_uni_it` updates `squads.createdBy = 'UidMatteo1'` + `memberUids` adding `'UidMatteo1'` BEFORE copying `members/mat_uni_it` -> `members/UidMatteo1` and `presence/mat_uni_it` -> `presence/UidMatteo1`, deletes legacy subdocs, then removes `'mat_uni_it'` from `memberUids` and `nextSession.attendeeUids`.
- In `src/utils/squads.test.js`:
  - Replace `FRIENDS_HUB_SQUAD_ID` / `friendshipToHubActivityDoc` tests with:
    - UID-keyed `sendFriendRequest` tests: rejecting self-request, rejecting missing `/friendLookups/{emailHash}` lookup with `"No UniSphere account found for that email address."`, resolving valid `/friendLookups/{emailHash}` -> creating UID-keyed `/friendships/{sortedUidA}__${sortedUidB}`, supporting direct UID request (`+ Friend` flow), reverse-request auto-accept, and `declineOrRemoveFriendship`.
    - Call-order test for `leaveSquadCleanly` proving `deleteDoc(members/{uid})` and `deleteDoc(presence/{uid})` execute BEFORE `updateDoc(squads/{squadId}, { memberUids: arrayRemove(uid) })` (Review Focus #4).
    - Call-order test for `joinSquadInCloud` proving `updateDoc(squads/{squadId})` executes BEFORE `setDoc(members/{uid})`.
    - `deleteSquadCompletely` deletes subcollections + `/squadInvites/{code}` BEFORE `deleteDoc(squads/{squadId})`.

- [ ] **Step 2: Run migration and squad tests to verify failures**

Run: `node --test src/utils/migration.test.js src/utils/squads.test.js`
Expected: FAIL because `src/lib/migrationService.js` does not exist yet and `src/lib/squadService.js` still uses `FRIENDS_HUB_SQUAD_ID`.

- [ ] **Step 3: Implement `src/lib/migrationService.js` and update `src/lib/squadService.js`**

- Build `src/lib/migrationService.js` cleanly with injectable `ops` defaulting to Firestore helpers (`getDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `getDocs`, `collection`, `query`, `where`, `arrayUnion`, `arrayRemove`).
- Refactor `src/lib/squadService.js`:
  - Remove `FRIENDS_HUB_SQUAD_ID`, `friendshipToHubActivityDoc`, `hubActivityDocToFriendship`, and `.slice(0, 128)` friendship truncation.
  - Implement `/friendLookups/{emailHash}`, `/friendProfiles/{uid}`, `/squadInvites/{code}`, ordered `joinSquadInCloud`, ordered `leaveSquadCleanly`, ordered `deleteSquadCompletely`, and UID-keyed `/friendships` CRUD & `fetchFriendProfileTelemetry`.
  - Note: in-memory test store fallback in `squadService.js` (when `db` is `null` during Node tests) should support injected/seeded `friendLookups` OR accept an `ops` mock so both unit tests and browser run smoothly.

- [ ] **Step 4: Run migration and squad tests to verify pass**

Run: `node --test src/utils/migration.test.js src/utils/squads.test.js`
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/lib/squadService.js src/lib/migrationService.js src/utils/squads.test.js src/utils/migration.test.js; if ($LASTEXITCODE -eq 0) { git commit -m "feat(social,migration): migrate friendships to UID keys, add lookups/invites, fix leave order, and add legacy migration" }
```

---

### Task 4: Strict Authenticated `firestore.rules` (Mandatory `firestore-rules-author` Delegation)

**Files:**
- Modify: `firestore.rules` (ONLY via `firestore-rules-author` subagent!)
- Test: `src/utils/security.test.js`, `src/utils/squads.test.js`

**Interfaces:**
- Consumes: schemas and ID formats from Tasks 1–3 (`/users/{uid}`, `/friendLookups/{emailHash}`, `/friendProfiles/{uid}`, `/friendships/{friendshipId}`, `/squadInvites/{code}`, `/squads/{squadId}` + subcollections).
- Produces: hardened `firestore.rules` enforcing strict `request.auth != null` on every operation and zero unauthenticated reads/writes.

- [ ] **Step 1: Add strict `firestore.rules` tests to `src/utils/security.test.js` and `src/utils/squads.test.js` (Review Focus #5)**

Update rule-inspection assertions so `src/utils/security.test.js` and `src/utils/squads.test.js` fail against the current open rules and verify:
- Zero occurrences of `allow get, list: if true;` or `allow get: if isUserDocOwner(userId) || isValidDocId(userId);` or `allow delete: if false;` on `squads/{squadId}/sessions/{sessionId}`.
- Every `match` block enforces `isSignedIn()` or `if false;` (`/emailVerifications`, `/mail`, `/test` locked to `allow read, write: if false;`).
- `/users/{userId}` forbids `list` (`allow list: if false;`), forbids `'passwordHash' in request.resource.data` on write, and allows narrow `isLegacyEmailOwner(userId)` for migration read/cleanup only.
- `/friendLookups/{emailHash}` enforces `emailHash.matches('^[a-f0-9]{64}$')`, `allow list: if false;`, and key allowlist `['uid', 'displayName', 'emailHash', 'updatedAt']`.
- `/friendProfiles/{userId}` enforces `isUserDocOwner(userId) || isAcceptedFriendOf(userId)`, `allow list: if false;`, and forbids `grades` / `passwordHash`.
- `/friendships/{friendshipId}` enforces participant-only `get`/`list`, canonical UID pair `friendshipId.size() <= 512`, `requesterUid != recipientUid`, `pending -> accepted` transition by `recipientUid`.
- `/squadInvites/{code}` enforces `get: if isSignedIn()`, `allow list: if false;`, and creator/squad-creator `delete`.
- `/squads/{squadId}` enforces participant/legacy `list`, solo-creator `delete`, and `members`/`presence`/`activities`/`sessions` deletion by author or `isSquadCreator(squadId)`.

- [ ] **Step 2: Run security & squads tests to confirm they fail against current `firestore.rules`**

Run: `node --test src/utils/security.test.js src/utils/squads.test.js`
Expected: FAIL on strict `firestore.rules` assertions.

- [ ] **Step 3: Invoke `firestore-rules-author` subagent to rewrite `firestore.rules`**

**MANDATORY RULE:** Dispatch `invoke_subagent` with `TypeName: "firestore-rules-author"`, passing the exact rules specification from Spec Section D and `docs/superpowers/specs/2026-11-27-gdpr-hardening-and-account-deletion-design.md` (including helper `legacyEmailDocId` matching `getEmailDocId` normalization in `authService.js`, canonical ASCII `isAcceptedFriendOf` pair lookup `<= 512`, `squadInvites/{code}`, and `allow delete` on `squads/{squadId}/sessions/{sessionId}`). Inspect the returned `firestore.rules` diff afterward.

- [ ] **Step 4: Run security & squads tests to verify pass**

Run: `node --test src/utils/security.test.js src/utils/squads.test.js`
Expected: PASS

- [ ] **Step 5: Commit Task 4**

```powershell
git add firestore.rules src/utils/security.test.js src/utils/squads.test.js; if ($LASTEXITCODE -eq 0) { git commit -m "security(rules): require strict Firebase Auth, privacy-separate FriendProfiles, and allow creator/self teardown" }
```

---

### Task 5: Self-Serve GDPR Art. 17 Account Deletion Service (`accountDeletionService.js`)

**Files:**
- Create: `src/lib/accountDeletionService.js`
- Create: `src/utils/accountDeletion.test.js`

**Interfaces:**
- Consumes: `hashEmailForLookup`, `getEmailDocId` from `src/lib/authService.js`; `normalizeUserId` from `src/utils/telemetry.js`.
- Produces in `src/lib/accountDeletionService.js`:
  - `selectRandomNextCreator(members: Array<{ uid: string, name?: string, displayName?: string }>, excludedUid: string, randomFn?: () => number): { uid: string, name: string } | null`
  - `cleanNextSessionForUser(nextSession: object | null | undefined, excludedUid: string): { nextSession: object | null, changed: boolean }` — strips `excludedUid` from `attendeeUids` and matching `attendees` entries.
  - `deleteCurrentUserAccount({ authUser, password, cleanupActiveListeners, clearBrowserStorage, randomFn, ops }): Promise<{ ok: boolean, error?: string, transferredSquads: number, deletedSquads: number }>` — implements the exact 5-phase pipeline from Spec Section E.3.

- [ ] **Step 1: Write failing unit tests in `src/utils/accountDeletion.test.js` (Review Focus #3 & #4)**

Write tests covering:
1. `selectRandomNextCreator`: returns `null` when empty or only `excludedUid`; returns `{ uid, name }` deterministically using injected `randomFn` (`0.0` picks first eligible, `0.99` picks last eligible, clamped cleanly).
2. `cleanNextSessionForUser`: removes `excludedUid` from `attendeeUids` and `attendees`, leaving other attendees intact and setting `changed: true`.
3. Phase 1 re-auth failure (`reauthenticate` throws `auth/wrong-password` or `auth/invalid-credential`): returns `{ ok: false, error: 'Incorrect password. Please try again.' }` with **zero** calls to `cleanupActiveListeners`, Firestore deletes/updates, `deleteUser`, or `clearBrowserStorage`.
4. Phase 3 non-empty owned squad: deletes deleting user's `activities`, `sessions`, updates `nextSession` attendance, deletes `members/{uid}` and `presence/{uid}` BEFORE updating `squads/{squadId}` (`createdBy: nextCreator.uid`, `creatorName: nextCreator.name`, `memberUids` minus `uid`), then Phase 4 deletes `/friendships`, `/friendLookups/{emailHash}`, `/friendProfiles/{uid}`, `/users/{uid}`, then Phase 5 calls `deleteUser(authUser)` and `clearBrowserStorage()`.
5. Phase 3 empty owned squad: deletes all docs in `members`, `presence`, `activities`, `sessions` + `/squadInvites/{code}` BEFORE `deleteDoc(squads/{squadId})`.
6. Mid-cleanup Firestore failure in Phase 3/4: aborts cleanly and NEVER calls `deleteUser(authUser)` or `clearBrowserStorage()`, returning `{ ok: false, error: ... }`.

- [ ] **Step 2: Run account deletion tests to verify they fail**

Run: `node --test src/utils/accountDeletion.test.js`
Expected: FAIL (`Cannot find module '../lib/accountDeletionService.js'`).

- [ ] **Step 3: Implement `src/lib/accountDeletionService.js`**

Implement `selectRandomNextCreator`, `cleanNextSessionForUser`, and `deleteCurrentUserAccount` strictly following the 5 phases in Spec Section E.3, with default Firestore/Firebase Auth operations wrapped in `ops` (and clean error classification mapping `auth/wrong-password` / `auth/invalid-credential` / `auth/too-many-requests`).

- [ ] **Step 4: Run account deletion tests to verify pass**

Run: `node --test src/utils/accountDeletion.test.js`
Expected: PASS

- [ ] **Step 5: Commit Task 5**

```powershell
git add src/lib/accountDeletionService.js src/utils/accountDeletion.test.js; if ($LASTEXITCODE -eq 0) { git commit -m "feat(gdpr): add 5-phase self-serve accountDeletionService with random squad ownership transfer" }
```

---

### Task 6: Wire Strict Auth, Migration, Friends/Squads & Settings Delete Account UI into `src/app.js`, `pages/settings.html`, and `src/index.css`

**Files:**
- Modify: `src/app.js`
- Modify: `pages/settings.html:120-144`
- Modify: `src/index.css`
- Test: `src/utils/accountDeletion.test.js`, `src/utils/squads.test.js`, `src/utils/security.test.js`

**Interfaces:**
- Consumes:
  - `runOneTimeLegacyMigration` from `src/lib/migrationService.js`
  - `hashEmailForLookup` from `src/lib/authService.js`
  - `normalizeUserId`, `buildFriendProfilePayload` from `src/utils/telemetry.js`
  - `syncFriendProfileAndLookup`, `createSquadInvite`, `resolveSquadByInviteCode`, `joinSquadInCloud`, `deleteSquadInvite`, `sendFriendRequest`, `acceptFriendRequest`, `declineOrRemoveFriendship`, `fetchUserFriendships`, `fetchFriendProfileTelemetry` from `src/lib/squadService.js`
  - `deleteCurrentUserAccount` from `src/lib/accountDeletionService.js`

- [ ] **Step 1: Add UI markup & wiring tests in `src/utils/accountDeletion.test.js` and `src/utils/squads.test.js`**

- Assert `pages/settings.html` contains Danger Zone card with `#btn-open-delete-account`, accessible `<dialog id="modal-delete-account">`, `#form-delete-account`, `#input-delete-password`, `#chk-delete-confirm`, `#delete-account-status`, `#btn-confirm-delete-account`, `#btn-cancel-delete-account`.
- Assert `src/app.js` does NOT contain `GoogleAuthProvider`, `signInWithPopup`, `signInWithRedirect`, `getRedirectResult`, `completeGoogleUserSignIn`, `btn-google-sso`, `formatGoogleAuthError`, `verifyPassword`, `FRIENDS_HUB_SQUAD_ID`, or `hubActivityDocToFriendship`; DOES contain `deleteCurrentUserAccount`, `runOneTimeLegacyMigration`, `cleanupAllRealtimeListeners`, `friendProfiles`, `where('users', 'array-contains',`, `joinSquadInCloud`, and `resolveSquadByInviteCode`.
- Update `src/utils/squads.test.js` line checking `FRIENDS_HUB_SQUAD_ID` in `src/app.js` to check participant-scoped `where('users', 'array-contains',` and `/friendProfiles/` instead.

- [ ] **Step 2: Run affected tests to verify failures before implementation**

Run: `node --test src/utils/accountDeletion.test.js src/utils/squads.test.js src/utils/security.test.js`
Expected: FAIL on missing Settings Danger Zone markup and old Google/PBKDF2/FRIENDS_HUB wiring in `src/app.js`.

- [ ] **Step 3: Implement `pages/settings.html`, `src/index.css`, and `src/app.js` wiring**

- **`pages/settings.html` (right `.stack` below `Workspace Backup & Reset` card):** Add Danger Zone Obsidian card (`Delete Account` heading, clear summary noting permanent erasure + random Squad reassignment, `#btn-open-delete-account`) and `<dialog id="modal-delete-account" ...>` with `#form-delete-account`, `#input-delete-password`, `#chk-delete-confirm`, `#delete-account-status`, `#btn-cancel-delete-account`, `#btn-confirm-delete-account`.
- **`src/index.css`:** Add minimal Deep Obsidian Glass `.danger-zone-card`, `.btn-danger-solid`, and `#modal-delete-account` spacing helpers matching existing `.btn-danger` and `.modal-card` tokens.
- **`src/app.js`:**
  - Remove `GoogleAuthProvider`, `signInWithPopup`, `signInWithRedirect`, `getRedirectResult`, `completeGoogleUserSignIn`, `handleGoogleSignIn`, `#btn-google-sso`, `formatGoogleAuthError`, `verifyPassword`, `FRIENDS_HUB_SQUAD_ID`, `hubActivityDocToFriendship`.
  - Add `getActiveAuthUid()` (`auth?.currentUser?.uid || ''`, fallback `'local_student'` ONLY in offline/non-Firebase mode) and `cleanupAllRealtimeListeners()`.
  - Remove unauthenticated PBKDF2 fallback from `#form-auth-login`; write `/users/{authUser.uid}` (without `passwordHash`), `/friendProfiles/{authUser.uid}`, and `/friendLookups/{emailHash}` on registration (`#form-auth-register`) and updates (`pushWorkstationToCloud`).
  - Update `onAuthStateChanged`: on signed-in, run `await runOneTimeLegacyMigration({ authUser: user, profile, courses, studyLogs, assignments, dbInstance: db })` before subscribing to `doc(db, 'users', user.uid)` and loading squads/friendships; on signed-out, call `cleanupAllRealtimeListeners()`.
  - Update `subscribeToUserFriendships(myUid)` -> `query(collection(db, 'friendships'), where('users', 'array-contains', myUid))`; update `selectFriendForStatsView` -> `doc(db, 'friendProfiles', normUid)`; update `#form-create-squad` -> `createSquadInvite`; update `#form-join-squad` -> `resolveSquadByInviteCode` + `joinSquadInCloud`.
  - Bind `#btn-open-delete-account`, `#btn-cancel-delete-account`, and `#form-delete-account` submit to `deleteCurrentUserAccount({ authUser: auth.currentUser, password, cleanupActiveListeners: cleanupAllRealtimeListeners, clearBrowserStorage: clearUniSphereBrowserStorage })`, showing inline status in `#delete-account-status` and redirecting to `/index.html` on success.

- [ ] **Step 4: Run tests + TypeScript check to verify pass**

Run: `node --test src/utils/accountDeletion.test.js src/utils/squads.test.js src/utils/security.test.js; if ($LASTEXITCODE -eq 0) { npm run lint }`
Expected: PASS and exit code 0.

- [ ] **Step 5: Commit Task 6**

```powershell
git add src/app.js pages/settings.html src/index.css src/utils/accountDeletion.test.js src/utils/squads.test.js; if ($LASTEXITCODE -eq 0) { git commit -m "feat(app,settings): enforce strict UID auth, auto-migration, friendProfiles sync, and Delete Account UI" }
```

---

### Task 7: Legal Page Updates (`pages/privacy.html`, `pages/terms.html`) & Full Verification Gate

**Files:**
- Modify: `pages/privacy.html:65-190`
- Modify: `pages/terms.html:100-120`
- Test: `src/utils/introPage.test.js`

- [ ] **Step 1: Add assertions in `src/utils/introPage.test.js` for updated English Privacy & Terms copy**

Assert:
- `pages/privacy.html` does NOT mention `Google Sign-In` or `Google Sign-In identifier` or *"in our next milestone"* deletion placeholder; DOES describe Email/Password Firebase Auth, strict authenticated access (`request.auth != null`), separation of private workspace data vs friend telemetry, and self-serve **Delete My Account** in *Settings* (including shared Squad entry erasure) + `privacy@unispherelife.me`.
- `pages/terms.html` documents Study Squad ownership continuity (random reassignment to a remaining member on creator account deletion, or Squad deletion when empty) and self-serve deletion in *Settings*.

- [ ] **Step 2: Run introPage test to verify it fails against Milestone 1 legal text**

Run: `node --test src/utils/introPage.test.js`
Expected: FAIL on Google Sign-In / next-milestone deletion assertions.

- [ ] **Step 3: Update `pages/privacy.html` and `pages/terms.html`**

Keep `UniSphere Project Maintainer`, `privacy@unispherelife.me`, English-only prose, and GDPR/Italian Civil Code/DSA legal structure intact while updating authentication, `/users/{uid}` vs `/friendProfiles/{uid}` isolation, self-serve Settings deletion, and random Squad ownership transfer sections cleanly.

- [ ] **Step 4: Run full test, typecheck, and production build verification gate**

Run (PowerShell):
```powershell
npm test; if ($LASTEXITCODE -eq 0) { npm run lint }; if ($LASTEXITCODE -eq 0) { npm run build }
```
Expected: All test suites PASS (0 failed), `tsc --noEmit` exits 0, `vite build` exits 0 cleanly.

- [ ] **Step 5: Commit Task 7 & remind operator to deploy `firestore.rules`**

```powershell
git add pages/privacy.html pages/terms.html src/utils/introPage.test.js; if ($LASTEXITCODE -eq 0) { git commit -m "docs(legal): update Privacy Policy and Terms for strict auth, friend separation, and self-serve deletion" }
```
*(In final Milestone 2 summary after execution, instruct operator to run `firebase deploy --only firestore:rules` or paste the updated `firestore.rules` into the Firebase Console Rules editor before deploying production builds.)*
