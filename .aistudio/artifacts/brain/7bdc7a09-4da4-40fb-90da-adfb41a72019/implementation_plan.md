# Dopamine & Gamification Update + Modular Squads Hub

Elevate UniSphere with subtle, sensory gamification micro-interactions for solo productivity and introduce an isolated, modular "Squads" multiplayer hub in the Workspace Explorer sidebar for asynchronous study rivalry, live library presence, and weekly telemetry heatmaps.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were aligned during Phase 1 interactive clarification:
> - **Micro-Interactions Audio Feedback**: Enabled by default with an instant mute/unmute toggle in the top workstation header and settings, using synthesized Web Audio API tones (mechanical clicks and futuristic timer chimes) to preserve a quiet academic atmosphere.
> - **Squad Membership Architecture**: Multi-squad support with a sleek squad switcher dropdown, allowing students to belong to multiple study groups (e.g., Computer Science Cohort, Math Study Group) while keeping their active lobby focused.
> - **Ghost Racing Session Telemetry**: Populated with real historical study sessions logged by squad members from Firestore, paired with authentic fallback templates if a new squad has limited history.
> - **Solo-User Isolation**: Absolute zero-clutter guarantee. If a user never creates or joins a squad, their Dashboard, Courses, Study Tracker, and Assignments views remain strictly pristine without popups, banners, or forced multiplayer prompts.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Global Sensory Polish (Solo & Multiplayer)**: Installs lightweight confetti bursts and crisp Web Audio API micro-tones for checking off deliverables and finishing focus blocks. Computes and tracks academic telemetry (`xp`, `currentStreak`, `minutesStudiedThisWeek`, `tasksCompletedThisWeek`) and dynamically scales the ObsidianUI card border illumination and progress bar saturation based on daily study goal completion.
  2. **Isolated Squads Hub (`/squads` in Workspace Explorer)**:
     - **Zero State**: Sleek pair of ObsidianUI action cards to "Create a Squad" (generates an alphanumeric 6-character code) or "Join via Code".
     - **Active Squad Bento Grid**:
       - *Live Library Lobby*: Real-time "Lock In" status bar syncing active courses; pulsing presence cards showing what friends are studying with elapsed time counters; post-session XP Loot Drop modal and activity feed micro-updates.
       - *Weekly Sprint Podium & Merged Heatmap*: Monday-reset top-3 leaderboard ranked by ELO/Power rating (study minutes + on-time tasks); GitHub-style contribution grid glowing with each member's designated neon accent (Cyan, Purple, Emerald, Amber); Sunday "Weekly Wrapped" receipt card generator (MVP, Night Owl, Clutch Player).
       - *Ghost Racing*: Dual-progress bar async rivalry comparing live progress against a friend's past study session minute-by-minute.

- **Target Audience**: University students seeking motivating academic micro-rewards and optional peer accountability without social media clutter or distracting notifications.
- **Key Value**: Delivers visceral, rewarding feedback for deep work while preserving UniSphere's focused, minimalist workstation ergonomics.

---

### 2. User Experience & Visual Design

- **Visual Identity & Theme**:
  - *Aesthetic*: Matte Obsidian minimalist design system (`bg-zinc-950`, `border-zinc-800`, `text-zinc-100`) and Crisp Light Mode (`bg-gray-50`, `border-zinc-200`).
  - *Dynamic Power Borders*: Subtle CSS box-shadow and border-color transitions on daily goal cards:
    - 0% - 49%: Subtle matte border (`border-zinc-800` / `border-zinc-200`).
    - 50% - 99%: Elevated Indigo glow (`border-indigo-500/40`, `shadow-[0_0_15px_rgba(99,102,241,0.12)]`).
    - 100% (Daily Completion): Radiant Cyan/Emerald leveling (`border-emerald-500/60`, `shadow-[0_0_20px_rgba(16,185,129,0.2)]`).
  - *Typography*: High-density sans display typography with monospace tabular figures (`font-mono tabular-nums`) for timers, XP increments, and ELO calculations.
  - *Accent Accents for Squad Members*: Curated neon accents for heatmap attribution:
    - Member 1: Electric Cyan (`#06B6D4` / `rgba(6,182,212,0.85)`)
    - Member 2: Vivid Purple (`#A855F7` / `rgba(168,85,247,0.85)`)
    - Member 3: Emerald Glow (`#10B981` / `rgba(16,185,129,0.85)`)
    - Member 4: Amber Blaze (`#F59E0B` / `rgba(245,158,11,0.85)`)

- **Key User Flows**:
  1. *Solo Dopamine Flow*: Complete a deliverable or study timer -> Trigger crisp mechanical audio tick or chime -> Emit canvas confetti -> Increment user XP and study telemetry -> Elevate dynamic power borders.
  2. *Squad Joining Flow*: Click "Squads" in sidebar -> View Empty State cards -> Create Squad (generates unique 6-char code) or enter code -> Immediately load Bento dashboard and sync personal course list for Lock-In.
  3. *Live Lock-In Flow*: Select course from synced dropdown in Squads header -> Click "Lock In" -> Firestore creates real-time active session -> Live presence card pulses green for peers -> Timer counts elapsed minutes -> Click "End Session" -> XP Loot Drop modal pops up with sound + confetti -> Auto-broadcasts accomplishment to Squad Feed.
  4. *Ghost Race Flow*: Pick a recent session from the Ghost Racing feed -> Click "Race Ghost" -> Dual-bar HUD displays your live minutes vs. friend's checkpoint timeline -> Finish race to claim bonus XP.
  5. *Weekly Wrapped Flow*: Click "Weekly Wrapped" on the Podium module -> Generates an elegant printable/downloadable academic receipt receipt card detailing week's MVP, Night Owl, and Clutch Player.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Audio Feedback Implementation**
  - *Chosen Approach*: Web Audio API synthesized oscillators (`sine`, `triangle`, and filtered low-latency envelopes) in `src/utils/audio.ts` with no external audio file dependencies.
  - *Why*: Eliminates broken 404 audio assets, zero bundle size overhead, zero external network requests, instant sub-5ms latency.
  - *Alternatives Considered*: Storing `.mp3` files in `/public` (risk of missing assets and latency issues).

