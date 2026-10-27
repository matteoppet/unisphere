import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStudyDuration,
  getLocalDateString,
  getWeekDaysSummary,
  calculateWeeklyFocus,
} from './telemetry';

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
      { date: '2026-10-20', durationMinutes: 120 }, // Tuesday of week 1
      { date: '2026-10-25', durationMinutes: 180 }, // Sunday of week 1
    ];

    // On Sunday 2026-10-25: total 300m = 5h studied towards 20h goal
    const sundayFocus = calculateWeeklyFocus(previousWeekLogs, 20, new Date(2026, 9, 25));
    assert.equal(sundayFocus.weeklyMinutes, 300);
    assert.equal(sundayFocus.weeklyHours, '5');
    assert.equal(sundayFocus.weeklyDuration, '5h');
    assert.equal(sundayFocus.remainingDuration, '15h');
    assert.equal(sundayFocus.weeklyGoalPercent, 25);

    // On Monday 2026-10-26: new week starts, widget MUST reset to 0
    const mondayFocus = calculateWeeklyFocus(previousWeekLogs, 20, new Date(2026, 9, 26));
    assert.equal(mondayFocus.weeklyMinutes, 0);
    assert.equal(mondayFocus.weeklyHours, '0');
    assert.equal(mondayFocus.weeklyDuration, '0h');
    assert.equal(mondayFocus.remainingDuration, '20h');
    assert.equal(mondayFocus.weeklyGoalPercent, 0);
  });

  it('tracks study time during the week and resets again on the next Monday', () => {
    const allLogs = [
      { date: '2026-10-25', durationMinutes: 180 }, // Previous week Sunday
      { date: '2026-10-27', durationMinutes: 90 },  // Current week Tuesday
      { date: '2026-10-30', durationMinutes: 60 },  // Current week Friday
    ];

    // During current week (Friday 2026-10-30): should only count Tuesday + Friday (150m = 2.5h)
    const currentWeekFocus = calculateWeeklyFocus(allLogs, 20, new Date(2026, 9, 30));
    assert.equal(currentWeekFocus.weeklyMinutes, 150);
    assert.equal(currentWeekFocus.weeklyHours, '2.5');
    assert.equal(currentWeekFocus.weeklyDuration, '2h 30m');
    assert.equal(currentWeekFocus.remainingDuration, '17h 30m');
    assert.equal(currentWeekFocus.weeklyGoalPercent, 13); // round((150 / 1200) * 100) = 13%

    // Next week Monday (2026-11-02): resets to 0 again
    const nextMondayFocus = calculateWeeklyFocus(allLogs, 20, new Date(2026, 10, 2));
    assert.equal(nextMondayFocus.weeklyMinutes, 0);
    assert.equal(nextMondayFocus.weeklyHours, '0');
    assert.equal(nextMondayFocus.weeklyDuration, '0h');
    assert.equal(nextMondayFocus.remainingDuration, '20h');
    assert.equal(nextMondayFocus.weeklyGoalPercent, 0);
  });

  it('correctly calculates time format for 1h 50m + 2h 30m = 4h 20m without using percentages', () => {
    const logs = [
      { date: '2026-10-26', durationMinutes: 110 }, // 1h 50m on Monday
      { date: '2026-10-29', durationMinutes: 150 }, // 2h 30m on Thursday
    ];

    const focus = calculateWeeklyFocus(logs, 20, new Date(2026, 9, 29));
    assert.equal(focus.weeklyMinutes, 260);
    assert.equal(focus.weeklyDuration, '4h 20m');
    assert.equal(focus.remainingDuration, '15h 40m');
    assert.equal(focus.remainingMinutes, 940);
  });

  it('calculates correctly when passing pre-computed weekTotalMinutes', () => {
    // 0 minutes
    const zeroFocus = calculateWeeklyFocus(0, 20);
    assert.equal(zeroFocus.weeklyMinutes, 0);
    assert.equal(zeroFocus.weeklyHours, '0');
    assert.equal(zeroFocus.weeklyGoalPercent, 0);

    // 60 minutes
    const oneHourFocus = calculateWeeklyFocus(60, 20);
    assert.equal(oneHourFocus.weeklyMinutes, 60);
    assert.equal(oneHourFocus.weeklyHours, '1');
    assert.equal(oneHourFocus.weeklyGoalPercent, 5);

    // 75 minutes with custom goal of 25h
    const customGoalFocus = calculateWeeklyFocus(75, 25);
    assert.equal(customGoalFocus.weeklyMinutes, 75);
    assert.equal(customGoalFocus.weeklyHours, '1.3');
    assert.equal(customGoalFocus.weeklyGoalPercent, 5);

    // Fallback when goal is 0 or negative (defaults to 20h)
    const fallbackGoalFocus = calculateWeeklyFocus(120, 0);
    assert.equal(fallbackGoalFocus.weeklyMinutes, 120);
    assert.equal(fallbackGoalFocus.weeklyHours, '2');
    assert.equal(fallbackGoalFocus.weeklyGoalPercent, 10);
  });
});
