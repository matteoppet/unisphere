# Exams & Assignments UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Exams & Assignments table to display colored `0/30` / `0/30 - 0/30` grades, add a bold divider before completed items, collapse mobile view to 3 columns (`Course`, `Date`, `Grade`) with expandable detail rows, and link course names to a centered Course Info modal.

**Architecture:** Keep grade formatting, part-level status (`pass`/`fail`/`ungraded`), short date formatting, divider placement, and course lookup as pure functions in `src/utils/grades.js` while leaving GPA calculation (`getItemExamGrade`, `calculateMediaGrades`) untouched. Add `#modal-course-info` and `#modal-course` to `pages/assignments.html`, and wire table rendering, `expandedAssignmentIds` state, course modal opening, and `@media (max-width: 720px)` responsive drawer styling in `src/app.js` and `src/index.css`.

**Tech Stack:** Vanilla ES Modules (`src/utils/grades.js`, `src/app.js`), native HTML `<dialog>` & `<table>`, plain CSS (`src/index.css`), Node built-in test runner (`node --test`), TypeScript `tsc --noEmit`, Vite build.

**Spec:** [docs/superpowers/specs/2026-11-16-exams-assignments-ui-design.md](../specs/2026-11-16-exams-assignments-ui-design.md)

## Global Constraints

- Single exams and assignments show `0/30` when ungraded and `<grade>/30` when graded; Midterm (`Esonero`) items show `0/30 - 0/30` with each grade part colored independently (`>= 18` green `#006600`, `< 18` red `#b30000`, ungraded muted gray).
- Ungraded `0/30` placeholders must never be treated as numeric `0` in `getItemExamGrade()` or `calculateMediaGrades()`.
- Bold separator line (`3px solid #333333`) appears strictly between the last incomplete item and first completed item when both groups exist.
- Mobile (`<= 720px`) displays only 3 columns (`Course`, `Date`, `Grade`) and expands details (`Type`, `Actions`, `More Grade Info`) underneath when the row is clicked; desktop stays a 5-column table (`Course`, `Type`, `Date`, `Grade`, `Actions`).
- Clicking a course name opens a centered Course Info modal (`#modal-course-info`) with an `Edit Course` / `Create Course` action to `#modal-course`, without toggling the mobile row drawer.
- Preserve all existing comments/docstrings unrelated to changes, and keep Firestore sanitization (`sanitizeAssignmentItem`) compatible.

## Review Focus

- **Midterm with missing or empty `examParts`:** Creating a `Midterm` without entering Esonero 1 or Esonero 2 yields `examParts: undefined` or `[]`; `getAssignmentDisplayGrade()` must still emit 2 ungraded parts (`0/30 - 0/30`), not collapse into a single `0/30`. (Pinned in Task 1.)
- **Numeric `0` grade vs. ungraded `0/30`:** A saved `grade: 0` (or Esonero grade `0`) must render `0/30` with `status: 'fail'` (red), whereas missing/null/undefined/empty grade renders `0/30` with `status: 'ungraded'` (muted gray) and returns `null` from `getItemExamGrade()`. (Pinned in Task 1.)
- **Course lookup by `title`, `shortTitle`, `code`, and unmatched course name:** Typed `#assignment-course` values may match case-insensitively by `shortTitle` or `code` or not match any course in `courses`; `findCourseForName()` resolves all three and `#modal-course-info` shows a fallback state with a `Create Course` button pre-filling the course title when unmatched. (Pinned in Task 1 & Task 3.)
- **Completed bold divider boundary cases:** When a list has 0 items, only incomplete items, or only completed items, no `.assignments-completed-divider` separator is rendered; it renders only when index `i > 0` transitions from incomplete to `status === 'completed'`. (Pinned in Task 1 & Task 3.)
- **Mobile row click vs. Course link / Actions click & keyboard access:** Clicking `<a data-open-course-info>` or links inside the table/drawer must not accidentally toggle row expansion; clicking or pressing `Enter`/`Space` on a mobile row toggles `aria-expanded` and `.assignment-detail-row[hidden]`. (Pinned in Task 3.)

---

### Environment Setup Check (Before Task 1)

If `node_modules` is missing in the worktree (`node --test` fails with `ERR_MODULE_NOT_FOUND` for `firebase`), install dependencies without creating a lockfile:

