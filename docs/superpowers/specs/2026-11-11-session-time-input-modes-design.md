# Session Time Input Modes Design

## Intent & Why
Allow students logging study sessions to input session duration flexibly:
1. Pure **minutes** (e.g., 90)
2. **Hours and minutes** (e.g., 1h 30m)
3. **Time range** (start time to end time, e.g., 14:00 to 15:30) with automatic duration calculation.

This removes the friction of students having to manually calculate minutes when they study in time blocks or hours.

## Goals
- Add a 3-button segmented mode switcher inside `#modal-log` across `index.html`, `pages/dashboard.html`, and `pages/logs.html`.
- Support 3 distinct input modes:
  - **Minutes:** numeric input (min 5, max 720, step 5).
  - **Hours & Min:** side-by-side numeric inputs for hours (0–12) and minutes (0–59).
  - **Time Range:** side-by-side time inputs (`type="time"`) for start and end time with automatic calculation (including crossing midnight support).
- Provide a live calculated duration preview badge (`Calculated: 1h 30m (90 min)`).
- Synchronize values bidirectionally when switching modes so the user never loses their current duration.
- Preserve canonical `durationMinutes` in the form payload and data model (compatible with all downstream telemetry, XP, streaks, and Firestore schemas).

## Non-Goals / Anti-Goals
- No backend schema alterations (session logs continue storing `durationMinutes` as an integer).
- No complex date-time range pickers across multiple days (session logging is single-day or overnight within 12 hours).

## Constraints
- Visual consistency with existing UniSphere native modal aesthetic and Obsidian design tokens (`src/index.css`).
- Zero breakage of existing tests and clean production build (`npm test` and `npm run build` exit code 0).

## Approaches
1. **Segmented Mode Switcher with Live Canonical Sync (Picked):**
   A 3-button tab row inside the duration section of `#modal-log` toggles visibility between three input containers: Minutes, Hours & Min, and Time Range. Pure utility functions `calculateDurationFromHoursMinutes` and `calculateDurationFromRange` in `src/utils/telemetry.js` compute total minutes. Any input change updates the canonical `#log-minutes` value and a live preview badge (`Calculated: 1h 30m (90 min)`). Switching tabs converts the current canonical duration into the active mode's inputs.
2. **Freeform Text Parser (Alternative):**
   A single text input that parses strings like "1h 30m", "90m", "14:00-15:30". Rejected because freeform text input is error-prone, less accessible on mobile, and harder for users to discover syntax rules.
