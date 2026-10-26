import React, { useState, useEffect } from 'react';
import {
  Course,
  StudyLog,
  StudentProfile,
  AssignmentItem,
  ResourceLink,
} from '../types';
import { QuickNotesSection } from './QuickNotesSection';
import { ResourceLinkerSection } from './ResourceLinkerSection';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { fireTaskConfetti, fireCelebrationConfetti } from '../utils/confetti';
import { getPowerBorderClass, getPowerBarFillClass } from '../utils/telemetry';
import { NewAssignmentModal } from './Modals';
import { QuickStudyModal } from './QuickStudyModal';
import { Bookmark, FileText, Columns } from 'lucide-react';

interface DashboardViewProps {
  profile: StudentProfile;
  courses: Course[];
  studyLogs: StudyLog[];
  assignments?: AssignmentItem[];
  quickNotes?: string;
  onUpdateQuickNotes?: (notes: string) => void;
  resources?: ResourceLink[];
  onUpdateResources?: (resources: ResourceLink[]) => void;
  onAddStudyLog: (log: Omit<StudyLog, 'id' | 'timestamp'>) => void;
  onDeleteStudyLog?: (id: string) => void;
  onOpenCourseDetail: (course: Course) => void;
  onOpenColumnsModal: () => void;
  onOpenEmailGroup: () => void;
  onNavigateToCurriculum: () => void;
  onNavigateToStudyTracker?: () => void;
  onOpenNewCourse?: () => void;
  onAddAssignment?: (asg: Omit<AssignmentItem, 'id'>) => void;
  onNavigateToAssignments?: () => void;
  onUpdateAssignmentStatus?: (id: string, status: AssignmentItem['status']) => void;
  onUpdateCourse?: (course: Course) => void;
  onDeleteCourse?: (courseId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  courses,
  studyLogs,
  assignments = [],
  quickNotes = '',
  onUpdateQuickNotes,
  resources = [],
  onUpdateResources,
  onAddStudyLog,
  onDeleteStudyLog,
  onOpenCourseDetail,
  onOpenColumnsModal,
  onOpenEmailGroup,
  onNavigateToCurriculum,
  onNavigateToStudyTracker,
  onOpenNewCourse,
  onAddAssignment,
  onNavigateToAssignments,
  onUpdateAssignmentStatus,
  onUpdateCourse,
  onDeleteCourse,
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

  // Right Workstation Panel Tab Switcher ('resources' | 'notes' | 'split')
  const [rightPanelTab, setRightPanelTab] = useState<'resources' | 'notes' | 'split'>(() => {
    try {
      const saved = localStorage.getItem('unisphere_right_panel_tab');
      if (saved === 'notes' || saved === 'resources' || saved === 'split') return saved;
    } catch {}
    return 'resources';
  });
  const [dashboardTab, setDashboardTab] = useState<'courses' | 'logs'>('courses');
  const [courseFilter, setCourseFilter] = useState<'all' | 'active' | 'completed' | 'planned'>('all');
  const [copiedMatricola, setCopiedMatricola] = useState(false);

  // Data Table Search & Sorting States
  const [tableSearch, setTableSearch] = useState('');
  const [courseSortField, setCourseSortField] = useState<'title' | 'cfu' | 'year' | 'status' | 'deliverable'>('title');
  const [courseSortAsc, setCourseSortAsc] = useState(true);
  const [logSortField, setLogSortField] = useState<'date' | 'course' | 'duration' | 'tag'>('date');
  const [logSortAsc, setLogSortAsc] = useState(false);

  // Floating Action Button (FAB) & Quick Context Menu states
  const [fabOpen, setFabOpen] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [showQuickStudyModal, setShowQuickStudyModal] = useState(false);
  const [quickNotification, setQuickNotification] = useState<string | null>(null);

  // Live Focus Timer State for Floating 'Quick Study' Action Button
  const [isQuickTimerRunning, setIsQuickTimerRunning] = useState(false);
  const [quickTimerSeconds, setQuickTimerSeconds] = useState(0);
  const [quickTimerCourse, setQuickTimerCourse] = useState<string>(() => {
    return courses.find((c) => c.status === 'active')?.title || courses[0]?.title || 'General Deep Work';
  });

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isQuickTimerRunning) {
      timer = setInterval(() => {
        setQuickTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isQuickTimerRunning]);

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
    const xp = Math.max(20, Math.round(log.durationMinutes * 2));
    setQuickNotification(`Study session logged: ${log.courseName} (${log.durationMinutes}m) • +${xp} XP`);
    setTimeout(() => setQuickNotification(null), 3500);
  };

  const handleInstantQuickStudyLog = (mins: number) => {
    const activeCourse = courses.find((c) => c.status === 'active') || courses[0];
    const cName = activeCourse ? activeCourse.title : 'General Deep Work';
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    handleCreateQuickStudyLog({
      courseName: cName,
      courseId: activeCourse?.id,
      durationMinutes: mins,
      date: todayStr,
      timeRange: `Today ${nowTime}`,
      notes: `Quick Study session on ${cName}`,
      rating: 5,
      tag: 'Deep Work',
    });
    fireCelebrationConfetti();
    setFabOpen(false);
  };

  const handleCopyMatricola = () => {
    if (!profile.studentId) return;
    navigator.clipboard.writeText(profile.studentId);
    setCopiedMatricola(true);
    setTimeout(() => setCopiedMatricola(false), 2000);
  };

  // Course collections by status
  const activeCourses = courses.filter((c) => c.status === 'active');
  const completedCourses = courses.filter((c) => c.status === 'completed');
  const plannedCourses = courses.filter((c) => c.status === 'planned');

