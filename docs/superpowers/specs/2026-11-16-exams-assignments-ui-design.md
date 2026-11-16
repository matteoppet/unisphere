# Exams & Assignments UI Redesign — Design Doc

**Date:** 2026-11-16  
**Size:** Small change (focused updates to `pages/assignments.html`, `src/utils/grades.js`, `src/app.js`, `src/index.css`, and `src/utils/assignmentsView.test.js`)  
**Status:** Draft awaiting approval

---

## 1. Intent & Why

Students using the **Exams & Assignments** page need faster visual scanning of exam progress, a cleaner separation between upcoming and completed exams, a usable mobile table without horizontal scrolling, and direct access to course details without leaving the page.

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Individual `0/30` Grade Formatting & Colors:**
   - Single exams and assignments display `0/30` when ungraded and `<grade>/30` (e.g., `28/30`) when graded.
   - Esonero (`Midterm`) rows display `0/30 - 0/30` (e.g., `29.5/30 - 0/30` or `15/30 - 24/30`) with each part colored independently.
   - Color rules per grade slot: **green** (`#006600`, bold) when `>= 18`, **red** (`#b30000`, bold) when `< 18`, and **muted gray** when ungraded (`0/30` placeholder).
2. **Completed Exams Bold Separator:**
   - Render a bold horizontal separator line (`3px solid #333333`) between the last incomplete item and the first completed item whenever both incomplete and completed rows are present.
3. **Mobile 3-Column Table & Expandable Detail Drawer (`<= 720px`):**
   - Hide the `Type` and `Actions` columns on mobile viewports so only **Course**, **Date**, and **Grade** remain visible.
   - Clicking/tapping a row expands a detail row directly beneath it showing **Type**, **Actions** (`Mark as complete` / `Reopen`, `Edit`, `Delete`), and **More Grade Info** (for Midterm: Esonero 1, Esonero 2, combined average; for Exam/Assignment: grade & pass/fail status).
4. **Course Link Opening Centered Course Info Modal:**
   - Render the **Course** name in each row as a clickable link.
   - Clicking it opens a centered native `<dialog>` (`#modal-course-info`) displaying all course metadata (`Title`, `Status`, `CFU`, `Year / Semester`, `Professor Email`, `Office Hours`, `Notes / Syllabus`), with an **Edit Course** button that switches to `#modal-course` (or pre-fills a new course if the typed course name has no saved course record yet).
   - Clicking the course link opens the modal without toggling the mobile row drawer.

### Non-Goals & Anti-Goals
- **No GPA / Media calculation side effects:** Ungraded `0/30` placeholders must never count as numeric `0` in `getItemExamGrade()` or `calculateMediaGrades()`.
- **No Firestore schema changes:** Keep existing `assignments` and `courses` schemas and `sanitizeAssignmentItem` / `sanitizeCourseItem` contracts untouched.
- **No mobile-only duplicate card DOM or horizontal overflow:** Desktop stays a full-width 5-column table; mobile stays a semantic 3-column table.

## 3. Constraints

- Vanilla JavaScript + native HTML `<dialog>` / `<table>` + plain CSS in `src/index.css` matching UniSphere's existing native theme.
- Existing layout contracts in `src/app.js` (e.g., `assignments-table-scroll` sizing and daily urgency rollover) must remain intact.
- `npm test`, `npm run lint`, and `npm run build` must pass after implementation.

## 4. Approaches Considered

1. **Approach 1 — Structured Grades + Single-Table CSS Drawer + Read-Only Course Info Modal *(Selected)***
   - Extend `getAssignmentDisplayGrade()` in `src/utils/grades.js` to return structured per-part descriptors (`parts`, `averageText`, `averageStatus`, etc.) while keeping GPA calculation functions untouched.
   - Keep one semantic `<table>` in `pages/assignments.html`, hide `Type` and `Actions` via CSS `@media (max-width: 720px)`, track expanded row IDs in a `Set` so drawers survive re-renders/cloud sync, and render the bold divider right before the first completed row.
   - Add a dedicated centered read-only `#modal-course-info` `<dialog>` plus `#modal-course` inside `pages/assignments.html` so direct navigation to `/pages/assignments.html` works immediately.
   - *Trade-off:* Slightly more HTML dialog markup in `pages/assignments.html`, in exchange for clean logic separation, unit-testable grade descriptors, and zero accidental edits when inspecting course details.
2. **Approach 2 — Inline Grade Rendering + Direct Edit Modal Reuse**
   - Compute per-part `0/30` colors directly inside `populateAssignmentsPage()` in `src/app.js` and open `#modal-course` edit inputs directly on course click.
   - *Trade-off:* Mixes formatting logic into DOM string assembly (harder to unit-test) and forces editable form inputs instead of a clean info view.

**Decision:** **Approach 1** was chosen for clean testability in `grades.js`, native responsive table semantics, and a dedicated read-only Course Info modal.

## 5. Decided Architecture & Behavior

- **`src/utils/grades.js`:** `getAssignmentDisplayGrade(item)` returns structured `parts` (2 parts for `Midterm` or items with `examParts`, 1 part otherwise), where each part exposes `{ label, value, displayText, status }` (`status`: `'pass' | 'fail' | 'ungraded'`) plus `averageValue`, `averageText`, and `averageStatus`.
- **`src/app.js`:**
  - `populateAssignmentsPage()` renders each grade part from `gradeInfo.parts`, inserts the bold separator row/class between the last incomplete item and first completed item when both exist, renders `<tr class="assignment-detail-row">` beneath each main row (`hidden` unless expanded on mobile via `expandedAssignmentIds`), and renders `<a href="#" data-open-course-info="...">` for the Course name.
  - Course lookup matches `courses` case-insensitively by `title`, `shortTitle`, or `code` (matching `calculateMediaGrades()`), falling back to a "Course not saved in registry yet — Create Course" state in `#modal-course-info`.
- **`src/index.css` & `pages/assignments.html`:**
  - Keep desktop 5-column headers (`Course`, `Type`, `Date`, `Grade`, `Actions`); hide columns 2 and 5 at `@media (max-width: 720px)` and show mobile expand affordances (`▸` / `▾`) and drawer styling.
  - Style `.assignments-completed-divider` as a bold `3px solid #333333` boundary.

## 6. Left to the Builder

- Exact CSS spacing, responsive short-date formatting at `320px–720px` so the 3 mobile columns fit without horizontal overflow, keyboard accessibility (`tabindex="0"`, `Enter`/`Space`, `aria-expanded`) on mobile expandable rows, and updating/expanding tests in `src/utils/assignmentsView.test.js`.
