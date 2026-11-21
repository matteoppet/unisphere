# Dashboard Goals Widget Design

**Date:** 2026-11-21
**Size:** Small change

## Intent & Why
Students need a lightweight Goals tracker directly on the Dashboard (stacked below the Courses card in the left column) to track both course-linked learning milestones (e.g., `Analisi 1`) and personal goals (e.g., `Skill`, `Project`) without leaving the main workspace.

## Goals, Non-Goals, Anti-Goals
- **Goals:**
  - Display a `Goals` card below `Courses` in the Dashboard left column with a `+ Add Goal` button.
  - Render each goal with a checkbox, goal title (struck through and dimmed when completed), and a right-aligned pill badge showing its Course or personal tag (`Skill`, `Project`, etc.).
  - Support adding, editing, and deleting a goal through a native `<dialog id="modal-goal">` modal, while allowing single-click checkbox toggling directly on the card.
  - Persist goals across `localStorage`, Firestore (`users/{userId}.checklist`), and JSON workspace export/import.
- **Non-Goals:**
  - Creating a separate top-level navigation page for goals or modifying `firestore.rules`.
- **Anti-Goals:**
  - Breaking existing Firestore sync (`hasOnly(allowedKeys)` validation) or losing legacy string checklist items if present.

## Constraints
- Must use the existing `checklist` field on `/users/{userId}` (which `firestore.rules` validates as `string` or `list` up to 500 items).
- Must keep `index.html` and `pages/dashboard.html` in sync (as `app.js` caches and renders dashboard markup from both entrypoints) and include `#modal-goal` across page templates or dynamically ensure it is mounted.
- Must sanitize all user inputs with `sanitizeTextInput` and `escapeHtml`.

## Approaches Considered
1. **Approach A (Selected): Structured Goal objects in the existing `checklist` list field** — Stores `{ id, title, tag, completed, createdAt, completedAt }` objects in `checklist` (with legacy string fallback). Gives stable IDs for modal editing/deletion and works immediately with deployed Firestore security rules.
2. **Approach B: Delimiter-encoded lines inside a plain `checklist` string** — Fragile when titles contain delimiters and lacks stable IDs for modal editing.
3. **Approach C: Dedicated `goals` field on the Firestore user document** — Rejected by deployed `firestore.rules` (`hasOnly(allowedKeys)`) unless security rules are redeployed first.

## Decided Design (How It Works)
- **Layout:** Wrap the left column of `.grid-3` on the Dashboard (`index.html` and `pages/dashboard.html`) in a `<div class="stack">` containing the existing **Courses** card followed by the new **Goals** card.
- **Goals Card UI:**
  - Header with `<h3>Goals</h3>` and `<button type="button" id="btn-dash-add-goal">+ Add Goal</button>`.
  - List of goals sorted with active (uncompleted) goals first and completed goals below.
  - Each row has:
    - A checkbox (`input[type="checkbox"]`) that immediately toggles `completed` state and syncs to localStorage/Firestore.
    - The goal title and right-aligned pill badge (`<span class="goal-tag-badge">...</span>`); clicking the row text or badge opens `#modal-goal` to edit or delete the goal.
    - Completed goals render with a checked gray checkbox, muted gray text, and `text-decoration: line-through`.
- **Add / Edit Goal Modal (`#modal-goal`):**
  - **Goal Title** (`required`, max 150 chars, e.g., `Learn derivatives`).
  - **Course or Personal Tag** selector/input allowing selection from the user's Courses plus personal categories (`Skill`, `Project`, `Personal`) or custom tag text.
  - **Mark as completed** checkbox.
  - **Delete Goal** danger button (visible when editing an existing goal), **Cancel**, and **Save Goal** buttons.

## Left to the Builder
- Exact CSS class naming for `.goals-list`, `.goal-item`, `.goal-tag-badge`, and legacy string migration helper details in `src/utils/checklist.js` and `src/lib/authService.js`.
