export function calculateElo(minutesThisWeek = 0, tasksThisWeek = 0, streak = 0) {
  const base = 1000;
  const timeWeight = Math.round(minutesThisWeek * 1.4);
  const taskWeight = tasksThisWeek * 25;
  const streakWeight = Math.min(200, streak * 15);
  return base + timeWeight + taskWeight + streakWeight;
}

export function updateStreak(currentStreak = 0, lastActiveDate, referenceDate = new Date()) {
  const today = getLocalDateString(referenceDate);
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

  const todayStr = getLocalDateString(referenceDate);
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
      isFuture: dateStr > todayStr,
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

function parseValidLocalDate(dateStr) {
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

export function getWeekKeyForDate(dateStr) {
  const parsedDate = parseValidLocalDate(dateStr);
  if (!parsedDate) return null;
  const dayOfWeek = parsedDate.getDay();
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate() + distanceToMonday
  );
  return getLocalDateString(monday);
}

function formatShortWeekRange(monday, referenceYear) {
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
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const monYear = monday.getFullYear();
  const sunYear = sunday.getFullYear();
  const monMonth = monthNames[monday.getMonth()];
  const sunMonth = monthNames[sunday.getMonth()];

  if (monYear === sunYear && monday.getMonth() === sunday.getMonth()) {
    return monYear === referenceYear
      ? `${monday.getDate()}–${sunday.getDate()} ${monMonth}`
      : `${monday.getDate()}–${sunday.getDate()} ${monMonth} ${monYear}`;
  }
  if (monYear === sunYear) {
    return monYear === referenceYear
      ? `${monday.getDate()} ${monMonth} – ${sunday.getDate()} ${sunMonth}`
      : `${monday.getDate()} ${monMonth} – ${sunday.getDate()} ${sunMonth} ${sunYear}`;
  }
  return `${monday.getDate()} ${monMonth} ${monYear} – ${sunday.getDate()} ${sunMonth} ${sunYear}`;
}

export function getDashboardWeekView(
  studyLogs = [],
  selectedWeekKey = null,
  referenceDate = new Date()
) {
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

  const todayStr = getLocalDateString(referenceDate);
  const referenceYear = referenceDate.getFullYear();
  const currentMonday = getStartOfWeek(referenceDate);
  const currentWeekKey = getLocalDateString(currentMonday);
  const lastMonday = new Date(
    currentMonday.getFullYear(),
    currentMonday.getMonth(),
    currentMonday.getDate() - 7
  );
  const lastWeekKey = getLocalDateString(lastMonday);

  const weeksMap = new Map();
  weeksMap.set(currentWeekKey, {
    weekKey: currentWeekKey,
    monday: currentMonday,
    totalMinutes: 0,
    items: [],
  });

  const safeLogs = Array.isArray(studyLogs) ? studyLogs : [];
  for (let index = 0; index < safeLogs.length; index++) {
    const log = safeLogs[index];
    const parsedDate = parseValidLocalDate(log?.date);
    if (!parsedDate) continue;

    const dayOfWeek = parsedDate.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate() + distanceToMonday
    );
    const weekKey = getLocalDateString(monday);

    let entry = weeksMap.get(weekKey);
    if (!entry) {
      entry = {
        weekKey,
        monday,
        totalMinutes: 0,
        items: [],
      };
      weeksMap.set(weekKey, entry);
    }

    entry.totalMinutes += Number(log?.durationMinutes) || 0;
    entry.items.push({
      log,
      index,
      dateKey: log.date.trim(),
      timestamp: Number(log?.timestamp) || 0,
    });
  }

  const sortedEntries = Array.from(weeksMap.values()).sort((a, b) =>
    b.weekKey.localeCompare(a.weekKey)
  );

  const weeks = sortedEntries.map((entry) => {
    entry.items.sort((a, b) => {
      if (a.dateKey !== b.dateKey) {
        return b.dateKey.localeCompare(a.dateKey);
      }
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return a.index - b.index;
    });

    const totalDuration = formatStudyDuration(entry.totalMinutes);
    const shortRange = formatShortWeekRange(entry.monday, referenceYear);
    const isCurrentWeek = entry.weekKey === currentWeekKey;
    const isLastWeek = entry.weekKey === lastWeekKey;
    const prefix = isCurrentWeek ? 'This Week · ' : isLastWeek ? 'Last Week · ' : '';

    return {
      weekKey: entry.weekKey,
      monday: entry.monday,
      label: `${prefix}${shortRange} · ${totalDuration}`,
      totalMinutes: entry.totalMinutes,
      totalDuration,
      logs: entry.items.map((x) => x.log),
    };
  });

  let selectedIndex = selectedWeekKey
    ? weeks.findIndex((w) => w.weekKey === selectedWeekKey)
    : -1;
  if (selectedIndex === -1) {
    selectedIndex = weeks.findIndex((w) => w.weekKey === currentWeekKey);
    if (selectedIndex === -1) selectedIndex = 0;
  }

  const selected = weeks[selectedIndex];
  const prevWeekKey = selectedIndex < weeks.length - 1 ? weeks[selectedIndex + 1].weekKey : null;
  const nextWeekKey = selectedIndex > 0 ? weeks[selectedIndex - 1].weekKey : null;

  const widgetDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(
      selected.monday.getFullYear(),
      selected.monday.getMonth(),
      selected.monday.getDate() + i
    );
    const dateStr = getLocalDateString(d);
    const dayLogs = selected.logs.filter((l) => String(l?.date || '').trim() === dateStr);
    const minutes = dayLogs.reduce((sum, l) => sum + (Number(l?.durationMinutes) || 0), 0);
    const sessionCount = dayLogs.length;

    return {
      shortDay: dayNames[i],
      dateStr,
      formattedDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      hours: formatStudyDuration(minutes),
      minutes,
      sessionCount,
      hasSessions: sessionCount > 0,
      isFuture: dateStr > todayStr,
    };
  });

  return {
    weeks: weeks.map(({ monday: _m, ...rest }) => rest),
    selectedWeekKey: selected.weekKey,
    selectedIndex,
    currentWeekKey,
    prevWeekKey,
    nextWeekKey,
    widgetDays,
    weekTotalMinutes: selected.totalMinutes,
    totalDuration: selected.totalDuration,
    logs: selected.logs,
    totalLogCount: safeLogs.length,
  };
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
  const startMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(startTimeStr.trim());
  const endMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(endTimeStr.trim());
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
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(timeStr.trim());
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

