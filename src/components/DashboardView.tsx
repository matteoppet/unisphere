import React, { useState } from 'react';
import {
  Course,
  StudyLog,
  StudentProfile,
} from '../types';
import { QuickNotesSection } from './QuickNotesSection';
import { playClickBeep } from '../utils/audio';

interface DashboardViewProps {
  profile: StudentProfile;
  courses: Course[];
  studyLogs: StudyLog[];
  quickNotes?: string;
  onUpdateQuickNotes?: (notes: string) => void;
  onAddStudyLog: (log: Omit<StudyLog, 'id' | 'timestamp'>) => void;
  onOpenCourseDetail: (course: Course) => void;
  onOpenColumnsModal: () => void;
  onOpenEmailGroup: () => void;
  onNavigateToCurriculum: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  courses,
  studyLogs,
  quickNotes = '',
  onUpdateQuickNotes,
  onAddStudyLog,
  onOpenCourseDetail,
  onOpenColumnsModal,
  onOpenEmailGroup,
  onNavigateToCurriculum,
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
    courses.find((c) => c.status === 'active')?.title || 'Distributed Systems & Cloud Computing'
  );
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [notes, setNotes] = useState('');
  const [sessionJustAdded, setSessionJustAdded] = useState(false);

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

  // Calculate weighted GPA on completed courses
  const totalCfuForGpa = completedCourses.reduce((sum, c) => sum + c.cfu, 0);
  const weightedSum = completedCourses.reduce(
    (sum, c) => sum + (c.finalGrade || c.estGrade) * c.cfu,
    0
  );
  const weightedGpa =
    totalCfuForGpa > 0 ? (weightedSum / totalCfuForGpa).toFixed(1) : '28.6';

  // GPA 4.0 scale equivalent: (gpa / 30) * 4
  const gpa4Scale = ((parseFloat(weightedGpa) / 30) * 4).toFixed(2);

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
    playClickBeep();
    setSessionJustAdded(true);
    setTimeout(() => setSessionJustAdded(false), 2400);
  };

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-2 sm:p-3.5 space-y-2.5 sm:space-y-3.5">
      {/* 1. DEGREE TELEMETRY & MILESTONE BANNER */}
      <div className="border border-gray-200 bg-white rounded-xl p-2.5 sm:p-3.5 text-xs shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Degree & Institution Lockup */}
          <div className="py-0.5">
            <h1 className="font-extrabold text-sm sm:text-lg lg:text-xl text-neutral-900 tracking-tight leading-tight">
              {profile.degreeName}
            </h1>
            <div className="text-[10px] sm:text-[11px] text-neutral-600 font-sans flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="font-semibold text-neutral-800">
                {profile.institution || 'Alma Mater Studiorum - Università di Bologna'}
              </span>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-700 font-medium">
                {profile.degreeType || 'Laurea Triennale'}
              </span>
            </div>
          </div>

          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 text-[10.5px] sm:text-[11px]">
            {/* Total Earned CFU */}
            <div className="bg-slate-50/70 border border-gray-200 p-1.5 sm:p-2 rounded-lg min-w-[100px] shadow-2xs">
              <div className="text-neutral-500 text-[9.5px] sm:text-[10px] uppercase font-semibold">
                Total Earned
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-sm sm:text-base text-neutral-900 font-mono">
                  {totalEarnedCFU}
                </span>
                <span className="text-neutral-600 text-[9.5px] sm:text-[10px]">
                  / {targetCFU} CFU
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1 sm:h-1.5 rounded-full overflow-hidden mt-0.5 sm:mt-1">
                <div
                  className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${donePercent}%` }}
                />
              </div>
            </div>

            {/* Weighted GPA */}
            <div className="bg-slate-50/70 border border-gray-200 p-1.5 sm:p-2 rounded-lg min-w-[100px] shadow-2xs">
              <div className="text-neutral-500 text-[9.5px] sm:text-[10px] uppercase font-semibold">
                Weighted GPA
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-sm sm:text-base text-neutral-900 font-mono">
                  {weightedGpa}
                </span>
                <span className="text-neutral-600 text-[9.5px] sm:text-[10px]">/ 30.0</span>
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-neutral-500 font-mono mt-1 sm:mt-2">
                Equiv. {gpa4Scale} / 4.0 Scale
              </div>
            </div>

            {/* Weekly Focus */}
            <div className="col-span-2 sm:col-span-1 bg-slate-50/70 border border-gray-200 p-1.5 sm:p-2 rounded-lg min-w-[100px] shadow-2xs">
              <div className="text-neutral-500 text-[9.5px] sm:text-[10px] uppercase font-semibold">
                Weekly Focus
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-sm sm:text-base text-emerald-700 font-mono">
                  {weeklyHours}h
                </span>
                <span className="text-neutral-600 text-[9.5px] sm:text-[10px]">
                  / {profile.weeklyGoalHours}h
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1 sm:h-1.5 rounded-full overflow-hidden mt-0.5 sm:mt-1">
                <div
                  className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${weeklyGoalPercent}%` }}
                />
              </div>
              <div className="text-[9.5px] sm:text-[10px] text-neutral-500 font-mono mt-0.5">
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
          <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 border-b border-gray-200 px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800">
                <span className="material-symbols-outlined text-[15px] text-blue-700">
                  table_view
                </span>
                <span>Active Courses</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  className="win-button px-1.5 sm:px-2 py-0.5 text-[10.5px] sm:text-[11px] flex items-center gap-1 text-neutral-800"
                  onClick={onOpenEmailGroup}
                  title="Email all active course instructors"
                >
                  <span className="material-symbols-outlined text-[12px] sm:text-[13px]">
                    mail
                  </span>
                  <span>Email Group</span>
                </button>
                <button
                  className="win-button px-1.5 sm:px-2 py-0.5 text-[10.5px] sm:text-[11px] flex items-center gap-1 text-blue-800 font-medium"
                  onClick={onNavigateToCurriculum}
                  title="Open Complete Degree Curriculum"
                >
                  <span>Go to page</span>
                  <span className="material-symbols-outlined text-[12px] sm:text-[13px]">
                    open_in_new
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile Cards View (Ultra-compact layout for phone screens) */}
            <div className="sm:hidden p-1.5 space-y-1.5">
              {activeCourses.map((course) => {
                const badgeClass =
                  course.nextDeliverable?.badgeColor === 'red'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : course.nextDeliverable?.badgeColor === 'amber'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200';

                return (
                  <div
                    key={course.id}
                    onClick={() => onOpenCourseDetail(course)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200/90 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer shadow-2xs flex flex-col gap-1"
                  >
                    {/* Compact Row 1: Title + CFU badge */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="font-semibold text-xs text-neutral-900 truncate leading-snug">
                        {course.title}
                      </div>
                      <span className="shrink-0 font-mono font-bold text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-gray-200 leading-none">
                        {course.cfu} CFU
                      </span>
                    </div>

                    {/* Compact Row 2: Deliverable pill + Instructor Email + View link */}
                    <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-500">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        {course.nextDeliverable ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 border rounded text-[9.5px] font-semibold leading-none truncate ${badgeClass}`}
                          >
                            {course.nextDeliverable.title}
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-mono text-[9px] leading-none">
                            No deliverable
                          </span>
                        )}
                        <span className="text-neutral-300">•</span>
                        <a
                          href={`mailto:${course.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline truncate text-[10px]"
                          title={course.email}
                        >
                          {course.email}
                        </a>
                      </div>

                      <div className="flex items-center gap-0.5 text-blue-600 font-medium shrink-0 ml-1">
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

            {/* Desktop Table View (Visible on tablet/desktop) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="sticky top-0 bg-slate-50/90 border-b border-gray-200">
                  <tr className="font-semibold text-slate-700">
                    <th className="win-header-cell px-2.5 py-1.5 cursor-pointer">
                      Course Title &amp; Instructor{' '}
                      <span className="text-neutral-400 font-mono text-[9px]">
                        ▲
                      </span>
                    </th>
                    <th className="win-header-cell px-2.5 py-1.5 w-16 text-right cursor-pointer tabular-nums">
                      CFU
                    </th>
                    <th className="win-header-cell px-2.5 py-1.5 w-32 cursor-pointer">
                      Incoming
                    </th>
                    <th className="win-header-cell px-2.5 py-1.5 w-16 text-center cursor-pointer">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-sans">
                  {activeCourses.map((course, idx) => {
                    const badgeClass =
                      course.nextDeliverable?.badgeColor === 'red'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : course.nextDeliverable?.badgeColor === 'amber'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-800 border-slate-200';

                    return (
                      <tr
                        key={course.id}
                        onClick={() => onOpenCourseDetail(course)}
                        className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${
                          idx % 2 === 1 ? 'bg-slate-50/30' : ''
                        }`}
                      >
                        <td className="px-2.5 py-2">
                          <div className="font-bold text-neutral-900 group-hover:text-blue-700">
                            {course.title}
                          </div>
                          <div className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                            <a
                              href={`mailto:${course.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline"
                            >
                              {course.email}
                            </a>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono font-bold text-neutral-800 tabular-nums">
                          {course.cfu}
                        </td>
                        <td className="px-2.5 py-2">
                          {course.nextDeliverable ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 border rounded-md text-[10px] font-semibold ${badgeClass}`}
                            >
                              {course.nextDeliverable.title}
                            </span>
                          ) : (
                            <span className="text-neutral-400 font-mono text-[10px]">
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <button
                            className="win-button px-2 py-0.5 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCourseDetail(course);
                            }}
                            title="Open Course Details"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Minimal Compact Week Study Schedule Chart */}
          <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 border-b border-gray-200 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800">
                <span className="material-symbols-outlined text-[15px] text-emerald-700">
                  calendar_view_week
                </span>
                <span>Current Week</span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] pb-1.5 border-b border-gray-100">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-neutral-900 font-mono text-xs">
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
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs ring-1 ring-emerald-200/70'
                          : 'bg-slate-50/60 border-gray-200 text-neutral-400'
                      }`}
                    >
                      <div className="w-full pb-0.5 sm:pb-1 border-b border-inherit">
                        <div
                          className={`text-[8px] sm:text-[9px] font-bold uppercase ${
                            isGreen ? 'text-emerald-800' : 'text-neutral-500'
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
                            isGreen ? 'text-emerald-800' : 'text-neutral-400'
                          }`}
                        >
                          {wd.hours}
                        </div>
                        <div
                          className={`text-[7px] sm:text-[9px] font-mono leading-tight ${
                            isGreen ? 'text-emerald-700 font-semibold' : 'text-neutral-400'
                          }`}
                        >
                          {wd.sessionCount}s
                        </div>
                      </div>

                      <div className="w-full pt-0.5 flex justify-center">
                        {isGreen ? (
                          <span
                            className="inline-flex items-center justify-center w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-600 text-white text-[7px] sm:text-[8px] font-bold"
                            title={`${wd.sessionCount} session(s)`}
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200" />
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
          <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 border-b border-gray-200 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800">
                <span className="material-symbols-outlined text-[15px] text-blue-600">
                  add_circle
                </span>
                <span>Log Study Session</span>
                <span className="px-1 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-mono uppercase font-bold tracking-wider">
                  Quick Add
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                {activeCourses.length} active
              </span>
            </div>

            <div className="p-2.5 sm:p-3 text-xs">
              <form onSubmit={handleSubmitSession} className="space-y-2 sm:space-y-2.5">
                {/* Target Course */}
                <div className="space-y-0.5">
                  <label
                    className="text-[10px] font-bold text-neutral-700 uppercase tracking-wide block"
                    htmlFor="course-select"
                  >
                    Target Course
                  </label>
                  <select
                    id="course-select"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full text-[11px] py-1.5 px-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-medium transition-all"
                    required
                  >
                    {activeCourses.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.shortTitle || c.title} ({c.cfu} CFU)
                      </option>
                    ))}
                  </select>
                </div>

              {/* Date & Duration inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label
                    className="text-[10px] font-bold text-neutral-700 uppercase tracking-wide"
                    htmlFor="session-date"
                  >
                    Date
                  </label>
                  <input
                    id="session-date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full text-[11px] py-1.5 px-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-blue-500 font-mono transition-all"
                  />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-[10px] font-bold text-neutral-700 uppercase tracking-wide"
                      htmlFor="session-duration"
                    >
                      Duration
                    </label>
                    <span className="text-[10px] font-mono text-blue-700 font-bold">
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
                    className="w-full text-[11px] py-1.5 px-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-blue-500 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Preset duration pills for instant 1-click selection */}
              <div className="flex items-center gap-1 pt-0.5">
                <span className="text-[9px] font-mono text-neutral-500 uppercase">Preset:</span>
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
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-gray-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              {/* Notes */}
              <div className="space-y-0.5">
                <label
                  className="text-[10px] font-bold text-neutral-700 uppercase tracking-wide"
                  htmlFor="session-topic"
                >
                  Notes / Topic
                </label>
                <textarea
                  id="session-topic"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Chapter 4 problem set, query analysis, slide review..."
                  className="w-full text-[11px] p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-none font-sans transition-all"
                />
              </div>

              {/* Action Button & Confirmation feedback */}
              <div className="pt-1 flex flex-col gap-1">
                {sessionJustAdded ? (
                  <div className="py-2 px-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">
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
    </div>
  );
};