```powershell
npm install --no-package-lock
```

---

### Task 1: Pure Grade Parts, Short Date, Divider Predicate, and Course Matching in `src/utils/grades.js`

**Files:**
- Modify: `src/utils/grades.js:46-125,223-260`
- Test: `src/utils/assignmentsView.test.js:1-190`

**Interfaces:**
- Consumes: `EXAM_MONTH_NAMES`, `parseLocalDateOnly`, `clampExamGradeValue`, `normalizeAssignmentType` in `src/utils/grades.js`
- Produces:
  - `formatExamDateShort(dateStr: string): string`
  - `getAssignmentDisplayGrade(item: object): { isSplit: boolean, value: number|null, text: string, isPass: boolean, isFail: boolean, isPending: boolean, partsText: string, averageValue: number|null, averageText: string, averageStatus: 'pass'|'fail'|'ungraded', parts: Array<{ label: string, value: number|null, displayText: string, status: 'pass'|'fail'|'ungraded' }> }`
  - `shouldRenderCompletedDivider(sortedItems: Array<object>, index: number): boolean`
  - `findCourseForName(courses: Array<object>, courseName: string): object|null`

- [ ] **Step 1: Update and expand failing tests in `src/utils/assignmentsView.test.js`**

Update `getAssignmentDisplayGrade` tests and add tests for `formatExamDateShort`, `shouldRenderCompletedDivider`, `findCourseForName`, empty-`examParts` Midterms, and explicit `0` vs ungraded `0/30` + `calculateMediaGrades` isolation:

```js
import {
  formatExamDate,
  formatExamDateShort,
  normalizeAssignmentType,
  getAssignmentDisplayGrade,
  getExamUrgencyState,
  sortAssignmentsForTable,
  shouldRenderCompletedDivider,
  findCourseForName,
  calculateMediaGrades,
} from './grades.js';

// In describe('formatExamDate'):
assert.equal(formatExamDateShort('2026-11-12'), '12 Nov 2026');
assert.equal(formatExamDateShort('2026-01-05'), '5 Jan 2026');
assert.equal(formatExamDateShort(''), '-');

// In describe('getAssignmentDisplayGrade'):
// 1. Single Exam: 28 -> text '28/30', parts: [{ label: 'Grade', value: 28, displayText: '28/30', status: 'pass' }]
// 2. Single Exam: 0 -> text '0/30', isFail: true, parts[0].status === 'fail'
// 3. Single Ungraded Exam -> text '0/30', isPending: true, isPass: false, isFail: false, parts[0] = { displayText: '0/30', status: 'ungraded', value: null }
// 4. Midterm with missing/empty examParts -> isSplit: true, text: '0/30 - 0/30', parts: [ungraded '0/30', ungraded '0/30'], averageText: '-'
// 5. Midterm with E1: 29.5, E2: undefined -> text: '29.5/30 - 0/30', parts[0] = { displayText: '29.5/30', status: 'pass', value: 29.5 }, parts[1] = { displayText: '0/30', status: 'ungraded', value: null }, averageText: '-'
// 6. Midterm with E1: 15, E2: 24 -> text: '15/30 - 24/30', parts[0].status === 'fail', parts[1].status === 'pass', averageValue: 19.5, averageText: '19.5/30', averageStatus: 'pass'
// 7. Midterm with E1: 0, E2: 24 -> parts[0].status === 'fail', parts[1].status === 'pass', averageValue: 12, averageStatus: 'fail'
// 8. calculateMediaGrades ignores ungraded Exam & partial Midterm (does not treat 0/30 placeholder as 0)

// In describe('shouldRenderCompletedDivider'):
// - returns false when items empty, all incomplete, or all completed
// - returns true strictly at first completed index following an incomplete item

// In describe('findCourseForName'):
// - matches case-insensitively by title, shortTitle, or code, and returns null when missing
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test src/utils/assignmentsView.test.js`
Expected: FAIL because `formatExamDateShort`, `shouldRenderCompletedDivider`, `findCourseForName` are not exported and `getAssignmentDisplayGrade` returns old `'28 / 30'` / `'-'` formats.

- [ ] **Step 3: Implement pure helpers in `src/utils/grades.js`**

