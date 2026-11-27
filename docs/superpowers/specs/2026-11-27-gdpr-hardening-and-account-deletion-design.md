# UniSphere — GDPR Art. 32 Hardening, Strict Firebase Auth, and Self-Serve Account Deletion (Milestone 2 Design Specification)

- **Feature:** Milestone 2 — Removal of Google Sign-In, Strict Authenticated `firestore.rules`, One-Time Legacy Migration, Privacy-Separated Friend Telemetry, and GDPR Art. 17 Self-Serve Account Deletion
- **Date:** 2026-11-27
- **Branch:** `matteoppet/website-introdution`
- **Status:** Draft (Pending User Approval of Finalized Spec)
- **Prerequisite:** Milestone 1 (`docs/superpowers/specs/2026-11-27-website-introduction-design.md`, commits `fa469ef`..`27baca5`)

---

## Intent & Why

Milestone 1 established UniSphere's public introduction page, legal transparency pages (`pages/privacy.html`, `pages/terms.html`), and split Sign In / Create Account entry UI (`pages/login.html`). However, an audit of `firestore.rules`, `src/lib/authService.js`, `src/lib/squadService.js`, `src/utils/telemetry.js`, `src/app.js`, and `pages/settings.html` revealed structural GDPR compliance and security gaps:

1. **Public / Unauthenticated Firestore Access (GDPR Art. 5(1)(f) & Art. 32):** `firestore.rules` currently allows unauthenticated `get` on `/users/{userId}` (containing full academic profiles, grades, exams, notes, and `passwordHash`), unauthenticated `get`/`list` across `/squads`, `/friendships`, `/emailVerifications`, and `/mail`, and unauthenticated reads/writes to the shared `squads/unisphere_friends_hub/activities` hub used for friend requests.
2. **Oversharing User Documents for Friend Features (GDPR Art. 5(1)(c) Data Minimization):** Friends currently read each other's full `/users/{userId}` document (`sendFriendRequest`, `fetchFriendProfileTelemetry`, `selectFriendForStatsView`) rather than a strict minimal telemetry projection.
3. **Email-Slug Document Keying & Google Sign-In Surface:** Today's client keys `/users/{docId}` and squad identities (`createdBy`, `memberUids`, `members/{id}`, `presence/{id}`) by normalized email (`getEmailDocId`), while still offering Google Sign-In and unauthenticated PBKDF2 login fallback. Removing Google Sign-In and keying all identity documents strictly by Firebase Auth `uid` (`request.auth.uid`) eliminates email-as-identifier exposure in squads/friendships, removes external Google Identity origins from CSP headers, and eliminates passwordless re-authentication edge cases—paired with an automatic one-time client migration so existing users do not lose their workspaces or squads.
4. **Missing GDPR Art. 17 Right to Erasure:** `pages/settings.html` only provides "Reset Workspace Data" (which pushes empty arrays into Firestore rather than erasing the account or Firebase Auth identity). Users need a self-serve permanent account deletion flow that cleanly handles owned Squads (randomly reassigning ownership if members remain, or deleting empty Squads), erases their shared Squad entries (`activities`, `sessions`, `nextSession` attendance), deletes friendships and personal docs, and deletes the Firebase Auth user.

---

## Goals

1. **Remove Google Sign-In completely** from UI (`pages/login.html`), client auth logic (`src/app.js`, `src/lib/authService.js`), CSP headers (`vercel.json`, `server.ts`, `src/lib/authService.js`), and unit tests (`src/utils/security.test.js`), while adding a brief note in `pages/login.html` directing any former Google sign-in users to **Forgot password?** to set a password and retain their Firebase Auth `uid`.
2. **Enforce strict Firebase Auth (`request.auth != null`) across every Firestore read and write (`firestore.rules`)**, eliminate unauthenticated PBKDF2 password-hash fallback sign-in and `passwordHash` storage in `/users/{uid}`, and preserve case-sensitive Firebase Auth `uid` identifiers everywhere.
3. **Automatic One-Time Legacy Login Migration:** When an existing Firebase Auth user signs in and has data stored at legacy email-keyed `/users/{emailSlug}` (with no `/users/{uid}` yet, or unmigrated email-keyed squad memberships), migrate `/users/{emailSlug}` -> `/users/{uid}` (stripping `passwordHash`), initialize `/friendProfiles/{uid}` + `/friendLookups/{emailHash}`, convert their squad `createdBy` / `memberUids` / `members` / `presence` references from `emailSlug` to `uid`, and delete the legacy `/users/{emailSlug}` doc.
4. **Privacy-Separate Friends & Squads (Approach 1):**
   - Lock `/users/{uid}` exclusively to `request.auth.uid == uid` for `get`, `create`, `update`, and `delete` (no `list`).
   - Key `/friendships` strictly by canonical Firebase Auth `uid` pairs (`${sortedUidA}__${sortedUidB}`, `users: [uidA, uidB]`) up to 512 chars so both email-lookup friend requests and the Squad Members `+ Friend` action work without exposing member email addresses in `/squads`.
   - Use `/friendLookups/{sha256(normalizedEmail)}` (`allow get: if isSignedIn(); allow list: if false;`) to resolve an exact email -> `{ uid, displayName }`, and `/squadInvites/{code}` (`allow get: if isSignedIn(); allow list: if false;`) for join-by-code without opening `/squads` to `list`.
   - Create `/friendProfiles/{uid}` (`allow get: if isUserDocOwner(uid) || isAcceptedFriendOf(uid); allow list: if false;`) carrying only friend-safe identity, degree summary, grade-free enrolled `courses`, and weekly study telemetry fields expected by `buildFriendTelemetrySummary`.
   - Migrate `squadService.js` and `src/app.js` friend operations off `squads/unisphere_friends_hub/activities` onto participant-scoped `/friendships` queries (`where('users', 'array-contains', myUid)`).