- **Decision 2: Particle & Confetti Delivery**
  - *Chosen Approach*: Lightweight `canvas-confetti` (with fallback particle physics generator if canvas is throttled).
  - *Why*: Industry standard, high performance 60fps canvas rendering, automatically cleans up memory upon completion.

- **Decision 3: Firestore Data Schema & Query Optimization**
  - *Chosen Approach*: Separate top-level `/squads/{squadId}` documents with subcollections `/squads/{squadId}/members/{userId}`, `/squads/{squadId}/presence/{userId}`, `/squads/{squadId}/activities/{activityId}`, and `/squads/{squadId}/sessions/{sessionId}`.
  - *Why*: Strict scalability adherence from Firebase Security rules: never use unbounded arrays on single documents. Listeners are mounted *only* when the Squads view is open or when actively locked-in, avoiding excessive reads.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          UNISPHERE WORKSPACE                           │
├───────────────────────────────┬────────────────────────────────────────┤
│     WORKSPACE EXPLORER        │            ACTIVE VIEWPORT             │
│                               │                                        │
│  [LayoutDashboard] Dashboard  │  [QuickToolbar] Audio Toggle / XP Bar  │
│  [BookOpen]        Courses    │  ────────────────────────────────────  │
│  [Clock]           Study Log  │  Current View:                         │
│  [CheckCircle2]    Tasks      │    ├─ Solo Views (Dashboard/Courses)   │
│  [Users / Swords]  Squads ◄───┼────┤  └─ Dopamine: Confetti + Audio    │
│  [Settings]        Settings   │    │     └─ Dynamic Power Borders      │
│                               │    └─ Squads View (Isolated Hub)       │
└───────────────────────────────┴────────────────────────────────────────┘
                                            │
                       ┌────────────────────┴────────────────────┐
                       ▼                                         ▼
            [Solo State Engine]                      [Squads Bento Hub]
     ┌───────────────────────────────┐       ┌───────────────────────────────┐
     │ • Profile XP & Streaks        │       │ 1. Live Library Lobby (LockIn)│
     │ • Dynamic Border Level (0-100)│       │ 2. Weekly Sprint Podium (ELO) │
     │ • Synced Courses & Logs       │       │ 3. Merged Squad Heatmap       │
     │ • Web Audio Synth & Confetti  │       │ 4. Sunday Wrapped Receipt     │
     └───────────────────────────────┘       │ 5. Ghost Racing (Dual HUD)    │
                                             │ 6. Squad Feed & Loot Drops    │
                                             └───────────────────────────────┘
                                                             │
                                                             ▼
                                                [Firestore Persistence]
                                              /users/{uid} (profile & XP)
                                              /squads/{squadId}
                                                ├─ /members/{uid}
                                                ├─ /presence/{uid} (Lock In)
                                                ├─ /activities/{id}
                                                └─ /sessions/{id} (Ghosts)
```

- **Data Models**:
  - `UserGamification`: `{ xp: number, currentStreak: number, minutesStudiedThisWeek: number, tasksCompletedThisWeek: number, lastActiveDate: string }`
  - `Squad`: `{ id: string, name: string, code: string, createdAt: string, createdBy: string, memberCount: number }`
  - `SquadMember`: `{ uid: string, displayName: string, avatarUrl?: string, color: string, elo: number, minutesThisWeek: number, tasksThisWeek: number, joinedAt: string }`
  - `SquadPresence`: `{ uid: string, displayName: string, courseId: string, courseName: string, startedAt: number, status: 'locked-in' | 'idle' }`
  - `SquadActivity`: `{ id: string, uid: string, displayName: string, type: 'session_complete' | 'task_complete' | 'loot_drop', title: string, xpEarned: number, timestamp: number }`
  - `GhostSession`: `{ id: string, uid: string, memberName: string, courseName: string, durationMinutes: number, milestones: { minute: number, taskLabel?: string }[], timestamp: number }`

- **Interactive State & Event Mapping**:
  - `onCompleteTask`: calls `triggerTaskAudio()`, fires particle burst, updates Firestore `xp += 25` and `tasksCompletedThisWeek += 1`.
  - `onLockInStart`: opens Firestore presence document `/squads/{squadId}/presence/{uid}` with `startedAt: Date.now()`.
  - `onLockInFinish`: updates Firestore presence to idle, triggers futuristic chime, opens Loot Drop modal awarding `+50 to +150 XP`, creates `GhostSession` for friends to challenge, and adds activity event.
  - `onRaceGhost`: mounts real-time dual-slider timer syncing user elapsed time vs. friend's checkpoint progress.
  - `onDownloadReceipt`: renders formatted SVG/canvas receipt with week's MVP and badges.
