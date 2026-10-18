import React, { useState } from 'react';
import { Course, StudentProfile } from '../types';
import { StatusBadge } from './StatusBadge';

interface CurriculumViewProps {
  courses: Course[];
  profile: StudentProfile;
  onOpenCourseDetail: (course: Course) => void;
  onOpenNewCourse: () => void;
  onUpdateCourse: (course: Course) => void;
  onDeleteCourse?: (courseId: string) => void;
}

export const CurriculumView: React.FC<CurriculumViewProps> = ({
  courses,
  profile,
  onOpenCourseDetail,
  onOpenNewCourse,
  onUpdateCourse,
  onDeleteCourse,
}) => {
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter courses
  const filteredCourses = courses.filter((c) => {
    if (selectedYear !== 'all' && c.year !== selectedYear) return false;
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate metrics
  const completed = courses.filter((c) => c.status === 'completed');
  const active = courses.filter((c) => c.status === 'active');
  const planned = courses.filter((c) => c.status === 'planned');

  const completedCFU = completed.reduce((sum, c) => sum + c.cfu, 0);
  const activeCFU = active.reduce((sum, c) => sum + c.cfu, 0);
  const plannedCFU = planned.reduce((sum, c) => sum + c.cfu, 0);
  const targetCFU = profile.totalTargetCFU || 180;

  // Status badge with appealing modern styling
  const renderStatusBadge = (status: Course['status'], isCompact = false) => {
    return <StatusBadge status={status} size={isCompact ? 'sm' : 'md'} />;
  };

  return (
    <div className="flex-1 bg-gray-50 dark:bg-zinc-950 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5 select-none transition-colors">
      {/* Telemetry Header */}
      <div className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
            <div className="bg-slate-50/70 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 p-3 sm:p-3.5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-neutral-500 dark:text-zinc-400 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                  Completed (Passed)
                </div>
                <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tracking-tight leading-none">
                    {completedCFU}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-500 dark:text-zinc-400 font-mono">
                    / {targetCFU} CFU
                  </span>
                </div>
              </div>
              <div className="text-[10px] sm:text-[10.5px] text-neutral-500 dark:text-zinc-400 font-mono mt-2 pt-1.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <span>{completed.length} examinations recorded</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {Math.round((completedCFU / targetCFU) * 100)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-50/70 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 p-3 sm:p-3.5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-neutral-500 dark:text-zinc-400 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                  Active Enrolled (Term)
                </div>
                <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-blue-700 dark:text-blue-400 font-mono tracking-tight leading-none">
                    {activeCFU}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-500 dark:text-zinc-400 font-mono">
                    CFU
                  </span>
                </div>
              </div>
              <div className="text-[10px] sm:text-[10.5px] text-neutral-500 dark:text-zinc-400 font-mono mt-2 pt-1.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <span>{active.length} active courses ongoing</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {Math.round((activeCFU / targetCFU) * 100)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-50/70 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 p-3 sm:p-3.5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-neutral-500 dark:text-zinc-400 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                  Planned Ahead (Year 3)
                </div>
                <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-amber-700 dark:text-amber-400 font-mono tracking-tight leading-none">
                    {plannedCFU}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-500 dark:text-zinc-400 font-mono">
                    CFU
                  </span>
                </div>
              </div>
              <div className="text-[10px] sm:text-[10.5px] text-neutral-500 dark:text-zinc-400 font-mono mt-2 pt-1.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <span>{planned.length} syllabus modules remaining</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {Math.round((plannedCFU / targetCFU) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* Courses List Table with Controls */}
      <div className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Controls Toolbar */}
        <div className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedYear('all')}
                className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.98] whitespace-nowrap ${
                  selectedYear === 'all'
                    ? 'font-semibold bg-indigo-50 dark:bg-zinc-800 border-indigo-200 dark:border-zinc-700 text-indigo-700 dark:text-zinc-100 shadow-2xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedYear(1)}
                className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.98] whitespace-nowrap ${
                  selectedYear === 1
                    ? 'font-semibold bg-indigo-50 dark:bg-zinc-800 border-indigo-200 dark:border-zinc-700 text-indigo-700 dark:text-zinc-100 shadow-2xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                Y1 (60)
              </button>
              <button
                onClick={() => setSelectedYear(2)}
                className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.98] whitespace-nowrap ${
                  selectedYear === 2
                    ? 'font-semibold bg-indigo-50 dark:bg-zinc-800 border-indigo-200 dark:border-zinc-700 text-indigo-700 dark:text-zinc-100 shadow-2xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                Y2 (60)
              </button>
              <button
                onClick={() => setSelectedYear(3)}
                className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.98] whitespace-nowrap ${
                  selectedYear === 3
                    ? 'font-semibold bg-indigo-50 dark:bg-zinc-800 border-indigo-200 dark:border-zinc-700 text-indigo-700 dark:text-zinc-100 shadow-2xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                Y3 (60)
              </button>
            </div>

            <div className="h-4 w-[1px] bg-gray-200 dark:bg-zinc-700 mx-0.5 hidden sm:block"></div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-[11px] py-1 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed Only</option>
              <option value="active">Active Only</option>
              <option value="planned">Planned Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Search course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-[11px] px-2.5 py-1 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 placeholder:text-neutral-400 dark:placeholder:text-zinc-500 flex-1 sm:w-44 focus:outline-none focus:border-blue-500 dark:focus:border-indigo-500"
            />
            <button
              onClick={onOpenNewCourse}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-2.5 py-1 text-[11px] font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add Course</span>
            </button>
          </div>
        </div>

        {/* Empty state when no courses exist */}
        {filteredCourses.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-900/40">
            <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-zinc-600 block mb-1.5">
              menu_book
            </span>
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">No courses in curriculum</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5 mb-3">Build your academic plan by adding your modules and CFU credits.</p>
            <button
              onClick={onOpenNewCourse}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add First Course</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (Ultra-compact for mobile layout) */}
            <div className="sm:hidden p-1.5 space-y-1.5">
              {filteredCourses.map((c) => {
                return (
                  <div
                    key={c.id}
                    onClick={() => onOpenCourseDetail(c)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 active:bg-slate-100 dark:active:bg-zinc-800 transition-colors cursor-pointer shadow-2xs flex flex-col gap-1"
                  >
                    {/* Compact Row 1: Title + CFU */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="font-semibold text-xs text-neutral-900 dark:text-zinc-100 truncate leading-snug">
                        {c.title}
                      </div>
                      <span className="shrink-0 font-mono font-bold text-[10px] tabular-nums bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 leading-none">
                        {c.cfu} CFU
                      </span>
                    </div>

                    {/* Compact Row 2: Status + Email + Progress + Arrow */}
                    <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        {renderStatusBadge(c.status, true)}
                        {c.email && (
                          <>
                            <span className="text-neutral-300 dark:text-zinc-600">•</span>
                            <a
                              href={`mailto:${c.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 dark:text-blue-400 hover:underline truncate text-[10px]"
                              title={c.email}
                            >
                              {c.email}
                            </a>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <div className="w-10 bg-slate-200 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 dark:bg-blue-500 h-full rounded-full"
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-[9px] text-slate-600 dark:text-zinc-400">
                          {c.progress}%
                        </span>
                        <span className="material-symbols-outlined text-[13px] text-blue-600 dark:text-blue-400 ml-0.5 leading-none">
                          chevron_right
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="sticky top-0 bg-slate-50/90 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 z-10">
                  <tr className="font-semibold text-slate-700 dark:text-zinc-300">
                    <th className="win-header-cell px-2.5 py-1.5">Name</th>
                    <th className="win-header-cell px-2.5 py-1.5 w-16 text-right tabular-nums">CFU</th>
                    <th className="win-header-cell px-2.5 py-1.5 w-28 text-center">Status</th>
                    <th className="win-header-cell px-2.5 py-1.5 w-32 text-right tabular-nums">Progress</th>
                    <th className="win-header-cell px-2.5 py-1.5 w-20 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/80 font-sans">
                  {filteredCourses.map((c, idx) => {
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onOpenCourseDetail(c)}
                        className={`hover:bg-blue-50/50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group ${
                          idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-zinc-900/40' : ''
                        }`}
                      >
                        <td className="px-2.5 py-2">
                          <div className="font-bold text-neutral-900 dark:text-zinc-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                            {c.title}
                          </div>
                          {c.email && (
                            <div className="text-[10px] text-neutral-500 dark:text-zinc-400 mt-0.5">
                              <a
                                href={`mailto:${c.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {c.email}
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono font-bold text-neutral-900 dark:text-zinc-100 tabular-nums">
                          {c.cfu}
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          {renderStatusBadge(c.status)}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden shrink-0">
                              <div
                                className="bg-blue-600 dark:bg-blue-500 h-full transition-all rounded-full"
                                style={{ width: `${c.progress}%` }}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-[10px] w-9 text-right font-semibold text-neutral-800 dark:text-zinc-200 shrink-0">
                              {c.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCourseDetail(c);
                              }}
                              className="px-2.5 py-1 text-[10px] font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                            >
                              Inspect
                            </button>
                            {onDeleteCourse && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete course "${c.title}"?`)) {
                                    onDeleteCourse(c.id);
                                  }
                                }}
                                title="Delete course"
                                className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px] leading-none">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="bg-slate-50/80 dark:bg-zinc-900/90 border-t border-gray-200 dark:border-zinc-800 px-3 py-2 text-[10px] text-slate-600 dark:text-zinc-400 flex justify-between items-center font-mono">
          <span>Showing {filteredCourses.length} syllabus modules</span>
          <span>Target Degree Total: {targetCFU} CFU (100%)</span>
        </div>
      </div>
    </div>
  );
};