5. **Implement GDPR Art. 17 Self-Serve Account Deletion (`pages/settings.html` + `src/lib/accountDeletionService.js`):**
   - Add a **Danger Zone / Delete Account** card and password-reauthenticated confirmation modal in `pages/settings.html`.
   - Unsubscribe active Firestore `onSnapshot` listeners cleanly before deletion mutations begin.
   - Across every Squad containing `uid`: delete the user's `activities`, personal `sessions`, and remove `uid` from `nextSession.attendees` / `attendeeUids`; if the deleting user is `createdBy` and other members remain, randomly select a remaining member (`selectRandomNextCreator`) to receive `createdBy` and `creatorName` before deleting `members/{uid}` and `presence/{uid}`; if no other members remain, delete all Squad subcollections (`members`, `presence`, `activities`, `sessions`, `squadInvites/{code}`) and delete the `squads/{squadId}` document.
   - Delete `/friendships` involving `uid`, `/friendLookups/{emailHash}`, `/friendProfiles/{uid}`, `/users/{uid}`, Firebase Auth user (`deleteUser`), and browser storage, then redirect to `/index.html`.
6. **Update English Legal Pages (`pages/privacy.html`, `pages/terms.html`)** to remove Google Sign-In mentions and document strict Firebase Email/Password auth, one-time UID migration, `/friendProfiles` telemetry separation, self-serve Settings deletion (including shared Squad entry erasure), and random Squad ownership transfer.

---

## Non-Goals

- Adding `firebase-admin` / server-side Cloud Functions or Vercel Admin SDK deletion endpoints (excluded by selecting Approach 1).
- Re-introducing Google, Microsoft, Apple, or any third-party OAuth SSO providers.
- Supporting login for legacy local/PBKDF2 accounts that have *no* Firebase Auth user (`auth.currentUser == null` cannot satisfy `request.auth != null`; such users must register via Firebase Auth Email/Password).
- Changing solo-user core workflows or violating solo-user isolation outside `/squads`.
- Automating live production deployment (`firebase deploy --only firestore:rules`); production rules push stays an explicit manual step documented for the operator.

---

## Anti-Goals

- Calling `.toLowerCase()` on Firebase Auth `uid` strings anywhere in client code, services, or `telemetry.js` (Firebase Auth UIDs are mixed-case base62-like strings; lowercasing corrupts UID equality with `request.auth.uid`!).
- Leaving any unauthenticated `get` or `list` path in `firestore.rules` (not even `test/connection`, `emailVerifications`, `mail`, or `squads`).
- Truncating canonical friendship document IDs below 512 chars or allowing `list` on `/friendProfiles`, `/friendLookups`, `/squadInvites`, or `/users`.
- Writing or modifying `firestore.rules` directly in the main agent (mandatory project rule: any edit to `firestore.rules` MUST be delegated to the `firestore-rules-author` subagent).
- Calling `deleteUser()` before Firestore cleanup finishes or leaving active `onSnapshot` listeners alive during deletion.

---

## Constraints

