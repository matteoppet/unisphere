# Friends Page Layout Restructure & Modernization

Realize the user's sketch layout for the Friends (Squads) page, creating a cohesive, high-density study community hub. The page features a prominent top-level Live Study Lobby and a balanced two-column workstation uniting the Weekly Sprint Leaderboard and Contribution Heatmap alongside the Live Squad Feed and Ghost Racing Hub.

---

### User Clarifications & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user:
> - **Main Grid Distribution**: Two-column layout with Lobby and Feed arranged side-by-side in balanced proportions (Desktop 7:5 ratio, responsive stack on mobile).
> - **Hero Module Priority**: Prominently feature the Live Study Lobby, "Lock In" focus controller, and active member cards at the top.
> - **Contribution Heatmap Placement**: Integrated directly alongside the Weekly Sprint Leaderboard and podium in the primary column.

- **Confirmed Decision 1**: Keep the top squad switcher and header clean and accessible, featuring quick squad switching, invite code copying, and admin/membership controls.
- **Confirmed Decision 2**: Present live library presences with clear active states (pulsing indicator, active course name, elapsed study timer) so friends can see who is studying in real time.
- **Confirmed Decision 3**: Retain the complete GitHub-style study contribution heatmap with multi-member color intensity and interactive day tooltips in the primary column directly below the weekly podium.
- **Confirmed Decision 4**: Unify the Ghost Racing challenger hub and the real-time social activity feed in the secondary column.

---

### 1. Overview & Architectural Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  [👥 Squad Name ▼]  [Code: #XK89J 📋]                       [+ Invite] [⚙️ Manage Squad]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│  🔴 LIVE STUDY LOBBY & FOCUS BAR                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ [Radio] 3 Studying Now  |  Course: [Math II ▼]  [▶ Lock In] / [⏹ Finish Session] │  │
│  │ ──────────────────────────────────────────────────────────────────────────────── │  │
│  │ ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐ │  │
│  │ │ 🟢 Alex M. · 42m     │  │ 🟢 Sarah K. · 1h 15m │  │ 🟢 Matteo · 25m          │ │  │
│  │ │ Studying Physics I   │  │ Studying Algorithms  │  │ Studying Thermodynamics  │ │  │
│  │ └──────────────────────┘  └──────────────────────┘  └──────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  TWO-COLUMN MAIN SECTION (lg:grid-cols-12)                                             │
│  ┌──────────────────────────────────────────────┐ ┌──────────────────────────────────┐ │
│  │ PRIMARY COLUMN (7 cols)                      │ │ SECONDARY COLUMN (5 cols)        │ │
│  │                                              │ │                                  │ │
│  │ 🏆 WEEKLY SPRINT PODIUM & LEADERBOARD        │ │ ⚡ LIVE SQUAD FEED               │ │
│  │ ┌──────────────────────────────────────────┐ │ │ ┌──────────────────────────────┐ │ │
│  │ │        [1st 👑 Matteo · 14.5h]           │ │ │ │ • Sarah completed 90m session │ │ │
│  │ │ [2nd Alex · 11h]     [3rd Sarah · 9.5h]  │ │ │ │   +90 XP · 12m ago     [👏 3] │ │ │
│  │ │ ──────────────────────────────────────── │ │ │ │ • Alex unlocked Streak (5d)   │ │ │
│  │ │ #4 David L.    7.2h   Level 4   🔥 4-day │ │ │ │   +50 XP · 1h ago      [🔥 2] │ │ │
│  │ │ #5 Elena R.    5.8h   Level 3   🔥 2-day │ │ │ │ • Matteo completed Physics HW│ │ │
│  │ └──────────────────────────────────────────┘ │ │ └──────────────────────────────┘ │ │
│  │                                              │ │                                  │ │
│  │ 📅 STUDY CONTRIBUTION HEATMAP                │ │ 👻 GHOST RACING CHALLENGE HUB    │ │
│  │ ┌──────────────────────────────────────────┐ │ │ ┌──────────────────────────────┐ │ │
│  │ │ 20 Weeks x 7 Days Grid (Mon–Sun)         │ │ │ │ Race Sarah's 60m focus run    │ │ │
│  │ │ Intensity Swatches · Hover Tooltips      │ │ │ │ [Start Ghost Race]            │ │ │
│  │ └──────────────────────────────────────────┘ │ │ └──────────────────────────────┘ │ │
│  └──────────────────────────────────────────────┘ └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2. User Experience & Visual Design

