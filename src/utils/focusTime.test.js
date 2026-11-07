import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  formatStudyDuration,
  getLocalDateString,
  getWeekDaysSummary,
  calculateWeeklyFocus,
  groupStudyLogsByWeek,
  calculateTableScrollMaxHeight,
} from './telemetry.js';

describe('Focus Time formatting and weekly summary (#13)', () => {
  it('formats 0 minutes as 0h', () => {
    assert.equal(formatStudyDuration(0), '0h');
    assert.equal(formatStudyDuration(-10), '0h');
  });

  it('formats exact hours as integer hours without .0 or decimal percentage', () => {
    assert.equal(formatStudyDuration(60), '1h');
    assert.equal(formatStudyDuration(120), '2h');
    assert.equal(formatStudyDuration(180), '3h');
  });

  it('formats sub-hour durations in minutes rather than decimals (e.g. 45m not 0.8h)', () => {
    assert.equal(formatStudyDuration(15), '15m');
    assert.equal(formatStudyDuration(25), '25m');
    assert.equal(formatStudyDuration(30), '30m');
    assert.equal(formatStudyDuration(45), '45m');
    assert.equal(formatStudyDuration(50), '50m');
  });

  it('formats multi-hour durations with remaining minutes', () => {
    assert.equal(formatStudyDuration(75), '1h 15m');
    assert.equal(formatStudyDuration(90), '1h 30m');
    assert.equal(formatStudyDuration(105), '1h 45m');
  });

  it('returns valid local date string YYYY-MM-DD', () => {
    const fixedDate = new Date(2026, 9, 26);
    assert.equal(getLocalDateString(fixedDate), '2026-10-26');
  });

  it('computes week summary correctly with single and multiple sessions', () => {
    const today = getLocalDateString();
    const summary = getWeekDaysSummary([
      { date: today, durationMinutes: 45 },
      { date: today, durationMinutes: 15 },
    ]);

    assert.equal(summary.weekTotalMinutes, 60);
    assert.equal(summary.weekTotalSessions, 2);
    assert.equal(summary.activeDaysCount, 1);

    const todayDay = summary.weekDays.find((d) => d.dateStr === today);
    assert.ok(todayDay);
    assert.equal(todayDay.hours, '1h');
    assert.equal(todayDay.sessionCount, 2);
    assert.equal(todayDay.hasSessions, true);
  });
});

describe('Weekly Focus widget calculation and reset (#16)', () => {
  it('resets weekly focus hours and goal percentage on a new week (Monday)', () => {
    const previousWeekLogs = [
      { date: '2026-10-20', durationMinutes: 120 },
      { date: '2026-10-25', durationMinutes: 180 },
    ];

    const sundayFocus = calculateWeeklyFocus(previousWeekLogs, 20, new Date(2026, 9, 25));
    assert.equal(sundayFocus.weeklyMinutes, 300);
    assert.equal(sundayFocus.weeklyHours, '5');
    assert.equal(sundayFocus.weeklyDuration, '5h');
    assert.equal(sundayFocus.remainingDuration, '15h');
    assert.equal(sundayFocus.weeklyGoalPercent, 25);

    const mondayFocus = calculateWeeklyFocus(previousWeekLogs, 20, new Date(2026, 9, 26));
    assert.equal(mondayFocus.weeklyMinutes, 0);
    assert.equal(mondayFocus.weeklyHours, '0');
    assert.equal(mondayFocus.weeklyDuration, '0h');
    assert.equal(mondayFocus.remainingDuration, '20h');
    assert.equal(mondayFocus.weeklyGoalPercent, 0);
  });
});

describe('Weekly log per day widget includes Saturday (#32)', () => {
  it('returns 6 days (Mon through Sat) in widgetDays with Saturday study time included', () => {
    const saturdayLogs = [
      { date: '2026-10-24', durationMinutes: 90 }, // Saturday
    ];
    const summary = getWeekDaysSummary(saturdayLogs, new Date(2026, 9, 21)); // Wednesday of that week
    assert.ok(Array.isArray(summary.widgetDays));
    assert.equal(summary.widgetDays.length, 6);
    assert.deepEqual(
      summary.widgetDays.map((d) => d.shortDay),
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    );
    const saturdayEntry = summary.widgetDays[5];
    assert.equal(saturdayEntry.shortDay, 'Sat');
    assert.equal(saturdayEntry.dateStr, '2026-10-24');
    assert.equal(saturdayEntry.minutes, 90);
    assert.equal(saturdayEntry.hours, '1h 30m');
  });
});

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

  it('wires scrollable containers and week-separator-row into index.html, dashboard.html, logs.html, index.css, and app.js', () => {
    const indexHtml = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const dashHtml = fs.readFileSync(new URL('../../pages/dashboard.html', import.meta.url), 'utf8');
    const logsHtml = fs.readFileSync(new URL('../../pages/logs.html', import.meta.url), 'utf8');
    const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

    assert.match(indexHtml, /class="table-wrap table-scroll table-scroll-sm"/);
    assert.match(dashHtml, /class="table-wrap table-scroll table-scroll-sm"/);
    assert.match(logsHtml, /class="table-wrap table-scroll"/);
    assert.match(css, /\.table-scroll\s*\{[\s\S]*?max-height:\s*calc\(100vh\s*-/);
    assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.table-scroll[\s\S]*?max-height:\s*200px/);
    assert.match(css, /\.week-separator-row\s+td\s*\{/);
    assert.match(appJs, /groupStudyLogsByWeek/);
    assert.match(appJs, /calculateTableScrollMaxHeight/);
    assert.match(appJs, /week-separator-row/);
  });

  it('calculates viewport-fitted max-height keeping ~150px bottom margin on desktop and 3 logs (200px) on mobile', () => {
    // Desktop: 950px window, table top at 435px, 150px bottom buffer -> 365px
    assert.equal(calculateTableScrollMaxHeight(950, 435, 1280), 365);
    // Mobile (<= 720px width): fixed 200px (~3 log rows)
    assert.equal(calculateTableScrollMaxHeight(844, 400, 390), 200);
    // Very short desktop window still keeps a sensible 180px floor
    assert.equal(calculateTableScrollMaxHeight(500, 420, 1024), 180);
  });
});


