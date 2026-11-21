# Dashboard Goals Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dashboard Goals widget and Add/Edit/Delete Goal modal allowing students to track goals linked to a Course or a personal tag (`Skill`, `Project`, etc.) with real-time Firestore and `localStorage` persistence.

**Architecture:** Store goals as a sanitized array of structured objects (`{ id, title, tag, completed, createdAt, completedAt }`) inside the existing `checklist` field on `/users/{userId}` (which `firestore.rules` validates as `string` or `list` up to 500 items), with transparent migration from legacy checklist strings or JSON strings. Stack the new Goals card beneath the Courses card in the first column of the Dashboard `.grid-3` layout (`index.html` and `pages/dashboard.html`) and provide a native `<dialog id="modal-goal">` for creating, editing, and deleting goals.

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5 `<dialog>`, CSS3, Firebase Firestore, Vite, Node.js test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-21-dashboard-goals-widget-design.md`

## Global Constraints

- Must store goals in the `checklist` field of `/users/{userId}` (`list` of `<= 500` items) so deployed `firestore.rules` (`hasOnly(allowedKeys)` and `isValidOptionalStringOrList(data, 'checklist', 20000, 500)`) pass without rule changes.
- Never include `undefined` property values on goal objects written to Firestore.
- Keep `index.html` and `pages/dashboard.html` Dashboard markup and `#modal-goal` identical.
- Sanitize all goal text fields with `sanitizeTextInput` and escape rendered HTML with `escapeHtml`.

## Review Focus

1. **XSS payloads in goal title or tag (`<script>alert(1)</script>Learn CAD`):** `sanitizeGoalItem` must strip script/HTML tags from both `title` and `tag`, and reject items whose sanitized `title` is empty.
2. **Legacy string `checklist` in `localStorage` or Firestore (`"• [ ] Learn derivatives\n• [x] Master limit proofs"`):** `normalizeGoalsList` must convert legacy checklist lines into structured goal objects without data loss.
3. **Blank or whitespace-only tag input:** `sanitizeGoalItem` must default an empty `tag` to `'Skill'` so every goal row renders a valid right-aligned pill badge.
4. **Unchecking a previously completed goal:** `completedAt` must be omitted (not set to `undefined`) when `completed` is `false` so Firestore `setDoc()` does not throw on `undefined` field values.
5. **Lists exceeding the 500-item Firestore limit:** `normalizeGoalsList` must cap the returned array at 500 items so `isValidOptionalStringOrList(data, 'checklist', 20000, 500)` in `firestore.rules` never rejects a cloud sync write.

---

### Task 1: Goal Data Model, Sanitization, Sorting & Legacy Migration

**Files:**
- Modify: `src/utils/checklist.js`
- Modify: `src/lib/authService.js`
- Test: `src/utils/checklist.test.js`

**Interfaces:**
- Consumes: `sanitizeTextInput(value, maxLength, allowMultiline)` from `src/lib/authService.js`
- Produces:
  - `sanitizeGoalItem(raw)` -> `{ id: string, title: string, tag: string, completed: boolean, createdAt: number, completedAt?: number } | null`
  - `normalizeGoalsList(rawChecklist)` -> `Array<GoalItem>` (max 500 items)
  - `sortGoalsForDisplay(goals)` -> `Array<GoalItem>` (uncompleted first, completed last)
  - `upsertGoalItem(goals, draft)` -> `Array<GoalItem>`
  - `toggleGoalCompletion(goals, goalId, nowMs)` -> `Array<GoalItem>`
  - `deleteGoalItem(goals, goalId)` -> `Array<GoalItem>`

- [ ] **Step 1: Write the failing unit tests in `src/utils/checklist.test.js`**

