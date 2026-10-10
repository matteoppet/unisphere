import React, { useState, useEffect } from 'react';
import { StudyLog, Course, StudyTag } from '../types';

interface StudyTrackerViewProps {
  studyLogs: StudyLog[];
  courses: Course[];
  onAddStudyLog: (log: Omit<StudyLog, 'id' | 'timestamp'>) => void;
  onDeleteStudyLog: (id: string) => void;
  onExportCsv: () => void;
}

export const StudyTrackerView: React.FC<StudyTrackerViewProps> = ({
  studyLogs,
  courses,
  onAddStudyLog,
  onDeleteStudyLog,
  onExportCsv,
}) => {
  const [courseFilter, setCourseFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [searchNotes, setSearchNotes] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Modal State for adding a session
  const [showAddModal, setShowAddModal] = useState(false);
  // Modal State for delete confirmation
  const [deleteConfirmLog, setDeleteConfirmLog] = useState<StudyLog | null>(null);

  const [selectedCourse, setSelectedCourse] = useState(
    courses[0]?.shortTitle || courses[0]?.title || ''
  );
  const [sessionDate, setSessionDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [tag, setTag] = useState<StudyTag>('Deep Work');
  const [notes, setNotes] = useState('');

  // Close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmLog) {
          setDeleteConfirmLog(null);
        } else if (showAddModal) {
          setShowAddModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal, deleteConfirmLog]);

  const handleOpenAddModal = () => {
    const active = courses.find((c) => c.status === 'active') || courses[0];
    if (active) {
      setSelectedCourse(active.shortTitle || active.title);
    }
    setSessionDate(new Date().toISOString().split('T')[0]);
    setDurationMinutes(60);
    setTag('Deep Work');
    setNotes('');
    setShowAddModal(true);
  };

  const handleSubmitSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    const matchedCourse = courses.find(
      (c) => c.title === selectedCourse || c.shortTitle === selectedCourse
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = sessionDate === todayStr ? 'Today' : sessionDate;
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    onAddStudyLog({
      courseName: matchedCourse ? matchedCourse.shortTitle : selectedCourse,
      courseId: matchedCourse?.id,
      durationMinutes: Number(durationMinutes),
      date: sessionDate,
      timeRange: `${prefix} ${nowTime}`,
      notes: notes.trim() || 'General course syllabus study & topic review.',
      rating: 5,
      tag,
    });

    setShowAddModal(false);
    setNotes('');
  };

  // Total metrics
  const totalMinutes = studyLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Hours per course breakdown
  const courseTimeMap: { [course: string]: number } = {};
  studyLogs.forEach((l) => {
    courseTimeMap[l.courseName] =
      (courseTimeMap[l.courseName] || 0) + l.durationMinutes;
  });

  // Calculate current week (Monday through Sunday)
  const referenceDateStr =
    studyLogs.length > 0 ? studyLogs[0].date : new Date().toISOString().split('T')[0];
  const refDate = new Date(referenceDateStr);
  const dayOfWeek = refDate.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + distanceToMonday);

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

  // Filtered study logs
  const filteredLogs = studyLogs.filter((log) => {
    if (
      courseFilter !== 'all' &&
      log.courseName !== courseFilter &&
      !log.courseName.toLowerCase().includes(courseFilter.toLowerCase()) &&
      !courseFilter.toLowerCase().includes(log.courseName.toLowerCase())
    ) {
      return false;
    }
    if (tagFilter !== 'all' && log.tag !== tagFilter) return false;
    if (searchNotes.trim()) {
      const q = searchNotes.toLowerCase();
      return (
        log.notes.toLowerCase().includes(q) ||
        log.courseName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleRowExpand = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5 select-none">
      {/* 1. FIRST WIDGET: Current Week */}
      <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Widget Header - Inside the widget */}
        <div className="bg-slate-50/80 border-b border-gray-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800">
              <span className="material-symbols-outlined text-[15px] text-emerald-700">
                calendar_view_week
              </span>
              <span>Current Week</span>
            </div>
            <span className="text-neutral-300 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-neutral-900 font-mono text-xs">
                {weekTotalHours}h Focus Time
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-neutral-600 font-medium">
            <button
              onClick={onExportCsv}
              className="win-button px-2 py-1 text-[10px] font-semibold text-neutral-700 flex items-center gap-1 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Export study records as CSV"
            >
              <span className="material-symbols-outlined text-[13px] text-amber-700">
                file_download
              </span>
              <span>Export (CSV)</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-2.5 py-1 text-[11px] font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              title="Record new study session"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add Session</span>
            </button>
          </div>
        </div>

        <div className="p-3 text-xs space-y-2">
          {/* 7-Day Columns (Mon - Sun) */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-0.5">
            {weekDays.map((wd) => {
              const isGreen = wd.hasSessions;

              return (
                <div
                  key={wd.dateStr}
                  className={`py-1.5 sm:py-2 px-0.5 sm:px-1 rounded-lg border flex flex-col items-center justify-between text-center transition-all ${
                    isGreen
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs ring-1 ring-emerald-200/70'
                      : 'bg-slate-50/60 border-gray-200 text-neutral-400'
                  }`}
                >
                  <div className="w-full pb-0.5 sm:pb-1 border-b border-inherit">
                    <div
                      className={`text-[8px] sm:text-[10px] font-bold uppercase ${
                        isGreen ? 'text-emerald-800' : 'text-neutral-500'
                      }`}
                    >
                      {wd.shortDay}
                    </div>
                    <div className="text-[7px] sm:text-[8px] font-mono opacity-80 leading-tight">
                      {wd.formattedDate}
                    </div>
                  </div>

                  <div className="my-1 sm:my-2 flex flex-col items-center">
                    <div
                      className={`font-mono font-bold text-[10px] sm:text-sm leading-tight ${
                        isGreen ? 'text-emerald-800' : 'text-neutral-400'
                      }`}
                    >
                      {wd.hours}
                    </div>
                    <div
                      className={`text-[7px] sm:text-[10px] font-mono leading-tight mt-0.5 ${
                        isGreen ? 'text-emerald-700 font-semibold' : 'text-neutral-400'
                      }`}
                    >
                      {wd.sessionCount}s
                    </div>
                  </div>

                  <div className="w-full pt-0.5 sm:pt-1 flex justify-center">
                    {isGreen ? (
                      <span
                        className="inline-flex items-center justify-center w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-600 text-white text-[7px] sm:text-[9px] font-bold"
                        title={`${wd.sessionCount} session(s) logged`}
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

      {/* 2. Course Distribution Analysis */}
      <div className="border border-gray-200 bg-white rounded-xl shadow-sm p-3 text-xs">
        <div className="font-bold text-[11px] text-neutral-800 border-b border-gray-100 pb-1.5 flex items-center justify-between">
          <span>Course Distribution Analysis</span>
          <span className="font-mono text-[10px] text-neutral-500">
            {totalHours}h Logged Total
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5 pt-2">
          {Object.entries(courseTimeMap).map(([cName, mins]) => {
            const hrs = (mins / 60).toFixed(1);
            const pct =
              totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;

            return (
              <div key={cName} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium text-neutral-900 truncate">
                    {cName}
                  </span>
                  <span className="font-mono text-neutral-600 text-[10px]">
                    {hrs}h ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Audit Logs Table */}
      <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Filters & Display Controls */}
        <div className="bg-slate-50/80 border-b border-gray-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-neutral-700">
              Filter:
            </span>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="text-[11px] py-1 px-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.shortTitle}>
                  {c.shortTitle}
                </option>
              ))}
            </select>

            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="text-[11px] py-1 px-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="all">All Cognitive Tags</option>
              <option value="Deep Work">Deep Work</option>
              <option value="Problem Solving">Problem Solving</option>
              <option value="Review">Review</option>
              <option value="Lab Work">Lab Work</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Search notes / topics..."
              value={searchNotes}
              onChange={(e) => setSearchNotes(e.target.value)}
              className="text-[11px] px-2.5 py-1 border border-gray-200 rounded-lg bg-white flex-1 sm:w-48 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleOpenAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-2.5 py-1 text-[11px] font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              title="Add Session"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add Session</span>
            </button>
          </div>
        </div>

        {/* Mobile Cards View (Ultra-compact for mobile layout) */}
        <div className="sm:hidden p-1.5 space-y-1.5">
          {filteredLogs.map((log) => {
            const hours = Math.floor(log.durationMinutes / 60);
            const mins = log.durationMinutes % 60;
            const durStr =
              hours > 0
                ? `${hours}h ${mins > 0 ? `${mins}m` : ''}`
                : `${mins}m`;

            return (
              <div
                key={log.id}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200/90 bg-white shadow-2xs flex flex-col gap-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="font-semibold text-xs text-neutral-900 truncate leading-snug">
                    {log.courseName}
                  </div>
                  <span className="shrink-0 font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 leading-none">
                    {durStr}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span className="font-mono">{log.date} • {log.timeRange}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[9px] font-semibold">
                      {log.tag}
                    </span>
                    <button
                      onClick={() => setDeleteConfirmLog(log)}
                      className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50"
                      title="Delete log"
                    >
                      <span className="material-symbols-outlined text-[13px] leading-none">delete</span>
                    </button>
                  </div>
                </div>

                {log.notes && (
                  <p className="text-[10px] text-neutral-600 bg-slate-50 px-1.5 py-0.5 rounded border border-gray-100 leading-snug truncate">
                    {log.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto max-h-[420px]">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="sticky top-0 bg-slate-50/90 border-b border-gray-200 z-10">
              <tr className="font-semibold text-slate-700">
                <th className="win-header-cell px-2.5 py-1.5 w-28">Date &amp; Time</th>
                <th className="win-header-cell px-2.5 py-1.5">Target Course</th>
                <th className="win-header-cell px-2.5 py-1.5 w-20 text-right">
                  Duration
                </th>
                <th className="win-header-cell px-2.5 py-1.5 w-28 text-center">
                  Focus Tag
                </th>
                <th className="win-header-cell px-2.5 py-1.5 w-20 text-center">
                  Notes
                </th>
                <th className="win-header-cell px-2.5 py-1.5 w-16 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {filteredLogs.map((log) => {
                const hours = Math.floor(log.durationMinutes / 60);
                const mins = log.durationMinutes % 60;
                const durStr =
                  hours > 0
                    ? `${hours}h ${mins > 0 ? `${mins}m` : ''}`
                    : `${mins}m`;

                const isExpanded = expandedRowId === log.id;

                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-2.5 py-2 font-mono text-neutral-600 text-[10px]">
                        <div>{log.date}</div>
                        <div className="text-[9px] text-neutral-400">
                          {log.timeRange}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 font-bold text-neutral-900">
                        {log.courseName}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-neutral-900 font-semibold">
                        {durStr}
                      </td>

                      <td className="px-2.5 py-2 text-center">
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[10px] font-semibold">
                          {log.tag}
                        </span>
                      </td>

                      {/* In compact mode, show an expand note button */}
                      <td className="px-2.5 py-2 text-center">
                        <button
                          onClick={() => toggleRowExpand(log.id)}
                          className={`win-button px-2 py-0.5 text-[10px] flex items-center justify-center gap-0.5 mx-auto ${
                            isExpanded ? 'bg-amber-50 border-amber-300 font-semibold text-amber-900' : ''
                          }`}
                          title="Inspect session note"
                        >
                          <span>{isExpanded ? 'Hide' : 'View'}</span>
                        </button>
                      </td>

                      <td className="px-2.5 py-2 text-center">
                        <button
                          onClick={() => setDeleteConfirmLog(log)}
                          className="win-button px-2 py-0.5 text-red-700 text-[10px] hover:bg-red-50"
                          title="Delete log entry"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>

                    {/* Expandable note drawer row */}
                    {isExpanded && (
                      <tr className="bg-amber-50/40 border-b border-amber-200">
                        <td
                          colSpan={6}
                          className="px-3.5 py-2 text-[10px] text-neutral-800"
                        >
                          <div className="flex items-start gap-1.5">
                            <span className="font-semibold text-neutral-900 shrink-0">
                              Description &amp; Objectives:
                            </span>
                            <span className="text-neutral-700 leading-relaxed">
                              {log.notes}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Adding Study Session */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col text-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Title Bar */}
            <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="material-symbols-outlined text-[18px] text-indigo-600 shrink-0">
                  query_stats
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Add Study Session</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitSession} className="p-4 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Target Course <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-indigo-500"
                  required
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.shortTitle || c.title}>
                      {c.shortTitle || c.title} ({c.cfu} CFU)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700 block">
                      Duration (Minutes) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-indigo-700 font-bold">
                      {durationMinutes} min
                    </span>
                  </div>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    required
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Math.max(15, parseInt(e.target.value) || 15))
                    }
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-neutral-500 uppercase">Presets:</span>
                {[30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`px-2 py-0.5 text-[10px] rounded-md font-mono transition-colors cursor-pointer ${
                      durationMinutes === mins
                        ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-gray-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Cognitive Tag
                </label>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value as StudyTag)}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Deep Work">Deep Work</option>
                  <option value="Problem Solving">Problem Solving</option>
                  <option value="Review">Review</option>
                  <option value="Lab Work">Lab Work</option>
                  <option value="Exam Prep">Exam Prep</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Notes &amp; Objectives
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Chapter 4 problem set, query analysis, slide review..."
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">add_task</span>
                  <span>Save Session</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Deleting Study Session */}
      {deleteConfirmLog && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setDeleteConfirmLog(null)}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col text-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Title Bar */}
            <div className="bg-rose-50/80 border-b border-rose-100 px-4 py-3 flex items-center justify-between text-rose-900 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0">
                  delete_forever
                </span>
                <h3 className="text-xs font-bold text-rose-900">Delete Study Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmLog(null)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-3">
              <p className="text-neutral-700 text-xs leading-relaxed">
                Are you sure you want to delete this study session log?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1 text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-xs">
                    {deleteConfirmLog.courseName}
                  </span>
                  <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                    {deleteConfirmLog.durationMinutes} min
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {deleteConfirmLog.date} • {deleteConfirmLog.timeRange}
                </div>
                {deleteConfirmLog.notes && (
                  <div className="text-[10px] text-slate-600 truncate border-t border-slate-200/60 pt-1 mt-1">
                    {deleteConfirmLog.notes}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[13px]">warning</span>
                This action cannot be undone.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmLog(null)}
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200/70 border border-gray-200 rounded-lg transition-colors cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStudyLog(deleteConfirmLog.id);
                  setDeleteConfirmLog(null);
                }}
                className="px-3.5 py-1.5 text-xs bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                <span>Delete Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
