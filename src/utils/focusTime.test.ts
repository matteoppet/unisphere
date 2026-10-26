import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatStudyDuration, getLocalDateString, getWeekDaysSummary } from './telemetry';

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