Append a new `describe('Dashboard Goals data model and sanitization', ...)` block to `src/utils/checklist.test.js` testing:
```js
describe('Dashboard Goals data model and sanitization', () => {
  it('sanitizes goal items, strips XSS tags, and defaults empty tag to Skill', () => {
    const item = sanitizeGoalItem({
      id: 'goal-1',
      title: '<script>evil()</script>Learn derivatives',
      tag: '   ',
      completed: false,
      createdAt: 1700000000000,
    });
    assert.deepEqual(item, {
      id: 'goal-1',
      title: 'Learn derivatives',
      tag: 'Skill',
      completed: false,
      createdAt: 1700000000000,
    });
    assert.equal('completedAt' in item, false);
    assert.equal(sanitizeGoalItem({ title: '<script>alert(1)</script>' }), null);
  });

  it('migrates legacy multiline checklist strings and JSON strings into structured goals', () => {
    const migrated = normalizeGoalsList('• [ ] Learn CAD\n• [x] Master limit proofs');
    assert.equal(migrated.length, 2);
    assert.equal(migrated[0].title, 'Learn CAD');
    assert.equal(migrated[0].completed, false);
    assert.equal(migrated[0].tag, 'Skill');
    assert.equal(migrated[1].title, 'Master limit proofs');
    assert.equal(migrated[1].completed, true);
  });

  it('sorts active goals before completed goals while preserving relative order', () => {
    const sorted = sortGoalsForDisplay([
      { id: 'g1', title: 'Master limit proofs', tag: 'Analisi 1', completed: true, createdAt: 1 },
      { id: 'g2', title: 'Learn derivatives', tag: 'Analisi 1', completed: false, createdAt: 2 },
      { id: 'g3', title: 'Learn CAD', tag: 'Skill', completed: false, createdAt: 3 },
    ]);
    assert.deepEqual(sorted.map((g) => g.id), ['g2', 'g3', 'g1']);
  });

  it('upserts, toggles completion without undefined fields, deletes, and caps at 500 items', () => {
    let list = upsertGoalItem([], { id: 'g1', title: 'Create this game', tag: 'Project', completed: false });
    assert.equal(list.length, 1);
    assert.equal(list[0].tag, 'Project');

    list = toggleGoalCompletion(list, 'g1', 1700000005000);
    assert.equal(list[0].completed, true);
    assert.equal(list[0].completedAt, 1700000005000);

    list = toggleGoalCompletion(list, 'g1', 1700000009000);
    assert.equal(list[0].completed, false);
    assert.equal('completedAt' in list[0], false);

    list = upsertGoalItem(list, { id: 'g1', title: 'Create 3D game', tag: 'Skill', completed: true });
    assert.equal(list[0].title, 'Create 3D game');
    assert.equal(list[0].tag, 'Skill');
    assert.equal(list[0].completed, true);

    list = deleteGoalItem(list, 'g1');
    assert.equal(list.length, 0);

    const oversized = Array.from({ length: 520 }, (_, i) => ({
      id: `g-${i}`,
      title: `Goal ${i}`,
      tag: 'Skill',
    }));
    assert.equal(normalizeGoalsList(oversized).length, 500);
  });
});
```

- [ ] **Step 2: Run the test suite to verify the new tests fail**

Run: `node --test src/utils/checklist.test.js`
Expected: FAIL with export error for `sanitizeGoalItem`, `normalizeGoalsList`, `sortGoalsForDisplay`, `upsertGoalItem`, `toggleGoalCompletion`, `deleteGoalItem`.

- [ ] **Step 3: Implement goal helpers in `src/utils/checklist.js` and export from `src/lib/authService.js`**

In `src/utils/checklist.js`, import `sanitizeTextInput` from `../lib/authService.js` and implement `sanitizeGoalItem`, `normalizeGoalsList`, `sortGoalsForDisplay`, `upsertGoalItem`, `toggleGoalCompletion`, and `deleteGoalItem` while keeping existing checklist string helpers intact. Re-export `sanitizeGoalItem` and `normalizeGoalsList` from `src/lib/authService.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/utils/checklist.test.js`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/utils/checklist.js src/lib/authService.js src/utils/checklist.test.js; if ($?) { git commit -m "feat: add structured goal sanitization, sorting, and legacy checklist migration" }
```

---

### Task 2: Dashboard Goals Widget UI, Add/Edit/Delete Modal & App Wiring

**Files:**
- Modify: `index.html`
- Modify: `pages/dashboard.html`
- Modify: `src/index.css`
- Modify: `src/app.js`
- Test: `src/utils/checklist.test.js`

**Interfaces:**
- Consumes: `sanitizeGoalItem`, `normalizeGoalsList`, `sortGoalsForDisplay`, `upsertGoalItem`, `toggleGoalCompletion`, `deleteGoalItem` from `src/utils/checklist.js`
- DOM IDs & Data Attributes:
  - Card & List: `#dash-goals-card`, `#btn-dash-add-goal`, `#dash-goals-list`
  - Row interaction attributes: `data-toggle-goal="<id>"` on the checkbox `<input type="checkbox">`, `data-open-goal="<id>"` on the clickable goal body/button
  - Modal: `#modal-goal`, `#form-goal`, `#modal-goal-title`, `#goal-id`, `#goal-title`, `#goal-tag`, `#goal-tag-suggestions`, `[data-goal-tag-preset]`, `#goal-completed`, `#btn-delete-goal`

