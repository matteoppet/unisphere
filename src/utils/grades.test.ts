import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getExamResult,
  getItemExamGrade,
  isExamType,
  calculateMediaGrades,
} from './grades';
import { AssignmentItem, Course } from '../types';

describe('Grade calculation utilities', () => {
  it('correctly calculates split exam grade (esonero 1 + esonero 2)', () => {
    // Both passed
    assert.strictEqual(
      getExamResult([
        { label: 'Esonero 1', grade: 28 },
        { label: 'Esonero 2', grade: 30 },
      ]),
      29
    );

    // Decimal result
    assert.strictEqual(
      getExamResult([
        { label: 'Esonero 1', grade: 27 },
        { label: 'Esonero 2', grade: 28 },
      ]),
      27.5
    );

    // One part failing (< 18)
    assert.strictEqual(
      getExamResult([
        { label: 'Esonero 1', grade: 16 },
        { label: 'Esonero 2', grade: 28 },
      ]),
      null
    );

    // Incomplete parts
    assert.strictEqual(
      getExamResult([
        { label: 'Esonero 1', grade: 25 },
        { label: 'Esonero 2', grade: undefined },
      ]),
      null
    );

    assert.strictEqual(getExamResult(undefined), null);
  });

  it('identifies exam types correctly', () => {
    assert.strictEqual(isExamType('Exam'), true);
    assert.strictEqual(isExamType('Midterm'), true);
    assert.strictEqual(isExamType('Oral'), true);
    assert.strictEqual(isExamType('Final'), true);
    assert.strictEqual(isExamType('Assignment'), false);
    assert.strictEqual(isExamType('Project'), false);
    assert.strictEqual(isExamType('Lab Report'), false);
  });

  it('extracts item exam grade for both single and split exams', () => {
    const splitExam: AssignmentItem = {
      id: '1',
      title: 'Physics Exam',
      courseName: 'Physics 1',
      type: 'Exam',
      dueDate: '2026-06-15',
      status: 'completed',
      examParts: [
        { label: 'Esonero 1', grade: 26 },
        { label: 'Esonero 2', grade: 30 },
      ],
    };
    assert.strictEqual(getItemExamGrade(splitExam), 28);

    const singleExam: AssignmentItem = {
      id: '2',
      title: 'Math Exam',
      courseName: 'Calculus',
      type: 'Exam',
      dueDate: '2026-06-20',
      status: 'completed',
      grade: 30,
    };
    assert.strictEqual(getItemExamGrade(singleExam), 30);

    const failingExam: AssignmentItem = {
      id: '3',
      title: 'Chemistry Exam',
      courseName: 'Chemistry',
      type: 'Exam',
      dueDate: '2026-06-25',
      status: 'todo',
      grade: 15,
    };
    assert.strictEqual(getItemExamGrade(failingExam), null);

    const unrankedExam: AssignmentItem = {
      id: '4',
      title: 'Upcoming Exam',
      courseName: 'History',
      type: 'Exam',
      dueDate: '2026-07-01',
      status: 'todo',
    };
    assert.strictEqual(getItemExamGrade(unrankedExam), null);
  });

  it('calculates weighted average, arithmetic average, and laurea base', () => {
    const courses: Course[] = [
      {
        id: 'c1',
        code: 'MAT01',
        title: 'Calculus 1',
        shortTitle: 'Calc 1',
        email: 'prof@uni.edu',
        cfu: 9,
        year: 1,
        semester: 1,
        status: 'completed',
        progress: 100,
        color: '#6366F1',
      },
      {
        id: 'c2',
        code: 'FIS01',
        title: 'Physics 1',
        shortTitle: 'Phys 1',
        email: 'prof@uni.edu',
        cfu: 6,
        year: 1,
        semester: 2,
        status: 'completed',
        progress: 100,
        color: '#10B981',
      },
    ];

    const assignments: AssignmentItem[] = [
      // Single exam: Calculus 1 (9 CFU) -> 28
      {
        id: 'a1',
        title: 'Calculus 1 Written & Oral',
        courseName: 'Calculus 1',
        type: 'Exam',
        dueDate: '2026-01-20',
        status: 'completed',
        grade: 28,
      },
      // Split exam: Physics 1 (6 CFU) -> 24 (22 and 26)
      {
        id: 'a2',
        title: 'Physics 1 Partial Exams',
        courseName: 'Phys 1', // matches shortTitle
        type: 'Exam',
        dueDate: '2026-02-15',
        status: 'completed',
        examParts: [
          { label: 'Esonero 1', grade: 22 },
          { label: 'Esonero 2', grade: 26 },
        ],
      },
      // Ungraded exam (should be excluded)
      {
        id: 'a3',
        title: 'Future Exam',
        courseName: 'Calculus 1',
        type: 'Exam',
        dueDate: '2026-07-15',
        status: 'todo',
      },
    ];

    const summary = calculateMediaGrades(assignments, courses);

    // Total CFU = 9 + 6 = 15
    // Weighted sum = (28 * 9) + (24 * 6) = 252 + 144 = 396
    // Weighted average = 396 / 15 = 26.4
    // Arithmetic average = (28 + 24) / 2 = 26
    // Laurea base = (26.4 * 110) / 30 = 96.8
    assert.strictEqual(summary.gradedExamsCount, 2);
    assert.strictEqual(summary.totalGradedCFU, 15);
    assert.strictEqual(summary.weightedAverage, 26.4);
    assert.strictEqual(summary.arithmeticAverage, 26);
    assert.strictEqual(summary.laureaBase, 96.8);
  });

  it('handles empty assignments gracefully', () => {
    const summary = calculateMediaGrades([], []);
    assert.strictEqual(summary.gradedExamsCount, 0);
    assert.strictEqual(summary.weightedAverage, null);
    assert.strictEqual(summary.arithmeticAverage, null);
    assert.strictEqual(summary.laureaBase, null);
    assert.strictEqual(summary.totalGradedCFU, 0);
    assert.deepStrictEqual(summary.exams, []);
  });
});