- **Visual Standards (Anti-Slop Compliance)**:
  - Clean obsidian borders (`border-zinc-200 dark:border-zinc-800`), flat cards without heavy artificial shadows.
  - No decorative pills for static metadata; clean typography with `·` separators and tabular figures (`font-mono tabular-nums`).
  - Active presence indicated with micro-animations (pulsing green indicator dot) and high-contrast text.
  - Clean segmented buttons for feed filters and ghost racing triggers.

- **Responsive Viewport Rhythm**:
  - **Desktop ($\ge 1024\text{px}$)**: Full side-by-side two-column grid (`grid-cols-12`, 7 cols left, 5 cols right) maximizing screen real estate without nested scroll traps.
  - **Tablet & Mobile ($< 1024\text{px}$)**: Natural vertical cascade—Top Lobby $\rightarrow$ Podium/Leaderboard $\rightarrow$ Live Feed $\rightarrow$ Contribution Heatmap $\rightarrow$ Ghost Racing.

---

### 3. Implementation Steps & File Modifications

#### File: `src/components/SquadsView.tsx`

1. **Top Squad Header Alignment**:
   - Refine the squad selector dropdown and header actions (`Manage Squad`, `Leave Squad`, invite code copy pill).
   - Ensure seamless squad switching and one-click code sharing.

2. **Hero Module: Live Study Lobby & Real-Time Presence**:
   - Elevate the Lobby to the hero slot immediately beneath the top header.
   - Refactor the "Lock In" controller into a sleek, unified command bar: Course selector dropdown, Start/Stop toggle button, elapsed timer display, and earned XP preview.
   - Display active member cards in a responsive grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`), showing avatar initial, name, course name, and active session duration.

3. **Primary Column (Left - 7 cols)**:
   - **Weekly Sprint Podium**: Top 3 visual podium (2nd, 1st Crown, 3rd) with member avatars, hours logged, and rank cards.
   - **Squad Leaderboard Table**: Clean high-density list for remaining squad members with rank, avatar, level indicator, study hours, and daily streak flame.
   - **Study Contribution Heatmap**: High-fidelity GitHub-style 20-week x 7-day contribution grid with weekday labels (Mon, Wed, Fri), month markers, legend intensity scale, and interactive day hover inspection.

4. **Secondary Column (Right - 5 cols)**:
   - **Live Squad Social Feed**: Real-time event log of friend achievements (study sessions logged, level ups, streak milestones, loot drops) with celebratory reaction buttons (👏, 🔥, ⚡).
   - **Ghost Racing Hub**: Asynchronous race cards against friends' past sessions, showing target duration, course, and instant "Start Race" CTA, plus the active Ghost Racing HUD overlay when in progress.

5. **Modals & Persistence**:
   - Maintain all existing Firestore syncing hooks (`fetchUserSquads`, `syncSquadToUserDoc`, real-time presences listener, activity logger).
   - Ensure Create Squad, Join Squad, Manage Squad, and Confirmation modals open and function properly without DOM leaks.

---

### 4. Verification & Testing Plan

1. **Visual Layout Verification**:
   - Verify that the Live Study Lobby is at the top of the Friends view.
   - Verify that the two-column grid (7:5) renders properly on desktop and cascades cleanly on mobile.
   - Verify that the Heatmap and Leaderboard share the primary column, and the Activity Feed and Ghost Racing occupy the secondary column.
2. **Interactive Functionality**:
   - Test "Lock In" button: verify timer begins, presence broadcasts to Firestore/local state, and "Finish & Claim XP" awards points and triggers celebration.
   - Test squad switcher: switch between squads, create new squad, and join squad via code.
   - Test Ghost Race start and cancellation.
   - Test feed reaction clicks.
3. **Compilation & Linting**:
   - Run `compile_applet` and `lint_applet` to ensure zero TypeScript errors and clean compilation.
