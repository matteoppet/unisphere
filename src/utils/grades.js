export function getExamResult(parts) {
  if (!parts || parts.length !== 2 || parts.some((part) => typeof part.grade !== 'number')) {
    return null;
  }
  const grades = parts.map((part) => part.grade);
  if (grades.some((grade) => grade < 18)) return null;
  return Math.round(((grades[0] + grades[1]) / 2) * 10) / 10;
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
