# Session Logs Scrollable View & Weekly Separator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact scrollable region and Monday–Sunday weekly separator rows to the Session Logs tables on both the Dashboard and Session Logs pages.

**Architecture:** Extract a pure helper `groupStudyLogsByWeek(studyLogs)` in `src/utils/telemetry.js` that sorts logs chronologically (`date` desc, `timestamp` desc) and groups them into Monday–Sunday buckets with formatted range labels and total weekly durations. Update `src/app.js`, `pages/dashboard.html`, `pages/logs.html`, and `src/index.css` to render `.week-separator-row` headers inside vertically scrollable `.table-scroll` containers with sticky `<thead>` cells.

**Tech Stack:** Vanilla ES Modules (JavaScript), HTML5, CSS3, Node.js native test runner (`node:test`).

**Spec:** `docs/superpowers/plans/../specs/2026-11-07-session-logs-scrollable-week-separator-design.md`

## Global Constraints

- Preserve existing table columns (`colspan="4"` on Dashboard, `colspan="6"` on Session Logs).
- Remove `.slice(0, 10)` on the Dashboard session logs table so all logs are accessible in the scrollable region.
- Maintain compact native HTML table styling (`max-height: 280px` on Dashboard, `max-height: 440px` on Session Logs page, sticky `<thead>`).
- `npm test` and `npm run build` must succeed with exit code 0.

## Review Focus

- Logs on Sunday (`dayOfWeek === 0`) must group into the preceding Monday's week rather than starting a new week.
- Multiple logs on the same date or out-of-order insertion must sort deterministically (`date` descending, then `timestamp` descending) and sum durations accurately in the week label.
- Week spans that cross month or year boundaries (e.g. `28 Dec 2025 – 3 Jan 2026` or `26 Oct – 1 Nov`) must format clearly without off-by-one month/day bugs.
- Malformed or missing `date` strings on a log item must not throw or crash rendering (fallback to an `'Other'` group at the end).
- Empty log lists must continue rendering the single `.empty-cell` row without any week separator row.

---

### Task 1: Weekly Log Grouping Helper & Unit Tests

**Files:**
- Modify: `src/utils/telemetry.js`
- Test: `src/utils/focusTime.test.js`

**Interfaces:**
- Produces: `groupStudyLogsByWeek(studyLogs = []) -> Array<{ weekKey: string, label: string, totalMinutes: number, totalDuration: string, logs: Array<object> }>` in `src/utils/telemetry.js`

- [ ] **Step 1: Write the failing unit tests in `src/utils/focusTime.test.js`**