- Add `formatExamDateShort(dateStr)` using `parseLocalDateOnly` and 3-letter month abbreviations (`Jan`..`Dec`).
- Refactor `getAssignmentDisplayGrade(item = {})` so:
  - Helper `buildGradePart(label, rawVal)` clamps via `clampExamGradeValue(rawVal)` and produces `{ label, value: clamped, displayText: clamped !== null ? \`${clamped}/30\` : '0/30', status: clamped === null ? 'ungraded' : clamped >= 18 ? 'pass' : 'fail' }`.
  - When `normalizedType === 'Midterm' || (Array.isArray(item?.examParts) && item.examParts.length > 0)`, always build 2 parts (`Esonero 1`, `Esonero 2`), set `text = \`${p1.displayText} - ${p2.displayText}\``, compute `averageValue`/`averageText`/`averageStatus` when both parts are non-null, and preserve `partsText` (`E1: <g1|-> · E2: <g2|->`).
  - Otherwise build 1 part (`Grade`), set `text = p1.displayText`, `isPass = p1.status === 'pass'`, `isFail = p1.status === 'fail'`, `isPending = p1.status === 'ungraded'`, `averageValue = p1.value`, `averageText = p1.value !== null ? p1.displayText : '-'`, `averageStatus = p1.status`.
- Add `shouldRenderCompletedDivider(sortedItems = [], index = 0)` returning `Boolean(index > 0 && sortedItems[index]?.status === 'completed' && sortedItems[index - 1]?.status !== 'completed')`.
- Add `findCourseForName(courses = [], courseName = '')` matching `title`, `shortTitle`, or `code` case-insensitively and trimmed, and reuse it inside `calculateMediaGrades`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test src/utils/assignmentsView.test.js src/utils/grades.test.js`
Expected: PASS on all new unit tests in `grades.test.js` and Task 1 blocks in `assignmentsView.test.js` (note: Task 3 DOM/HTML regex tests stay pending or updated in Task 2/3).

- [ ] **Step 5: Commit**

```bash
git add src/utils/grades.js src/utils/assignmentsView.test.js
git commit -m "feat(grades): format 0/30 grade parts, short dates, divider, and course lookup"
```

---

### Task 2: Add Centered `#modal-course-info` and `#modal-course` to `pages/assignments.html`

**Files:**
- Modify: `pages/assignments.html:74-160`
- Test: `src/utils/assignmentsView.test.js:212-279`

**Interfaces:**
- Consumes: UniSphere native `<dialog>` structure (`data-close-modal`, `#modal-course` IDs from `pages/courses.html:105-166`)
- Produces:
  - `#modal-course-info` in `pages/assignments.html` containing:
    - `#course-info-title`
    - `#course-info-details` (grid for Status, CFU, Year / Semester, Office Hours, Professor Email, Notes / Syllabus)
    - `#course-info-missing-notice` (`hidden` by default, shown when typed course is not in `courses`)
    - `#btn-course-info-edit` (opens `#modal-course` to edit or create)
    - `[data-close-modal="modal-course-info"]`
  - `#modal-course` included in `pages/assignments.html` with matching form IDs (`#form-course`, `#course-id`, `#course-title`, `#course-status`, `#course-cfu`, `#course-year`, `#course-semester`, `#course-email`, `#course-office`, `#course-notes`, `#btn-delete-course`).

- [ ] **Step 1: Add failing markup assertions to `src/utils/assignmentsView.test.js`**

Add assertions verifying `pages/assignments.html` retains the 5 `<th>` headers `['Course', 'Type', 'Date', 'Grade', 'Actions']` and includes `#modal-course-info`, `#course-info-title`, `#course-info-details`, `#course-info-missing-notice`, `#btn-course-info-edit`, and `#modal-course`.

- [ ] **Step 2: Run test to verify failure**

Run: `node --test src/utils/assignmentsView.test.js`
Expected: FAIL because `#modal-course-info` and `#modal-course` do not exist in `pages/assignments.html`.

- [ ] **Step 3: Update `pages/assignments.html`**

Keep `<table class="assignments-table">` headers unchanged (`<th>Course</th>`, `<th>Type</th>`, `<th>Date</th>`, `<th>Grade</th>`, `<th>Actions</th>`) and append `#modal-course-info` and `#modal-course` dialogs inside `#root`.

