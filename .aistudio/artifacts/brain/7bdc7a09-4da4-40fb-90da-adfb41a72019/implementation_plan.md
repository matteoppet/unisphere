# Dashboard Layout Realignment & Workstation Restructure

Restructure the UniSphere dashboard layout, top bar, and Explorer sidebar to match the user's architectural sketch, reorganizing existing components into an intuitive two-column dashboard with tabbed courses/logs and an integrated quick note-taking workstation.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during interactive clarification:
> - **Explorer Sidebar Labels**: Renamed `Squads` to `Friends` and retained `Assignments & Exams` label for clear academic clarity.
> - **Left Tabbed Panel Interaction**: The card header provides `[Active Courses]` and `[Sessions Logs]` tabs, dynamically switching the table view between active enrolled courses and study session logs, with a contextual `[Go to Page]` button that deep-links directly to either the Curriculum view or the Study Tracker view.
> - **Quick Note-taking (+) Button**: The embedded bottom-right `(+)` button in the note panel triggers the Quick Action speed-dial menu (enabling instant creation of a new task/exam, logging a study session, or adding a new course) while preserving quick checklist and scratchpad note editing.

- **Confirmed Decision 1**: Header layout updated to feature `[Light/Dark]` on the top-left, centered global search bar, and `[Log-Out]` on the top-right.
- **Confirmed Decision 2**: Main dashboard degree header displays Degree title, clickable `Matricola` badge, university subtitle, and 3 rounded stat chips (`Total CFU`, `Completed courses`, `Weekly Focus`).
- **Confirmed Decision 3**: The right column hosts `Quick Note taking` as a full-height column panel with scratchpad/checklist modes and the `(+)` quick action trigger button.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Top Bar Header**: Reorganizes the primary toolbar into three distinct zones: a dedicated `[Light/Dark]` theme toggle on the left (with mobile hamburger), a prominent centered global search bar with keyboard shortcut (`Ctrl+K`), and a prominent `[Log-Out]` button on the right along with subtle audio sensory controls.
  2. **Explorer Navigation**: Aligns the sidebar navigation under the `Explorer` header with `Dashboard` (accented with an active status indicator), `Courses`, `Assignments & Exams`, `Friends`, and a partitioned `Settings` view.
  3. **Incoming Deliverable Banner**: Positioned prominently at the top of the dashboard content area when upcoming exams or assignments are due, with color-coded urgency and dismiss affordance.
  4. **Degree & Academic Metrics Card**: Showcases the student's degree program (e.g. Mechanical Engineering), student ID/Matricola badge with 1-click clipboard copy, and university credentials alongside 3 metric chips:
     - `Total CFU` (earned / target CFU with completion bar)
     - `Completed courses` (passed courses count & active term count)
     - `Weekly Focus` (weekly hours logged / target goal with dynamic power glow)
  5. **Two-Column Workstation Grid**:
     - *Left Panel (Tabbed Active Courses & Session Logs)*: Segmented control switching seamlessly between Active Courses (with deliverable dates and professor contact actions) and Sessions Logs (with historical study times, tags, and notes), plus a `[Go to Page]` shortcut button linking to the full view.
     - *Right Panel (Quick Note taking)*: Full-height note taking station with ephemeral daily scratchpad, actionable task checklist, auto-reset preferences, and an integrated bottom-right `(+)` action button for swift entry creation.

- **Target Audience**: University students managing degree progression, semester courses, exam deadlines, and daily study sessions.
- **Key Value**: Delivers the exact spatial rhythm and workflow sketched by the user without losing existing functionality or component state.

---

### 2. User Experience & Visual Design

- **Visual Identity & Theme**:
  - *Color System*: Obsidian dark theme (`bg-zinc-950`, card `bg-zinc-900`, border `border-zinc-800`) paired with crisp light theme (`bg-gray-50`, card `bg-white`, border `border-gray-200`).
  - *Metric Chips*: Three rounded pill/box containers (`rounded-xl p-3 border`) displaying clean tabular numbers and subtle status bars.
  - *Typography*: High-contrast sans headings (`font-bold tracking-tight`) paired with tabular numerals (`font-mono tabular-nums`) for credits, matricola, hours, and countdown timers.

