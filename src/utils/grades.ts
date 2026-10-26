import { AssignmentItem, Course, ExamPart } from '../types';

/**
 * Calculates final exam grade from two partial exam parts (esoneri).
 * In the Italian university system, both parts must be >= 18/30.
 * Returns arithmetic average rounded to 1 decimal place, or null if incomplete/failed.
 */
export function getExamResult(parts?: ExamPart[]): number | null {
  if (!parts || parts.length !== 2 || parts.some((part) => typeof part.grade !== 'number')) {
    return null;
  }
  const grades = parts.map((part) => part.grade as number);
  if (grades.some((grade) => grade < 18)) return null;
  return Math.round(((grades[0] + grades[1]) / 2) * 10) / 10;
}

/**
 * Checks whether an assignment item type represents an exam.
 */
export function isExamType(type: AssignmentItem['type']): boolean {
  return ['Midterm', 'Exam', 'Final', 'Oral'].includes(type);
}

/**
 * Extracts the passing exam grade (18 to 30) for any assignment/exam item,
 * whether it is a split exam (esonero 1 + 2) or a single total exam.
 * Returns null if not passed or not graded.
 */
export function getItemExamGrade(item: AssignmentItem): number | null {
  if (item.examParts && item.examParts.length === 2) {
    return getExamResult(item.examParts);
  }
  if (typeof item.grade === 'number' && !isNaN(item.grade) && item.grade >= 18) {
    return Math.min(30, Math.max(18, item.grade));
  }
  return null;
}

export interface GradedExamDetail {
  item: AssignmentItem;
  grade: number;
  cfu: number;
  isSplit: boolean;
}

export interface ExamGradeSummary {
  weightedAverage: number | null; // Media ponderata (CFU-weighted)
  arithmeticAverage: number | null; // Media aritmetica
  laureaBase: number | null; // Graduation base out of 110 based on weighted average
  gradedExamsCount: number;
  totalGradedCFU: number;
  exams: GradedExamDetail[];
}

/**
 * Calculates academic media grades (weighted by course CFU and arithmetic average)
 * across all completed/graded exams.
 */
export function calculateMediaGrades(
  assignments: AssignmentItem[] = [],
  courses: Course[] = []
): ExamGradeSummary {
  const gradedExams: GradedExamDetail[] = [];

  for (const item of assignments) {
    const grade = getItemExamGrade(item);
    if (grade === null) continue;

    // Find course CFU
    const normalizedItemCourse = (item.courseName || '').trim().toLowerCase();
    const course = courses.find((c) => {
      const title = (c.title || '').trim().toLowerCase();
      const shortTitle = (c.shortTitle || '').trim().toLowerCase();
      const code = (c.code || '').trim().toLowerCase();
      return (
        (title && title === normalizedItemCourse) ||
        (shortTitle && shortTitle === normalizedItemCourse) ||
        (code && code === normalizedItemCourse)
      );
    });

    // Default CFU to course CFU if positive, otherwise standard 6 CFU
    const cfu = course && course.cfu > 0 ? course.cfu : 6;
    const isSplit = Boolean(item.examParts && item.examParts.length === 2);

    gradedExams.push({
      item,
      grade,
      cfu,
      isSplit,
    });
  }

  if (gradedExams.length === 0) {
    return {
      weightedAverage: null,
      arithmeticAverage: null,
      laureaBase: null,
      gradedExamsCount: 0,
      totalGradedCFU: 0,
      exams: [],
    };
  }

  const totalGradedCFU = gradedExams.reduce((sum, e) => sum + e.cfu, 0);
  const weightedSum = gradedExams.reduce((sum, e) => sum + e.grade * e.cfu, 0);
  const arithmeticSum = gradedExams.reduce((sum, e) => sum + e.grade, 0);

  const weightedAverage =
    totalGradedCFU > 0 ? Math.round((weightedSum / totalGradedCFU) * 100) / 100 : null;
  const arithmeticAverage =
    Math.round((arithmeticSum / gradedExams.length) * 100) / 100;

  const laureaBase =
    weightedAverage !== null ? Math.round(((weightedAverage * 110) / 30) * 100) / 100 : null;

  return {
    weightedAverage,
    arithmeticAverage,
    laureaBase,
    gradedExamsCount: gradedExams.length,
    totalGradedCFU,
    exams: gradedExams,
  };
}