1. **Mandatory Subagent Delegation for `firestore.rules`:** Creating/authoring/modifying `firestore.rules` MUST be delegated to `firestore-rules-author`.
2. **Case-Sensitive Firebase Auth UIDs:** Existing code in `src/lib/squadService.js`, `src/utils/telemetry.js`, and `src/app.js` frequently runs `.trim().toLowerCase()` on `uid` (because `uid` used to be an email slug!). All Firebase Auth `uid` paths (`normUid` helpers used for `auth.uid` or `/users/{uid}` / `/friendProfiles/{uid}` / `/friendships` / `/squads`) MUST preserve original UID casing (`.trim().replace(/\//g, '_')` without `.toLowerCase()`), while email normalization (`normalizeEmail`) continues to `.trim().toLowerCase()`.
3. **Canonical 512-Char Friendship Document IDs:** `buildFriendshipId(uidA, uidB)` must sort `[uidA, uidB]` lexicographically (case-sensitive ASCII order matching Firestore rules `<` string comparison) into `${sorted[0]}__${sorted[1]}` up to 512 chars without `.slice(0, 128)`.
4. **Squad Join & Creation Rule Ordering:** Because `squads/{squadId}` subcollections verify `isSquadMember(squadId)`:
   - **Create Squad:** write `squads/{squadId}` (`memberUids: [myUid]`, `createdBy: myUid`) -> write `squadInvites/{code}` -> write `members/{myUid}`, `presence/{myUid}`.
   - **Join Squad:** read `squadInvites/{code}` -> read `squads/{squadId}` -> update `squads/{squadId}` (`memberUids: arrayUnion(myUid)`) -> write `members/{myUid}`, `presence/{myUid}`.
   - **Leave / Account Delete (Non-Empty Squad):** delete user's `activities` & `sessions`, update `squads/{squadId}.nextSession` (remove from `attendees`/`attendeeUids`), delete `members/{myUid}` & `presence/{myUid}` -> finally update `squads/{squadId}` removing `myUid` from `memberUids` (and transferring `createdBy` + `creatorName` if `createdBy == myUid`).
   - **Account Delete (Empty / Solo Creator Squad):** delete all docs in `members`, `presence`, `activities`, `sessions`, delete `squadInvites/{code}` -> delete `squads/{squadId}`.
5. **Solo-User Isolation:** Solo users who never visit `/squads` or add friends experience zero social UI clutter; syncing `/friendProfiles/{uid}` and `/friendLookups/{emailHash}` runs silently inside existing profile/workspace persistence only when signed in.
6. **CSP Parity:** `src/lib/authService.js`, `vercel.json`, and `server.ts` must stay strictly synchronized for CSP headers (removing `https://accounts.google.com` and `https://apis.google.com`).
7. **Test Suite Cleanliness:** Update `src/utils/security.test.js`, `src/utils/squads.test.js`, and add coverage for legacy migration, UID casing, `selectRandomNextCreator`, deletion phases, and strict rules so `npm test`, `npm run lint`, and `npm run build` pass with exit code 0.

---

## Approaches Considered

### Approach 1 (Selected): Strict Firebase Auth + One-Time UID Migration + Privacy-Separated Friend Data
- Remove Google Sign-In; enforce `request.auth != null` on all Firestore operations; migrate legacy email-keyed `/users/<email>` and email-keyed squads automatically to Firebase Auth `uid` on login; use `uid`-keyed `/friendships`, `/friendLookups/{emailHash}`, `/squadInvites/{code}`, and `/friendProfiles/{uid}`; perform complete GDPR Art. 17 client-side erasure including shared Squad artifacts.
- **Pros:** Zero server/Admin-SDK secret surface; strict GDPR Art. 5(1)(c) and Art. 32 compliance; preserves existing user workspaces, Squads, Squad `+ Friend`, and Friend Stats UI.
- **Cons:** Client-side migration and deletion span multiple Firestore writes and require careful phase ordering and narrow temporary migration rules during the transition window.

### Approach 2 (Rejected): Clean Cutover Without Migration
- Lock rules strictly to `uid` immediately and abandon pre-Milestone 2 email-keyed workspaces and squads.
- **Rejected by user decision:** Existing Firebase Auth users must keep access to their workspaces and Squads via automatic one-time migration.

### Approach 3 (Rejected): Server-Side Migration & Deletion via `firebase-admin`
- Route deletions and friend data through Vercel serverless functions holding `FIREBASE_SERVICE_ACCOUNT`.
- **Rejected because:** Unnecessary backend credential management when Firebase Client Auth + strict `firestore.rules` + reauthentication handle all requirements directly.

---

## Decided Design

### A. Google Sign-In Removal, Login Guidance & Strict Firebase Email/Password Auth

