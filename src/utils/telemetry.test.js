import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDurationFromHoursMinutes,
  calculateDurationFromRange,
  addMinutesToTimeString,
  formatStudyDuration,
  calculateElo,
  updateStreak,
  generateSquadCode,
  getLocalDateString,
  getWeekDaysSummary,
  calculateWeeklyFocus,
  calculateTableScrollMaxHeight,
} from './telemetry.js';

describe('telemetry.js - Session Time & Duration Calculation Utilities (#41)', () => {
  describe('calculateDurationFromHoursMinutes', () => {
    it('calculates duration for standard hours and minutes', () => {
      assert.equal(calculateDurationFromHoursMinutes(1, 30), 90);
      assert.equal(calculateDurationFromHoursMinutes(0, 45), 45);
      assert.equal(calculateDurationFromHoursMinutes(2, 15), 135);
      assert.equal(calculateDurationFromHoursMinutes(3, 0), 180);
    });

    it('handles string input values from HTML number inputs', () => {
      assert.equal(calculateDurationFromHoursMinutes('1', '30'), 90);
      assert.equal(calculateDurationFromHoursMinutes('0', '15'), 15);
      assert.equal(calculateDurationFromHoursMinutes('2', '0'), 120);
    });

    it('returns 0 for zero or negative values', () => {
      assert.equal(calculateDurationFromHoursMinutes(0, 0), 0);
      assert.equal(calculateDurationFromHoursMinutes(-1, 30), 30);
      assert.equal(calculateDurationFromHoursMinutes(1, -15), 60);
      assert.equal(calculateDurationFromHoursMinutes(-2, -20), 0);
    });

    it('clamps upper bound to 720 minutes (12 hours)', () => {
      assert.equal(calculateDurationFromHoursMinutes(13, 0), 720);
      assert.equal(calculateDurationFromHoursMinutes(24, 0), 720);
      assert.equal(calculateDurationFromHoursMinutes(11, 120), 720);
    });

    it('handles NaN or missing inputs safely', () => {
      assert.equal(calculateDurationFromHoursMinutes(null, undefined), 0);
      assert.equal(calculateDurationFromHoursMinutes('abc', 'def'), 0);
    });
  });

  describe('calculateDurationFromRange', () => {
    it('calculates duration within the same day', () => {
      assert.equal(calculateDurationFromRange('09:00', '10:30'), 90);
      assert.equal(calculateDurationFromRange('14:15', '16:45'), 150);
      assert.equal(calculateDurationFromRange('08:00', '08:45'), 45);
    });

    it('returns 0 when start equals end time', () => {
      assert.equal(calculateDurationFromRange('14:00', '14:00'), 0);
      assert.equal(calculateDurationFromRange('00:00', '00:00'), 0);
    });

    it('supports timestamps with optional seconds format HH:MM:SS', () => {
      assert.equal(calculateDurationFromRange('09:00:00', '10:30:00'), 90);
      assert.equal(calculateDurationFromRange('14:00:30', '15:30:45'), 90);
    });

    it('calculates duration when range crosses midnight', () => {
      // 23:00 to 00:30 is 90 minutes
      assert.equal(calculateDurationFromRange('23:00', '00:30'), 90);
      // 22:30 to 01:15 is 165 minutes
      assert.equal(calculateDurationFromRange('22:30', '01:15'), 165);
      // 23:50 to 00:10 is 20 minutes
      assert.equal(calculateDurationFromRange('23:50', '00:10'), 20);
    });

    it('safely rejects invalid or malformed time strings', () => {
      assert.equal(calculateDurationFromRange('', '10:00'), 0);
      assert.equal(calculateDurationFromRange('09:00', ''), 0);
      assert.equal(calculateDurationFromRange(null, undefined), 0);
      assert.equal(calculateDurationFromRange('25:00', '10:00'), 0);
      assert.equal(calculateDurationFromRange('09:65', '10:00'), 0);
      assert.equal(calculateDurationFromRange('invalid', 'time'), 0);
    });
  });

  describe('addMinutesToTimeString', () => {
    it('adds minutes within the same day', () => {
      assert.equal(addMinutesToTimeString('14:00', 90), '15:30');
      assert.equal(addMinutesToTimeString('09:15', 45), '10:00');
      assert.equal(addMinutesToTimeString('10:00', 0), '10:00');
    });

    it('wraps around midnight when adding minutes past 24:00', () => {
      assert.equal(addMinutesToTimeString('23:15', 75), '00:30');
      assert.equal(addMinutesToTimeString('23:00', 120), '01:00');
    });

    it('supports strings with optional seconds format', () => {
      assert.equal(addMinutesToTimeString('14:00:00', 60), '15:00');
    });

    it('falls back safely to default 14:00 when given invalid inputs', () => {
      assert.equal(addMinutesToTimeString('invalid', 60), '14:00');
      assert.equal(addMinutesToTimeString('', 60), '14:00');
      assert.equal(addMinutesToTimeString(null, 60), '14:00');
    });
  });
});
