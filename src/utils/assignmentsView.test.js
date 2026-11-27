import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  isValidGradeInput,
} from './grades.js';
import { sanitizeAssignmentItem } from '../lib/authService.js';

const repoRoot = path.resolve(import.meta.dirname || '.', '../..');

describe('Exams & Assignments Redesign (#exams-redesign)', () => {
  describe('formatExamDate & formatExamDateShort', () => {
    it('formats YYYY-MM-DD as readable day month year (e.g. 12 November 2026)', () => {
      assert.equal(formatExamDate('2026-11-12'), '12 November 2026');
      assert.equal(formatExamDate('2026-01-05'), '5 January 2026');
      assert.equal(formatExamDate(''), '-');
      assert.equal(formatExamDate(null), '-');
    });

    it('formats YYYY-MM-DD in short mobile form (e.g. 12 Nov 2026)', () => {
      assert.equal(formatExamDateShort('2026-11-12'), '12 Nov 2026');
      assert.equal(formatExamDateShort('2026-01-05'), '5 Jan 2026');
      assert.equal(formatExamDateShort(''), '-');
      assert.equal(formatExamDateShort(null), '-');
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
    it('formats single grades as <grade>/30 and ungraded as ungraded 0/30 with pass/fail/ungraded states', () => {
      const passHigh = getAssignmentDisplayGrade({ type: 'Exam', grade: 28 });
      assert.equal(passHigh.isSplit, false);
      assert.equal(passHigh.value, 28);
      assert.equal(passHigh.text, '28/30');
      assert.equal(passHigh.isPass, true);
      assert.equal(passHigh.isFail, false);
      assert.equal(passHigh.isPending, false);
      assert.equal(passHigh.averageValue, 28);
      assert.equal(passHigh.averageText, '28/30');
      assert.equal(passHigh.averageStatus, 'pass');
      assert.deepEqual(passHigh.parts, [
        { label: 'Grade', value: 28, displayText: '28/30', status: 'pass' },
      ]);

      const passBorder = getAssignmentDisplayGrade({ type: 'Exam', grade: 18 });
      assert.equal(passBorder.value, 18);
      assert.equal(passBorder.text, '18/30');
      assert.equal(passBorder.isPass, true);
      assert.equal(passBorder.isFail, false);
      assert.equal(passBorder.parts[0].status, 'pass');

      const failLow = getAssignmentDisplayGrade({ type: 'Exam', grade: 17 });
      assert.equal(failLow.value, 17);
      assert.equal(failLow.text, '17/30');
      assert.equal(failLow.isPass, false);
      assert.equal(failLow.isFail, true);
      assert.equal(failLow.parts[0].status, 'fail');

      const failZero = getAssignmentDisplayGrade({ type: 'Assignment', grade: 0 });
      assert.equal(failZero.value, 0);
      assert.equal(failZero.text, '0/30');
      assert.equal(failZero.isPass, false);
      assert.equal(failZero.isFail, true);
      assert.equal(failZero.isPending, false);
      assert.deepEqual(failZero.parts, [
        { label: 'Grade', value: 0, displayText: '0/30', status: 'fail' },
      ]);

      const twoDecimals = getAssignmentDisplayGrade({ type: 'Exam', grade: 29.65 });
      assert.equal(twoDecimals.value, 29.65);
      assert.equal(twoDecimals.text, '29.65/30');
      assert.equal(twoDecimals.isPass, true);
      assert.equal(twoDecimals.parts[0].status, 'pass');

      const commaDecimal = getAssignmentDisplayGrade({ type: 'Exam', grade: '29,60' });
      assert.equal(commaDecimal.value, 29.6);
      assert.equal(commaDecimal.text, '29.6/30');
      assert.equal(commaDecimal.isPass, true);

      const ungraded = getAssignmentDisplayGrade({ type: 'Exam' });
      assert.equal(ungraded.value, null);
      assert.equal(ungraded.text, '0/30');
      assert.equal(ungraded.isPass, false);
      assert.equal(ungraded.isFail, false);
      assert.equal(ungraded.isPending, true);
      assert.equal(ungraded.averageValue, null);
      assert.equal(ungraded.averageText, '-');
      assert.equal(ungraded.averageStatus, 'ungraded');
      assert.deepEqual(ungraded.parts, [
        { label: 'Grade', value: null, displayText: '0/30', status: 'ungraded' },
      ]);
    });

    it('formats Midterm esonero grades as 0/30 - 0/30 with independent part statuses and combined average', () => {
      const emptyMidterm = getAssignmentDisplayGrade({ type: 'Midterm' });
      assert.equal(emptyMidterm.isSplit, true);
      assert.equal(emptyMidterm.text, '0/30 - 0/30');
      assert.equal(emptyMidterm.isPending, true);
      assert.equal(emptyMidterm.averageValue, null);
      assert.equal(emptyMidterm.averageText, '-');
      assert.equal(emptyMidterm.averageStatus, 'ungraded');
      assert.deepEqual(emptyMidterm.parts, [
        { label: 'Esonero 1', value: null, displayText: '0/30', status: 'ungraded' },
        { label: 'Esonero 2', value: null, displayText: '0/30', status: 'ungraded' },
      ]);

      const partialHigh = getAssignmentDisplayGrade({
        type: 'Midterm',
        examParts: [{ label: 'Esonero 1', grade: 29.5 }],
      });
      assert.equal(partialHigh.text, '29.5/30 - 0/30');
      assert.equal(partialHigh.value, null);
      assert.equal(partialHigh.isPending, true);
      assert.equal(partialHigh.averageText, '-');
      assert.equal(partialHigh.partsText, 'E1: 29.5 · E2: -');
      assert.deepEqual(partialHigh.parts, [
        { label: 'Esonero 1', value: 29.5, displayText: '29.5/30', status: 'pass' },
        { label: 'Esonero 2', value: null, displayText: '0/30', status: 'ungraded' },
      ]);

      const mixedPass = getAssignmentDisplayGrade({
        type: 'Midterm',
        examParts: [
          { label: 'Esonero 1', grade: 15 },
          { label: 'Esonero 2', grade: 24 },
        ],
      });
      assert.equal(mixedPass.text, '15/30 - 24/30');
      assert.equal(mixedPass.parts[0].status, 'fail');
      assert.equal(mixedPass.parts[1].status, 'pass');
      assert.equal(mixedPass.averageValue, 19.5);
      assert.equal(mixedPass.averageText, '19.5/30');
      assert.equal(mixedPass.averageStatus, 'pass');
      assert.equal(mixedPass.isPass, true);
      assert.equal(mixedPass.isFail, false);

      const zeroFailPart = getAssignmentDisplayGrade({
        type: 'Midterm',
        examParts: [
          { label: 'Esonero 1', grade: 0 },
          { label: 'Esonero 2', grade: 24 },
        ],
      });
      assert.equal(zeroFailPart.text, '0/30 - 24/30');
      assert.equal(zeroFailPart.parts[0].status, 'fail');
      assert.equal(zeroFailPart.parts[0].value, 0);
      assert.equal(zeroFailPart.parts[1].status, 'pass');
      assert.equal(zeroFailPart.averageValue, 12);
      assert.equal(zeroFailPart.averageText, '12/30');
      assert.equal(zeroFailPart.averageStatus, 'fail');
      assert.equal(zeroFailPart.isFail, true);

      const twoDecimalMidterm = getAssignmentDisplayGrade({
        type: 'Midterm',
        examParts: [
          { label: 'Esonero 1', grade: 29.6 },
          { label: 'Esonero 2', grade: 29.5 },
        ],
      });
      assert.equal(twoDecimalMidterm.text, '29.6/30 - 29.5/30');
      assert.equal(twoDecimalMidterm.averageValue, 29.55);
      assert.equal(twoDecimalMidterm.averageText, '29.55/30');
      assert.equal(twoDecimalMidterm.averageStatus, 'pass');
    });

    it('keeps calculateMediaGrades unaffected by ungraded 0/30 placeholders', () => {
      const courses = [{ id: 'c1', title: 'Analisi 1', shortTitle: 'An1', code: 'MAT1', cfu: 12 }];
      const summary = calculateMediaGrades(
        [
          { id: 'a1', courseName: 'Analisi 1', type: 'Exam', status: 'todo' },
          {
            id: 'a2',
            courseName: 'Analisi 1',
            type: 'Midterm',
            status: 'todo',
            examParts: [{ label: 'Esonero 1', grade: 29.5 }],
          },
        ],
        courses
      );
      assert.equal(summary.gradedExamsCount, 0);
      assert.equal(summary.weightedAverage, null);
    });
  });

  describe('isValidGradeInput', () => {
    it('accepts optional empty input, dot decimals, and comma decimals in 0..30 and rejects invalid/out-of-range values', () => {
      assert.equal(isValidGradeInput(''), true);
      assert.equal(isValidGradeInput('29,60'), true);
      assert.equal(isValidGradeInput('29.65'), true);
      assert.equal(isValidGradeInput('0'), true);
      assert.equal(isValidGradeInput('30'), true);
      assert.equal(isValidGradeInput('30,00'), true);
      assert.equal(isValidGradeInput('30.1'), false);
      assert.equal(isValidGradeInput('-1'), false);
      assert.equal(isValidGradeInput('abc'), false);
      assert.equal(isValidGradeInput('29,6,0'), false);
    });
  });

  describe('shouldRenderCompletedDivider', () => {
    it('returns true strictly at the transition from incomplete to completed items', () => {
      assert.equal(shouldRenderCompletedDivider([], 0), false);
      assert.equal(
        shouldRenderCompletedDivider([{ status: 'todo' }, { status: 'in-progress' }], 1),
        false
      );
      assert.equal(
        shouldRenderCompletedDivider([{ status: 'completed' }, { status: 'completed' }], 0),
        false
      );
      assert.equal(
        shouldRenderCompletedDivider([{ status: 'completed' }, { status: 'completed' }], 1),
        false
      );

      const mixed = [
        { status: 'todo' },
        { status: 'in-progress' },
        { status: 'completed' },
        { status: 'completed' },
      ];
      assert.deepEqual(
        mixed.map((_, idx) => shouldRenderCompletedDivider(mixed, idx)),
        [false, false, true, false]
      );
    });
  });

  describe('findCourseForName', () => {
    it('matches case-insensitively by title, shortTitle, or code and returns null when missing', () => {
      const courses = [
        { id: 'c1', title: 'Analisi Matematica 1', shortTitle: 'Analisi 1', code: 'MAT101' },
      ];
      assert.equal(findCourseForName(courses, '  analisi matematica 1 ')?.id, 'c1');
      assert.equal(findCourseForName(courses, 'analisi 1')?.id, 'c1');
      assert.equal(findCourseForName(courses, 'mat101')?.id, 'c1');
      assert.equal(findCourseForName(courses, 'Fisica 1'), null);
      assert.equal(findCourseForName(courses, ''), null);
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

      const decimalCleaned = sanitizeAssignmentItem({
        id: 'asg-dec-1',
        courseName: 'Fisica 1',
        type: 'Midterm',
        dueDate: '2026-11-22',
        status: 'todo',
        examParts: [
          { label: 'Esonero 1', grade: '29,60' },
          { label: 'Esonero 2', grade: 28.75 },
        ],
      });
      assert.ok(decimalCleaned);
      assert.equal(decimalCleaned.examParts[0].grade, 29.6);
      assert.equal(decimalCleaned.examParts[1].grade, 28.75);

      const singleDecimalCleaned = sanitizeAssignmentItem({
        id: 'asg-dec-2',
        courseName: 'Algebra',
        type: 'Exam',
        dueDate: '2026-11-25',
        status: 'completed',
        grade: 29.65,
      });
      assert.ok(singleDecimalCleaned);
      assert.equal(singleDecimalCleaned.grade, 29.65);
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

      // Coherent modal across assignments.html and dashboard.html
      for (const pagePath of ['pages/assignments.html', 'pages/dashboard.html']) {
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
        assert.match(pageHtml, /id="assignment-grade"[^>]*inputmode="decimal"/);
        assert.match(pageHtml, /id="assignment-esonero1"[^>]*inputmode="decimal"/);
        assert.match(pageHtml, /id="assignment-esonero2"[^>]*inputmode="decimal"/);
        assert.doesNotMatch(pageHtml, /id="assignment-grade"[^>]*step="0\.5"/);
        assert.doesNotMatch(pageHtml, /id="assignment-esonero1"[^>]*step="0\.5"/);
        assert.doesNotMatch(pageHtml, /id="assignment-esonero2"[^>]*step="0\.5"/);
      }

      // App.js wiring for sorting, urgency, daily check, and modal synchronization
      assert.match(appSrc, /sortAssignmentsForTable/);
      assert.match(appSrc, /getExamUrgencyState/);
      assert.match(appSrc, /getAssignmentDisplayGrade/);
      assert.match(appSrc, /normalizeAssignmentType/);
      assert.match(appSrc, /lastAssignmentsDateKey/);
    });

    it('includes centered #modal-course-info and #modal-course dialogs in pages/assignments.html', () => {
      const html = fs.readFileSync(path.join(repoRoot, 'pages/assignments.html'), 'utf8');
      assert.match(html, /id="modal-course-info"/);
      assert.match(html, /id="course-info-title"/);
      assert.match(html, /id="course-info-details"/);
      assert.match(html, /id="course-info-missing-notice"/);
      assert.match(html, /id="btn-course-info-edit"/);
      assert.match(html, /data-close-modal="modal-course-info"/);
      assert.match(html, /id="modal-course"/);
      assert.match(html, /id="form-course"/);
      assert.match(html, /id="course-title"/);
    });

    it('wires 0/30 grade parts, bold completed divider, mobile 3-column drawer, and course info modal in CSS and App.js', () => {
      const css = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
      const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');

      // CSS classes for individual grade parts, bold completed separator, mobile drawer, and course info grid
      assert.match(css, /\.exam-grade-ungraded/);
      assert.match(css, /\.assignments-completed-divider\s+td/);
      assert.match(css, /border-top:\s*3px\s+solid\s+#333333/);
      assert.match(css, /\.assignment-detail-row/);
      assert.match(css, /\.course-info-grid/);
      assert.match(css, /@media\s*\(\s*max-width:\s*720px\s*\)[\s\S]*?\.assignments-table\s+thead\s+th:nth-child\(2\)/);
      assert.match(css, /@media\s*\(\s*max-width:\s*720px\s*\)[\s\S]*?\.assignments-table\s+thead\s+th:nth-child\(5\)/);
      assert.match(css, /@media\s*\(\s*max-width:\s*720px\s*\)[\s\S]*?\.assignment-main-row\s+td:nth-child\(2\)/);
      assert.match(css, /@media\s*\(\s*max-width:\s*720px\s*\)[\s\S]*?\.assignment-main-row\s+td:nth-child\(5\)/);

      // App.js wiring
      assert.match(appSrc, /formatExamDateShort/);
      assert.match(appSrc, /shouldRenderCompletedDivider/);
      assert.match(appSrc, /findCourseForName/);
      assert.match(appSrc, /expandedAssignmentIds/);
      assert.match(appSrc, /data-open-course-info/);
      assert.match(appSrc, /data-toggle-assignment-row/);
      assert.match(appSrc, /assignment-detail-row/);
      assert.match(appSrc, /assignments-completed-divider/);
      assert.match(appSrc, /function openCourseInfoModal/);
      assert.match(appSrc, /btn-course-info-edit/);
    });
  });
});
