# Session Time Input Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students logging study sessions to switch between three input modes ("Minutes", "Hours & Min", and "Time Range") in `#modal-log` with automatic duration calculation and live preview while preserving the canonical `durationMinutes`.

**Architecture:** Pure helper functions `calculateDurationFromHoursMinutes(hours, minutes)` and `calculateDurationFromRange(startTime, endTime)` in `src/utils/telemetry.js` compute total duration in minutes. Modal markup across `index.html`, `pages/dashboard.html`, and `pages/logs.html` introduces a 3-tab segmented mode toggle with corresponding input groups and a live duration preview badge. `src/app.js` manages tab state, live calculation, and bidirectional synchronization into `#log-minutes`.

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5 dialog and time inputs, CSS3, Node.js native test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-11-session-time-input-modes-design.md`

## Global Constraints

- Must work in `#modal-log` across all 3 pages (`index.html`, `pages/dashboard.html`, `pages/logs.html`).
- Canonical study log schema must remain `durationMinutes: number` (between 5 and 720 minutes).
- Styling must conform to UniSphere aesthetic in `src/index.css`.
- `npm test` and `npm run build` must exit with code 0.

## Review Focus

- **Empty / partial time range:** When only start or end time is filled, duration must not be NaN or negative; keep or show valid duration.
- **Crossing midnight in time range:** Start time `23:00` and end time `01:00` must compute 120 minutes (not negative).
- **Zero or negative duration in hours/min:** Hours = 0, Min = 0 must enforce minimum session limit (minimum 5 minutes upon submission).
- **Mode switching preserves duration:** Entering 90 minutes in "Minutes" mode and switching to "Hours & Min" must display 1 hour and 30 minutes; switching to "Time Range" from 14:00 must display end time 15:30.
- **Form submission:** Submitting the form in any mode sends the accurately computed `durationMinutes` to `sanitizeStudyLogItem`.

---

### Task 1: Time Calculation Utilities & Unit Tests

**Files:**
- Modify: `src/utils/telemetry.js`
- Test: `src/utils/focusTime.test.js`

**Interfaces:**
- `calculateDurationFromHoursMinutes(hours, minutes)`: returns integer minutes clamped to `[0, 720]`.
- `calculateDurationFromRange(startTimeStr, endTimeStr)`: parses `HH:MM` strings, calculates difference (including overnight crossing midnight), returns integer minutes clamped to `[0, 720]`.

- [ ] **Step 1: Write unit tests in `src/utils/focusTime.test.js`**

Add test suite for `calculateDurationFromHoursMinutes` and `calculateDurationFromRange`:
- Standard hours and minutes (e.g. 1h 30m -> 90, 0h 45m -> 45, 2h 0m -> 120).
- Extreme / negative / invalid inputs handled safely.
- Time range within same day (e.g. `09:00` to `10:30` -> 90, `14:15` to `16:45` -> 150).
- Time range crossing midnight (e.g. `23:00` to `00:30` -> 90, `22:30` to `01:15` -> 165).
- Invalid, empty, or identical range strings return 0.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL due to missing export functions.

- [ ] **Step 3: Implement functions in `src/utils/telemetry.js`**

Implement and export `calculateDurationFromHoursMinutes` and `calculateDurationFromRange`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit changes**

Git commit: `feat(telemetry): add duration calculation utilities for hours/minutes and time ranges`

---

### Task 2: Modal Markup & CSS for Input Mode Switcher

**Files:**
- Modify: `src/index.css`
- Modify: `index.html`
- Modify: `pages/dashboard.html`
- Modify: `pages/logs.html`

- [ ] **Step 1: Add CSS styles in `src/index.css`**

Add styles for:
- `.log-time-mode-toggle`: segmented button group for switching modes (`role="tablist"`).
- `.log-time-tab`: tab button with clean hover and `.active` state (`#3B77BC` accent).
- `.log-time-panel`: panel container, hiding inactive panels (`display: none` or `.hidden`).
- `.log-duration-preview`: helper badge displaying live calculated duration.
- Include `input[type="time"]` in form control styling in `src/index.css`.

- [ ] **Step 2: Update `#modal-log` in `index.html`, `pages/dashboard.html`, and `pages/logs.html`**

In each file's `#modal-log`:
- Replace the simple duration row with:
  - Mode toggle: 3 buttons (`data-time-mode="minutes"`, `data-time-mode="hours-minutes"`, `data-time-mode="range"`).
  - Mode 1 panel (`#log-mode-minutes`): standard `<input type="number" id="log-minutes" min="5" max="720" step="5" value="90" required />`.
  - Mode 2 panel (`#log-mode-hours-minutes`): `<input type="number" id="log-hours" min="0" max="12" value="1" />` and `<input type="number" id="log-subminutes" min="0" max="59" step="5" value="30" />`.
  - Mode 3 panel (`#log-mode-range`): `<input type="time" id="log-start-time" />` and `<input type="time" id="log-end-time" />`.
  - Duration preview: `<div id="log-duration-preview" class="log-duration-preview">Calculated: 1h 30m (90 min)</div>`.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit changes**

Git commit: `feat(ui): add 3-mode duration selector markup and styles to session modal`

---

### Task 3: Interactive Mode Switching, Live Sync & Form Handling

**Files:**
- Modify: `src/app.js`
- Test: `src/utils/focusTime.test.js`

- [ ] **Step 1: Write integration tests in `src/utils/focusTime.test.js`**

Add tests verifying:
- Modal markup integrity across `index.html`, `pages/dashboard.html`, and `pages/logs.html` (all contain the 3 mode buttons, mode panels, and time inputs).
- Canonical `#log-minutes` updates correctly on changes from all 3 modes.

- [ ] **Step 2: Wire mode switching and live synchronization in `src/app.js`**

In `src/app.js`:
- In `openLogModal()`:
  - Reset to default mode (`minutes` or last active).
  - Set default time range based on current time (e.g., current time minus 90 min to current time, or defaults).
  - Update `#log-duration-preview`.
- Add event listeners:
  - Click on `.log-time-tab` switches the active panel and synchronizes values from current duration.
  - Input listeners on `#log-minutes`, `#log-hours`, `#log-subminutes`, `#log-start-time`, `#log-end-time` calculate duration, clamp within 5–720 min, update canonical value, and update `#log-duration-preview`.
- Form submission in `form-log` reads the validated canonical duration in minutes.

- [ ] **Step 3: Run all tests and build**

Run: `npm test && npm run build`
Expected: All tests pass, build completes with exit code 0.

- [ ] **Step 4: Commit changes**

Git commit: `feat(logs): implement interactive 3-mode time logging in session dialog (#41)`
