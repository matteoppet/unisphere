import React, { useState } from 'react';
import { Course, StudentProfile } from '../types';

interface CurriculumViewProps {
  courses: Course[];
  profile: StudentProfile;
  onOpenCourseDetail: (course: Course) => void;
  onOpenNewCourse: () => void;
  onUpdateCourse: (course: Course) => void;
}

export const CurriculumView: React.FC<CurriculumViewProps> = ({
  courses,
  profile,
  onOpenCourseDetail,
  onOpenNewCourse,
  onUpdateCourse,
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
        c.instructor.toLowerCase().includes(q)
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

  // Status badge with colored dot indicator & high-contrast styling
  const renderStatusBadge = (status: Course['status'], isCompact = false) => {
    const badgeConfigs = {
      completed: {
        bg: 'bg-green-50 border-green-200 text-green-700',
        dot: 'text-green-600',
        label: 'COMPLETED',
      },
      active: {
        bg: 'bg-blue-50 border-blue-200 text-blue-700',
        dot: 'text-blue-600',
        label: 'ACTIVE',
      },
      planned: {
        bg: 'bg-amber-50 border-amber-200 text-amber-700',
        dot: 'text-amber-600',
        label: 'PLANNED',
      },
    };

    const cfg = badgeConfigs[status] || {
      bg: 'bg-slate-50 border-slate-200 text-slate-700',
      dot: 'text-slate-500',
      label: status.toUpperCase(),
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 border rounded-md font-medium tracking-wide shadow-2xs ${
          isCompact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
        } ${cfg.bg}`}
      >
        <svg
          className={`w-1.5 h-1.5 shrink-0 fill-current ${cfg.dot}`}
          viewBox="0 0 6 6"
          aria-hidden="true"
        >
          <circle cx="3" cy="3" r="2.5" />
        </svg>
        <span>{cfg.label}</span>
      </span>
    );
  };

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5 select-none">
      {/* Telemetry Header */}
      <div className="border border-gray-200 bg-white rounded-xl shadow-sm p-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
            <div className="bg-slate-50/70 border border-gray-200 p-3 sm:p-3.5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-neutral-500 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                  Completed (Passed)
                </div>
                <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-emerald-700 font-mono tracking-tight leading-none">
                    {completedCFU}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-500 font-mono">
                    / {targetCFU} CFU
                  </span>
                </div>
              </div>
              <div className="text-[10px] sm:text-[10.5px] text-neutral-500 font-mono mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                <span>{completed.length} examinations recorded</span>
                <span className="font-semibold text-emerald-700">
                  {Math.round((completedCFU / targetCFU) * 100)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-gray-200 p-3 sm:p-3.5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-neutral-500 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                  Active Enrolled (Term)
                </div>
                <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-blue-700 font-mono tracking-tight leading-none">
                    {activeCFU}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-500 font-mono">
                    CFU
                  </span>
                </div>
              </div>
              <div className="text-[10px] sm:text-[10.5px] text-neutral-500 font-mono mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                <span>{active.length} active courses ongoing</span>
                <span className="font-semibold text-blue-700">
                  {Math.round((activeCFU / targetCFU) * 100)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-gray-200 p-3 sm:p-3.5 rounded-lg shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-neutral-500 text-[10px] sm:text-[10.5px] uppercase font-semibold tracking-wider">
                  Planned Ahead (Year 3)
                </div>
                <div className="flex items-baseline gap-1.5 mt-1 sm:mt-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-amber-700 font-mono tracking-tight leading-none">
                    {plannedCFU}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-500 font-mono">
                    CFU
                  </span>
                </div>
              </div>
              <div className="text-[10px] sm:text-[10.5px] text-neutral-500 font-mono mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                <span>{planned.length} syllabus modules remaining</span>
                <span className="font-semibold text-amber-700">
                  {Math.round((plannedCFU / targetCFU) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* Courses List Table with Controls */}
      <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Controls Toolbar */}
        <div className="bg-slate-50/80 border-b border-gray-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedYear('all')}
                className={`win-button px-2 py-0.5 text-[11px] whitespace-nowrap ${
                  selectedYear === 'all' ? 'font-bold bg-blue-50 border-blue-300 text-blue-900' : ''
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedYear(1)}
                className={`win-button px-2 py-0.5 text-[11px] whitespace-nowrap ${
                  selectedYear === 1 ? 'font-bold bg-blue-50 border-blue-300 text-blue-900' : ''
                }`}
              >
                Y1 (60)
              </button>
              <button
                onClick={() => setSelectedYear(2)}
                className={`win-button px-2 py-0.5 text-[11px] whitespace-nowrap ${
                  selectedYear === 2 ? 'font-bold bg-blue-50 border-blue-300 text-blue-900' : ''
                }`}
              >
                Y2 (60)
              </button>
              <button
                onClick={() => setSelectedYear(3)}
                className={`win-button px-2 py-0.5 text-[11px] whitespace-nowrap ${
                  selectedYear === 3 ? 'font-bold bg-blue-50 border-blue-300 text-blue-900' : ''
                }`}
              >
                Y3 (60)
              </button>
            </div>

            <div className="h-4 w-[1px] bg-gray-200 mx-0.5 hidden sm:block"></div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-[11px] py-1 px-2 border border-gray-200 rounded-lg bg-white"
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
              className="text-[11px] px-2.5 py-1 border border-gray-200 rounded-lg bg-white flex-1 sm:w-44 focus:outline-none focus:border-blue-500"
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

        {/* Mobile Cards View (Ultra-compact for mobile layout) */}
        <div className="sm:hidden p-1.5 space-y-1.5">
          {filteredCourses.map((c) => {
            return (
              <div
                key={c.id}
                onClick={() => onOpenCourseDetail(c)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200/90 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer shadow-2xs flex flex-col gap-1"
              >
                {/* Compact Row 1: Title + CFU */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="font-semibold text-xs text-neutral-900 truncate leading-snug">
                    {c.title}
                  </div>
                  <span className="shrink-0 font-mono font-bold text-[10px] tabular-nums bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-gray-200 leading-none">
                    {c.cfu} CFU
                  </span>
                </div>

                {/* Compact Row 2: Status + Grade + Year/Sem + Progress + Arrow */}
                <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-500">
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    {renderStatusBadge(c.status, true)}
                    <span className="font-mono font-semibold text-slate-800 text-[10px] tabular-nums">
                      {c.status === 'completed'
                        ? `${c.isLaude ? '30L' : c.finalGrade}/30`
                        : c.status === 'active'
                        ? `Est: ${c.isLaude ? '30L' : c.estGrade}`
                        : 'Planned'}
                    </span>
                    <span className="text-neutral-300">•</span>
                    <a
                      href={`mailto:${c.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:underline truncate text-[10px]"
                      title={c.email}
                    >
                      {c.email}
                    </a>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <div className="w-10 bg-slate-200 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${c.progress}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-[9px] text-slate-600">
                      {c.progress}%
                    </span>
                    <span className="material-symbols-outlined text-[13px] text-blue-600 ml-0.5 leading-none">
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
            <thead className="sticky top-0 bg-slate-50/90 border-b border-gray-200 z-10">
              <tr className="font-semibold text-slate-700">
                <th className="win-header-cell px-2.5 py-1.5">Name</th>
                <th className="win-header-cell px-2.5 py-1.5 w-16 text-right tabular-nums">CFU</th>
                <th className="win-header-cell px-2.5 py-1.5 w-28 text-center">Status</th>
                <th className="win-header-cell px-2.5 py-1.5 w-24 text-right tabular-nums">Grade (/30)</th>
                <th className="win-header-cell px-2.5 py-1.5 w-32 text-right tabular-nums">Progress</th>
                <th className="win-header-cell px-2.5 py-1.5 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {filteredCourses.map((c, idx) => {
                return (
                  <tr
                    key={c.id}
                    onClick={() => onOpenCourseDetail(c)}
                    className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${
                      idx % 2 === 1 ? 'bg-slate-50/30' : ''
                    }`}
                  >
                    <td className="px-2.5 py-2">
                      <div className="font-bold text-neutral-900 group-hover:text-blue-700">
                        {c.title}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        <a
                          href={`mailto:${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline"
                        >
                          {c.email}
                        </a>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono font-bold text-neutral-900 tabular-nums">
                      {c.cfu}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      {renderStatusBadge(c.status)}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono font-bold text-neutral-900 tabular-nums">
                      {c.status === 'completed' ? (
                        <span>{c.isLaude ? '30L' : c.finalGrade}</span>
                      ) : c.status === 'active' ? (
                        <span className="text-blue-700">
                          <span className="text-[10px] text-blue-500 font-normal mr-1">est.</span>
                          {c.isLaude ? '30L' : c.estGrade}
                        </span>
                      ) : (
                        <span className="text-neutral-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden shrink-0">
                          <div
                            className="bg-blue-600 h-full transition-all rounded-full"
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-[10px] w-9 text-right font-semibold text-neutral-800 shrink-0">
                          {c.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCourseDetail(c);
                        }}
                        className="win-button px-2 py-0.5 text-[10px]"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50/80 border-t border-gray-200 px-3 py-2 text-[10px] text-slate-600 flex justify-between items-center font-mono">
          <span>Showing {filteredCourses.length} syllabus modules</span>
          <span>Target Degree Total: {targetCFU} CFU (100%)</span>
        </div>
      </div>
    </div>
  );
};