- [ ] **Step 1: Add DOM/wiring verification test in `src/utils/checklist.test.js`**

Add a test in `src/utils/checklist.test.js` that reads `index.html`, `pages/dashboard.html`, `src/index.css`, and `src/app.js` to assert:
- Both `index.html` and `pages/dashboard.html` wrap the Courses card and `#dash-goals-card` in a `.stack` container inside `.grid-3`, include `#btn-dash-add-goal`, `#dash-goals-list`, and `<dialog id="modal-goal">` with `#form-goal`, `#goal-title`, `#goal-tag`, `#goal-completed`, and `#btn-delete-goal`.
- `src/index.css` defines `.goals-list`, `.goal-item`, `.goal-item.goal-completed`, `.goal-title`, and `.goal-tag-badge`.
- `src/app.js` renders `#dash-goals-list` and wires `#modal-goal` add, edit, toggle, and delete actions.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/utils/checklist.test.js`
Expected: FAIL because `#dash-goals-card` and `#modal-goal` are not yet in `index.html` and `pages/dashboard.html`.

- [ ] **Step 3: Update `index.html`, `pages/dashboard.html`, `src/index.css`, and `src/app.js`**

1. **`index.html` and `pages/dashboard.html`:**
   - Wrap the first column of `.grid-3` in `<div class="stack">` containing the existing Courses `<section class="card">` and the new Goals card:
     ```html
     <!-- 1b. Goals Card -->
     <section class="card" id="dash-goals-card">
       <div class="card-header">
         <h3>Goals</h3>
         <button type="button" id="btn-dash-add-goal">+ Add Goal</button>
       </div>
       <ul class="goals-list" id="dash-goals-list"></ul>
     </section>
     ```
   - Add `<dialog id="modal-goal">` with `#form-goal`, `#modal-goal-title`, `#goal-id`, `#goal-title`, `#goal-tag` (with `list="goal-tag-suggestions"` and quick-select preset chips for `Skill`, `Project`, plus active courses in `#goal-tag-suggestions`), `#goal-completed` checkbox, `#btn-delete-goal` danger button, Cancel (`data-close-modal="modal-goal"`), and Save Goal submit button.
2. **`src/index.css`:**
   - Style `.goals-list` (list-style: none, margin/padding 0), `.goal-item` (flex row with checkbox, title, and right-aligned `.goal-tag-badge`, subtle bottom border `#eeeeee`, hover affordance for opening modal), `.goal-item.goal-completed .goal-title` (`text-decoration: line-through; color: #888888;`), `.goal-tag-badge` (rounded pill `border-radius: 999px; background-color: #efefef; border: 1px solid #d5d5d5; padding: 2px 12px; font-size: 13px; color: #333333;`), and `.goal-tag-presets` for quick preset chips inside `#modal-goal`.
3. **`src/app.js`:**
   - Initialize `checklist` state using `normalizeGoalsList(...)` from `localStorage` (`${STORAGE_KEY}_checklist`), persist via `JSON.stringify(checklist)` in `saveToLocalStorage()`, hydrate via `normalizeGoalsList(data.checklist)` in `applyRemoteWorkspaceData()` and JSON backup import, and push `normalizeGoalsList(checklist)` in `pushWorkstationToCloud()`.
   - In `populateDashboardPage()`, render sorted goals into `#dash-goals-list` (or an empty state `<li class="empty-cell">No goals added yet.</li>`) and populate `#goal-tag-suggestions` in `updateCourseSuggestionsDatalist()` with `Skill`, `Project`, and each course title.
   - Add `openGoalModal(goalToEdit = null)` and bind `#btn-dash-add-goal`, `[data-open-goal]`, `[data-toggle-goal]`, `[data-goal-tag-preset]`, `#form-goal` submit, and `#btn-delete-goal` click handlers.

- [ ] **Step 4: Run tests, typecheck, and production build**

Run: `npm test; if ($?) { npm run lint }; if ($?) { npm run build }`
Expected: All tests pass, `tsc --noEmit` exits 0, `vite build` succeeds with exit code 0.

- [ ] **Step 5: Commit Task 2**

```powershell
git add index.html pages/dashboard.html src/index.css src/app.js src/utils/checklist.test.js; if ($?) { git commit -m "feat: add dashboard goals widget and add/edit/delete goal modal" }
```
