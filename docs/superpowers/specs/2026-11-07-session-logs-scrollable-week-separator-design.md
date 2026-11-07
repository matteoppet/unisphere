# Session Logs Scrollable View & Weekly Separator Design

## Intent & Why
Keep the Session Logs table on both the Dashboard card and the Session Logs page compact as logs accumulate, and visually group logs by week so week boundaries are obvious at a glance.

## Goals
- Make both session log tables vertically scrollable with sticky table headers (`max-height: 280px` on Dashboard, `440px` on Session Logs page).
- Remove the `.slice(0, 10)` cap on the Dashboard session logs table so all logs can be scrolled.
- Sort displayed logs newest-first (`date` descending, then `timestamp` descending) and insert a compact `<tr class="week-separator-row">` before each Monday–Sunday week group (`Week of 2 Nov – 8 Nov · 4h 30m`).

## Non-Goals / Anti-Goals
- No extra filters, pagination, collapsible accordions, or heavy visual styling that breaks the compact native HTML table look.

## Constraints
- Preserve existing table columns (`colspan="4"` on Dashboard, `colspan="6"` on Session Logs) and clean production build (`npm run build` / `npm test`).

## Approaches
1. **Compact Week Header Row (Picked):** Sort logs newest-first (`date` descending, then `timestamp` descending), and whenever the Monday-based week changes, insert a slim full-width `<tr class="week-separator-row">` with `colspan` (e.g., `Week of 2 Nov – 8 Nov · 4h 30m`, with tiny `4px 8px` padding, `#f7f7f7` background, and `#555` text). Wrap both session log tables in a `.table-scroll` container (`max-height: 280px` on Dashboard, `440px` on the Session Logs page, `overflow-y: auto`) with a sticky `<thead>` so column headers stay visible while scrolling.
2. **Border-Only Divider:** Keep only data rows, and apply a thicker/double top border (`border-top: 2px solid #9e9e9e`) on the first `<tr>` of each new week without any extra row or label.