1. **`pages/login.html`:**
   - Remove `<button type="button" id="btn-google-sso" ...>Sign In with Google</button>` from `#panel-auth-login`.
   - Replace the `<p class="auth-legal-note">Signing in with Google is governed by...</p>` notice with a concise monochrome helper note for existing users: e.g., *"Previously signed in with Google? Use **Forgot password?** above with your email to set a password and keep your workspace."*
   - Keep the Login button (`Log-In`) and `Forgot password?` link inside `#panel-auth-login`.
2. **`src/app.js`:**
   - Remove `GoogleAuthProvider`, `signInWithPopup`, `signInWithRedirect`, `getRedirectResult`, `completeGoogleUserSignIn`, `handleGoogleSignIn`, `#btn-google-sso` listener, `getRedirectResult` startup hook, and `formatGoogleAuthError` import.
   - `#form-auth-login` calls `signInWithEmailAndPassword(auth, email, password)` exclusively — remove all unauthenticated `/users/{emailSlug}` + `verifyPasswordPBKDF2` fallback code.
   - `#form-auth-register` calls `createUserWithEmailAndPassword(auth, email, password)`, writes `/users/{authUser.uid}` (without `passwordHash`), writes `/friendLookups/{emailHash}` and `/friendProfiles/{authUser.uid}` (Section B), and signs/sets `emailVerified: true` when OTP verified.
   - Switch all post-auth workspace reads/writes from `getEmailDocId(email)` to `auth.currentUser.uid`.
3. **`src/lib/authService.js`:**
   - Remove `formatGoogleAuthError` export.
   - Strip `https://accounts.google.com` and `https://apis.google.com` from `script-src` and `frame-src` in `getSecurityHeaders()`.
   - Remove unauthenticated Firestore reads/writes to `emailVerifications` and `mail` collections in `dispatchVerificationCode` and `verifyEmailCode` (email dispatch continues using `/api/send-email` + `sessionStorage` `unisphere_otp_*`, persisting `emailVerified: true` into `/users/{uid}` once authenticated).
4. **`src/lib/firebase.js`:**
   - Remove the unconditional unauthenticated `testConnection()` call (`getDocFromServer(doc(db, 'test', 'connection'))`) at module load.
5. **`vercel.json` and `server.ts`:**
   - Sync CSP headers with `getSecurityHeaders()`: `script-src 'self'`, `frame-src 'self'`, removing `https://accounts.google.com` and `https://apis.google.com`.

---

### B. One-Time Legacy Email-to-UID Migration (Triggered on Login)

When an authenticated user (`authUser = auth.currentUser`) signs in via `#form-auth-login` or restores an authenticated session in `onAuthStateChanged`:

1. **User Document Migration (`migrateLegacyUserToUid` in `src/lib/authService.js` or `src/lib/migrationService.js`):**
   - Normalize `legacyEmailId = getEmailDocId(authUser.email)` (if `authUser.email` exists).
   - If `/users/{authUser.uid}` does **not** exist and `legacyEmailId !== authUser.uid`:
     - Attempt `getDoc(doc(db, 'users', legacyEmailId))`. (Allowed by narrow `firestore.rules` legacy-read clause checking `request.auth.token.email != null && getEmailDocId(request.auth.token.email) == userId`.)
     - If legacy doc exists: copy payload to `doc(db, 'users', authUser.uid)` stripping `passwordHash` and adding `{ uid: authUser.uid, email: normalizeEmail(authUser.email), migratedFromEmailId: legacyEmailId, migratedAt }`, then `deleteDoc(doc(db, 'users', legacyEmailId))`.
   - Ensure `/friendLookups/{sha256(normalizeEmail(authUser.email))}` and `/friendProfiles/{authUser.uid}` are written/synced if missing.
2. **Squad Membership & Ownership Migration (`migrateLegacySquadsForUser` in `src/lib/squadService.js`):**
   - Query `/squads` where `memberUids` contains `legacyEmailId`.
   - For each matched squad:
     - First ensure `authUser.uid` is added to `squads/{squadId}.memberUids` (and if `createdBy === legacyEmailId`, update `createdBy` to `authUser.uid` in the same/immediate update so subcollection rules grant member/creator access).
     - Copy `members/{legacyEmailId}` -> `members/{authUser.uid}` (setting `uid: authUser.uid` and preserving display name/stats, without exposing email) and `presence/{legacyEmailId}` -> `presence/{authUser.uid}` if present; delete `members/{legacyEmailId}` and `presence/{legacyEmailId}`.
     - Update `squads/{squadId}` removing `legacyEmailId` from `memberUids`, updating any `nextSession.attendeeUids` entry from `legacyEmailId` -> `authUser.uid`, and keeping `memberCount` accurate.
