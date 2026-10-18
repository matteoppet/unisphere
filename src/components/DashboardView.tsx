import React, { useState, useEffect } from 'react';
import {
  Course,
  StudyLog,
  StudentProfile,
  AssignmentItem,
} from '../types';
import { QuickNotesSection } from './QuickNotesSection';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { playClickBeep, playFuturisticChime } from '../utils/audio';
import { fireTaskConfetti, fireCelebrationConfetti } from '../utils/confetti';
import { getPowerBorderClass, getPowerBarFillClass } from '../utils/telemetry';
import { NewAssignmentModal, NewStudyLogModal } from './Modals';
import { X } from 'lucide-react';

interface DashboardViewProps {
  profile: StudentProfile;
  courses: Course[];
  studyLogs: StudyLog[];
  assignments?: AssignmentItem[];
  quickNotes?: string;
  onUpdateQuickNotes?: (notes: string) => void;
  onAddStudyLog: (log: Omit<StudyLog, 'id' | 'timestamp'>) => void;
  onOpenCourseDetail: (course: Course) => void;
  onOpenColumnsModal: () => void;
  onOpenEmailGroup: () => void;
  onNavigateToCurriculum: () => void;
  onOpenNewCourse?: () => void;
  onAddAssignment?: (asg: Omit<AssignmentItem, 'id'>) => void;
  onNavigateToAssignments?: () => void;
  onUpdateAssignmentStatus?: (id: string, status: AssignmentItem['status']) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  courses,
  studyLogs,
  assignments = [],
  quickNotes = '',
  onUpdateQuickNotes,
  onAddStudyLog,
  onOpenCourseDetail,
  onOpenColumnsModal,
  onOpenEmailGroup,
  onNavigateToCurriculum,
  onOpenNewCourse,
  onAddAssignment,
  onNavigateToAssignments,
  onUpdateAssignmentStatus,
}) => {
  // Local fallback if not passed by parent
  const [localNotes, setLocalNotes] = useState(quickNotes);
  const currentNotes = onUpdateQuickNotes ? quickNotes : localNotes;
  const handleUpdateNotes = (newNotes: string) => {
    if (onUpdateQuickNotes) {
      onUpdateQuickNotes(newNotes);
    } else {
      setLocalNotes(newNotes);
    }
  };
  // Study session form states
  const [selectedCourse, setSelectedCourse] = useState(
    courses.find((c) => c.status === 'active')?.title || courses[0]?.title || ''
  );
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [notes, setNotes] = useState('');
  const [sessionJustAdded, setSessionJustAdded] = useState(false);
  const [copiedMatricola, setCopiedMatricola] = useState(false);
  const [dismissedBannerId, setDismissedBannerId] = useState<string | null>(null);

  // Floating Action Button (FAB) & Quick Context Menu states
  const [fabOpen, setFabOpen] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [showQuickStudyModal, setShowQuickStudyModal] = useState(false);
  const [quickNotification, setQuickNotification] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fabOpen) {
        setFabOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fabOpen]);

  const handleCreateQuickTask = (asg: Omit<AssignmentItem, 'id'>) => {
    if (onAddAssignment) {
      onAddAssignment(asg);
      setQuickNotification(`Task added: "${asg.title}"`);
      setTimeout(() => setQuickNotification(null), 3000);
    } else if (onNavigateToAssignments) {
      onNavigateToAssignments();
    }
  };

  const handleCreateQuickStudyLog = (log: Omit<StudyLog, 'id' | 'timestamp'>) => {
    onAddStudyLog(log);
    setQuickNotification(`Study session logged: ${log.courseName} (${log.durationMinutes}m)`);
    setTimeout(() => setQuickNotification(null), 3000);
  };

  const handleCopyMatricola = () => {
    if (!profile.studentId) return;
    navigator.clipboard.writeText(profile.studentId);
    setCopiedMatricola(true);
    playClickBeep();
    setTimeout(() => setCopiedMatricola(false), 2000);
  };

  // Active courses
  const activeCourses = courses.filter((c) => c.status === 'active');
  const completedCourses = courses.filter((c) => c.status === 'completed');

  // Calculate earned CFU: sum of completed courses
  const targetCFU = profile.totalTargetCFU || 180;
  const totalEarnedCFU = completedCourses.reduce((sum, c) => sum + c.cfu, 0);
  const donePercent = Math.min(
    100,
    Math.round((totalEarnedCFU / targetCFU) * 100)
  );

  // Calculate weekly focus hours
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyMinutes = studyLogs
    .filter((log) => log.timestamp >= oneWeekAgo)
    .reduce((sum, log) => sum + log.durationMinutes, 0);
  const weeklyHours = (weeklyMinutes / 60).toFixed(1);
  const weeklyGoalPercent = Math.min(
    100,
    Math.round((parseFloat(weeklyHours) / profile.weeklyGoalHours) * 100)
  );

  // Calculate current week (Monday through Sunday) for compact weekly schedule chart
  const referenceDateStr =
    studyLogs.length > 0 ? studyLogs[0].date : new Date().toISOString().split('T')[0];
  const refDate = new Date(referenceDateStr);
  const dayOfWeek = refDate.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + distanceToMonday);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    const dayLogs = studyLogs.filter((l) => l.date === dateStr);
    const dayMins = dayLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
    const hours = (dayMins / 60).toFixed(1);
    const sessionCount = dayLogs.length;

    return {
      shortDay: dayNames[i],
      dateStr,
      formattedDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      hours: dayMins > 0 ? `${hours}h` : '0h',
      minutes: dayMins,
      sessionCount,
      hasSessions: sessionCount > 0,
    };
  });

  const weekTotalMinutes = weekDays.reduce((sum, d) => sum + d.minutes, 0);
  const weekTotalHours = (weekTotalMinutes / 60).toFixed(1);
  const weekTotalSessions = weekDays.reduce((sum, d) => sum + d.sessionCount, 0);
  const activeDaysCount = weekDays.filter((d) => d.hasSessions).length;

  // Dynamic Power Border Telemetry
  const todayIso = new Date().toISOString().split('T')[0];
  const todayMinutesStudied = studyLogs
    .filter((l) => l.date === todayIso)
    .reduce((sum, l) => sum + l.durationMinutes, 0);
  const dailyTargetMinutes = Math.max(30, Math.round(((profile.weeklyGoalHours || 20) * 60) / 6));
  const dailyPowerPercent = Math.min(100, Math.round((todayMinutesStudied / dailyTargetMinutes) * 100));
  const powerBorderClass = getPowerBorderClass(dailyPowerPercent);
  const powerBarFill = getPowerBarFillClass(dailyPowerPercent);

  // Submit study session
  const handleSubmitSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    const matchedCourse = courses.find((c) => c.title === selectedCourse || c.shortTitle === selectedCourse);

    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = sessionDate === todayStr ? 'Today' : sessionDate;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    onAddStudyLog({
      courseName: matchedCourse ? matchedCourse.shortTitle : selectedCourse,
      courseId: matchedCourse?.id,
      durationMinutes: Number(durationMinutes),
      date: sessionDate,
      timeRange: `${prefix} ${nowTime}`,
      notes: notes.trim() || 'General course syllabus study & topic review.',
      rating: 5,
      tag: 'Deep Work',
    });

    setNotes('');
    playFuturisticChime();
    fireCelebrationConfetti();
    setSessionJustAdded(true);
    setTimeout(() => setSessionJustAdded(false), 2400);
  };

  // Deliverable Radar Calculation (Exams, Assignments, Deadlines)
  const formatDeliverableDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return dateStr;
  };

  const calculateDaysLeft = (dateStr: string) => {
    if (!dateStr) return 999;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 999;
    const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  interface IncomingItem {
    id: string;
    title: string;
    courseName: string;
    type: string;
    dueDate: string;
    daysLeft: number;
    isAssignment: boolean;
    isCourseDeliverable?: boolean;
    course?: Course;
  }

  const incomingItems: IncomingItem[] = React.useMemo(() => {
    const list: IncomingItem[] = [];

    // 1. Uncompleted assignments and exams
    (assignments || [])
      .filter((a) => a.status !== 'completed' && a.status !== 'submitted' && !!a.dueDate)
      .forEach((a) => {
        list.push({
          id: a.id,
          title: a.title,
          courseName: a.courseName,
          type: a.type || 'Task',
          dueDate: a.dueDate,
          daysLeft: calculateDaysLeft(a.dueDate),
          isAssignment: true,
        });
      });

    // 2. Next deliverables from active/planned courses
    (courses || [])
      .filter((c) => c.nextDeliverable && c.nextDeliverable.date && c.status !== 'completed')
      .forEach((c) => {
        const deliv = c.nextDeliverable!;
        const exists = list.some(
          (item) => item.title.toLowerCase() === deliv.title.toLowerCase()
        );
        if (!exists) {
          list.push({
            id: `course-deliv-${c.id}`,
            title: deliv.title,
            courseName: c.shortTitle || c.title,
            type: deliv.type || 'Deliverable',
            dueDate: deliv.date,
            daysLeft: calculateDaysLeft(deliv.date),
            isAssignment: false,
            isCourseDeliverable: true,
            course: c,
          });
        }
      });

    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [assignments, courses]);

  const nextItem = incomingItems[0];
  const isExam =
    nextItem &&
    (nextItem.type.toLowerCase().includes('exam') ||
      nextItem.type.toLowerCase().includes('midterm') ||
      nextItem.type.toLowerCase().includes('final') ||
      nextItem.type.toLowerCase().includes('oral') ||
      nextItem.type.toLowerCase().includes('quiz') ||
      nextItem.type.toLowerCase().includes('appello') ||
      nextItem.type.toLowerCase().includes('parziale'));

  const bannerTitle = isExam ? 'Incoming Exam' : 'Incoming Assignment';

  const getDeliverableDisplayName = (item: IncomingItem) => {
    const isGenericExam = ['exam', 'esame', 'final', 'midterm', 'parziale', 'appello', 'oral'].includes(
      item.title.toLowerCase().trim()
    );
    if (isGenericExam && item.courseName) {
      return item.courseName;
    }
    if (
      item.courseName &&
      item.courseName !== 'General' &&
      item.courseName.toLowerCase() !== item.title.toLowerCase()
    ) {
      if (item.title.toLowerCase().includes(item.courseName.toLowerCase())) {
        return item.title;
      }
      return `${item.courseName} - ${item.title}`;
    }
    return item.title || item.courseName;
  };

  const displayName = nextItem ? getDeliverableDisplayName(nextItem) : '';

  const daysText =
    nextItem
      ? nextItem.daysLeft < 0
        ? `${Math.abs(nextItem.daysLeft)} Days overdue`
        : nextItem.daysLeft === 0
        ? 'Due Today'
        : nextItem.daysLeft === 1
        ? '1 Day left'
        : `${nextItem.daysLeft} Days left`
      : '';

  const isRed = (nextItem?.daysLeft ?? 999) <= 3;

  return (
    <div className="flex-1 bg-gray-50 dark:bg-zinc-950 overflow-y-auto p-2 sm:p-3.5 space-y-2.5 sm:space-y-3.5 transition-colors">
      {/* INCOMING DELIVERABLE BANNER (Only shown when there are incoming items and not dismissed) */}
      {nextItem && dismissedBannerId !== nextItem.id && (
        <div
          className={`rounded-xl border p-3.5 sm:p-4 transition-all flex items-center justify-between gap-3 ${
            isRed
              ? 'border-red-500 bg-red-500/10 dark:bg-red-950/30 text-red-500 dark:text-red-400'
              : 'border-orange-500 bg-orange-500/10 dark:bg-orange-950/30 text-orange-500 dark:text-orange-400'
          }`}
        >
          <div className="space-y-1 min-w-0">
            <h2 className="font-bold text-sm sm:text-base tracking-tight leading-none">
              {bannerTitle}
            </h2>
            <p className="text-xs sm:text-sm font-medium opacity-90 leading-tight truncate">
              {displayName} - {daysText}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDismissedBannerId(nextItem.id)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isRed
                ? 'border-red-500/60 hover:border-red-500 hover:bg-red-500/20 text-red-500 dark:text-red-400'
                : 'border-orange-500/60 hover:border-orange-500 hover:bg-orange-500/20 text-orange-500 dark:text-orange-400'
            }`}
            title="Dismiss banner"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 1. DEGREE TELEMETRY & MILESTONE BANNER */}
      <div className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3.5 text-xs shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Degree, Student & Matricola Lockup */}
          <div className="py-0.5 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-extrabold text-sm sm:text-lg lg:text-xl text-neutral-900 dark:text-zinc-100 tracking-tight leading-tight">
                {profile.degreeName || 'Degree Program'}
              </h1>
              {profile.studentId ? (
                <button
                  type="button"
                  onClick={handleCopyMatricola}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200/80 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 font-mono text-[10px] sm:text-[11px] font-medium transition-colors shadow-2xs group cursor-pointer"
                  title="Click to copy Matricola to clipboard"
                >
                  <span className="text-slate-500 dark:text-zinc-400 font-sans text-[10px] font-semibold uppercase tracking-wider">
                    Matricola:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100 tracking-wide">
                    {profile.studentId}
                  </span>
                  <span className="material-symbols-outlined text-[11px] text-slate-400 dark:text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-200 ml-0.5">
                    {copiedMatricola ? 'check' : 'content_copy'}
                  </span>
                  {copiedMatricola && (
                    <span className="text-[9px] font-sans font-semibold text-emerald-700 dark:text-emerald-400 ml-0.5">
                      Copied!
                    </span>
                  )}
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 font-mono text-[10px] sm:text-[11px]"
                  title="Matricola not set (can be configured in Settings)"
                >
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-wider">
                    Matricola:
                  </span>
                  <span className="italic text-slate-400 dark:text-zinc-500">Not set</span>
                </span>
              )}
            </div>

            <div className="text-[10px] sm:text-[11px] text-neutral-600 dark:text-zinc-400 font-sans flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="font-semibold text-neutral-800 dark:text-zinc-200">
                {profile.institution || 'University / Institution'}
              </span>
              <span className="text-neutral-400 dark:text-zinc-600">•</span>
              <span className="text-neutral-700 dark:text-zinc-300 font-medium">
                {profile.degreeType || 'Degree Level'}
              </span>
            </div>
          </div>

          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 text-[10.5px] sm:text-[11px]">
            {/* Total Earned CFU */}
            <div className="bg-slate-50/70 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 p-1.5 sm:p-2 rounded-lg min-w-[100px] shadow-2xs">
              <div className="text-neutral-500 dark:text-zinc-400 text-[9.5px] sm:text-[10px] uppercase font-semibold">
                Total Earned
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-sm sm:text-base text-neutral-900 dark:text-zinc-100 font-mono">
                  {totalEarnedCFU}
                </span>
                <span className="text-neutral-600 dark:text-zinc-400 text-[9.5px] sm:text-[10px]">
                  / {targetCFU} CFU
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1 sm:h-1.5 rounded-full overflow-hidden mt-0.5 sm:mt-1">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${donePercent}%` }}
                />
              </div>
            </div>

            {/* Completed Courses */}
            <div className="bg-slate-50/70 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 p-1.5 sm:p-2 rounded-lg min-w-[100px] shadow-2xs">
              <div className="text-neutral-500 dark:text-zinc-400 text-[9.5px] sm:text-[10px] uppercase font-semibold">
                Completed
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-sm sm:text-base text-neutral-900 dark:text-zinc-100 font-mono">
                  {completedCourses.length}
                </span>
                <span className="text-neutral-600 dark:text-zinc-400 text-[9.5px] sm:text-[10px]">Passed</span>
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-neutral-500 dark:text-zinc-400 font-mono mt-1 sm:mt-2">
                {activeCourses.length} ongoing in term
              </div>
            </div>

            {/* Weekly Focus */}
            <div className={`col-span-2 sm:col-span-1 bg-slate-50/70 dark:bg-zinc-900/80 border p-1.5 sm:p-2 rounded-lg min-w-[100px] shadow-2xs ${powerBorderClass}`}>
              <div className="text-neutral-500 dark:text-zinc-400 text-[9.5px] sm:text-[10px] uppercase font-semibold">
                Weekly Focus
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-sm sm:text-base text-emerald-700 dark:text-emerald-400 font-mono">
                  {weeklyHours}h
                </span>
                <span className="text-neutral-600 dark:text-zinc-400 text-[9.5px] sm:text-[10px]">
                  / {profile.weeklyGoalHours}h
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1 sm:h-1.5 rounded-full overflow-hidden mt-0.5 sm:mt-1">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${powerBarFill}`}
                  style={{ width: `${weeklyGoalPercent}%` }}
                />
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-neutral-500 dark:text-zinc-400 font-mono mt-0.5">
                Target: {weeklyGoalPercent}% Reached
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN WORKSTATION GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        {/* LEFT COLUMN: Active Courses Table + Study Activity Log (8 cols) */}
        <div className="xl:col-span-8 space-y-3">
          {/* Active Courses Table */}
          <div className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800 dark:text-zinc-200">
                <span className="material-symbols-outlined text-[15px] text-blue-700 dark:text-blue-400">
                  table_view
                </span>
                <span>Active Courses</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="compact"
                  size="sm"
                  onClick={onOpenEmailGroup}
                  title="Email all active course professors"
                  className="gap-1 text-zinc-800 dark:text-zinc-200"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    mail
                  </span>
                  <span>Email Group</span>
                </Button>
                <Button
                  variant="compact"
                  size="sm"
                  onClick={onNavigateToCurriculum}
                  title="Open Complete Degree Curriculum"
                  className="gap-1 text-indigo-700 dark:text-indigo-400 font-semibold"
                >
                  <span>Go to page</span>
                  <span className="material-symbols-outlined text-[13px]">
                    open_in_new
                  </span>
                </Button>
              </div>
            </div>

            {/* If no active courses, display clean empty state */}
            {activeCourses.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-900/40">
                <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-zinc-600 block mb-1">
                  school
                </span>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">No active courses enrolled yet</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5 mb-3">Add courses to your curriculum to track your semester progress.</p>
                <button
                  onClick={onNavigateToCurriculum}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  <span>Add Course in Curriculum</span>
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Cards View */}
                <div className="sm:hidden p-1.5 space-y-1.5">
                  {activeCourses.map((course) => {
                    const badgeClass =
                      course.nextDeliverable?.badgeColor === 'red'
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-900/80'
                        : course.nextDeliverable?.badgeColor === 'amber'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/80'
                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';

                    return (
                      <div
                        key={course.id}
                        onClick={() => onOpenCourseDetail(course)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-700 transition-colors cursor-pointer shadow-2xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="font-semibold text-xs text-neutral-900 dark:text-zinc-100 truncate leading-snug">
                            {course.title}
                          </div>
                          <span className="shrink-0 font-mono font-bold text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 leading-none">
                            {course.cfu} CFU
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-500 dark:text-zinc-400">
                          <div className="flex items-center gap-1.5 truncate min-w-0">
                            {course.nextDeliverable ? (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 border rounded text-[9.5px] font-semibold leading-none truncate ${badgeClass}`}
                              >
                                {course.nextDeliverable.title}
                              </span>
                            ) : (
                              <span className="text-neutral-400 dark:text-zinc-500 font-mono text-[9px] leading-none">
                                No deliverable
                              </span>
                            )}
                            {course.email && (
                              <>
                                <span className="text-neutral-300 dark:text-zinc-600">•</span>
                                <a
                                  href={`mailto:${course.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 dark:text-blue-400 hover:underline truncate text-[10px]"
                                  title={course.email}
                                >
                                  {course.email}
                                </a>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-medium shrink-0 ml-1">
                            <span className="text-[10px]">View</span>
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              chevron_right
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="cursor-pointer">
                          Course Title
                        </TableHead>
                        <TableHead className="w-16 text-right cursor-pointer tabular-nums">
                          CFU
                        </TableHead>
                        <TableHead className="w-24 text-center cursor-pointer">
                          Status
                        </TableHead>
                        <TableHead className="w-32 cursor-pointer">
                          Incoming
                        </TableHead>
                        <TableHead className="w-16 text-center cursor-pointer">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeCourses.map((course, idx) => {
                        const badgeClass =
                          course.nextDeliverable?.badgeColor === 'red'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-900/80'
                            : course.nextDeliverable?.badgeColor === 'amber'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/80'
                            : 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700';

                        return (
                          <TableRow
                            key={course.id}
                            onClick={() => onOpenCourseDetail(course)}
                            className={`cursor-pointer group ${
                              idx % 2 === 1 ? 'bg-slate-50/20 dark:bg-zinc-900/30' : ''
                            }`}
                          >
                            <TableCell className="px-2.5 py-2">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {course.title}
                              </div>
                              {course.email && (
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <a
                                    href={`mailto:${course.email}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                                  >
                                    {course.email}
                                  </a>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-2.5 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                              {course.cfu}
                            </TableCell>
                            <TableCell className="px-2.5 py-2 text-center">
                              <StatusBadge status={course.status} size="sm" />
                            </TableCell>
                            <TableCell className="px-2.5 py-2">
                              {course.nextDeliverable ? (
                                <span
                                  className={`inline-block px-1.5 py-0.5 border rounded-md text-[10px] font-semibold ${badgeClass}`}
                                >
                                  {course.nextDeliverable.title}
                                </span>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-2.5 py-2 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px] font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenCourseDetail(course);
                                }}
                                title="Open Course Details"
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          {/* Minimal Compact Week Study Schedule Chart */}
          <div className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800 dark:text-zinc-200">
                <span className="material-symbols-outlined text-[15px] text-emerald-700 dark:text-emerald-400">
                  calendar_view_week
                </span>
                <span>Current Week</span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] pb-1.5 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-neutral-900 dark:text-zinc-100 font-mono text-xs">
                    {weekTotalHours}h Focus Time
                  </span>
                </div>
              </div>

              {/* Minimal 7-day strip */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-0.5">
                {weekDays.map((wd) => {
                  const isGreen = wd.hasSessions;
                  return (
                    <div
                      key={wd.dateStr}
                      className={`py-1 sm:py-2 px-0.5 sm:px-1 rounded-lg border flex flex-col items-center justify-between text-center transition-all ${
                        isGreen
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 shadow-2xs ring-1 ring-emerald-200/70 dark:ring-emerald-900/50'
                          : 'bg-slate-50/60 dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-800 text-neutral-400 dark:text-zinc-500'
                      }`}
                    >
                      <div className="w-full pb-0.5 sm:pb-1 border-b border-inherit">
                        <div
                          className={`text-[8px] sm:text-[9px] font-bold uppercase ${
                            isGreen ? 'text-emerald-800 dark:text-emerald-400' : 'text-neutral-500 dark:text-zinc-400'
                          }`}
                        >
                          {wd.shortDay}
                        </div>
                        <div className="text-[7px] sm:text-[8px] font-mono opacity-80 leading-tight">
                          {wd.formattedDate}
                        </div>
                      </div>

                      <div className="my-0.5 sm:my-1.5 flex flex-col items-center">
                        <div
                          className={`font-mono font-bold text-[10px] sm:text-[12px] leading-tight ${
                            isGreen ? 'text-emerald-800 dark:text-emerald-300' : 'text-neutral-400 dark:text-zinc-400'
                          }`}
                        >
                          {wd.hours}
                        </div>
                        <div
                          className={`text-[7px] sm:text-[9px] font-mono leading-tight ${
                            isGreen ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-neutral-400 dark:text-zinc-500'
                          }`}
                        >
                          {wd.sessionCount}s
                        </div>
                      </div>

                      <div className="w-full pt-0.5 flex justify-center">
                        {isGreen ? (
                          <span
                            className="inline-flex items-center justify-center w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white text-[7px] sm:text-[8px] font-bold"
                            title={`${wd.sessionCount} session(s)`}
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Study Session Logger + Quick Notes (4 cols) */}
        <div className="xl:col-span-4 space-y-3">
          {/* Study Session Quick Entry Widget */}
          <div className={`border bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden flex flex-col ${powerBorderClass}`}>
            <div className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800 dark:text-zinc-200">
                <span className="material-symbols-outlined text-[15px] text-blue-600 dark:text-blue-400">
                  add_circle
                </span>
                <span>Log Study Session</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 dark:text-zinc-400">
                {activeCourses.length} active
              </span>
            </div>

            <div className="p-2.5 sm:p-3 text-xs">
              <form onSubmit={handleSubmitSession} className="space-y-2 sm:space-y-2.5">
                {/* Target Course */}
                <div className="space-y-0.5">
                  <label
                    className="text-[10px] font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide block"
                    htmlFor="course-select"
                  >
                    Target Course
                  </label>
                  <select
                    id="course-select"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full text-[11px] py-1.5 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 dark:focus:border-indigo-500 font-medium transition-all"
                    required
                    disabled={activeCourses.length === 0}
                  >
                    {activeCourses.length === 0 ? (
                      <option value="">No active courses available</option>
                    ) : (
                      activeCourses.map((c) => (
                        <option key={c.id} value={c.title}>
                          {c.shortTitle || c.title} ({c.cfu} CFU)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Date & Duration inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label
                      className="text-[10px] font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide"
                      htmlFor="session-date"
                    >
                      Date
                    </label>
                    <input
                      id="session-date"
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-full text-[11px] py-1.5 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 font-mono transition-all"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-[10px] font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide"
                        htmlFor="session-duration"
                      >
                        Duration
                      </label>
                      <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 font-bold">
                        {durationMinutes} min
                      </span>
                    </div>
                    <input
                      id="session-duration"
                      type="number"
                      min="15"
                      step="15"
                      value={durationMinutes}
                      onChange={(e) =>
                        setDurationMinutes(Math.max(15, parseInt(e.target.value) || 15))
                      }
                      className="w-full text-[11px] py-1.5 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 font-mono transition-all"
                    />
                  </div>
                </div>

                {/* Preset duration pills for instant 1-click selection */}
                <div className="flex items-center gap-1 pt-0.5">
                  <span className="text-[9px] font-mono text-neutral-500 dark:text-zinc-400 uppercase">Preset:</span>
                  {[30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        playClickBeep();
                        setDurationMinutes(mins);
                      }}
                      className={`px-2 py-0.5 text-[10px] rounded-md font-mono transition-colors ${
                        durationMinutes === mins
                          ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                          : 'bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                {/* Notes */}
                <div className="space-y-0.5">
                  <label
                    className="text-[10px] font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide"
                    htmlFor="session-topic"
                  >
                    Notes / Topic
                  </label>
                  <textarea
                    id="session-topic"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Study session notes, problem set, topics covered..."
                    className="w-full text-[11px] p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-none font-sans transition-all"
                  />
                </div>

                {/* Action Button & Confirmation feedback */}
                <div className="pt-1 flex flex-col gap-1">
                  {sessionJustAdded ? (
                    <div className="py-2 px-2.5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-[15px] text-emerald-600 dark:text-emerald-400">
                        check_circle
                      </span>
                      <span>Session Recorded to Telemetry!</span>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-2 px-3 rounded-lg text-[11px] shadow-xs hover:shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        add_task
                      </span>
                      <span>Log Study Session (Ctrl+S)</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Quick Notes Section */}
          <QuickNotesSection
            notes={currentNotes}
            onUpdateNotes={handleUpdateNotes}
          />
        </div>
      </div>

      {/* Floating Action Feedback Toast */}
      {quickNotification && (
        <div className="fixed bottom-20 sm:bottom-22 right-5 sm:right-6 z-50 py-2 px-3 bg-emerald-600 dark:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{quickNotification}</span>
        </div>
      )}

      {/* Floating Action Button (FAB) & Context Menu */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40">
        {/* Backdrop click-away overlay when context menu is open */}
        {fabOpen && (
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[1px] -z-10 transition-opacity animate-in fade-in duration-150"
            onClick={() => setFabOpen(false)}
          />
        )}

        {/* Context Menu Speed-Dial */}
        {fabOpen && (
          <div
            role="menu"
            aria-orientation="vertical"
            className="absolute bottom-14 sm:bottom-16 right-0 mb-2 w-64 sm:w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-gray-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in slide-in-from-bottom-3 duration-200 text-left select-none ring-1 ring-black/5 dark:ring-white/5"
          >
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800/80 mb-0.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-zinc-400">
                <span className="material-symbols-outlined text-[13px] text-indigo-500">
                  bolt
                </span>
                <span>Quick Actions</span>
              </div>
              <span className="text-[9.5px] font-mono text-neutral-400 dark:text-zinc-500">
                Esc to close
              </span>
            </div>

            {/* Action 1: New Task / Exam */}
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                playClickBeep();
                setShowQuickTaskModal(true);
              }}
              className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 border border-transparent hover:border-emerald-200/60 dark:hover:border-emerald-800/40 transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">
                  add_task
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs text-neutral-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                  New Task / Exam
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-zinc-400 truncate">
                  Add assignment, deadline or test
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-neutral-300 dark:text-zinc-600 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">
                chevron_right
              </span>
            </button>

            {/* Action 2: Log Study Session */}
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                playClickBeep();
                setShowQuickStudyModal(true);
              }}
              className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-blue-50/80 dark:hover:bg-blue-950/40 border border-transparent hover:border-blue-200/60 dark:hover:border-blue-800/40 transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100/80 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">
                  history_edu
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs text-neutral-900 dark:text-zinc-100 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  Log Study Session
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-zinc-400 truncate">
                  Record study hours &amp; topic review
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-neutral-300 dark:text-zinc-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all">
                chevron_right
              </span>
            </button>

            {/* Action 3: New Course */}
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                playClickBeep();
                if (onOpenNewCourse) {
                  onOpenNewCourse();
                } else {
                  onNavigateToCurriculum();
                }
              }}
              className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 border border-transparent hover:border-indigo-200/60 dark:hover:border-indigo-800/40 transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-100/80 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">
                  school
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs text-neutral-900 dark:text-zinc-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  Add New Course
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-zinc-400 truncate">
                  Register syllabus course &amp; CFUs
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-neutral-300 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                chevron_right
              </span>
            </button>
          </div>
        )}

        {/* Main FAB Trigger Button */}
        <button
          type="button"
          onClick={() => {
            playClickBeep();
            setFabOpen((prev) => !prev);
          }}
          aria-label={fabOpen ? "Close quick actions menu" : "Open quick actions menu"}
          aria-expanded={fabOpen}
          title="Quick Actions (Add Task, Study Log, or Course)"
          className={`group relative flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 ring-2 ring-white/20 dark:ring-zinc-800 transition-all duration-200 cursor-pointer ${
            fabOpen
              ? 'bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 scale-95'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] sm:text-[26px] transition-transform duration-300 ${
              fabOpen ? 'rotate-45' : 'rotate-0'
            }`}
          >
            add
          </span>

          {/* Tooltip on hover when closed */}
          {!fabOpen && (
            <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-neutral-900/90 dark:bg-zinc-800/90 text-white text-[10.5px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md backdrop-blur-xs hidden sm:block">
              Quick Actions
            </span>
          )}
        </button>
      </div>

      {/* Quick Modals from Context Menu */}
      {showQuickTaskModal && (
        <NewAssignmentModal
          courses={courses}
          onClose={() => setShowQuickTaskModal(false)}
          onAdd={handleCreateQuickTask}
        />
      )}

      {showQuickStudyModal && (
        <NewStudyLogModal
          courses={courses}
          onClose={() => setShowQuickStudyModal(false)}
          onAdd={handleCreateQuickStudyLog}
        />
      )}
    </div>
  );
};
