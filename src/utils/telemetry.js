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
    widgetDays: weekDays.slice(0, 7),
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

export function groupStudyLogsByWeek(studyLogs = []) {
  if (!Array.isArray(studyLogs) || studyLogs.length === 0) return [];

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

  function parseValidDate(dateStr) {
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

  const annotated = studyLogs.map((log, index) => {
    const parsedDate = parseValidDate(log?.date);
    return {
      log,
      index,
      parsedDate,
      dateKey: parsedDate ? log.date.trim() : '',
      timestamp: Number(log?.timestamp) || 0,
    };
  });

  annotated.sort((a, b) => {
    if (a.parsedDate && !b.parsedDate) return -1;
    if (!a.parsedDate && b.parsedDate) return 1;
    if (a.parsedDate && b.parsedDate) {
      if (a.dateKey !== b.dateKey) {
        return b.dateKey.localeCompare(a.dateKey);
      }
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
    }
    return a.index - b.index;
  });

  const groupsMap = new Map();

  for (const item of annotated) {
    const { log, parsedDate } = item;
    const mins = Number(log?.durationMinutes) || 0;

    if (!parsedDate) {
      let group = groupsMap.get('other');
      if (!group) {
        group = {
          weekKey: 'other',
          baseLabel: 'Other',
          totalMinutes: 0,
          logs: [],
        };
        groupsMap.set('other', group);
      }
      group.totalMinutes += mins;
      group.logs.push(log);
      continue;
    }

    const dayOfWeek = parsedDate.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate() + distanceToMonday
    );
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

    const weekKey = getLocalDateString(monday);
    let group = groupsMap.get(weekKey);
    if (!group) {
      const startFmt = `${monday.getDate()} ${monthNames[monday.getMonth()]}`;
      const endFmt = `${sunday.getDate()} ${monthNames[sunday.getMonth()]}`;
      group = {
        weekKey,
        baseLabel: `Week of ${startFmt} – ${endFmt}`,
        totalMinutes: 0,
        logs: [],
      };
      groupsMap.set(weekKey, group);
    }
    group.totalMinutes += mins;
    group.logs.push(log);
  }

  return Array.from(groupsMap.values()).map((g) => {
    const totalDuration = formatStudyDuration(g.totalMinutes);
    return {
      weekKey: g.weekKey,
      label: `${g.baseLabel} · ${totalDuration}`,
      totalMinutes: g.totalMinutes,
      totalDuration,
      logs: g.logs,
    };
  });
}

export function calculateTableScrollMaxHeight(
  viewportHeight,
  elementTop,
  viewportWidth = 1024,
  bottomOffset = 150
) {
  if (viewportWidth <= 720) {
    return 200;
  }
  const available = Math.floor(viewportHeight - elementTop - bottomOffset);
  return Math.max(180, available);
}

export function calculateDurationFromHoursMinutes(hours, minutes) {
  const h = Math.max(0, parseInt(hours, 10) || 0);
  const m = Math.max(0, parseInt(minutes, 10) || 0);
  const total = h * 60 + m;
  return Math.min(720, Math.max(0, total));
}

export function calculateDurationFromRange(startTimeStr, endTimeStr) {
  if (typeof startTimeStr !== 'string' || typeof endTimeStr !== 'string') return 0;
  const startMatch = /^(\d{1,2}):(\d{2})$/.exec(startTimeStr.trim());
  const endMatch = /^(\d{1,2}):(\d{2})$/.exec(endTimeStr.trim());
  if (!startMatch || !endMatch) return 0;

  const startH = parseInt(startMatch[1], 10);
  const startM = parseInt(startMatch[2], 10);
  const endH = parseInt(endMatch[1], 10);
  const endM = parseInt(endMatch[2], 10);

  if (startH < 0 || startH > 23 || startM < 0 || startM > 59) return 0;
  if (endH < 0 || endH > 23 || endM < 0 || endM > 59) return 0;

  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  let diff = endTotal - startTotal;
  if (diff < 0) {
    // Crosses midnight, e.g. 23:00 to 01:00
    diff += 24 * 60;
  }

  return Math.min(720, Math.max(0, diff));
}

export function addMinutesToTimeString(timeStr = '14:00', minutesToAdd = 0) {
  if (typeof timeStr !== 'string') return '14:00';
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return '14:00';
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return '14:00';

  const total = (h * 60 + m + (parseInt(minutesToAdd, 10) || 0)) % (24 * 60);
  const normalized = total < 0 ? total + 24 * 60 : total;
  const resH = String(Math.floor(normalized / 60)).padStart(2, '0');
  const resM = String(normalized % 60).padStart(2, '0');
  return `${resH}:${resM}`;
}




