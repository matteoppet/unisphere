# Friends System & Squads Dual-View Layout (#44) Design

## Intent & Why
Allow students to build a personal list of friends independently of Squad membership (like Discord) on `/pages/squads.html`. Based on the user's sketch, the Squads page splits into a left-hand **Friends Sidebar** (with search, friend-request send/accept workflow, and friends list) and a right-hand **Main Content Area** that displays the **Current Squad View** by default and switches to **Friend Infos and Stats** when a friend is selected.

## Goals
1. **Two-Column Layout on `/pages/squads.html` (#44 Sketch):**
   - **Left Sidebar (`Friends` panel):**
     - **Search & Add Friend Bar (`#friend-search-input`):** Filters existing friends in real time as the user types, and allows sending a friend request when an email address is entered (via an `Add` button or pressing Enter) or via an `+ Add Friend` modal/action.
     - **Pending Friend Requests Section:** Shows incoming friend requests with `Accept` and `Decline` buttons, plus outgoing pending requests with a `Cancel` link.
     - **Friends List (`Friend 1`, `Friend 2`, ...):** Displays accepted friends with their name, online/live status dot, and weekly study time badge. Clicking a friend selects them and switches the right-hand pane to their **Friend Infos and Stats** view. Includes a top/inline option (or clicking the selected friend / `← Back to Squad View`) to return to the **Current Squad View**.
   - **Right Main Content Area:**
     - **Default Mode (`Current Squad View`):** Renders the existing Squads view (`#squads-empty-state` if not in a squad, or `#squads-active-widgets` if in a squad).
     - **Selected Friend Mode (`Friend Infos and Stats`):** Replaces the right-hand view with the selected friend's profile and study telemetry:
       - Header with friend's display name, email, institution & degree info, online/live status, `← Back to Squad View` button, and `Remove Friend` button.
       - Summary telemetry bar: `Weekly Study Time`, `Weekly Goal Progress`, `Current Streak`, and `Tasks Completed This Week`.
       - **7-Day Study Calendar (`Mon`–`Sun`):** Day-by-day study duration breakdown for the current week.
       - **Subjects Studied This Week & Active Courses:** Table of subjects studied this week with durations, plus enrolled courses list (without exposing private grades or personal notes).
2. **Friend-Request (Send / Accept / Decline / Remove) Workflow:**
   - Canonical document in top-level `friendships/{friendshipId}` where `friendshipId = [uidA, uidB].sort().join('__')`.
   - Fields: `id`, `users` (`[uidA, uidB]`), `requesterUid`, `requesterEmail`, `requesterName`, `recipientUid`, `recipientEmail`, `recipientName`, `status` (`'pending' | 'accepted'`), `createdAt`, `updatedAt`.
   - Also allow sending a friend request directly from the Squad Members table (`+ Friend` action next to `Nudge · Calendar` when a squadmate is not yet a friend).

## Non-Goals / Anti-Goals
- **Solo-User Isolation:** All Friends and Squads features remain strictly inside `/pages/squads.html`; zero popups or social clutter on Dashboard, Courses, Session Logs, Exams & Assignments, or Settings.
- **Privacy Preservation:** Never expose a friend's private exam grades, personal quick notes, or checklist items in the Friend Infos & Stats view—only academic profile metadata, study durations, streaks, and course/subject titles.

## Constraints
- Maintain UniSphere's existing HTML/CSS styling in `src/index.css` and `pages/squads.html` (and `index.html`).
- Update `firestore.rules` via the `firestore-rules-author` specialist subagent to validate `/friendships/{friendshipId}` reads, creates, updates, and deletes.
- Ensure all `onSnapshot` listeners (`friendships` and selected friend telemetry) are cleaned up when leaving the Squads route or logging out.

## Approaches
1. **Top-Level `friendships` Collection + Live `users/{friendId}` Telemetry (Picked):**
   Store requests and friendships in `friendships/{uidA__uidB}` queried via `where('users', 'array-contains', myUid)`, and read/subscribe to `users/{friendUid}` when viewing a friend's stats (with local fallback storage for offline/test environments).
2. **Mirrored `users/{userId}/friends/{otherUid}` Subcollections (Rejected):**
   Requires relaxing `users/{otherUid}` write security rules for non-owners and risks partial dual-write states.

## Decisions & Builder Scope
- **User Decision:** Use a mutual friend-request (send/accept) workflow backed by **Approach 1**.
- **Builder Calls:** Dual-purpose search/add input in the Friends sidebar (filters friends locally and sends a friend request when given an email), quick `+ Friend` action on squad members, and clean cleanup of Firestore listeners.
