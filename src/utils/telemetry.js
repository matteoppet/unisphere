export function calculateElo(minutesThisWeek = 0, tasksThisWeek = 0, streak = 0) {
  const base = 1000;
  const timeWeight = Math.round(minutesThisWeek * 1.4);
  const taskWeight = tasksThisWeek * 25;
  const streakWeight = Math.min(200, streak * 15);
  return base + timeWeight + taskWeight + streakWeight;
}

export function updateStreak(currentStreak = 0, lastActiveDate) {
  const today = new Date().toISOString().split('T')[0];
  if (!lastActiveDate) {
    return { streak: 1, today };
  }
  if (lastActiveDate === today) {
    return { streak: Math.max(1, currentStreak), today };
  }

  const lastDate = new Date(lastActiveDate);
  const now = new Date(today);
  const diffTime = Math.abs(now.getTime() - lastDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return { streak: currentStreak + 1, today };
  } else if (diffDays > 1) {
    return { streak: 1, today };
  }
  return { streak: currentStreak, today };
}

export function generateSquadCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getLocalDateString(d = new Date()) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export function formatStudyDuration(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0h';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

export function getWeekDaysSummary(studyLogs = [], referenceDate = new Date()) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const todayYear = referenceDate.getFullYear();
  const todayMonth = referenceDate.getMonth();
  const todayDate = referenceDate.getDate();
  const dayOfWeek = referenceDate.getDay();
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayYear, todayMonth, todayDate + distanceToMonday + i);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yr}-${mo}-${da}`;

    const dayLogs = studyLogs.filter((l) => l.date === dateStr);
    const dayMins = dayLogs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
    const sessionCount = dayLogs.length;

    return {
      shortDay: dayNames[i],
      dateStr,
      formattedDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      hours: formatStudyDuration(dayMins),
      minutes: dayMins,
      sessionCount,
      hasSessions: sessionCount > 0,
    };
  });

  const weekTotalMinutes = weekDays.reduce((sum, d) => sum + d.minutes, 0);
  const weekTotalSessions = weekDays.reduce((sum, d) => sum + d.sessionCount, 0);
  const activeDaysCount = weekDays.filter((d) => d.hasSessions).length;

  return {
    weekDays,
    weekTotalMinutes,
    weekTotalSessions,
    activeDaysCount,
  };
}

export function calculateWeeklyFocus(
  studyLogsOrMinutes,
  weeklyGoalHours = 20,
  referenceDate = new Date()
) {
  const weeklyMinutes =
    typeof studyLogsOrMinutes === 'number'
      ? studyLogsOrMinutes
      : getWeekDaysSummary(studyLogsOrMinutes, referenceDate).weekTotalMinutes;
  const weeklyHours = (weeklyMinutes / 60).toFixed(1).replace(/\.0$/, '');
  const weeklyDuration = formatStudyDuration(weeklyMinutes);
  const goal = weeklyGoalHours > 0 ? weeklyGoalHours : 20;
  const goalMinutes = goal * 60;
  const remainingMinutes = Math.max(0, goalMinutes - weeklyMinutes);
  const remainingDuration = formatStudyDuration(remainingMinutes);
  const weeklyGoalPercent = Math.min(100, Math.round((weeklyMinutes / goalMinutes) * 100));

  return {
    weeklyMinutes,
    weeklyHours,
    weeklyDuration,
    weeklyGoalPercent,
    remainingMinutes,
    remainingDuration,
  };
}
