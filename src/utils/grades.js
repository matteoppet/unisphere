export function getExamResult(parts) {
  if (!parts || parts.length !== 2 || parts.some((part) => typeof part.grade !== 'number')) {
    return null;
  }
  const grades = parts.map((part) => part.grade);
  if (grades.some((grade) => grade < 18)) return null;
  return Math.round(((grades[0] + grades[1]) / 2) * 10) / 10;
}

const EXAM_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseLocalDateOnly(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, monthIdx, day);
  if (d.getFullYear() !== year || d.getMonth() !== monthIdx || d.getDate() !== day) {
    return null;
  }
  return d;
}

function clampExamGradeValue(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = typeof val === 'number' ? val : Number(String(val).trim());
  if (!Number.isFinite(num)) return null;
  return Math.round(Math.min(30, Math.max(0, num)) * 10) / 10;
}

/**
 * Formats an ISO YYYY-MM-DD date into readable day-month-year form (e.g. "12 November 2026").
 */
export function formatExamDate(dateStr) {
  if (!dateStr) return '-';
  const parsed = parseLocalDateOnly(String(dateStr));
  if (!parsed) return String(dateStr);
  return `${parsed.getDate()} ${EXAM_MONTH_NAMES[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

/**
 * Normalizes legacy assignment types into the three table types: Exam, Midterm, or Assignment.
 */
export function normalizeAssignmentType(type) {
  if (type === 'Midterm') return 'Midterm';
  if (type === 'Assignment' || type === 'Project' || type === 'Reading') return 'Assignment';
  return 'Exam';
}

/**
 * Computes the display grade, Italian pass/fail state (>= 18 pass, < 18 fail), and partial details.
 */
export function getAssignmentDisplayGrade(item = {}) {
  const normalizedType = normalizeAssignmentType(item?.type);
  const parts = Array.isArray(item?.examParts) ? item.examParts : [];
  const isMidtermOrSplit = normalizedType === 'Midterm' || parts.length > 0;

  if (isMidtermOrSplit && parts.length > 0) {
    const g1 = clampExamGradeValue(parts[0]?.grade);
    const g2 = clampExamGradeValue(parts[1]?.grade);
    const partsText = `E1: ${g1 !== null ? g1 : '-'} · E2: ${g2 !== null ? g2 : '-'}`;

    if (g1 !== null && g2 !== null) {
      const avg = Math.round(((g1 + g2) / 2) * 10) / 10;
      return {
        value: avg,
        text: `${avg} / 30`,
        isPass: avg >= 18,
        isFail: avg < 18,
        isPending: false,
        partsText,
      };
    }

    return {
      value: null,
      text: '-',
      isPass: false,
      isFail: false,
      isPending: true,
      partsText,
    };
  }

  const singleGrade = clampExamGradeValue(item?.grade);
  if (singleGrade !== null) {
    return {
      value: singleGrade,
      text: `${singleGrade} / 30`,
      isPass: singleGrade >= 18,
      isFail: singleGrade < 18,
      isPending: false,
      partsText: '',
    };
  }

  return {
    value: null,
    text: '-',
    isPass: false,
    isFail: false,
    isPending: true,
    partsText: '',
  };
}

/**
 * Classifies an exam/assignment row's urgency color from normal -> yellow -> red as due date nears,
 * or green when completed.
 */
export function getExamUrgencyState(item = {}, referenceDate = new Date()) {
  if (item?.status === 'completed') {
    return {
      level: 'completed',
      rowClass: 'exam-row-completed',
      daysUntil: null,
      hint: 'Completed',
    };
  }

  const due = parseLocalDateOnly(item?.dueDate);
  if (!due) {
    return {
      level: 'normal',
      rowClass: 'exam-row-normal',
      daysUntil: null,
      hint: '',
    };
  }

  const todayMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const daysUntil = Math.round((due.getTime() - todayMidnight.getTime()) / 86400000);

  if (daysUntil <= 3) {
    let hint = `in ${daysUntil}d`;
    if (daysUntil < 0) hint = `Overdue (${Math.abs(daysUntil)}d)`;
    else if (daysUntil === 0) hint = 'Today';
    else if (daysUntil === 1) hint = 'Tomorrow';

    return {
      level: 'red',
      rowClass: 'exam-row-urgent-red',
      daysUntil,
      hint,
    };
  }

  if (daysUntil <= 10) {
    return {
      level: 'yellow',
      rowClass: 'exam-row-urgent-yellow',
      daysUntil,
      hint: `in ${daysUntil}d`,
    };
  }

  return {
    level: 'normal',
    rowClass: 'exam-row-normal',
    daysUntil,
    hint: `in ${daysUntil}d`,
  };
}

/**
 * Sorts items so approaching incomplete items appear at the top (closest date first)
 * and completed items stay at the bottom.
 */
export function sortAssignmentsForTable(items = [], referenceDate = new Date()) {
  if (!Array.isArray(items)) return [];

  return [...items].sort((a, b) => {
    const aDone = a?.status === 'completed';
    const bDone = b?.status === 'completed';
    if (aDone !== bDone) return aDone ? 1 : -1;

    const aUrgency = getExamUrgencyState(a, referenceDate);
    const bUrgency = getExamUrgencyState(b, referenceDate);

    if (!aDone) {
      const aHasDays = typeof aUrgency.daysUntil === 'number';
      const bHasDays = typeof bUrgency.daysUntil === 'number';
      if (aHasDays !== bHasDays) return aHasDays ? -1 : 1;
      if (aHasDays && bHasDays && aUrgency.daysUntil !== bUrgency.daysUntil) {
        return aUrgency.daysUntil - bUrgency.daysUntil;
      }
    } else {
      const aDue = parseLocalDateOnly(a?.dueDate)?.getTime() ?? -Infinity;
      const bDue = parseLocalDateOnly(b?.dueDate)?.getTime() ?? -Infinity;
      if (aDue !== bDue) return bDue - aDue;
      const aCompletedAt = Number(a?.completedAt) || 0;
      const bCompletedAt = Number(b?.completedAt) || 0;
      if (aCompletedAt !== bCompletedAt) return bCompletedAt - aCompletedAt;
    }

    const courseCmp = String(a?.courseName || '').localeCompare(String(b?.courseName || ''));
    if (courseCmp !== 0) return courseCmp;
    const typeCmp = String(a?.type || '').localeCompare(String(b?.type || ''));
    if (typeCmp !== 0) return typeCmp;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

export function isExamType(type) {
  return ['Midterm', 'Exam', 'Final', 'Oral'].includes(type);
}

export function getItemExamGrade(item) {
  if (item.examParts && item.examParts.length === 2) {
    return getExamResult(item.examParts);
  }
  if (typeof item.grade === 'number' && !Number.isNaN(item.grade) && item.grade >= 18) {
    return Math.min(30, Math.max(18, item.grade));
  }
  return null;
}

export function calculateMediaGrades(assignments = [], courses = []) {
  const gradedExams = [];

  for (const item of assignments) {
    const grade = getItemExamGrade(item);
    if (grade === null) continue;

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
  const arithmeticAverage = Math.round((arithmeticSum / gradedExams.length) * 100) / 100;

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