3. **Legacy Friendships Migration (`migrateLegacyFriendshipsForUser` in `src/lib/squadService.js`):**
   - Also check `/squads/unisphere_friends_hub/activities`? No — retiring `unisphere_friends_hub` cleanly and gating `friendships` strictly by UID means legacy pre-UID email friendships can either be cleaned up only if accessible, OR once both users have `/friendLookups/{emailHash}` and `/friendProfiles/{uid}`, users send clean UID-keyed friend requests under the hardened schema. Wait: if an old `/friendships` doc has `users: [emailA, emailB]` where caller matches `request.auth.token.email.lower()`, allow authenticated participant read/delete on legacy email `/friendships` docs during transition so stale legacy docs don't leave clutter (`allow delete: if isSignedIn() && (request.auth.uid in resource.data.users || authEmail() in resource.data.users)`). That is tiny, zero-risk, and super helpful!

---

### C. Privacy-Separated Friend Data, Lookups & Squad Invites

1. **Lookup Collections (Zero-Enumeration `allow list: if false`):**
   - **`/friendLookups/{emailHash}`:**
     - `emailHash` = lowercase 64-char hex SHA-256 of trimmed lowercased email (`sha256Hex(normalizeEmail(email))`).
     - Fields: `{ uid: string, displayName: string, emailHash: string, updatedAt: string }` (no plaintext email stored).
     - Used solely by `sendFriendRequest` to turn an exact entered email into `{ uid, displayName }`. If the lookup doc does not exist, `sendFriendRequest` rejects cleanly with `"No UniSphere account found for that email address."`
   - **`/squadInvites/{code}`:**
     - `code` = 6-char uppercase alphanumeric squad invite code (`^[A-Z0-9]{6,12}$`).
     - Fields: `{ code: string, squadId: string, createdBy: string, createdAt: string }`.
     - Written when creating a Squad, read via `getDoc` when joining by code (`joinSquadByCode`), and deleted when the Squad is deleted during empty-squad cleanup. Eliminates needing `allow list` by invite code on `/squads`.
2. **`/friendProfiles/{userId}` Schema (Compatible with `buildFriendTelemetrySummary` in `src/utils/telemetry.js`):**
   - Keyed by case-sensitive Firebase Auth `uid`.
   - Readable ONLY by owner or **accepted** friend (`isUserDocOwner(userId) || isAcceptedFriendOf(userId)`). Never `list`-able.
   - Pre-aggregated grade-free schema (strictly omitting `grades`, `examLog`, `notes`, `studyLogs`, `assignments`, `passwordHash`, and personal settings):
     ```ts
     interface FriendCourseSummary {
       id: string;
       title: string;
       code: string;
       semester: string;
       status: string;
     }

     interface FriendProfile {
       uid: string;                    // Exact Firebase Auth uid (matches doc ID)
       name: string;                   // Display name (matches safeDoc.name in buildFriendTelemetrySummary)
       displayName: string;
       institution: string;
       degreeName: string;
       degreeType: string;
       academicYear: string;
       status: string;                 // e.g. 'Enrolled'
       weeklyGoalHours: number;
       minutesThisWeek: number;
       tasksThisWeek: number;
       currentStreak: number;
       xp: number;
       dailyMinutes: Record<string, number>;   // 7-day breakdown map YYYY-MM-DD -> minutes
       subjectMinutes: Record<string, number>; // Weekly minutes per subject
       courses: FriendCourseSummary[];         // Enrolled courses WITHOUT grades/CFU-score PII
       updatedAt: string;
     }
     ```
   - Synced in `src/app.js` alongside user saves (for authenticated sessions only) and consumed by `fetchFriendProfileTelemetry(friendUid)` and `selectFriendForStatsView(friendUid)`.
3. **UID-Keyed `/friendships/{friendshipId}` (Retiring `unisphere_friends_hub`):**
   - `buildFriendshipId(uidA, uidB)`: sorts `[uidA, uidB]` case-sensitively (`uidA < uidB ? `${uidA}__${uidB}` : `${uidB}__${uidA}``), max length **512** (remove `.slice(0, 128)`).
   - Fields:
     ```ts
     interface FriendshipRecord {
       id: string;                   // <sortedUidA>__<sortedUidB>
       users: [string, string];      // [sortedUidA, sortedUidB]
       requesterUid: string;
       requesterName: string;
       recipientUid: string;
       recipientName: string;
       status: 'pending' | 'accepted';
       createdAt: string;
       updatedAt: string;
     }
     ```
   - Supports **both** email-search requests (via `/friendLookups/{emailHash}`) **and** Squad Member `+ Friend` requests directly from `member.uid` + `member.name` with zero squadmate email exposure!
   - Participant-scoped listener in `src/app.js`: `query(collection(db, 'friendships'), where('users', 'array-contains', myUid))`.
   - `doesFriendshipMatchUser` and `partitionFriendships` in `src/utils/telemetry.js` updated to match case-sensitive Firebase Auth UIDs (`item.requesterUid`, `item.recipientUid`, `item.users`) without lowercasing UIDs!