  // Courses scoped by courseFilter: 'all' | 'active' | 'completed' | 'planned'
  const scopedCourses =
    courseFilter === 'all'
      ? courses
      : courseFilter === 'active'
      ? activeCourses
      : courseFilter === 'completed'
      ? completedCourses
      : plannedCourses;

  // Filtered & Sorted Courses for Data Table
  const filteredCourses = scopedCourses
    .filter((course) => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        course.title.toLowerCase().includes(q) ||
        (course.code && course.code.toLowerCase().includes(q)) ||
        (course.email && course.email.toLowerCase().includes(q)) ||
        (course.status && course.status.toLowerCase().includes(q)) ||
        (course.nextDeliverable && course.nextDeliverable.title.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (courseSortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (courseSortField === 'cfu') {
        cmp = a.cfu - b.cfu;
      } else if (courseSortField === 'year') {
        cmp = (a.year * 10 + a.semester) - (b.year * 10 + b.semester);
      } else if (courseSortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else if (courseSortField === 'deliverable') {
        const da = a.nextDeliverable?.title || '';
        const db = b.nextDeliverable?.title || '';
        cmp = da.localeCompare(db);
      }
      return courseSortAsc ? cmp : -cmp;
    });

  // Filtered & Sorted Study Logs for Data Table
  const filteredLogs = studyLogs
    .filter((log) => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        log.courseName.toLowerCase().includes(q) ||
        log.tag.toLowerCase().includes(q) ||
        log.notes.toLowerCase().includes(q) ||
        log.date.includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (logSortField === 'date') {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = (a.timestamp || 0) - (b.timestamp || 0);
      } else if (logSortField === 'course') {
        cmp = a.courseName.localeCompare(b.courseName);
      } else if (logSortField === 'duration') {
        cmp = a.durationMinutes - b.durationMinutes;
      } else if (logSortField === 'tag') {
        cmp = a.tag.localeCompare(b.tag);
      }
      return logSortAsc ? cmp : -cmp;
    });

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


  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 dark:bg-zinc-950 p-2 sm:p-3.5 pb-24 xl:pb-3.5 gap-2.5 sm:gap-3 transition-colors overflow-y-auto xl:overflow-hidden select-none">

      {/* 1. DEGREE TELEMETRY & MILESTONE BANNER */}
      <div className="shrink-0 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-2.5 sm:p-3 text-xs shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Degree, Student & Matricola Lockup */}
          <div className="py-0.5 space-y-1">
            <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
              <h1 className="font-extrabold text-sm sm:text-lg lg:text-xl text-neutral-900 dark:text-zinc-100 tracking-tight leading-tight">
                {profile.degreeName || 'Degree Workstation'}
              </h1>
              {profile.studentId && (
                <button
                  type="button"
                  onClick={handleCopyMatricola}
                  className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono text-[10px] sm:text-[11px] font-medium transition-colors shadow-2xs group cursor-pointer shrink-0"
                  title="Click to copy Matricola to clipboard"
                >
                  <span className="font-sans text-[9.5px] sm:text-[10px] font-semibold tracking-wide text-blue-600 dark:text-blue-400">
                    Matricola:
                  </span>
                  <span className="font-bold text-blue-900 dark:text-blue-100 tracking-wide">
                    {profile.studentId}
                  </span>
                  <span className="material-symbols-outlined text-[11px] text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-200 ml-0.5">
                    {copiedMatricola ? 'check' : 'content_copy'}
                  </span>
                  {copiedMatricola && (
                    <span className="text-[9px] font-sans font-semibold text-emerald-700 dark:text-emerald-400 ml-0.5">
                      Copied!
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="text-[10px] sm:text-[11px] text-neutral-600 dark:text-zinc-400 font-sans flex items-center gap-1.5 flex-wrap pt-0.5">
              {profile.institution && (
                <span className="font-semibold text-neutral-800 dark:text-zinc-200">
                  {profile.institution}
                </span>
              )}
              {profile.institution && profile.degreeType && (
                <span className="text-neutral-400 dark:text-zinc-600">-</span>
              )}
              {profile.degreeType && (
                <span className="text-neutral-700 dark:text-zinc-300 font-medium">
                  {profile.degreeType}
                </span>
              )}
              {!profile.institution && !profile.degreeType && (
                <span className="text-neutral-500 dark:text-zinc-400">
                  {profile.name ? `${profile.name}'s Student Workspace` : 'Academic Workstation'}
                </span>
              )}
            </div>
          </div>

          {/* Key Metric Gauges: Compact 3-col grid on all screens so it never overflows */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-[11px]">
            {/* Total CFU */}
            <div className="bg-slate-50/70 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 p-1.5 sm:p-2.5 rounded-md shadow-2xs flex flex-col justify-between">
              <div className="text-neutral-600 dark:text-zinc-400 text-[9px] sm:text-[10px] font-bold truncate">
                Total CFU
              </div>
              <div className="flex items-baseline gap-0.5 sm:gap-1 my-0.5">
                <span className="font-bold text-xs sm:text-base lg:text-lg text-neutral-900 dark:text-zinc-100 font-mono">
                  {totalEarnedCFU}
                </span>
                <span className="text-neutral-500 dark:text-zinc-400 text-[8.5px] sm:text-[10px]">
                  /{targetCFU}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1 sm:h-1.5 rounded-full overflow-hidden mt-0.5">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${donePercent}%` }}
                />
              </div>
            </div>

            {/* Completed courses */}
            <div className="bg-slate-50/70 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 p-1.5 sm:p-2.5 rounded-md shadow-2xs flex flex-col justify-between">
              <div className="text-neutral-600 dark:text-zinc-400 text-[9px] sm:text-[10px] font-bold truncate">
                Completed
              </div>
              <div className="flex items-baseline gap-0.5 sm:gap-1 my-0.5">
                <span className="font-bold text-xs sm:text-base lg:text-lg text-neutral-900 dark:text-zinc-100 font-mono">
                  {completedCourses.length}
                </span>
                <span className="text-neutral-500 dark:text-zinc-400 text-[8.5px] sm:text-[10px]">Passed</span>
              </div>
              <div className="text-[8.5px] sm:text-[10px] text-neutral-500 dark:text-zinc-400 font-mono truncate">
                {activeCourses.length} active
              </div>
            </div>

            {/* Weekly Focus */}
            <div className={`bg-slate-50/70 dark:bg-zinc-900/80 border p-1.5 sm:p-2.5 rounded-md shadow-2xs flex flex-col justify-between ${powerBorderClass}`}>
              <div className="text-neutral-600 dark:text-zinc-400 text-[9px] sm:text-[10px] font-bold truncate">
                Weekly Focus
              </div>
              <div className="flex items-baseline gap-0.5 sm:gap-1 my-0.5">
                <span className="font-bold text-xs sm:text-base lg:text-lg text-emerald-700 dark:text-emerald-400 font-mono">
                  {weeklyHours}h
                </span>
                <span className="text-neutral-500 dark:text-zinc-400 text-[8.5px] sm:text-[10px]">
                  /{profile.weeklyGoalHours || 20}h
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1 sm:h-1.5 rounded-full overflow-hidden mt-0.5">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${powerBarFill}`}
                  style={{ width: `${weeklyGoalPercent}%` }}
                />
              </div>
              <div className="text-[8.5px] sm:text-[10px] text-neutral-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
                {weeklyGoalPercent}% goal
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN WORKSTATION - SCROLLABLE ON MOBILE, PINNED FILL Y-SPACE ON XL */}
      <div className="flex-1 min-h-0 flex flex-col xl:grid xl:grid-cols-12 gap-2.5 sm:gap-3 items-stretch">
        {/* LEFT COLUMN: Tabbed Panel [Courses] | [Sessions Logs] (8 cols on desktop) */}
        <div className="xl:col-span-8 flex flex-col min-h-[460px] xl:min-h-0 h-auto xl:h-full">
          <div className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md shadow-xs overflow-hidden flex flex-col flex-1 min-h-[460px] xl:min-h-0 h-full">
            {/* Header: Clean responsive segmented control, filter pills, search & actions */}
            <div className="shrink-0 bg-slate-50/90 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {/* Left group on desktop / Top row on mobile */}
              <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                {/* Segmented Control */}
                <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-zinc-800/90 p-0.5 rounded-md border border-slate-300/80 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardTab('courses');
                    }}
                    className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      dashboardTab === 'courses'
                        ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">school</span>
                    <span>Courses</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {scopedCourses.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDashboardTab('logs');
                    }}
                    className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      dashboardTab === 'logs'
                        ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">history_edu</span>
                    <span className="hidden xs:inline">Sessions Logs</span>
                    <span className="xs:hidden">Logs</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {studyLogs.length}
                    </span>
                  </button>
                </div>

                {/* Course Status Filter Scope Pills (Desktop View >= md) */}
                {dashboardTab === 'courses' && (
                  <div className="hidden md:flex items-center gap-1 py-0.5 bg-slate-200/80 dark:bg-zinc-800/90 p-0.5 rounded-md border border-slate-300/80 dark:border-zinc-700 text-[10.5px]">
                    <button
                      type="button"
                      onClick={() => setCourseFilter('all')}
                      title="Show all curriculum courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        courseFilter === 'all'
                          ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      All ({courses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseFilter('active')}
                      title="Show only currently active courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        courseFilter === 'active'
                          ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      Active ({activeCourses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseFilter('completed')}
                      title="Show passed / completed courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        courseFilter === 'completed'
                          ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      Passed ({completedCourses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseFilter('planned')}
                      title="Show planned future courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        courseFilter === 'planned'
                          ? 'bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      Planned ({plannedCourses.length})
                    </button>
                  </div>
                )}

                {/* Mobile Header Actions (compact on small screens) */}
                <div className="flex sm:hidden items-center gap-1 shrink-0">
                  {dashboardTab === 'courses' && onOpenNewCourse && (
                    <Button
                      variant="compact"
                      size="sm"
                      onClick={() => {
                        onOpenNewCourse();
                      }}
                      title="Add course"
                      className="gap-0.5 text-blue-700 dark:text-blue-400 font-semibold h-7 text-[10.5px] px-2"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>Course</span>
                    </Button>
                  )}

                  {dashboardTab === 'logs' && (
                    <Button
                      variant="compact"
                      size="sm"
                      onClick={() => {
                        setShowQuickStudyModal(true);
                      }}
                      title="Log session"
                      className="gap-0.5 text-emerald-700 dark:text-emerald-400 h-7 text-[10.5px] px-2"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>Log</span>
                    </Button>
                  )}

                  <Button
                    variant="compact"
                    size="sm"
                    onClick={() => {
                      if (dashboardTab === 'courses') onNavigateToCurriculum();
                      else if (onNavigateToStudyTracker) onNavigateToStudyTracker();
                      else onNavigateToCurriculum();
                    }}
                    title="Open full page"
                    className="gap-0.5 text-indigo-700 dark:text-indigo-400 font-semibold h-7 text-[10.5px] px-2"
                  >
                    <span>Page</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </Button>
                </div>
              </div>

              {/* Right group on desktop / Bottom section on mobile */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full sm:w-auto">
                {/* Mobile/Tablet Scope Filter Pills (Horizontally scrollable) */}
                {dashboardTab === 'courses' && (
                  <div className="flex md:hidden items-center gap-1 overflow-x-auto no-scrollbar py-0.5 bg-slate-200/80 dark:bg-zinc-800/90 p-0.5 rounded-md border border-slate-300/80 dark:border-zinc-700 text-[10.5px]">
                    <button
                      type="button"
                      onClick={() => setCourseFilter('all')}
                      title="Show all curriculum courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer shrink-0 ${
                        courseFilter === 'all'
                          ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      All ({courses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseFilter('active')}
                      title="Show only currently active courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer shrink-0 ${
                        courseFilter === 'active'
                          ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      Active ({activeCourses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseFilter('completed')}
                      title="Show passed / completed courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer shrink-0 ${
                        courseFilter === 'completed'
                          ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      Passed ({completedCourses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseFilter('planned')}
                      title="Show planned future courses"
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer shrink-0 ${
                        courseFilter === 'planned'
                          ? 'bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-400 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      Planned ({plannedCourses.length})
                    </button>
                  </div>
                )}

                {/* Inline Data Table Search Filter */}
                <div className="relative flex-1 sm:w-36 md:w-44 flex items-center">
                  <span className="material-symbols-outlined absolute left-2 text-[14px] text-zinc-400 pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder={dashboardTab === 'courses' ? 'Filter courses...' : 'Filter logs...'}
                    className="h-7 w-full pl-6 pr-6 text-[11px] rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                  {tableSearch && (
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      className="absolute right-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer text-xs"
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Desktop Header Actions */}
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {dashboardTab === 'courses' && onOpenNewCourse && (
                    <Button
                      variant="compact"
                      size="sm"
                      onClick={() => {
                        onOpenNewCourse();
                      }}
                      title="Add new course to curriculum"
                      className="gap-1 text-blue-700 dark:text-blue-400 font-semibold h-7 text-[11px] px-2 sm:px-2.5"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>Add Course</span>
                    </Button>
                  )}

                  {dashboardTab === 'logs' && (
                    <Button
                      variant="compact"
                      size="sm"
                      onClick={() => {
                        setShowQuickStudyModal(true);
                      }}
                      title="Record a new study session"
                      className="gap-1 text-emerald-700 dark:text-emerald-400 h-7 text-[11px] px-2 sm:px-2.5"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>Log Session</span>
                    </Button>
                  )}

                  {/* Go to Page button matching sketch */}
                  <Button
                    variant="compact"
                    size="sm"
                    onClick={() => {
                      if (dashboardTab === 'courses') {
                        onNavigateToCurriculum();
                      } else if (onNavigateToStudyTracker) {
                        onNavigateToStudyTracker();
                      } else {
                        onNavigateToCurriculum();
                      }
                    }}
                    title={dashboardTab === 'courses' ? 'Open Complete Degree Curriculum' : 'Open Complete Study Tracker'}
                    className="gap-1 text-indigo-700 dark:text-indigo-400 font-semibold h-7 text-[11px] px-2 sm:px-2.5"
                  >
                    <span className="hidden sm:inline">Go to Page</span>
                    <span className="sm:hidden">Page</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* TAB CONTENT: Courses Data Table (Compact, Clear Grid Borders, Zebra Striped, Sticky Header, No CODE column) */}
            {dashboardTab === 'courses' && (
              <div className="flex-1 min-h-[360px] xl:min-h-0 flex flex-col overflow-hidden">
                {scopedCourses.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-900/40 my-auto">
                    <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-zinc-600 block mb-1">
                      school
                    </span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      {courseFilter === 'active'
                        ? 'No active courses currently enrolled'
                        : courseFilter === 'completed'
                        ? 'No completed courses recorded yet'
                        : courseFilter === 'planned'
                        ? 'No planned future courses'
                        : 'No courses in curriculum'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5 mb-3">
                      {courseFilter === 'all'
                        ? 'Add courses to your curriculum to track your semester progress.'
                        : 'You can switch the scope filter or add new courses to your academic plan.'}
                    </p>
                    {courseFilter !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => setCourseFilter('all')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span>Show All Courses ({courses.length})</span>
                      </button>
                    ) : onOpenNewCourse ? (
                      <button
                        type="button"
                        onClick={onOpenNewCourse}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Add Course</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onNavigateToCurriculum}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        <span>Go to Curriculum</span>
                      </button>
                    )}
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-900/40 my-auto">
                    <span className="material-symbols-outlined text-[30px] text-slate-300 dark:text-zinc-600 block mb-1">
                      search_off
                    </span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">No courses match "{tableSearch}"</p>
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset search filter
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Subtle Mobile Horizontal Swipe Hint */}
                    <div className="sm:hidden px-2.5 py-1 bg-slate-100/90 dark:bg-zinc-800/90 text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between border-t border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[13px] text-blue-600 dark:text-blue-400">swipe</span>
                        <span>Swipe horizontally to view all columns</span>
                      </span>
                      <span className="font-mono text-[9.5px] text-zinc-500">
                        {filteredCourses.length} items
                      </span>
                    </div>

                    {/* Dedicated Compact Data Table with clear grid borders, alternating row colors, and fixed header row */}
                    <div className="flex-1 min-h-[280px] xl:min-h-0 overflow-auto border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <table className="w-full text-[11px] border-separate border-spacing-0 text-left min-w-[580px]">
                        <thead className="sticky top-0 z-20 shadow-xs bg-slate-100 dark:bg-zinc-800">
                          <tr className="bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-[10px] tracking-wider uppercase select-none">
                            <th
                              className="sticky top-0 left-0 z-30 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors shadow-[1px_0_3px_rgba(0,0,0,0.04)]"
                              onClick={() => {
                                if (courseSortField === 'title') setCourseSortAsc(!courseSortAsc);
                                else {
                                  setCourseSortField('title');
                                  setCourseSortAsc(true);
                                }
                              }}
                              title="Sort by Course Title"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Course Title &amp; Contact</span>
                                {courseSortField === 'title' && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                                    {courseSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th
                              className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-20 text-center cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors tabular-nums"
                              onClick={() => {
                                if (courseSortField === 'cfu') setCourseSortAsc(!courseSortAsc);
                                else {
                                  setCourseSortField('cfu');
                                  setCourseSortAsc(false);
                                }
                              }}
                              title="Sort by CFU"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <span>CFU</span>
                                {courseSortField === 'cfu' && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                                    {courseSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th
                              className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-24 text-center cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors"
                              onClick={() => {
                                if (courseSortField === 'year') setCourseSortAsc(!courseSortAsc);
                                else {
                                  setCourseSortField('year');
                                  setCourseSortAsc(true);
                                }
                              }}
                              title="Sort by Academic Term"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <span>Term</span>
                                {courseSortField === 'year' && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                                    {courseSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th
                              className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-28 text-center cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors"
                              onClick={() => {
                                if (courseSortField === 'status') setCourseSortAsc(!courseSortAsc);
                                else {
                                  setCourseSortField('status');
                                  setCourseSortAsc(true);
                                }
                              }}
                              title="Sort by Status"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <span>Status</span>
                                {courseSortField === 'status' && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                                    {courseSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th
                              className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-44 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors"
                              onClick={() => {
                                if (courseSortField === 'deliverable') setCourseSortAsc(!courseSortAsc);
                                else {
                                  setCourseSortField('deliverable');
                                  setCourseSortAsc(true);
                                }
                              }}
                              title="Sort by Deliverable"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Incoming Deliverable</span>
                                {courseSortField === 'deliverable' && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
                                    {courseSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-16 text-center">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCourses.map((course, idx) => {
                            const badgeClass =
                              course.nextDeliverable?.badgeColor === 'red'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-900/80'
                                : course.nextDeliverable?.badgeColor === 'amber'
                                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/80'
                                : 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700';

                            const isEvenRow = idx % 2 === 0;

                            const handleStatusCycle = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              if (!onUpdateCourse) return;
                              const nextStatus: Course['status'] =
                                course.status === 'active'
                                  ? 'completed'
                                  : course.status === 'completed'
                                  ? 'planned'
                                  : 'active';
                              onUpdateCourse({ ...course, status: nextStatus });
                            };

                            return (
                              <tr
                                key={course.id}
                                onClick={() => onOpenCourseDetail(course)}
                                className={`group cursor-pointer transition-colors duration-150 ${
                                  isEvenRow
                                    ? 'bg-white dark:bg-zinc-900'
                                    : 'bg-slate-50/80 dark:bg-zinc-800/40'
                                } hover:bg-blue-50/80 dark:hover:bg-zinc-800/70`}
                              >
                                <td className={`sticky left-0 z-10 border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 min-w-[190px] sm:min-w-[210px] align-middle ${
                                  isEvenRow ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50 dark:bg-zinc-800/90'
                                } group-hover:bg-blue-50 dark:group-hover:bg-zinc-800 transition-colors shadow-[1px_0_3px_rgba(0,0,0,0.04)]`}>
                                  <div className="font-bold text-[11.5px] text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {course.title}
                                  </div>
                                  {course.email && (
                                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5 leading-none">
                                      <span className="material-symbols-outlined text-[12px] text-zinc-400 dark:text-zinc-500">mail</span>
                                      <a
                                        href={`mailto:${course.email}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        {course.email}
                                      </a>
                                    </div>
                                  )}
                                </td>
                                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-center font-mono font-bold text-[11px] text-zinc-900 dark:text-zinc-100 tabular-nums align-middle">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                                    {course.cfu}
                                  </span>
                                </td>
                                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-center font-mono text-[10px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap align-middle">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100/70 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80">
                                    Y{course.year || 1} • S{course.semester || 1}
                                  </span>
                                </td>
                                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-center whitespace-nowrap align-middle">
                                  <StatusBadge
                                    status={course.status}
                                    size="sm"
                                    onClick={handleStatusCycle}
                                    title={
                                      onUpdateCourse
                                        ? course.status === 'active'
                                          ? 'Click to cycle status (Active -> Completed -> Planned)'
                                          : course.status === 'completed'
                                          ? 'Click to cycle status (Completed -> Planned -> Active)'
                                          : 'Click to cycle status (Planned -> Active -> Completed)'
                                        : undefined
                                    }
                                    className={onUpdateCourse ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
                                  />
                                </td>
                                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 align-middle">
                                  {course.nextDeliverable ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`inline-block px-1.5 py-0.5 border rounded text-[9.5px] font-semibold shadow-2xs ${badgeClass}`}>
                                        {course.nextDeliverable.title}
                                      </span>
                                      {course.nextDeliverable.date && (
                                        <span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                          {course.nextDeliverable.date}
                                        </span>
                                      )}
                                    </div>
                                  ) : course.status === 'completed' ? (
                                    <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[9.5px] font-medium inline-flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[12px]">verified</span>
                                      <span>Exam Passed • {course.cfu} CFU Acquired</span>
                                    </span>
                                  ) : course.status === 'planned' ? (
                                    <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[9.5px]">
                                      Planned curriculum module
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[9.5px]">
                                      — None scheduled
                                    </span>
                                  )}
                                </td>
                                <td className="border-b border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-center whitespace-nowrap align-middle">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenCourseDetail(course);
                                    }}
                                    className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                  >
                                    <span>Open</span>
                                    <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Data Table Footer Strip (Clean metrics, 'All up-to-date' removed) */}
                    <div className="shrink-0 px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/90 flex items-center justify-between text-[10.5px] text-zinc-500 dark:text-zinc-400 font-mono">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <span>
                          Showing {filteredCourses.length} of {scopedCourses.length} courses ({courseFilter} view)
                        </span>
                        <span>•</span>
                        <span>{activeCourses.length} active ({activeCourses.reduce((s, c) => s + c.cfu, 0)} CFU)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {completedCourses.length > 0 && (
                          <span className="text-blue-700 dark:text-blue-400 font-semibold text-[10px]">
                            {completedCourses.length} passed ({completedCourses.reduce((s, c) => s + c.cfu, 0)} CFU)
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB CONTENT: Sessions Logs (Genuine Compact Data Table) */}
            {dashboardTab === 'logs' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Minimal 7-day strip for quick weekly summary (shrink-0) */}
                <div className="shrink-0 p-2 sm:p-2.5 bg-slate-50/70 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between text-[11px] pb-1 border-b border-gray-200/60 dark:border-zinc-800">
                    <span className="font-bold text-neutral-900 dark:text-zinc-100 font-mono text-xs">
                      {weekTotalHours}h Focus Time this week
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {weekTotalSessions} session{weekTotalSessions === 1 ? '' : 's'} logged
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mt-1.5">
                    {weekDays.map((wd) => {
                      const isGreen = wd.hasSessions;
                      return (
                        <div
                          key={wd.dateStr}
                          className={`py-1 px-0.5 rounded border flex flex-col items-center justify-between text-center transition-all ${
                            isGreen
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 shadow-2xs'
                              : 'bg-white/60 dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-800 text-neutral-400 dark:text-zinc-500'
                          }`}
                        >
                          <div className={`text-[8px] font-bold uppercase ${isGreen ? 'text-emerald-800 dark:text-emerald-400' : 'text-neutral-500 dark:text-zinc-400'}`}>
                            {wd.shortDay}
                          </div>
                          <div className={`my-0.5 font-mono font-bold text-[10px] ${isGreen ? 'text-emerald-800 dark:text-emerald-300' : 'text-neutral-400 dark:text-zinc-400'}`}>
                            {wd.hours}
                          </div>
                          <div className="text-[7.5px] font-mono opacity-80 leading-tight">
                            {wd.formattedDate}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Real Data Table for Study Logs */}
                {studyLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-zinc-400 bg-slate-50/40 dark:bg-zinc-900/40 rounded-md border border-dashed border-gray-200 dark:border-zinc-800 my-auto">
                    <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-zinc-600 block mb-1">
                      history_edu
                    </span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">No study sessions logged yet</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5 mb-3">Record your deep work, problem sets, and review sessions.</p>
                    <button
                      type="button"
                      onClick={() => setShowQuickStudyModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>Log First Session</span>
                    </button>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-900/40 my-auto">
                    <span className="material-symbols-outlined text-[30px] text-slate-300 dark:text-zinc-600 block mb-1">
                      search_off
                    </span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">No sessions match "{tableSearch}"</p>
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset search filter
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Subtle Mobile Horizontal Swipe Hint */}
                    <div className="sm:hidden px-2.5 py-1 bg-slate-100/90 dark:bg-zinc-800/90 text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between border-t border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[13px] text-indigo-600 dark:text-indigo-400">swipe</span>
                        <span>Swipe horizontally to view all columns</span>
                      </span>
                      <span className="font-mono text-[9.5px] text-zinc-500">
                        {filteredLogs.length} sessions
                      </span>
                    </div>

                    {/* Dedicated Compact Data Table for Study Logs with clear grid borders, alternating row colors, and fixed header row */}
                    <div className="flex-1 min-h-[280px] xl:min-h-0 overflow-auto border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <table className="w-full text-[11px] border-separate border-spacing-0 text-left min-w-[580px]">
                        <thead className="sticky top-0 z-20 shadow-xs bg-slate-100 dark:bg-zinc-800">
                          <tr className="bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-[10px] tracking-wider uppercase select-none">
                            <th
                              className="sticky top-0 left-0 z-30 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-28 sm:w-32 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors shadow-[1px_0_3px_rgba(0,0,0,0.04)]"
                              onClick={() => {
                                if (logSortField === 'date') setLogSortAsc(!logSortAsc);
                                else {
                                  setLogSortField('date');
                                  setLogSortAsc(false);
                                }
                              }}
                              title="Sort by Date"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Date &amp; Time</span>
                                {logSortField === 'date' && (
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                    {logSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th
                              className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors"
                              onClick={() => {
                                if (logSortField === 'course') setLogSortAsc(!logSortAsc);
                                else {
                                  setLogSortField('course');
                                  setLogSortAsc(true);
                                }
                              }}
                              title="Sort by Course"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Course / Subject</span>
                                {logSortField === 'course' && (
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                    {logSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th
                              className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-20 text-center cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors tabular-nums"
                              onClick={() => {
                                if (logSortField === 'duration') setLogSortAsc(!logSortAsc);
                                else {
                                  setLogSortField('duration');
                                  setLogSortAsc(false);
                                }
                              }}
                              title="Sort by Duration"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <span>Duration</span>
                                {logSortField === 'duration' && (
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                    {logSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th
                              className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-r border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-28 text-center cursor-pointer hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors"
                              onClick={() => {
                                if (logSortField === 'tag') setLogSortAsc(!logSortAsc);
                                else {
                                  setLogSortField('tag');
                                  setLogSortAsc(true);
                                }
                              }}
                              title="Sort by Category Tag"
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <span>Category Tag</span>
                                {logSortField === 'tag' && (
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                    {logSortAsc ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th className={`sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 ${onDeleteStudyLog ? 'border-r' : ''} border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5`}>
                              Focus Topic &amp; Notes
                            </th>
                            {onDeleteStudyLog && (
                              <th className="sticky top-0 bg-slate-100 dark:bg-zinc-800 border-b-2 border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 w-14 text-center">
                                Action
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.map((log, idx) => {
                            const isEvenRow = idx % 2 === 0;

                            return (
                              <tr
                                key={log.id}
                                className={`group transition-colors duration-150 ${
                                  isEvenRow
                                    ? 'bg-white dark:bg-zinc-900'
                                    : 'bg-slate-50/80 dark:bg-zinc-800/40'
                                } hover:bg-indigo-50/80 dark:hover:bg-zinc-800/70`}
                              >
                                <td className={`sticky left-0 z-10 border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 font-mono text-[9.5px] whitespace-nowrap align-middle ${
                                  isEvenRow ? 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400' : 'bg-slate-50 dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-400'
                                } group-hover:bg-indigo-50 dark:group-hover:bg-zinc-800 transition-colors shadow-[1px_0_3px_rgba(0,0,0,0.04)]`}>
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{log.date}</div>
                                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">{log.timeRange}</div>
                                </td>
                                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 font-bold text-[11.5px] text-zinc-900 dark:text-zinc-100 align-middle">
                                  {log.courseName}
                                </td>
                                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-center tabular-nums align-middle">
                                  <span className="inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs">
                                    {log.durationMinutes}m
                                  </span>
                                </td>
                                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-center whitespace-nowrap align-middle">
                                  <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 shadow-2xs">
                                    {log.tag}
                                  </span>
                                </td>
                                <td className={`border-b ${onDeleteStudyLog ? 'border-r' : ''} border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[10.5px] text-zinc-700 dark:text-zinc-300 max-w-sm align-middle`} title={log.notes}>
                                  <div className="truncate font-sans leading-tight">
                                    {log.notes || '—'}
                                  </div>
                                </td>
                                {onDeleteStudyLog && (
                                  <td className="border-b border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-center align-middle">
                                    <button
                                      type="button"
                                      onClick={() => onDeleteStudyLog(log.id)}
                                      className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                      title="Delete log entry"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Sessions Data Table Footer Strip */}
                    <div className="shrink-0 px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/90 flex items-center justify-between text-[10.5px] text-zinc-500 dark:text-zinc-400 font-mono">
                      <div className="flex items-center gap-3">
                        <span>Showing {filteredLogs.length} of {studyLogs.length} sessions</span>
                        <span>•</span>
                        <span>Total {(filteredLogs.reduce((s, l) => s + l.durationMinutes, 0) / 60).toFixed(1)} hours</span>
                      </div>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        {filteredLogs.length > 0 ? `${Math.round(filteredLogs.reduce((s, l) => s + l.durationMinutes, 0) / filteredLogs.length)}m avg/session` : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Workstation Hub - Resource Linker & Quick Notes (4 cols) */}
        <div className="xl:col-span-4 flex flex-col min-h-[360px] xl:min-h-0 h-auto xl:h-full space-y-2">
          {/* Workstation Panel Segmented Switcher */}
          <div className="shrink-0 flex items-center justify-between bg-[#f5ede3] dark:bg-zinc-800/80 p-1 rounded-md border border-[#ecedef] dark:border-zinc-700/80 shadow-xs">
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setRightPanelTab('resources');
                  try {
                    localStorage.setItem('unisphere_right_panel_tab', 'resources');
                  } catch {}
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  rightPanelTab === 'resources'
                    ? 'bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 shadow-xs'
                    : 'text-[#636b78] dark:text-zinc-400 hover:text-[#2d2f34] dark:hover:text-zinc-200'
                }`}
              >
                <Bookmark size={13} className={rightPanelTab === 'resources' ? 'text-[#6366F1]' : ''} />
                <span>Resource Linker</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#fdf9f4] dark:bg-zinc-800 text-[#3f434a] dark:text-zinc-300 border border-[#ecedef] dark:border-zinc-700">
                  {resources.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRightPanelTab('notes');
                  try {
                    localStorage.setItem('unisphere_right_panel_tab', 'notes');
                  } catch {}
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  rightPanelTab === 'notes'
                    ? 'bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 shadow-xs'
                    : 'text-[#636b78] dark:text-zinc-400 hover:text-[#2d2f34] dark:hover:text-zinc-200'
                }`}
              >
                <FileText size={13} className={rightPanelTab === 'notes' ? 'text-amber-600 dark:text-amber-400' : ''} />
                <span>Quick Notes</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const nextTab = rightPanelTab === 'split' ? 'resources' : 'split';
                setRightPanelTab(nextTab);
                try {
                  localStorage.setItem('unisphere_right_panel_tab', nextTab);
                } catch {}
              }}
              title="Toggle split view (stacked both tools)"
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                rightPanelTab === 'split'
                  ? 'bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 shadow-xs'
                  : 'text-[#636b78] dark:text-zinc-400 hover:text-[#2d2f34] dark:hover:text-zinc-200'
              }`}
            >
              <Columns size={12} />
              <span>Split</span>
            </button>
          </div>

          {/* Active Workstation Tool Content */}
          {rightPanelTab === 'resources' && (
            <ResourceLinkerSection
              resources={resources}
              courses={courses}
              onUpdateResources={onUpdateResources}
              className="flex-1 min-h-[360px] xl:min-h-0 h-full"
            />
          )}

          {rightPanelTab === 'notes' && (
            <QuickNotesSection
              notes={currentNotes}
              onUpdateNotes={handleUpdateNotes}
              className="flex-1 min-h-[320px] xl:min-h-0 h-full"
            />
          )}

          {rightPanelTab === 'split' && (
            <div className="flex-1 flex flex-col gap-3 min-h-0 h-full overflow-y-auto pr-0.5">
              <div className="h-[360px] xl:h-[52%] shrink-0 flex flex-col">
                <ResourceLinkerSection
                  resources={resources}
                  courses={courses}
                  onUpdateResources={onUpdateResources}
                  className="flex-1 min-h-0 h-full"
                />
              </div>
              <div className="h-[320px] xl:h-[48%] shrink-0 flex flex-col">
                <QuickNotesSection
                  notes={currentNotes}
                  onUpdateNotes={handleUpdateNotes}
                  className="flex-1 min-h-0 h-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Quick Action Button in Bottom-Right Corner of Dashboard */}
      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 select-none">
        {/* Speed-dial backdrop click-away overlay when context menu is open */}
        {fabOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/25 dark:bg-black/60 backdrop-blur-[2px] transition-opacity"
            onClick={() => setFabOpen(false)}
          />
        )}

        {/* Quick Action Menu with Embedded Quick Study Functionality */}
        {fabOpen && (
          <div
            role="menu"
            className="absolute bottom-13 right-0 w-72 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-gray-200 dark:border-zinc-800 rounded-md shadow-2xl p-2 space-y-2 z-50 text-left select-none animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <div className="px-2.5 py-1 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800/80 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-zinc-400">
                Quick Actions
              </span>
              <button
                type="button"
                onClick={() => setFabOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer text-xs font-bold leading-none"
                title="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Quick Study Section - Embedded directly inside Quick Action button (NO ICON) */}
            <div className="p-2.5 rounded-md bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setFabOpen(false);
                    setShowQuickStudyModal(true);
                  }}
                  className="text-left group cursor-pointer"
                >
                  <div className="font-bold text-xs text-indigo-950 dark:text-indigo-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Quick Study
                  </div>
                  <div className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                    Instantly record a study session
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFabOpen(false);
                    setShowQuickStudyModal(true);
                  }}
                  className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Custom / Timer
                </button>
              </div>

              {/* 1-Click Instant Presets: Log directly without opening full tracker */}
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {[25, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleInstantQuickStudyLog(mins)}
                    className="py-1 px-1 rounded-md bg-white dark:bg-zinc-900 border border-indigo-200/80 dark:border-indigo-800/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white text-indigo-900 dark:text-indigo-200 font-mono text-[11px] font-bold text-center transition-all cursor-pointer shadow-2xs active:scale-95"
                    title={`Instant log ${mins}m to active course`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Other Actions in Quick Action Menu */}
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                setShowQuickTaskModal(true);
              }}
              className="w-full flex items-center justify-between p-2 rounded-md text-left hover:bg-gray-100 dark:hover:bg-zinc-800/60 text-neutral-900 dark:text-zinc-100 transition-colors cursor-pointer group"
            >
              <div>
                <div className="font-semibold text-xs group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                  New Task / Exam
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-zinc-400">
                  Add assignment, deadline or test
                </div>
              </div>
              <span className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">
                +
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                if (onOpenNewCourse) onOpenNewCourse();
                else onNavigateToCurriculum();
              }}
              className="w-full flex items-center justify-between p-2 rounded-md text-left hover:bg-gray-100 dark:hover:bg-zinc-800/60 text-neutral-900 dark:text-zinc-100 transition-colors cursor-pointer group"
            >
              <div>
                <div className="font-semibold text-xs group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  Add New Course
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-zinc-400">
                  Register syllabus &amp; CFUs
                </div>
              </div>
              <span className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">
                +
              </span>
            </button>
          </div>
        )}

        {/* Floating Quick Action Button - Pure text, NO ICON, Restored Indigo Color, Squared edges */}
        <button
          type="button"
          onClick={() => {
            setFabOpen((prev) => !prev);
          }}
          aria-label="Quick Action"
          title="Quick Action"
          className={`px-4 py-2.5 rounded-md font-bold text-xs sm:text-sm shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer active:scale-95 ring-2 ${
            fabOpen
              ? 'bg-zinc-800 text-white ring-zinc-600 shadow-zinc-900/40'
              : isQuickTimerRunning
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-emerald-400/50 shadow-emerald-600/30 animate-pulse'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white ring-indigo-400/30 shadow-indigo-600/40 hover:shadow-indigo-600/60'
          }`}
        >
          <span className="tracking-tight font-extrabold whitespace-nowrap">
            {fabOpen
              ? 'Close'
              : isQuickTimerRunning
              ? `${Math.floor(quickTimerSeconds / 60)}:${String(quickTimerSeconds % 60).padStart(2, '0')} • Quick Action`
              : 'Quick Action'}
          </span>
        </button>
      </div>

      {/* Dynamic Action Notification Toast */}
      {quickNotification && (
        <div className="fixed bottom-18 right-4 sm:bottom-20 sm:right-6 z-50 bg-neutral-900 text-white px-3.5 py-2 rounded-md text-xs shadow-xl flex items-center gap-2 border border-zinc-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="material-symbols-outlined text-[15px] text-emerald-400">check_circle</span>
          <span>{quickNotification}</span>
        </div>
      )}

      {/* Quick Modals from Context Menu */}
      {showQuickTaskModal && (
        <NewAssignmentModal
          courses={courses}
          onClose={() => setShowQuickTaskModal(false)}
          onAdd={handleCreateQuickTask}
        />
      )}

      {/* Dedicated Floating 'Quick Study' Instant Record Modal */}
      {showQuickStudyModal && (
        <QuickStudyModal
          courses={courses}
          isOpen={showQuickStudyModal}
          onClose={() => setShowQuickStudyModal(false)}
          onAddStudyLog={handleCreateQuickStudyLog}
          onSuccessNotification={(msg) => {
            setQuickNotification(msg);
            setTimeout(() => setQuickNotification(null), 3500);
          }}
          isTimerRunning={isQuickTimerRunning}
          timerSeconds={quickTimerSeconds}
          timerCourse={quickTimerCourse}
          onToggleTimer={(cName) => {
            setQuickTimerCourse(cName);
            setIsQuickTimerRunning((prev) => !prev);
          }}
          onResetTimer={() => {
            setIsQuickTimerRunning(false);
            setQuickTimerSeconds(0);
          }}
        />
      )}
    </div>
  );
};
