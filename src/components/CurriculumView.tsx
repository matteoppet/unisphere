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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    <div className="flex-1 bg-[#fdf9f4] dark:bg-[#09090b] text-[#2d2f34] dark:text-zinc-100 overflow-y-auto p-2.5 sm:p-4 space-y-4 select-none transition-colors">
      {/* Telemetry Header */}
      <div className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md slite-shadow p-3.5 sm:p-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div className="bg-[#fdf9f4] dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 p-3 sm:p-3.5 rounded-md flex flex-col justify-between">
            <div>
              <div className="text-[#3f434a]/70 dark:text-zinc-400 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                Completed (Passed)
              </div>
              <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#2d2f34] dark:text-zinc-100 font-mono tracking-tight leading-none">
                  {completedCFU}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#3f434a]/70 dark:text-zinc-400 font-mono">
                  / {targetCFU} CFU
                </span>
              </div>
            </div>
            <div className="text-[10px] sm:text-[10.5px] text-[#3f434a]/80 dark:text-zinc-400 font-mono mt-2 pt-1.5 border-t border-[#ecedef] dark:border-zinc-800 flex items-center justify-between">
              <span>{completed.length} examinations recorded</span>
              <span className="font-semibold text-[#6366F1]">
                {Math.round((completedCFU / targetCFU) * 100)}%
              </span>
            </div>
          </div>

          <div className="bg-[#fdf9f4] dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 p-3 sm:p-3.5 rounded-md flex flex-col justify-between">
            <div>
              <div className="text-[#3f434a]/70 dark:text-zinc-400 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                Active Enrolled (Term)
              </div>
              <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#6366F1] font-mono tracking-tight leading-none">
                  {activeCFU}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#3f434a]/70 dark:text-zinc-400 font-mono">
                  CFU
                </span>
              </div>
            </div>
            <div className="text-[10px] sm:text-[10.5px] text-[#3f434a]/80 dark:text-zinc-400 font-mono mt-2 pt-1.5 border-t border-[#ecedef] dark:border-zinc-800 flex items-center justify-between">
              <span>{active.length} active courses ongoing</span>
              <span className="font-semibold text-[#6366F1]">
                {Math.round((activeCFU / targetCFU) * 100)}%
              </span>
            </div>
          </div>

          <div className="bg-[#fdf9f4] dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 p-3 sm:p-3.5 rounded-md flex flex-col justify-between">
            <div>
              <div className="text-[#3f434a]/70 dark:text-zinc-400 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                Planned Ahead (Year 3)
              </div>
              <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#3f434a] dark:text-zinc-300 font-mono tracking-tight leading-none">
                  {plannedCFU}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#3f434a]/70 dark:text-zinc-400 font-mono">
                  CFU
                </span>
              </div>
            </div>
            <div className="text-[10px] sm:text-[10.5px] text-[#3f434a]/80 dark:text-zinc-400 font-mono mt-2 pt-1.5 border-t border-[#ecedef] dark:border-zinc-800 flex items-center justify-between">
              <span>{planned.length} syllabus modules remaining</span>
              <span className="font-semibold text-[#3f434a]">
                {Math.round((plannedCFU / targetCFU) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Courses List Table with Controls */}
      <div className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md slite-shadow overflow-hidden flex flex-col">
        {/* Controls Toolbar */}
        <div className="bg-[#fdf9f4] dark:bg-zinc-900/90 border-b border-[#ecedef] dark:border-zinc-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-[#f9efe4] dark:bg-zinc-800 p-0.5 rounded-md border border-[#ecedef] dark:border-zinc-700 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedYear('all')}
                className={`px-3 py-1 text-[11px] rounded-md transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  selectedYear === 'all'
                    ? 'font-semibold bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 slite-shadow'
                    : 'text-[#3f434a] dark:text-zinc-400 hover:text-[#2d2f34]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedYear(1)}
                className={`px-3 py-1 text-[11px] rounded-md transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  selectedYear === 1
                    ? 'font-semibold bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 slite-shadow'
                    : 'text-[#3f434a] dark:text-zinc-400 hover:text-[#2d2f34]'
                }`}
              >
                Y1 (60)
              </button>
              <button
                onClick={() => setSelectedYear(2)}
                className={`px-3 py-1 text-[11px] rounded-md transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  selectedYear === 2
                    ? 'font-semibold bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 slite-shadow'
                    : 'text-[#3f434a] dark:text-zinc-400 hover:text-[#2d2f34]'
                }`}
              >
                Y2 (60)
              </button>
              <button
                onClick={() => setSelectedYear(3)}
                className={`px-3 py-1 text-[11px] rounded-md transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  selectedYear === 3
                    ? 'font-semibold bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 slite-shadow'
                    : 'text-[#3f434a] dark:text-zinc-400 hover:text-[#2d2f34]'
                }`}
              >
                Y3 (60)
              </button>
            </div>

            <div className="h-4 w-[1px] bg-[#ecedef] dark:bg-zinc-700 mx-1 hidden sm:block"></div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-[11px] py-1 px-3 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 font-medium focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed Only</option>
              <option value="active">Active Only</option>
              <option value="planned">Planned Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-[11px] px-3.5 py-1.5 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 placeholder:text-[#3f434a]/60 dark:placeholder:text-zinc-500 flex-1 sm:w-48 focus:outline-none focus:border-[#6366F1]"
            />
            <button
              onClick={onOpenNewCourse}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white px-3.5 py-1.5 text-[11px] font-medium rounded-md shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Add Course"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add Course</span>
            </button>
          </div>
        </div>

        {/* Empty state when no courses exist */}
        {filteredCourses.length === 0 ? (
          <div className="p-8 text-center text-[#3f434a] dark:text-zinc-400 bg-[#fdf9f4]/50 dark:bg-zinc-900/40">
            <span className="material-symbols-outlined text-[36px] text-neutral-400 dark:text-zinc-600 block mb-1.5">
              menu_book
            </span>
            <p className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-300">No courses in curriculum</p>
            <p className="text-[11px] text-[#3f434a]/80 dark:text-zinc-500 mt-0.5 mb-3">Build your academic plan by adding your modules and CFU credits.</p>
            <button
              onClick={onOpenNewCourse}
              className="px-4 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add First Course</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="sm:hidden p-2 space-y-2">
              {filteredCourses.map((c) => {
                return (
                  <div
                    key={c.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View syllabus for ${c.title}`}
                    onClick={() => onOpenCourseDetail(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenCourseDetail(c);
                      }
                    }}
                    className="px-3 py-2 rounded-md border border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4] dark:bg-zinc-900 hover:bg-[#f9efe4]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer slite-shadow flex flex-col gap-1.5"
                  >
                    {/* Compact Row 1: Title + CFU */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="font-semibold text-xs text-[#2d2f34] dark:text-zinc-100 truncate leading-snug">
                        {c.title}
                      </div>
                      <span className="shrink-0 font-mono font-bold text-[10px] tabular-nums bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200 px-2 py-0.5 rounded-md border border-[#ecedef] dark:border-zinc-700 leading-none">
                        {c.cfu} CFU
                      </span>
                    </div>

                    {/* Compact Row 2: Status + Email + Arrow */}
                    <div className="flex items-center justify-between gap-1 text-[10px] text-[#3f434a] dark:text-zinc-400">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        {renderStatusBadge(c.status, true)}
                        {c.email && (
                          <>
                            <span className="text-[#3f434a]/40">•</span>
                            <a
                              href={`mailto:${c.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#6366F1] hover:underline truncate text-[10px]"
                              title={c.email}
                            >
                              {c.email}
                            </a>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <span className="material-symbols-outlined text-[13px] text-[#6366F1] ml-0.5 leading-none">
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
                <thead className="sticky top-0 bg-[#f9efe4] dark:bg-zinc-800 border-b border-[#ecedef] dark:border-zinc-800 z-10">
                  <tr className="font-semibold text-[#2d2f34] dark:text-zinc-300">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2 w-16 text-right tabular-nums">CFU</th>
                    <th className="px-3 py-2 w-28 text-center">Status</th>
                    <th className="px-3 py-2 w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ecedef] dark:divide-zinc-800/80 font-sans">
                  {filteredCourses.map((c, idx) => {
                    return (
                      <tr
                        key={c.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`View syllabus for ${c.title}`}
                        onClick={() => onOpenCourseDetail(c)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenCourseDetail(c);
                          }
                        }}
                        className={`hover:bg-[#f9efe4]/60 dark:hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer group ${
                          idx % 2 === 1 ? 'bg-[#fdf9f4]/50 dark:bg-zinc-900/40' : 'bg-white dark:bg-zinc-900'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-[#2d2f34] dark:text-zinc-100 group-hover:text-[#6366F1] transition-colors">
                            {c.title}
                          </div>
                          {c.email && (
                            <div className="text-[10px] text-[#3f434a]/80 dark:text-zinc-400 mt-0.5">
                              <a
                                href={`mailto:${c.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[#6366F1] hover:underline"
                              >
                                {c.email}
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-[#2d2f34] dark:text-zinc-100 tabular-nums">
                          {c.cfu}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {renderStatusBadge(c.status)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                 e.stopPropagation();
                                 onOpenCourseDetail(c);
                              }}
                              className="px-3 py-1 text-[10px] font-medium rounded-md border border-[#ecedef] dark:border-zinc-800 bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200 hover:bg-[#f3e3d3] dark:hover:bg-zinc-700 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                            >
                              Inspect
                            </button>
                            {onDeleteCourse && (
                              confirmDeleteId === c.id ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteCourse(c.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2.5 py-0.5 text-[9.5px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors cursor-pointer shadow-2xs"
                                  title="Confirm deletion"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(c.id);
                                    setTimeout(() => setConfirmDeleteId((prev) => (prev === c.id ? null : prev)), 3500);
                                  }}
                                  title="Delete course"
                                  className="p-1 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px] leading-none">delete</span>
                                </button>
                              )
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
      </div>
    </div>
  );
};