- **Key User Flows**:
  1. *Navigating & Searching*: User switches themes with one click at top-left, searches across all courses/tasks/logs via the central search bar, and navigates via the left Explorer sidebar.
  2. *Switching Dashboard Tabs*: User clicks `[Active Courses]` or `[Sessions Logs]` in the left panel to toggle the data view; clicking `[Go to Page]` jumps to the full Curriculum or Study Sessions view.
  3. *Quick Actions & Notes*: User jots down class notes in the right panel, checks off checklist items, or clicks the bottom-right `(+)` button to launch a quick task modal or study logger modal.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Tabbed Left Panel vs. Stacked Widgets**
  - *Chosen Approach*: Implement a unified card with a clean segmented tab control `[Active Courses]` | `[Sessions Logs]` and a `[Go to Page]` button that adapts dynamically based on the active tab.
  - *Why*: Directly satisfies the sketch layout, prevents vertical scroll fatigue, and gives both active coursework and study logs first-class presence.
  - *Alternatives Considered*: Stacking both tables vertically (would cause vertical bloat and push the layout out of alignment with the sketch).

- **Decision 2: Quick Note Taking Panel Integration**
  - *Chosen Approach*: Embed the floating action button `(+)` directly in the lower right of the Quick Note taking panel, providing a speed-dial popup with "New Task / Exam", "Log Study Session", and "Add Course".
  - *Why*: Matches the circular `(+)` button illustrated at the bottom-right of the notes area in the sketch while retaining the quick-entry modals.

- **Decision 3: Top Bar Zoning**
  - *Chosen Approach*: Place `[Light/Dark]` at top-left, the global search bar in the center, and `[Log-Out]` on the top-right. Keep the telemetry level indicator and audio mute toggle compact on the right next to Log-Out.
  - *Why*: Exact match with the sketch top bar (`[Light/Dark]`, `[Search Bar]`, `[Log-Out]`) while preserving accessibility and telemetry features.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Light/Dark]                    [      Search Bar      ]                     [Log-Out] │
├───────────────────┬────────────────────────────────────────────────────────────────────┤
│     Explorer      │  [ Incoming Exam/Assignment banner (If it exists)               X ]│
│ ───────────────── │ ┌────────────────────────────────────────────────────────────────┐ │
│ (•) Dashboard     │ │ Mechanical Engineering  [Matricola: 665924]  ┌────┐ ┌────┐ ┌───┐ │ │
│ [ ] Courses       │ │ Università Roma Tre - Laurea Triennale       │CFU │ │Pass│ │Foc│ │ │
│ [ ] Assign./Exams │ └────────────────────────────────────────────────────────────────┘ │
│ [ ] Friends       │ ┌───────────────────────────────────────┐ ┌──────────────────────┐ │
│                   │ │ [Active Courses] [Sessions Logs] [Go] │ │  Quick Note taking   │ │
│ ───────────────── │ │ ───────────────────────────────────── │ │ ──────────────────── │ │
│ [ ] Settings      │ │ • Course Title  CFU  Status  Incoming │ │ [Scratchpad] [Check] │ │
│                   │ │   (or recent study session logs)      │ │ Text area / checklist│ │
│                   │ │                                       │ │                  (+) │ │
│                   │ └───────────────────────────────────────┘ └──────────────────────┘ │
└───────────────────┴────────────────────────────────────────────────────────────────────┘
```

- **Interactive State & Event Mapping**:
  - `activeDashboardTab`: `'courses' | 'logs'` state within `DashboardView.tsx`.
  - `onNavigateToPage`: invokes `onNavigateToCurriculum()` if active tab is `'courses'`, or navigates to `'study-session-tracker'` if `'logs'`.
  - `onToggleTheme`: triggers `handleToggleTheme` from the top-left button.
  - `onSignOut`: fires Firebase/local logout from the top-right button.
  - `quickActions`: `(+)` trigger opens the quick action speed-dial menu for fast task, log, and course creation.

---