---

### D. Strict `firestore.rules` Design (Delegated to `firestore-rules-author`)

All collections require `isSignedIn()` (`request.auth != null`). No `if true` rules anywhere. Key patterns:

1. **`/users/{userId}`:**
   - `allow get: if isUserDocOwner(userId) || isLegacyEmailOwner(userId);` (where `isLegacyEmailOwner(userId)` checks `isSignedIn() && request.auth.token.email != null && legacyEmailDocId(request.auth.token.email) == userId` so existing accounts can read & migrate their legacy `/users/<email>` doc once).
   - `allow delete: if isUserDocOwner(userId) || isLegacyEmailOwner(userId);`
   - `allow list: if false;`
   - `allow create, update: if isUserDocOwner(userId) && !('passwordHash' in request.resource.data);`
2. **`/friendLookups/{emailHash}`:**
   - `allow get: if isSignedIn() && emailHash.matches('^[a-f0-9]{64}$');`
   - `allow list: if false;`
   - `allow create, update: if isSignedIn() && request.resource.data.uid == request.auth.uid && request.resource.data.emailHash == emailHash && request.resource.data.keys().hasOnly(['uid', 'displayName', 'emailHash', 'updatedAt']);`
   - `allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;`
3. **`/friendProfiles/{userId}`:**
   - `allow get: if isUserDocOwner(userId) || isAcceptedFriendOf(userId);`
   - `allow list: if false;`
   - `allow create, update: if isUserDocOwner(userId) && request.resource.data.uid == request.auth.uid && !('grades' in request.resource.data) && !('passwordHash' in request.resource.data);`
   - `allow delete: if isUserDocOwner(userId);`
   - `isAcceptedFriendOf(targetUserId)`:
     `let pairId = request.auth.uid < targetUserId ? request.auth.uid + '__' + targetUserId : targetUserId + '__' + request.auth.uid; return isSignedIn() && exists(/databases/$(database)/documents/friendships/$(pairId)) && get(/databases/$(database)/documents/friendships/$(pairId)).data.status == 'accepted';` (2 rule reads, deterministic, zero email lookup!).
4. **`/friendships/{friendshipId}`:**
   - `allow get, list: if isSignedIn() && (request.auth.uid in resource.data.users || isAuthEmailInList(resource.data.users));`
   - `allow create: if isSignedIn() && request.resource.data.requesterUid == request.auth.uid && request.auth.uid in request.resource.data.users && request.resource.data.users.size() == 2 && request.resource.data.status == 'pending' && friendshipId == (request.resource.data.users[0] < request.resource.data.users[1] ? request.resource.data.users[0] + '__' + request.resource.data.users[1] : request.resource.data.users[1] + '__' + request.resource.data.users[0]) && friendshipId.size() <= 512;`
   - `allow update: if isSignedIn() && request.auth.uid == resource.data.recipientUid && request.auth.uid in resource.data.users && resource.data.status == 'pending' && request.resource.data.status == 'accepted' && request.resource.data.users == resource.data.users && request.resource.data.requesterUid == resource.data.requesterUid && request.resource.data.recipientUid == resource.data.recipientUid;`
   - `allow delete: if isSignedIn() && (request.auth.uid in resource.data.users || isAuthEmailInList(resource.data.users));`
