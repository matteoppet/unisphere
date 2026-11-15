import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatExamDate,
  normalizeAssignmentType,
  getAssignmentDisplayGrade,
  getExamUrgencyState,
  sortAssignmentsForTable,
} from './grades.js';
import { sanitizeAssignmentItem } from '../lib/authService.js';

const repoRoot = path.resolve(import.meta.dirname || '.', '../..');

describe('Exams & Assignments Redesign (#exams-redesign)', () => {
  describe('formatExamDate', () => {
    it('formats YYYY-MM-DD as readable day month year (e.g. 12 November 2026)', () => {
      assert.equal(formatExamDate('2026-11-12'), '12 November 2026');
      assert.equal(formatExamDate('2026-01-05'), '5 January 2026');
      assert.equal(formatExamDate(''), '-');
      assert.equal(formatExamDate(null), '-');
    });
  });

  describe('normalizeAssignmentType', () => {
    it('normalizes types to Exam, Midterm, or Assignment', () => {
      assert.equal(normalizeAssignmentType('Exam'), 'Exam');
      assert.equal(normalizeAssignmentType('Final'), 'Exam');
      assert.equal(normalizeAssignmentType('Oral'), 'Exam');
      assert.equal(normalizeAssignmentType('Midterm'), 'Midterm');
      assert.equal(normalizeAssignmentType('Assignment'), 'Assignment');
      assert.equal(normalizeAssignmentType('Project'), 'Assignment');
      assert.equal(normalizeAssignmentType('Reading'), 'Assignment');
      assert.equal(normalizeAssignmentType('Unknown'), 'Exam');
    });
  });

  describe('getAssignmentDisplayGrade', () => {
    it('handles single grades from 0 to 30 with green >= 18 and red < 18', () => {
      const passHigh = getAssignmentDisplayGrade({ type: 'Exam', grade: 28 });
      assert.equal(passHigh.value, 28);
      assert.equal(passHigh.text, '28 / 30');
      assert.equal(passHigh.isPass, true);
      assert.equal(passHigh.isFail, false);
      assert.equal(passHigh.isPending, false);

      const passBorder = getAssignmentDisplayGrade({ type: 'Exam', grade: 18 });
      assert.equal(passBorder.value, 18);
      assert.equal(passBorder.text, '18 / 30');
      assert.equal(passBorder.isPass, true);
      assert.equal(passBorder.isFail, false);

      const failLow = getAssignmentDisplayGrade({ type: 'Exam', grade: 17 });
      assert.equal(failLow.value, 17);
      assert.equal(failLow.text, '17 / 30');
      assert.equal(failLow.isPass, false);
      assert.equal(failLow.isFail, true);

      const failZero = getAssignmentDisplayGrade({ type: 'Assignment', grade: 0 });
      assert.equal(failZero.value, 0);
      assert.equal(failZero.text, '0 / 30');
      assert.equal(failZero.isPass, false);
      assert.equal(failZero.isFail, true);

      const ungraded = getAssignmentDisplayGrade({ type: 'Exam' });
      assert.equal(ungraded.value, null);
      assert.equal(ungraded.text, '-');
      assert.equal(ungraded.isPass, false);
      assert.equal(ungraded.isFail, false);
      assert.equal(ungraded.isPending, true);
    });

    it('averages two esonero grades for Midterm and evaluates pass/fail at 18', () => {
      const passingMidterm = getAssignmentDisplayGrade({
        type: 'Midterm',
        examParts: [
          { label: 'Esonero 1', grade: 27 },
          { label: 'Esonero 2', grade: 28 },
        ],
      });
      assert.equal(passingMidterm.value, 27.5);
      assert.equal(passingMidterm.text, '27.5 / 30');
      assert.equal(passingMidterm.isPass, true);
      assert.equal(passingMidterm.isFail, false);
      assert.equal(passingMidterm.partsText, 'E1: 27 · E2: 28');

      const failingMidterm = getAssignmentDisplayGrade({
        type: 'Midterm',
        examParts: [
          { label: 'Esonero 1', grade: 15 },
          { label: 'Esonero 2', grade: 17 },
        ],
      });
      assert.equal(failingMidterm.value, 16);
      assert.equal(failingMidterm.text, '16 / 30');
      assert.equal(failingMidterm.isPass, false);
      assert.equal(failingMidterm.isFail, true);

      const partialMidterm = getAssignmentDisplayGrade({
        type: 'Midterm',
        examParts: [{ label: 'Esonero 1', grade: 24 }],
      });
      assert.equal(partialMidterm.value, null);
      assert.equal(partialMidterm.text, '-');
      assert.equal(partialMidterm.isPending, true);
      assert.equal(partialMidterm.partsText, 'E1: 24 · E2: -');
    });
  });

  describe('getExamUrgencyState', () => {
    const today = new Date(2026, 10, 15, 23, 0, 0); // 2026-11-15

    it('marks completed items green regardless of date', () => {
      const state = getExamUrgencyState(
        { dueDate: '2026-11-15', status: 'completed' },
        today
      );
      assert.equal(state.level, 'completed');
      assert.equal(state.rowClass, 'exam-row-completed');
    });

    it('transitions incomplete rows from normal -> yellow -> red as date approaches', () => {
      // > 10 days away -> normal
      assert.equal(
        getExamUrgencyState({ dueDate: '2026-11-30', status: 'todo' }, today).level,
        'normal'
      );
      assert.equal(
        getExamUrgencyState({ dueDate: '2026-11-30', status: 'todo' }, today).rowClass,
        'exam-row-normal'
      );

      // 4 to 10 days away -> yellow
      assert.equal(
        getExamUrgencyState({ dueDate: '2026-11-25', status: 'todo' }, today).level,
        'yellow'
      );
      assert.equal(
        getExamUrgencyState({ dueDate: '2026-11-19', status: 'todo' }, today).rowClass,
        'exam-row-urgent-yellow'
      );

      // <= 3 days away (including today and overdue) -> red
      assert.equal(
        getExamUrgencyState({ dueDate: '2026-11-18', status: 'todo' }, today).level,
        'red'
      );
      assert.equal(
        getExamUrgencyState({ dueDate: '2026-11-15', status: 'todo' }, today).rowClass,
        'exam-row-urgent-red'
      );
      assert.equal(
        getExamUrgencyState({ dueDate: '2026-11-13', status: 'in-progress' }, today).level,
        'red'
      );
    });

    it('re-evaluates urgency automatically when current day advances', () => {
      const item = { dueDate: '2026-11-20', status: 'todo' };
      // On Nov 8 (12 days left) -> normal
      assert.equal(getExamUrgencyState(item, new Date(2026, 10, 8)).level, 'normal');
      // On Nov 12 (8 days left) -> yellow
      assert.equal(getExamUrgencyState(item, new Date(2026, 10, 12)).level, 'yellow');
      // On Nov 18 (2 days left) -> red
      assert.equal(getExamUrgencyState(item, new Date(2026, 10, 18)).level, 'red');
    });
  });

  describe('sortAssignmentsForTable', () => {
    const today = new Date(2026, 10, 15);

    it('puts closest incomplete items at top and completed items at bottom', () => {
      const items = [
        { id: 'far', courseName: 'History', type: 'Exam', dueDate: '2026-12-20', status: 'todo' },
        { id: 'done-soon', courseName: 'Physics', type: 'Exam', dueDate: '2026-11-16', status: 'completed' },
        { id: 'urgent', courseName: 'Analisi 1', type: 'Exam', dueDate: '2026-11-17', status: 'todo' },
        { id: 'medium', courseName: 'Algebra', type: 'Midterm', dueDate: '2026-11-22', status: 'todo' },
        { id: 'done-old', courseName: 'Chemistry', type: 'Assignment', dueDate: '2026-11-01', status: 'completed' },
      ];

      const sorted = sortAssignmentsForTable(items, today);
      assert.deepEqual(
        sorted.map((x) => x.id),
        ['urgent', 'medium', 'far', 'done-soon', 'done-old']
      );
    });
  });

  describe('sanitizeAssignmentItem backward compatibility & title-optional modal support', () => {
    it('accepts items without explicit title by deriving a clean title from courseName and type, and preserves grade 0', () => {
      const cleaned = sanitizeAssignmentItem({
        id: 'asg-new-1',
        courseName: 'Analisi 1',
        type: 'Midterm',
        dueDate: '2026-11-20',
        status: 'todo',
        examParts: [
          { label: 'Esonero 1', grade: 0 },
          { label: 'Esonero 2', grade: 24 },
        ],
      });
      assert.ok(cleaned);
      assert.equal(cleaned.courseName, 'Analisi 1');
      assert.equal(cleaned.type, 'Midterm');
      assert.equal(cleaned.title, 'Analisi 1 Midterm');
      assert.equal(cleaned.examParts[0].grade, 0);
      assert.equal(cleaned.examParts[1].grade, 24);
    });
  });

  describe('Exams & Assignments Page HTML, CSS, and App.js wiring', () => {
    it('removes Grade & Exam Averages widget and renders full-width 5-column table sized to fill Y minus 200px', () => {
      const html = fs.readFileSync(path.join(repoRoot, 'pages/assignments.html'), 'utf8');
      const css = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
      const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');

      // Removed Grade & Exam Averages widget
      assert.doesNotMatch(html, /Grade &amp; Exam Averages/);
      assert.doesNotMatch(html, /id="assignments-summary-tbody"/);

      // Full-width board shell with compact card & table styling and viewport - 200px scroll sizing
      assert.match(html, /class="card assignments-board-card"/);
      assert.match(html, /class="card-header"/);
      assert.doesNotMatch(css, /\.assignments-page-shell\s*\{[\s\S]*?max-width:\s*960px/);
      assert.match(css, /\.assignments-page-shell\s*\{[\s\S]*?width:\s*100%/);
      assert.doesNotMatch(css, /\.assignments-board-card\s*\{[\s\S]*?calc\(100vh\s*-\s*200px\)/);
      assert.match(css, /\.assignments-table-scroll\s*\{[\s\S]*?overflow-y:\s*auto/);
      assert.match(css, /\.assignments-table\s+tbody\s+td\s*\{[\s\S]*?padding:\s*8px/);
      assert.match(css, /\.exam-row-urgent-yellow/);
      assert.match(css, /\.exam-row-urgent-red/);
      assert.match(css, /\.exam-row-completed/);
      assert.match(css, /\.exam-grade-pass/);
      assert.match(css, /\.exam-grade-fail/);
      assert.match(appSrc, /getElementById\('assignments-table-scroll'\)/);
      assert.match(appSrc, /assignmentsTableScrollEl\.style\.minHeight\s*=\s*`\$\{tableH\}px`/);
      assert.match(appSrc, /assignmentsTableScrollEl\.style\.maxHeight\s*=\s*`\$\{tableH\}px`/);
      assert.doesNotMatch(appSrc, /assignmentsBoardEl\.style\.height/);
      assert.doesNotMatch(appSrc, /class="exam-type-label"/);
      assert.doesNotMatch(appSrc, /btn-exam-complete/);
      assert.match(appSrc, /<a href="#" data-toggle-assignment=/);

      // Exactly 5 columns: Course, Type, Date, Grade, Actions
      const theadMatch = html.match(/<thead>\s*<tr>([\s\S]*?)<\/tr>\s*<\/thead>/);
      assert.ok(theadMatch, 'table thead should exist');
      const headers = Array.from(theadMatch[1].matchAll(/<th>([\s\S]*?)<\/th>/g)).map((m) =>
        m[1].trim()
      );
      assert.deepEqual(headers, ['Course', 'Type', 'Date', 'Grade', 'Actions']);

      // Coherent modal across assignments.html, dashboard.html, and index.html
      for (const pagePath of ['pages/assignments.html', 'pages/dashboard.html', 'index.html']) {
        const pageHtml = fs.readFileSync(path.join(repoRoot, pagePath), 'utf8');
        assert.match(pageHtml, /id="modal-assignment"/);
        assert.doesNotMatch(pageHtml, /id="assignment-title"/);
        assert.doesNotMatch(pageHtml, /id="assignment-status"/);
        assert.doesNotMatch(pageHtml, /id="assignment-notes"/);
        assert.match(pageHtml, /id="assignment-course"/);
        assert.match(pageHtml, /id="assignment-type"/);
        assert.match(pageHtml, /value="Exam"/);
        assert.match(pageHtml, /value="Midterm"/);
        assert.match(pageHtml, /value="Assignment"/);
        assert.match(pageHtml, /id="assignment-due"/);
        assert.match(pageHtml, /id="assignment-grade"/);
        assert.match(pageHtml, /id="assignment-esonero1"/);
        assert.match(pageHtml, /id="assignment-esonero2"/);
        assert.match(pageHtml, /id="assignment-esonero-average-preview"/);
        assert.match(pageHtml, /id="assignment-completed"/);
      }

      // App.js wiring for sorting, urgency, daily check, and modal synchronization
      assert.match(appSrc, /sortAssignmentsForTable/);
      assert.match(appSrc, /getExamUrgencyState/);
      assert.match(appSrc, /getAssignmentDisplayGrade/);
      assert.match(appSrc, /normalizeAssignmentType/);
      assert.match(appSrc, /lastAssignmentsDateKey/);
    });
  });
});