- [ ] **Step 4: Run test to verify pass**

Run: `node --test src/utils/assignmentsView.test.js`
Expected: PASS on HTML markup assertions.

- [ ] **Step 5: Commit**

```bash
git add pages/assignments.html src/utils/assignmentsView.test.js
git commit -m "feat(assignments): add Course Info and Course edit dialogs to assignments page"
```

---

### Task 3: Wire Table Grade Parts, Completed Divider, Mobile Expandable Rows, and Course Info Modal in `src/app.js` and `src/index.css`

**Files:**
- Modify: `src/app.js:90-115,286-300,1276-1340,2875-2905,3890-4110`
- Modify: `src/index.css:1177-1309`
- Test: `src/utils/assignmentsView.test.js`

**Interfaces:**
- Consumes: `formatExamDate`, `formatExamDateShort`, `getAssignmentDisplayGrade`, `shouldRenderCompletedDivider`, `findCourseForName` from `./utils/grades.js`
- Produces:
  - State `expandedAssignmentIds = new Set()` in `initApp()`
  - Helper `openCourseInfoModal(courseName)` populating `#modal-course-info` and wiring `#btn-course-info-edit` to close `#modal-course-info` and call `openCourseModal(...)` (either editing matched course or pre-filling `#course-title` when unmatched)
  - Click & `keydown` (`Enter`/`Space`) delegation for `[data-open-course-info]` and `tr[data-toggle-assignment-row]` (only expanding on mobile viewport `window.innerWidth <= 720`, and never toggling when clicking an `<a>` or `<button>` inside the row)
  - Responsive CSS in `src/index.css` hiding columns 2 (`Type`) and 5 (`Actions`) at `@media (max-width: 720px)`, styling `.assignments-completed-divider td`, `.exam-grade-part.exam-grade-pass` / `.exam-grade-fail` / `.exam-grade-ungraded`, `.assignment-detail-row`, and `.course-info-grid`.

- [ ] **Step 1: Update & expand wiring assertions in `src/utils/assignmentsView.test.js`**

Update `src/utils/assignmentsView.test.js` to assert:
- `src/index.css` defines `.exam-grade-ungraded`, `.assignments-completed-divider`, `.assignment-detail-row`, `.course-info-grid`, and `@media (max-width: 720px)` rules hiding `.assignments-table thead th:nth-child(2)`, `.assignments-table thead th:nth-child(5)`, `.assignment-main-row td:nth-child(2)`, and `.assignment-main-row td:nth-child(5)`.
- `src/app.js` imports `formatExamDateShort`, `shouldRenderCompletedDivider`, `findCourseForName`, renders `data-open-course-info`, `data-toggle-assignment-row`, `assignment-detail-row`, `assignments-completed-divider`, and implements `openCourseInfoModal`.

- [ ] **Step 2: Run test to verify failure**

Run: `node --test src/utils/assignmentsView.test.js`
Expected: FAIL because `src/app.js` and `src/index.css` do not yet contain those helpers and styles.

- [ ] **Step 3: Implement `src/app.js` and `src/index.css` updates**