5. **`/squadInvites/{code}`:**
   - `allow get: if isSignedIn();`
   - `allow list: if false;`
   - `allow create: if isSignedIn() && request.resource.data.createdBy == request.auth.uid;`
   - `allow update: if false;`
   - `allow delete: if isSignedIn() && (resource.data.createdBy == request.auth.uid || isSquadCreator(resource.data.squadId));` (also permits transferred creator deleting an empty squad's invite later).
6. **`/squads/{squadId}` & Subcollections (`members`, `presence`, `activities`, `sessions`):**
   - `allow get: if isSignedIn();`
   - `allow list: if isSignedIn() && (request.auth.uid in resource.data.memberUids || isAuthLegacyIdInList(resource.data.memberUids));`
   - `allow create: if isSignedIn() && request.resource.data.createdBy == request.auth.uid && request.auth.uid in request.resource.data.memberUids;`
   - `allow update: if isSignedIn()` allowing:
     - Joining via invite (`!(request.auth.uid in resource.data.memberUids) && request.auth.uid in request.resource.data.memberUids`, `createdBy` unchanged).
     - Leaving / creator transfer (`request.auth.uid in resource.data.memberUids` OR migrating legacy email ID into `request.auth.uid` when `isAuthLegacyIdInList(resource.data.memberUids)`). When changing `createdBy`, only `resource.data.createdBy == request.auth.uid` (or legacy-migrating creator) may change `createdBy` to another UID in `resource.data.memberUids` (or `request.resource.data.memberUids`).
     - Member metadata / `nextSession` updates while `request.auth.uid in resource.data.memberUids`.
   - `allow delete: if isSignedIn() && resource.data.createdBy == request.auth.uid && resource.data.memberUids.size() <= 1;`
   - Subcollections (`members/{memberId}`, `presence/{memberId}`, `activities/{activityId}`, `sessions/{sessionId}`):
     - Require `isSquadMember(squadId) || isLegacySquadMember(squadId)` on `get, list`.
     - `members/{memberId}` & `presence/{memberId}`: owner (`request.auth.uid == memberId` or legacy self) or `isSquadCreator(squadId)` can delete (supporting both member departure, migration cleanup, and empty-squad teardown).
     - `activities/{activityId}` & `sessions/{sessionId}`: author (`resource.data.uid == request.auth.uid` or legacy self) or `isSquadCreator(squadId)` can delete (replacing `allow delete: if false` on `sessions` so GDPR Art. 17 erasure deletes all user entries even in non-empty Squads!).
7. **Deprecated / Unauthenticated Collections (`emailVerifications`, `mail`, `test`):**
   - `allow read, write: if false;`

---

### E. Self-Serve GDPR Art. 17 Account Deletion (`pages/settings.html` + `src/lib/accountDeletionService.js`)

1. **Settings UI (`pages/settings.html` & `src/index.css`):**
   - Add a **Danger Zone / Delete Account** card below **Workspace Backup & Reset** in `pages/settings.html` with `#btn-open-delete-account` (`Delete My Account`).
   - Confirmation Modal `#modal-delete-account`:
     - Explains permanent deletion across profile, study logs, friend links, shared Squad posts/sessions, Firebase Auth login, and random Squad ownership reassignment when co-members remain.
     - Password input `#input-delete-password`, checkbox `#chk-delete-confirm`, status/error banner `#delete-account-status`, `#btn-confirm-delete-account`, and `#btn-cancel-delete-account`.
2. **`selectRandomNextCreator(members, excludedUid, randomFn = Math.random)`:**
   - Filters `members` where `member.uid && member.uid !== excludedUid`.
   - Returns `null` if none remain, or `{ uid: chosen.uid, name: chosen.name || chosen.displayName || 'Squad Member' }` at `Math.floor(randomFn() * eligible.length)` (clamped).
3. **5-Phase Deletion Sequence (`deleteCurrentUserAccount` in `src/lib/accountDeletionService.js`):**
   - **Phase 1 — Re-authenticate First:** `reauthenticateWithCredential(authUser, EmailAuthProvider.credential(email, password))`. Abort cleanly on wrong password with zero data touched.
   - **Phase 2 — Unsubscribe Active Listeners:** Invoke `cleanupActiveListeners()` passed from `src/app.js` so active `onSnapshot` subscriptions do not emit `permission-denied` errors during teardown.
   - **Phase 3 — Squads Cleanup & Random Transfer:**
     - Query `/squads` where `memberUids` contains `uid`.
     - For each squad:
       - Fetch `members` subcollection (`getDocs`).
       - **In every squad (whether creator or regular member, empty or non-empty):**
         - Query and delete all `activities` docs where `uid == currentUid`.
         - Query and delete all `sessions` docs where `uid == currentUid`.
         - Filter `currentUid` out of `squad.nextSession?.attendees` and `squad.nextSession?.attendeeUids` if present.
       - If `squad.createdBy === uid`:
         - Run `selectRandomNextCreator(members, uid)`.
         - **Case A (Other members remain):**
           1. Delete `members/{uid}` and `presence/{uid}`.
           2. Update `squads/{squadId}` setting `createdBy: nextCreator.uid`, `creatorName: nextCreator.name`, `memberUids: arrayRemove(uid)`, `memberCount: Math.max(0, remainingCount)`, cleaned `nextSession` (if changed), and `updatedAt`.
         - **Case B (No other members remain):**
           1. Delete all docs in subcollections (`members`, `presence`, `activities`, `sessions`).
           2. Delete `/squadInvites/{squad.code}` (if `squad.code` exists).
           3. Delete `/squads/{squadId}`.
       - Else (`squad.createdBy !== uid`):
         1. Delete `members/{uid}` and `presence/{uid}`.
         2. Update `squads/{squadId}` with `memberUids: arrayRemove(uid)`, `memberCount`, cleaned `nextSession` (if changed), and `updatedAt`.
   - **Phase 4 — Delete Personal & Social Graph Docs:**
     - Query `/friendships` with `where('users', 'array-contains', uid)` and delete all matching docs.
     - Delete `/friendLookups/{sha256(normalizeEmail(email))}` (if email present).
     - Delete `/friendProfiles/{uid}`.
     - Delete `/users/{uid}` (plus `/users/{legacyEmailId}` if somehow still present).
   - **Phase 5 — Delete Firebase Auth User & Clear Browser State:**
     - Call `await deleteUser(authUser)`.
     - Clear UniSphere keys from `localStorage` and `sessionStorage`.
     - Redirect to `/index.html`.
   - **Failure Recovery:** If any Firestore call fails transiently before Phase 5, abort before calling `deleteUser(authUser)` so the user can retry deletion without leaving an orphaned Firestore profile or losing auth credentials.

---

### F. Legal Page Updates (`pages/privacy.html`, `pages/terms.html`)

- Preserve `UniSphere Project Maintainer` and `privacy@unispherelife.me` placeholders and strict English copy.
- **`pages/privacy.html`:** Remove Google Sign-In mentions; document strict Firebase Email/Password auth (`request.auth != null` on all Firestore operations), one-time migration of legacy email-keyed docs to Firebase Auth `uid`, strict owner-only `/users/{uid}` vs friend-only `/friendProfiles/{uid}`, and GDPR Art. 17 self-serve **Delete My Account** in Settings (covering erasure of shared Squad activities/sessions/attendance) + `privacy@unispherelife.me` fallback.
- **`pages/terms.html`:** Remove Google Sign-In governance clauses; document Squad continuity (random ownership reassignment to a remaining member when a Squad creator deletes their account, or deletion of empty Squads).

---

## Design Calls Made

1. **One-Time Automatic Client Migration + Forgot-Password Guidance for Former Google Users:** Preserves existing user workspaces and Squads when moving from email-slug keys to `uid` keys without needing backend Admin scripts.
2. **Case-Sensitive Firebase Auth `uid` Everywhere:** `uid`-keyed `/friendships`, `/friendLookups/{emailHash}`, `/squadInvites/{code}`, and `/friendProfiles/{uid}` preserve exact UID casing (unlike email normalization) so Squad `+ Friend`, friend requests, and `isAcceptedFriendOf` work without exposing emails in `/squads` or `/friendProfiles`.
3. **Full Grade-Free Telemetry Schema in `/friendProfiles/{uid}`:** Retains all existing `#friend-info-stats-view` sections (`weeklyGoalHours`, `minutesThisWeek`, `dailyMinutes`, `subjectMinutes`, `tasksThisWeek`, `currentStreak`, `xp`, academic profile fields, and grade-free `courses`) via `buildFriendTelemetrySummary` while keeping `/users/{uid}` completely private.
4. **`/squadInvites/{code}` + Zero-Listing Lookup Design:** Prevents any signed-in user from calling `list` on `/squads`, `/friendProfiles`, `/friendLookups`, `/squadInvites`, or `/users`; `/friendships` lookup to unregistered emails fails cleanly with a user-friendly not-found message.
5. **Pre-Auth Email Code via Resend (`/api/send-email`) + `sessionStorage` Only:** Removes all unauthenticated `emailVerifications` and `mail` Firestore collection usage cleanly.
6. **Full GDPR Art. 17 Shared-Squad Erasure + `deleteUser` Last:** Deletes the user's `activities`, `sessions`, and `nextSession` attendance even in non-empty Squads (alongside random creator reassignment or empty Squad + invite cleanup), executing `deleteUser(auth.currentUser)` only after all Firestore cleanup succeeds.

---

## Left to the Builder

- Exact CSS/HTML markup refinements for `#modal-delete-account` and Danger Zone card inside `pages/settings.html` and `src/index.css` matching Deep Obsidian Glass.
- Updating `src/utils/security.test.js`, `src/utils/squads.test.js`, and adding focused tests for `selectRandomNextCreator`, deletion sequence ordering/failure abort, migration helpers, case-sensitive UID helpers, and strict `firestore.rules`.
- Including explicit post-merge manual deployment instructions for pushing updated `firestore.rules` to production (`firebase deploy --only firestore:rules` or Firebase Console).
