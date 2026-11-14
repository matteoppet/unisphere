# Squads View UI Redesign, Live Library & Issues (#36, #42, #43) Design

## Intent & Why
Transform `/pages/squads.html` into a comprehensive academic study hub matching the reference screenshot while replacing the static "Squad Goal" widget with an interactive **Live Library**, fixing the squad leave persistence bug (#42), adding a creator-only **Admin Panel** (#36), and adding a popup **Friend Weekly Calendar** modal (#43).

## Goals
1. **Top Title & Modal Links (#36):**
   - Display `Squads` heading alongside `+ Create or Join a Squad` (opens a `<dialog>` widget only when pressed, also allowing switching or leaving squads) and `Admin Panel` (shown only when `activeSquad.createdBy === myUid`).
   - Provide a `Leave Squad` action so any member can leave their current squad cleanly.
2. **Admin Panel Modal (#36):**
   - Creator-only `<dialog id="modal-squad-admin">` to rename the squad, set/update the squad description, remove individual members, or delete the squad.
3. **Fix Leave Squad Bug (#42):**
   - When leaving a squad (or when an admin removes a member), remove the member's UID from `squads/{squadId}.memberUids`, delete `squads/{squadId}/members/{uid}` and `squads/{squadId}/presence/{uid}`, and remove `squadId` from `users/{uid}.squadIds` (persisting `activeSquadId: null` cleanly so reloading the browser never re-joins the squad).
4. **Top Summary Bar:**
   - 5-column `.dashboard-summary` bar showing: `Active Squad` (with optional squad selector / description), `Squad Weekly Time`, `My Weekly Time`, `My Streak`, and `Invite Code` with `Copy` link.
5. **Live Library Widget (replaces Squad Goal):**
   - Left card (`Live Library`) with a `Go Live` / `End Live` button.
   - Displays currently live squad members, what subject they are studying, how long they have been studying (live elapsed timer + weekly time), and a `Go Live with ...` / `Join Live` action so squadmates can immediately join them live.
   - Retains the **Hours by Subject** table below the live study room so squad subject totals remain visible.
6. **Squad Members & Friend Weekly Calendar Modal (#43):**
   - Right card (`Squad Members`) with `Sort` selector (`Weekly Hours`, `Streak`, `Name`), `Copy Invite` button, 7-day squad weekly study tracker (`Mon`–`Sun` total squad hours), and member table (`Member`, `Status`, `Weekly Time`, `Streak`, `Action` with `Nudge` and `Calendar`).
   - Clicking a member's name or `Calendar` opens a separate `<dialog id="modal-friend-calendar">` showing that friend's 7-day weekly study breakdown (which days they studied and how many hours each day, plus subject breakdown).
7. **Squad Feed & Next Group Session:**
   - Bottom full-width card split into:
     - **Squad Feed (`Recent Activity & Shared Resources`)** with `Add Note` button (`<dialog id="modal-squad-note">`). Every feed item displays the **user's name in bold** (`<strong>`), note/resource details, timestamp, `(Open)` link, and `(Delete)` link.
     - **Next Group Session** box showing the upcoming session location/topic and date/time (editable via modal/inline), attendees list, and an `I'm In` toggle button.

## Non-Goals / Anti-Goals
- **Solo-User Isolation:** Zero squad UI, popups, or listeners on Dashboard, Courses, Session Logs, Exams & Assignments, or Settings.
- **No Exposure of Private Grades:** Only study durations, streaks, subjects, and shared squad notes are synced to `/squads/{squadId}`.

## Constraints
- Maintain UniSphere's native HTML/CSS aesthetic (`src/index.css`) matching the screenshot layout and typography.
- Update `firestore.rules` (via the `firestore-rules-author` specialist subagent) to authorize the enriched squad/member/presence/activity fields and deletion rules.
- All unit and security tests (`npm test`) and production build (`npm run build`) must pass with exit code 0.

## Approaches
1. **Synced Squad Subcollections + Squad Metadata (Picked):**
   Store `description` and `nextSession` on `squads/{squadId}`, sync each member's current-week daily breakdown (`dailyMinutes`) and `subjectMinutes` on `squads/{squadId}/members/{uid}`, store active live study sessions on `squads/{squadId}/presence/{uid}`, and store shared notes/activities on `squads/{squadId}/activities/{activityId}` (with local storage fallback for offline/test environments).
2. **On-Demand Reads from `users/{uid}` (Rejected):**
   Querying individual `users/{uid}` documents on demand exposes private user data (grades, personal notes) and adds latency when opening a friend's calendar.

## Decisions & Builder Scope
- **User Decision:** Use Approach 1 and a separate popup `<dialog>` modal for a friend's 7-day study calendar (#43).
- **Builder Calls:** Provide clean native `<dialog>` modals for Create/Join Squad, Admin Panel, Go Live, Add Note, Edit Next Session, and Friend Weekly Calendar, with full keyboard/close support and unit test coverage.