```javascript
describe('groupStudyLogsByWeek (#34)', () => {
  it('returns empty array when given no logs', () => {
    assert.deepEqual(groupStudyLogsByWeek([]), []);
  });

  it('sorts logs newest-first and groups Monday through Sunday into the same week', () => {
    const logs = [
      { id: '1', date: '2026-11-02', durationMinutes: 60, timestamp: 100 }, // Mon
      { id: '2', date: '2026-11-08', durationMinutes: 90, timestamp: 200 }, // Sun (same week)
      { id: '3', date: '2026-10-28', durationMinutes: 45, timestamp: 50 },  // Wed (prev week)
      { id: '4', date: '2026-11-08', durationMinutes: 30, timestamp: 300 }, // Sun (later timestamp)
    ];

    const groups = groupStudyLogsByWeek(logs);
    assert.equal(groups.length, 2);

    assert.equal(groups[0].weekKey, '2026-11-02');
    assert.equal(groups[0].totalMinutes, 180);
    assert.equal(groups[0].totalDuration, '3h');
    assert.equal(groups[0].label, 'Week of 2 Nov – 8 Nov · 3h');
    assert.deepEqual(groups[0].logs.map((l) => l.id), ['4', '2', '1']);

    assert.equal(groups[1].weekKey, '2026-10-26');
    assert.equal(groups[1].totalMinutes, 45);
    assert.equal(groups[1].totalDuration, '45m');
    assert.equal(groups[1].label, 'Week of 26 Oct – 1 Nov · 45m');
    assert.deepEqual(groups[1].logs.map((l) => l.id), ['3']);
  });

  it('handles malformed dates gracefully without throwing', () => {
    const logs = [
      { id: '1', date: 'invalid-date', durationMinutes: 30 },
      { id: '2', date: '2026-11-03', durationMinutes: 60 },
    ];
    const groups = groupStudyLogsByWeek(logs);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].weekKey, '2026-11-02');
    assert.equal(groups[1].weekKey, 'other');
    assert.equal(groups[1].label, 'Other · 30m');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `SyntaxError: The requested module './telemetry.js' does not provide an export named 'groupStudyLogsByWeek'`

- [ ] **Step 3: Implement `groupStudyLogsByWeek(studyLogs = [])` in `src/utils/telemetry.js`**

Export `groupStudyLogsByWeek(studyLogs = [])` in `src/utils/telemetry.js`. Parse valid `YYYY-MM-DD` dates in local time, sort valid logs descending by `date` then descending by `timestamp || 0` (placing invalid dates at the end under `weekKey: 'other'`), compute each log's Monday start (`dayOfWeek === 0 ? -6 : 1 - dayOfWeek`) and Sunday end (`+6` days), format dates as `${d.getDate()} ${monthNames[d.getMonth()]}`, and set `label` to ``Week of ${startFmt} – ${endFmt} · ${totalDuration}`` (or ``Other · ${totalDuration}`` for `'other'`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

---

### Task 2: Scrollable Table Containers & Weekly Separator Rendering

**Files:**
- Modify: `pages/dashboard.html:109-121`
- Modify: `pages/logs.html:66-80`
- Modify: `src/index.css:262-326`
- Modify: `src/app.js:49-53,757-774,951-970`

**Interfaces:**
- Consumes: `groupStudyLogsByWeek(studyLogs)` from `src/utils/telemetry.js`

- [ ] **Step 1: Add `.table-scroll`, `.table-scroll-sm`, and `.week-separator-row` styles in `src/index.css` and classes in `pages/dashboard.html` and `pages/logs.html`**

In `pages/dashboard.html`, add `table-scroll table-scroll-sm` to the `<div class="table-wrap">` wrapping `#dash-logs-tbody`.
In `pages/logs.html`, add `table-scroll` to the `<div class="table-wrap">` wrapping `#logs-registry-tbody`.
In `src/index.css`, add:
```css
.table-scroll {
  max-height: 440px;
  overflow-y: auto;
}

.table-scroll-sm {
  max-height: 280px;
}

.table-scroll thead th {
  position: sticky;
  top: 0;
  background-color: #ffffff;
  z-index: 1;
  box-shadow: inset 0 -1px 0 #e0e0e0;
}

.week-separator-row td {
  background-color: #f7f7f7;
  color: #555555;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 8px;
  border-top: 1px solid #dcdcdc;
  border-bottom: 1px solid #dcdcdc;
  letter-spacing: 0.01em;
}
```

- [ ] **Step 2: Render grouped weekly logs in `src/app.js` for both `#dash-logs-tbody` and `#logs-registry-tbody`**

Import `groupStudyLogsByWeek` from `./utils/telemetry.js` in `src/app.js`.
In `populateDashboard()` (`#dash-logs-tbody`), remove `.slice(0, 10)`, call `groupStudyLogsByWeek(studyLogs)`, and for each week group render:
```html
<tr class="week-separator-row">
  <td colspan="4">${escapeHtml(group.label)}</td>
</tr>
```
followed by its log rows.
In `populateLogsPage()` (`#logs-registry-tbody`), call `groupStudyLogsByWeek(filteredLogs)` and for each week group render:
```html
<tr class="week-separator-row">
  <td colspan="6">${escapeHtml(group.label)}</td>
</tr>
```
followed by its log rows.

- [ ] **Step 3: Run tests and production build to verify**

Run: `npm test && npm run build`
Expected: All tests PASS and Vite production build exits with code 0.

- [ ] **Step 4: Commit changes**

```bash
git add docs/ pages/dashboard.html pages/logs.html src/index.css src/app.js src/utils/telemetry.js src/utils/focusTime.test.js
git commit -m "feat(logs): add scrollable view and weekly separators to session logs (#34)"
```