export function calculateStreakFromLogs(studyLogs = [], referenceDate = new Date()) {
  if (!Array.isArray(studyLogs) || studyLogs.length === 0) {
    return 0;
  }

  const activeDates = new Set();
  for (const log of studyLogs) {
    if (log && Number(log.durationMinutes) > 0 && typeof log.date === 'string') {
      const trimmed = log.date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        activeDates.add(trimmed);
      }
    }
  }

  if (activeDates.size === 0) return 0;

  const todayStr = getLocalDateString(referenceDate);
  const yesterday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - 1
  );
  const yesterdayStr = getLocalDateString(yesterday);

  let cursorDate;
  if (activeDates.has(todayStr)) {
    cursorDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    );
  } else if (activeDates.has(yesterdayStr)) {
    cursorDate = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (true) {
    const dateStr = getLocalDateString(cursorDate);
    if (activeDates.has(dateStr)) {
      streak += 1;
      cursorDate.setDate(cursorDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function calculateCurrentStreak(
  studyLogs = [],
  profile = {},
  referenceDate = new Date()
) {
  const fromLogs = calculateStreakFromLogs(studyLogs, referenceDate);
  if (fromLogs > 0) {
    return fromLogs;
  }
  if (!Array.isArray(studyLogs) || studyLogs.length === 0) {
    const todayStr = getLocalDateString(referenceDate);
    const yesterday = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() - 1
    );
    const yesterdayStr = getLocalDateString(yesterday);
    if (profile?.lastActiveDate === todayStr || profile?.lastActiveDate === yesterdayStr) {
      return Math.max(1, Number(profile.currentStreak) || 1);
    }
  }
  return 0;
}

export function getStartOfWeek(referenceDate = new Date()) {
  const d = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const dayOfWeek = d.getDay();
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + distanceToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function countCompletedTasksThisWeek(assignments = [], referenceDate = new Date()) {
  if (!Array.isArray(assignments)) return 0;
  const startOfWeekMs = getStartOfWeek(referenceDate).getTime();

  return assignments.filter((a) => {
    if (a?.status !== 'completed') return false;
    const completedAt = Number(a.completedAt);
    if (!completedAt || isNaN(completedAt)) {
      return true;
    }
    return completedAt >= startOfWeekMs;
  }).length;
}

export function parseMemberTimestamp(val) {
  if (!val) return null;
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate();
    } catch {}
  }
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  return null;
}

export function getMemberEffectiveTelemetry(member = {}, referenceDate = new Date()) {
  const updatedDate =
    parseMemberTimestamp(member.updatedAt) || parseMemberTimestamp(member.joinedAt);

  const startOfWeek = getStartOfWeek(referenceDate);
  const startOfWeekStr = getLocalDateString(startOfWeek);

  const yesterday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - 1
  );
  const todayStr = getLocalDateString(referenceDate);
  const yesterdayStr = getLocalDateString(yesterday);

  let updatedDateStr = updatedDate ? getLocalDateString(updatedDate) : null;
  if (updatedDateStr && updatedDateStr > todayStr) {
    updatedDateStr = todayStr;
  }

  // Active in current week (Monday to Sunday)
  const isCurrentWeek = Boolean(updatedDateStr && updatedDateStr >= startOfWeekStr);

  // Active today or yesterday
  const isStreakActive = Boolean(
    updatedDateStr && (updatedDateStr === todayStr || updatedDateStr === yesterdayStr)
  );

  const minutesThisWeek = isCurrentWeek ? (Number(member.minutesThisWeek) || 0) : 0;
  const tasksThisWeek = isCurrentWeek ? (Number(member.tasksThisWeek) || 0) : 0;
  const currentStreak = isStreakActive ? (Number(member.currentStreak) || 0) : 0;
  const dailyMinutes =
    isCurrentWeek && member.dailyMinutes && typeof member.dailyMinutes === 'object'
      ? { ...member.dailyMinutes }
      : {};
  const subjectMinutes =
    isCurrentWeek && member.subjectMinutes && typeof member.subjectMinutes === 'object'
      ? { ...member.subjectMinutes }
      : {};

  const elo = (isCurrentWeek && isStreakActive && typeof member.elo === 'number')
    ? member.elo
    : calculateElo(minutesThisWeek, tasksThisWeek, currentStreak);

  return {
    ...member,
    minutesThisWeek,
    tasksThisWeek,
    currentStreak,
    dailyMinutes,
    subjectMinutes,
    elo,
    isCurrentWeek,
    isStreakActive,
  };
}

export function normalizeUserId(value = '') {
  const clean = String(value || '').trim().replace(/\//g, '_');
  if (!clean) return '';
  return clean.includes('@') ? clean.toLowerCase() : clean;
}

export function canManageSquad(squad, currentUid, extra = {}) {
  if (!squad || typeof squad !== 'object') return false;
  const creator = normalizeUserId(squad.createdBy || '');
  const candidates = [
    currentUid,
    extra?.authUid,
    extra?.studentId,
    extra?.email,
  ]
    .map((v) => normalizeUserId(v || ''))
    .filter(Boolean);

  if (creator && candidates.includes(creator)) {
    return true;
  }

  const creatorName = String(squad.creatorName || '').trim().toLowerCase();
  const displayName = String(extra?.displayName || '').trim().toLowerCase();
  if (creatorName && displayName && displayName !== 'student' && creatorName === displayName) {
    return true;
  }
  return false;
}

function isPreferredMemberRecord(candidate, existing) {
  const candIsEmailUid = String(candidate.uid || '').includes('@');
  const existIsEmailUid = String(existing.uid || '').includes('@');
  if (candIsEmailUid !== existIsEmailUid) return candIsEmailUid;

  const candMins = Number(candidate.minutesThisWeek) || 0;
  const existMins = Number(existing.minutesThisWeek) || 0;
  if (candMins !== existMins) return candMins > existMins;

  const candTime =
    (parseMemberTimestamp(candidate.updatedAt) || parseMemberTimestamp(candidate.joinedAt))?.getTime() || 0;
  const existTime =
    (parseMemberTimestamp(existing.updatedAt) || parseMemberTimestamp(existing.joinedAt))?.getTime() || 0;
  return candTime >= existTime;
}

export function deduplicateSquadMembers(rawMembers = [], identity = {}) {
  if (!Array.isArray(rawMembers)) {
    return { members: [], staleLegacyUids: [] };
  }

  const normMyUid = String(identity.myUid || '').trim().toLowerCase();
  const normMyName = String(identity.myDisplayName || '').trim().toLowerCase();
  const normAuthUid = String(identity.authUid || '').trim();
  const normStudentId = String(identity.studentId || '').trim().toLowerCase();
  const normMyEmail = String(identity.email || '').trim().toLowerCase();

  const staleSet = new Set();
  let selfRecord = null;
  const othersByKey = new Map();

  for (const m of rawMembers) {
    if (!m || !m.uid) continue;
    const rawUid = String(m.uid).trim();
    const normUid = rawUid.toLowerCase();
    const normEmail = String(m.email || '').trim().toLowerCase();
    const normName = String(m.displayName || '').trim().toLowerCase();

    const isSelf =
      (normMyUid && (normUid === normMyUid || (normEmail && normEmail === normMyUid))) ||
      (normMyEmail && (normUid === normMyEmail || (normEmail && normEmail === normMyEmail))) ||
      (normAuthUid && rawUid === normAuthUid) ||
      (normStudentId && normUid === normStudentId) ||
      (normMyName && normMyName !== 'student' && normName === normMyName);

    if (isSelf) {
      if (normMyUid && normUid !== normMyUid) {
        staleSet.add(rawUid);
      }
      if (!selfRecord || isPreferredMemberRecord(m, selfRecord)) {
        selfRecord = { ...m, uid: identity.myUid || rawUid };
      }
      continue;
    }

    const dedupeKey =
      normEmail ||
      (normName && normName !== 'student' ? `name:${normName}` : `uid:${normUid}`);

    const existing = othersByKey.get(dedupeKey);
    if (!existing) {
      othersByKey.set(dedupeKey, m);
    } else if (isPreferredMemberRecord(m, existing)) {
      if (existing.uid && existing.uid !== m.uid) {
        staleSet.add(String(existing.uid).trim());
      }
      othersByKey.set(dedupeKey, m);
    } else if (m.uid && m.uid !== existing.uid) {
      staleSet.add(rawUid);
    }
  }

  const members = [
    ...(selfRecord ? [selfRecord] : []),
    ...Array.from(othersByKey.values()),
  ];

  return {
    members,
    staleLegacyUids: Array.from(staleSet),
  };
}

export function getWeeklyDailyMinutesMap(studyLogs = [], referenceDate = new Date()) {
  const { weekDays } = getWeekDaysSummary(studyLogs, referenceDate);
  const out = {};
  for (const d of weekDays) {
    out[d.dateStr] = d.minutes;
  }
  return out;
}

export function getWeeklySubjectMinutesMap(studyLogs = [], referenceDate = new Date()) {
  if (!Array.isArray(studyLogs) || studyLogs.length === 0) return {};
  const { weekDays } = getWeekDaysSummary([], referenceDate);
  const validDates = new Set(weekDays.map((d) => d.dateStr));
  const out = {};
  for (const log of studyLogs) {
    if (!log || !validDates.has(log.date)) continue;
    const mins = Number(log.durationMinutes) || 0;
    if (mins <= 0) continue;
    const subj = String(log.courseName || 'General Study').trim() || 'General Study';
    out[subj] = (out[subj] || 0) + mins;
  }
  return out;
}

export function getMemberWeekDaysSummary(member = {}, referenceDate = new Date()) {
  const effective = getMemberEffectiveTelemetry(member, referenceDate);
  const { weekDays: baseDays } = getWeekDaysSummary([], referenceDate);
  const dailyMap = effective.dailyMinutes || {};

  const weekDays = baseDays.map((d) => {
    const mins = Math.max(0, Number(dailyMap[d.dateStr]) || 0);
    return {
      shortDay: d.shortDay,
      dateStr: d.dateStr,
      formattedDate: d.formattedDate,
      minutes: mins,
      hours: formatStudyDuration(mins),
      hasSessions: mins > 0,
      isFuture: d.isFuture,
    };
  });

  const sumFromDays = weekDays.reduce((s, d) => s + d.minutes, 0);
  const totalMinutes = sumFromDays > 0 ? sumFromDays : (Number(effective.minutesThisWeek) || 0);

  const rawSubj = effective.subjectMinutes || {};
  const subjects = Object.entries(rawSubj)
    .map(([subject, mins]) => ({
      subject: String(subject).trim(),
      minutes: Math.max(0, Number(mins) || 0),
      hours: formatStudyDuration(Math.max(0, Number(mins) || 0)),
    }))
    .filter((s) => s.subject && s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject));

  return {
    weekDays,
    totalMinutes,
    totalHours: formatStudyDuration(totalMinutes),
    subjects,
  };
}

export function aggregateSquadWeeklyDays(members = [], referenceDate = new Date()) {
  const { weekDays: baseDays } = getWeekDaysSummary([], referenceDate);
  const totalsByDate = {};
  for (const d of baseDays) {
    totalsByDate[d.dateStr] = 0;
  }

  if (Array.isArray(members)) {
    for (const m of members) {
      if (!m) continue;
      const effective = getMemberEffectiveTelemetry(m, referenceDate);
      const daily = effective.dailyMinutes || {};
      for (const d of baseDays) {
        totalsByDate[d.dateStr] += Math.max(0, Number(daily[d.dateStr]) || 0);
      }
    }
  }

  return baseDays.map((d) => {
    const mins = totalsByDate[d.dateStr] || 0;
    return {
      shortDay: d.shortDay,
      dateStr: d.dateStr,
      formattedDate: d.formattedDate,
      minutes: mins,
      hours: formatStudyDuration(mins),
      hasSessions: mins > 0,
      isFuture: d.isFuture,
    };
  });
}

export function aggregateSquadSubjectHours(members = [], referenceDate = new Date()) {
  const subjTotals = {};
  if (Array.isArray(members)) {
    for (const m of members) {
      if (!m) continue;
      const effective = getMemberEffectiveTelemetry(m, referenceDate);
      const subjMap = effective.subjectMinutes || {};
      for (const [subj, mins] of Object.entries(subjMap)) {
        const cleanSubj = String(subj || '').trim();
        const numMins = Math.max(0, Number(mins) || 0);
        if (!cleanSubj || numMins <= 0) continue;
        subjTotals[cleanSubj] = (subjTotals[cleanSubj] || 0) + numMins;
      }
    }
  }

  return Object.entries(subjTotals)
    .map(([subject, minutes]) => ({
      subject,
      minutes,
      hours: formatStudyDuration(minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject));
}

export function formatLiveElapsed(startedAt, nowMs = Date.now()) {
  const parsed = parseMemberTimestamp(startedAt);
  if (!parsed) {
    return { elapsedMinutes: 0, formatted: '0m' };
  }
  const diffMs = Math.max(0, nowMs - parsed.getTime());
  const elapsedMinutes = Math.max(1, Math.floor(diffMs / 60000));
  return {
    elapsedMinutes,
    formatted: formatStudyDuration(elapsedMinutes),
  };
}

export function sortSquadMembers(members = [], sortBy = 'hours') {
  if (!Array.isArray(members)) return [];
  const copy = [...members];
  if (sortBy === 'streak') {
    return copy.sort(
      (a, b) =>
        (Number(b.currentStreak) || 0) - (Number(a.currentStreak) || 0) ||
        (Number(b.minutesThisWeek) || 0) - (Number(a.minutesThisWeek) || 0) ||
        String(a.displayName || '').localeCompare(String(b.displayName || ''))
    );
  }
  if (sortBy === 'name') {
    return copy.sort((a, b) =>
      String(a.displayName || '').localeCompare(String(b.displayName || ''))
    );
  }
  return copy.sort(
    (a, b) =>
      (Number(b.minutesThisWeek) || 0) - (Number(a.minutesThisWeek) || 0) ||
      (Number(b.currentStreak) || 0) - (Number(a.currentStreak) || 0) ||
      String(a.displayName || '').localeCompare(String(b.displayName || ''))
  );
}

/**
 * Determines whether the current user has been removed from the given squad by an admin
 * so their browser session can immediately evict them from the squad view.
 */
export function isCurrentUserRemovedFromSquad(
  squad,
  members = [],
  activities = [],
  identity = {}
) {
  if (!squad || !identity) return false;
  if (
    canManageSquad(squad, identity.myUid, {
      authUid: identity.authUid,
      studentId: identity.studentId,
      email: identity.email,
      displayName: identity.myDisplayName,
    })
  ) {
    return false;
  }

  const candidateUids = new Set(
    [identity.myUid, identity.authUid, identity.studentId, identity.email]
      .filter(Boolean)
      .map((u) => normalizeUserId(u))
  );
  const myNormName = String(identity.myDisplayName || '').trim().toLowerCase();

  const myMemberDoc = Array.isArray(members)
    ? members.find((m) => m && m.uid && candidateUids.has(normalizeUserId(m.uid)))
    : null;
  const joinedAtMs = myMemberDoc?.joinedAt ? Date.parse(String(myMemberDoc.joinedAt)) || 0 : 0;

  let latestRemovedAtMs = 0;
  let latestRejoinedAtMs = 0;

  if (Array.isArray(activities)) {
    for (const act of activities) {
      if (!act) continue;
      const actUid = normalizeUserId(act.uid || '');
      const actName = String(act.displayName || '').trim().toLowerCase();
      const matchesUser =
        (actUid && candidateUids.has(actUid)) ||
        (myNormName && actName && actName !== 'removed member' && actName === myNormName);
      if (!matchesUser) continue;

      const ts = Date.parse(String(act.updatedAt || act.createdAt || '')) || 1;
      if (act.type === 'member_removed' && act.status === 'removed') {
        latestRemovedAtMs = Math.max(latestRemovedAtMs, ts);
      } else if (act.type === 'member_rejoined') {
        latestRejoinedAtMs = Math.max(latestRejoinedAtMs, ts);
      }
    }
  }

  if (
    latestRemovedAtMs > 0 &&
    latestRemovedAtMs >= joinedAtMs &&
    latestRemovedAtMs >= latestRejoinedAtMs
  ) {
    return true;
  }

  return false;
}

/**
 * Builds a canonical, order-independent document ID for a friendship between two users (#44).
 * Uses ASCII comparison (`<`) matching Firestore security rules and permits up to 512 chars.
 * Returns '' if either ID is empty, if both IDs match, or if combined length exceeds 512.
 */
export function getFriendshipId(uidA, uidB) {
  const normA = normalizeUserId(uidA);
  const normB = normalizeUserId(uidB);
  if (!normA || !normB || normA === normB) return '';
  const combined = normA < normB ? `${normA}__${normB}` : `${normB}__${normA}`;
  return combined.length <= 512 ? combined : '';
}

function formatReadableFallbackName(uidOrEmail = '') {
  const raw = String(uidOrEmail || '').trim();
  if (!raw) return 'Student';
  const localPart = raw.includes('@') ? raw.split('@')[0] : raw;
  const words = localPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'Student';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Checks whether a friendship record involves `myUid` or `myDisplayName` (#44).
 */
export function doesFriendshipMatchUser(item, myUid = '', myDisplayName = '') {
  if (!item || typeof item !== 'object') return false;
  const normMe = normalizeUserId(myUid);
  const normMyName = String(myDisplayName || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '_');
  const myEmailPrefix = normMe.includes('@') ? normMe.split('@')[0] : '';

  const reqUid = normalizeUserId(item.requesterUid || item.requesterEmail || '');
  const recUid = normalizeUserId(item.recipientUid || item.recipientEmail || '');
  const recName = String(item.recipientName || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '_');

  if (normMe) {
    if (reqUid === normMe || recUid === normMe) return true;
    if (
      Array.isArray(item.users) &&
      item.users.some((u) => normalizeUserId(u) === normMe)
    ) {
      return true;
    }
    if (myEmailPrefix && !recUid.includes('@') && recUid.toLowerCase() === myEmailPrefix) {
      return true;
    }
  }

  if (normMyName && normMyName !== 'student' && normMyName !== 'local_student') {
    if (!recUid.includes('@') && (recUid.toLowerCase() === normMyName || recName === normMyName)) {
      return true;
    }
  }

  return false;
}

/**
 * Classifies friendship records for `myUid` into acceptedFriends, incomingRequests, and outgoingRequests (#44).
 */
export function partitionFriendships(friendships = [], myUid = '', myDisplayName = '') {
  const normMe = normalizeUserId(myUid);
  const normMyName = String(myDisplayName || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '_');
  const myEmailPrefix = normMe.includes('@') ? normMe.split('@')[0] : '';
  const acceptedFriends = [];
  const incomingRequests = [];
  const outgoingRequests = [];

  if (!Array.isArray(friendships) || (!normMe && !normMyName)) {
    return { acceptedFriends, incomingRequests, outgoingRequests };
  }

  const seenFriendUids = new Set();

  for (const item of friendships) {
    if (!item || typeof item !== 'object') continue;
    const status = String(item.status || 'pending').trim().toLowerCase();
    if (status === 'removed' || status === 'declined') continue;

    const reqUid = normalizeUserId(item.requesterUid || item.requesterEmail || '');
    const recUid = normalizeUserId(item.recipientUid || item.recipientEmail || '');
    const recNameNorm = String(item.recipientName || '')
      .trim()
      .toLowerCase()
      .replace(/\//g, '_');
    if (!reqUid || !recUid || reqUid === recUid) continue;

    const isRequester = Boolean(normMe && reqUid === normMe);
    const isRecipient = Boolean(
      (normMe && recUid === normMe) ||
        (myEmailPrefix && !recUid.includes('@') && recUid.toLowerCase() === myEmailPrefix) ||
        (normMyName &&
          normMyName !== 'student' &&
          normMyName !== 'local_student' &&
          !recUid.includes('@') &&
          (recUid.toLowerCase() === normMyName || recNameNorm === normMyName))
    );
    if (!isRequester && !isRecipient) continue;

    const friendUid = isRequester ? recUid : reqUid;
    if (seenFriendUids.has(friendUid)) continue;
    seenFriendUids.add(friendUid);

    const friendEmail = isRequester
      ? String(item.recipientEmail || friendUid).trim()
      : String(item.requesterEmail || friendUid).trim();
    const rawDisplayName = isRequester ? item.recipientName : item.requesterName;
    const displayName =
      String(rawDisplayName || '').trim() || formatReadableFallbackName(friendEmail || friendUid);
    const friendshipId = item.id || getFriendshipId(reqUid, recUid);

    const normalizedEntry = {
      friendshipId,
      uid: friendUid,
      email: friendEmail || friendUid,
      displayName,
      status: status === 'accepted' ? 'accepted' : 'pending',
      direction: isRequester ? 'outgoing' : 'incoming',
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || item.createdAt || null,
    };

    if (status === 'accepted') {
      acceptedFriends.push(normalizedEntry);
    } else if (isRecipient) {
      incomingRequests.push(normalizedEntry);
    } else {
      outgoingRequests.push(normalizedEntry);
    }
  }

  acceptedFriends.sort((a, b) => a.displayName.localeCompare(b.displayName));
  incomingRequests.sort((a, b) => a.displayName.localeCompare(b.displayName));
  outgoingRequests.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    acceptedFriends,
    incomingRequests,
    outgoingRequests,
  };
}

/**
 * Filters a list of friends or requests by search query against displayName, email, or uid (#44).
 */
export function filterFriendsByQuery(friends = [], queryStr = '') {
  if (!Array.isArray(friends)) return [];
  const q = String(queryStr || '').trim().toLowerCase();
  if (!q) return [...friends];
  return friends.filter((f) => {
    if (!f) return false;
    const name = String(f.displayName || '').toLowerCase();
    const email = String(f.email || '').toLowerCase();
    const uid = String(f.uid || '').toLowerCase();
    return name.includes(q) || email.includes(q) || uid.includes(q);
  });
}

/**
 * Builds a privacy-safe telemetry & profile summary for a selected friend (#44).
 * Strips grades, personal notes, and sensitive fields while computing current-week 7-day study stats.
 */
export function buildFriendTelemetrySummary(
  userDocData = {},
  fallbackFriend = {},
  referenceDate = new Date()
) {
  const safeDoc = userDocData && typeof userDocData === 'object' ? userDocData : {};
  const safeFallback = fallbackFriend && typeof fallbackFriend === 'object' ? fallbackFriend : {};

  const uid = normalizeUserId(safeDoc.uid || safeFallback.uid || safeDoc.email || '');
  const email = String(safeDoc.email || safeFallback.email || '').trim().toLowerCase();
  const displayName =
    String(safeDoc.name || safeDoc.displayName || safeFallback.displayName || '').trim() ||
    formatReadableFallbackName(email || uid);

  const studyLogs = Array.isArray(safeDoc.studyLogs) ? safeDoc.studyLogs : null;
  const weeklyGoalHours = Math.max(1, Number(safeDoc.weeklyGoalHours) || 20);

  let weekDays = [];
  let weekTotalMinutes = 0;
  let subjects = [];
  let currentStreak = 0;
  let tasksCompletedThisWeek = 0;

  if (studyLogs) {
    const weekSummary = getWeekDaysSummary(studyLogs, referenceDate);
    weekDays = weekSummary.weekDays;
    weekTotalMinutes = weekSummary.weekTotalMinutes;

    const subjMap = getWeeklySubjectMinutesMap(studyLogs, referenceDate);
    subjects = Object.entries(subjMap)
      .map(([subject, minutes]) => ({
        subject: String(subject).trim(),
        minutes: Math.max(0, Number(minutes) || 0),
        hours: formatStudyDuration(Math.max(0, Number(minutes) || 0)),
      }))
      .filter((s) => s.subject && s.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject));

    currentStreak = calculateCurrentStreak(studyLogs, safeDoc, referenceDate);
    tasksCompletedThisWeek = Array.isArray(safeDoc.assignments)
      ? countCompletedTasksThisWeek(safeDoc.assignments, referenceDate)
      : 0;
  } else {
    const calendar = getMemberWeekDaysSummary(
      {
        ...safeFallback,
        ...safeDoc,
        minutesThisWeek:
          safeDoc.minutesThisWeek ?? safeDoc.minutesStudiedThisWeek ?? safeFallback.minutesThisWeek ?? 0,
      },
      referenceDate
    );
    weekDays = calendar.weekDays;
    weekTotalMinutes = calendar.totalMinutes;
    subjects = calendar.subjects;
    const effective = getMemberEffectiveTelemetry(
      {
        ...safeFallback,
        ...safeDoc,
        minutesThisWeek: weekTotalMinutes,
        tasksThisWeek:
          safeDoc.tasksThisWeek ?? safeDoc.tasksCompletedThisWeek ?? safeFallback.tasksThisWeek ?? 0,
      },
      referenceDate
    );
    currentStreak = effective.currentStreak;
    tasksCompletedThisWeek = effective.tasksThisWeek;
  }

  const focusSummary = calculateWeeklyFocus(weekTotalMinutes, weeklyGoalHours, referenceDate);
  const elo = calculateElo(weekTotalMinutes, tasksCompletedThisWeek, currentStreak);

  const rawCourses = Array.isArray(safeDoc.courses) ? safeDoc.courses : [];
  const courses = rawCourses
    .filter((c) => c && typeof c === 'object' && String(c.title || '').trim())
    .map((c) => ({
      id: String(c.id || ''),
      title: String(c.title || '').trim(),
      code: String(c.code || '').trim(),
      semester: String(c.semester || '').trim(),
      status: String(c.status || 'Active').trim(),
    }));

  return {
    uid,
    displayName,
    email,
    institution: String(safeDoc.institution || '').trim(),
    degreeName: String(safeDoc.degreeName || '').trim(),
    degreeType: String(safeDoc.degreeType || '').trim(),
    academicYear: String(safeDoc.academicYear || '').trim(),
    status: String(safeDoc.status || 'Enrolled').trim(),
    weeklyGoalHours,
    weekTotalMinutes,
    weekTotalHours: formatStudyDuration(weekTotalMinutes),
    weeklyGoalPercent: focusSummary.weeklyGoalPercent,
    currentStreak,
    tasksCompletedThisWeek,
    xp: Math.max(0, Number(safeDoc.xp) || 0),
    elo,
    weekDays,
    subjects,
    courses,
  };
}

/**
 * Builds the grade-free `/friendProfiles/{uid}` projection shared only with accepted friends.
 */
export function buildFriendProfilePayload({
  uid,
  profile = {},
  courses = [],
  studyLogs = [],
  assignments = [],
  referenceDate = new Date(),
} = {}) {
  const cleanUid = normalizeUserId(uid || profile?.uid || '');
  const safeProfile = profile && typeof profile === 'object' ? profile : {};
  const displayName =
    String(safeProfile.name || safeProfile.displayName || '').trim() || 'Student';
  const weekTotalMinutes = Math.min(
    10080,
    Math.max(0, getWeekDaysSummary(studyLogs, referenceDate).weekTotalMinutes)
  );
  const currentStreak = Math.min(10000, Math.max(0, calculateCurrentStreak(studyLogs, safeProfile, referenceDate)));
  const tasksThisWeek = Math.min(10000, Math.max(0, countCompletedTasksThisWeek(assignments, referenceDate)));
  const dailyMinutes = getWeeklyDailyMinutesMap(studyLogs, referenceDate);
  const subjectMinutes = getWeeklySubjectMinutesMap(studyLogs, referenceDate);
  const gradeFreeCourses = (Array.isArray(courses) ? courses : [])
    .filter((c) => c && typeof c === 'object' && String(c.title || '').trim())
    .slice(0, 120)
    .map((c) => ({
      id: String(c.id || '').slice(0, 80),
      title: String(c.title || '').trim().slice(0, 120),
      code: String(c.code || '').trim().slice(0, 40),
      semester: String(c.semester || '').trim().slice(0, 60),
      status: String(c.status || 'Active').trim().slice(0, 40),
    }));

  return {
    uid: cleanUid,
    name: displayName.slice(0, 100),
    displayName: displayName.slice(0, 100),
    institution: String(safeProfile.institution || '').trim().slice(0, 120),
    degreeName: String(safeProfile.degreeName || '').trim().slice(0, 120),
    degreeType: String(safeProfile.degreeType || '').trim().slice(0, 80),
    academicYear: String(safeProfile.academicYear || '').trim().slice(0, 60),
    status: String(safeProfile.status || 'Enrolled').trim().slice(0, 40),
    weeklyGoalHours: Math.min(168, Math.max(1, Number(safeProfile.weeklyGoalHours) || 20)),
    minutesThisWeek: weekTotalMinutes,
    tasksThisWeek,
    currentStreak,
    xp: Math.max(0, Number(safeProfile.xp) || 0),
    dailyMinutes,
    subjectMinutes,
    courses: gradeFreeCourses,
    updatedAt: referenceDate instanceof Date ? referenceDate.toISOString() : new Date().toISOString(),
  };
}