1. **In `src/app.js`:**
   - Import `formatExamDateShort`, `shouldRenderCompletedDivider`, `findCourseForName` from `./utils/grades.js`.
   - Track `const expandedAssignmentIds = new Set();` inside `initApp()`.
   - Add small helpers:
     - `renderAssignmentGradePartsHtml(gradeInfo)`: renders each entry in `gradeInfo.parts` as `<span class="exam-grade-part exam-grade-${part.status}">${escapeHtml(part.displayText)}</span>` joined by `<span class="exam-grade-sep"> - </span>`.
     - `renderAssignmentDetailInfoHtml(item, displayType, gradeInfo, urgency)`: renders mobile drawer content showing `Type`, `Status`/`Hint`, `Grade Details` (Esonero 1, Esonero 2, Combined Average for Midterm; Grade & Pass/Fail/Pending for Exam/Assignment), and `Actions` (`Mark as complete`/`Reopen`, `Edit`, `Delete`).
     - `openCourseInfoModal(courseName)`: looks up course via `findCourseForName(courses, courseName)`. If found, populates `#course-info-title` and `#course-info-details` with all fields (`Status`, `CFU`, `Year / Semester`, `Office Hours`, `Professor Email` with `mailto:` link when valid, `Notes / Syllabus`) and sets `#btn-course-info-edit` text to `'Edit Course'`. If not found, shows `#course-info-missing-notice`, clears details to fallback `'-'`, and sets `#btn-course-info-edit` text to `'Create Course'`. Stores target course ID / fallback title on `#btn-course-info-edit` data attributes and calls `dialog.showModal()`.
   - Update `populateAssignmentsPage()`:
     - For each sorted item `a` at index `idx`:
       - Apply `assignments-completed-divider` class to `<tr class="${urgency.rowClass} assignment-main-row${hasDivider ? ' assignments-completed-divider' : ''}" ...>` when `shouldRenderCompletedDivider(sorted, idx)` is true.
       - Render Course cell as `<a href="#" data-open-course-info="${escapeHtml(a.courseName)}">${escapeHtml(a.courseName)}</a><span class="mobile-expand-indicator" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>`.
       - Render Date cell with desktop full date + hint and mobile short date (`<span class="exam-date-full">${escapeHtml(formatExamDate(a.dueDate))}${hintHtml}</span><span class="exam-date-short">${escapeHtml(formatExamDateShort(a.dueDate))}</span>`).
       - Render Grade cell via `renderAssignmentGradePartsHtml(gradeInfo)`.
       - Render `<tr class="assignment-detail-row ${escapeHtml(urgency.rowClass)}" data-assignment-detail="${escapeHtml(a.id)}" ${isExpanded ? '' : 'hidden'}><td colspan="5">...</td></tr>` directly after the main row.
   - Update `openCourseModal(courseToEdit = null, prefillTitle = '')`: accept optional `prefillTitle` so `Create Course` from `#modal-course-info` pre-fills `#course-title`.
   - In global `document.addEventListener('click', ...)` and a lightweight `keydown` handler (`Enter`/`Space` on `[data-toggle-assignment-row]`):
     - Handle `[data-open-course-info]`: `e.preventDefault(); e.stopPropagation(); openCourseInfoModal(...)`.
     - Handle `#btn-course-info-edit`: close `#modal-course-info` and call `openCourseModal(foundCourse, fallbackTitle)`.
     - Handle `tr[data-toggle-assignment-row]`: if `window.innerWidth <= 720` and click target is NOT inside `a, button, input, select, textarea`, toggle `id` in `expandedAssignmentIds` and re-run `populateAssignmentsPage()` (or toggle `hidden` + `aria-expanded` + indicator inline). Also reset/hide mobile detail drawers cleanly when resizing above `720px`.

2. **In `src/index.css`:**
   - Add `.exam-grade-part.exam-grade-pass` (`#006600`, bold), `.exam-grade-part.exam-grade-fail` (`#b30000`, bold), `.exam-grade-part.exam-grade-ungraded` (`#666666`, normal), `.exam-grade-sep`.
   - Add `.assignments-completed-divider td { border-top: 3px solid #333333; }`.
   - Hide `.mobile-expand-indicator`, `.exam-date-short`, and `.assignment-detail-row` by default on desktop (`> 720px`).
   - Inside `@media (max-width: 720px)`:
     - Hide `.assignments-table thead th:nth-child(2)`, `.assignments-table thead th:nth-child(5)`, `.assignment-main-row td:nth-child(2)`, `.assignment-main-row td:nth-child(5)`, `.exam-date-full`.
     - Show `.exam-date-short`, `.mobile-expand-indicator`, and `.assignment-detail-row`.
     - Style `.assignment-main-row { cursor: pointer; }`, `.assignment-detail-card` (stacked clean detail rows inside `<td colspan="5">`).
   - Style `.course-info-grid`, `.course-info-item`, `.course-info-label`, `.course-info-value`, `.course-info-notes`.

- [ ] **Step 4: Run full verification suite**

Run:
```powershell
npm test
npm run lint
npm run build
```
Expected: All unit tests pass, `tsc --noEmit` exits 0, `vite build` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/app.js src/index.css src/utils/assignmentsView.test.js
git commit -m "feat(assignments): add 0/30 grade rendering, completed divider, mobile drawer, and course info modal"
```
