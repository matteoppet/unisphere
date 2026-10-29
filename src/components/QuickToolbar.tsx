import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Course, AssignmentItem, StudyLog, NavView, StudentProfile } from '../types';
import { Button } from './ui/button';
import { Flame } from 'lucide-react';
import { calculateActiveSearchIndex } from '../utils/keyboard';

interface QuickToolbarProps {
  profile?: StudentProfile;
  earnedCFU?: number;
  courses?: Course[];
  assignments?: AssignmentItem[];
  studyLogs?: StudyLog[];
  onSelectCourse?: (course: Course) => void;
  onNavigate?: (view: NavView) => void;
  onNewSession?: () => void;
  onExport: () => void;
  onSignOut?: () => void;
  onToggleMobileMenu?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const QuickToolbar: React.FC<QuickToolbarProps> = ({
  profile,
  earnedCFU,
  courses = [],
  assignments = [],
  studyLogs = [],
  onSelectCourse,
  onNavigate,
  onNewSession,
  onExport,
  onSignOut,
  onToggleMobileMenu,
  isDark = true,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'courses' | 'assignments' | 'logs'>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Global hotkeys: Ctrl+K or Cmd+K focuses search; '/' focuses search when not typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click-away listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanQ = query.trim().toLowerCase();

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (!cleanQ) return true;
      return (
        c.title.toLowerCase().includes(cleanQ) ||
        c.shortTitle.toLowerCase().includes(cleanQ) ||
        c.code.toLowerCase().includes(cleanQ) ||
        c.status.toLowerCase().includes(cleanQ) ||
        c.email.toLowerCase().includes(cleanQ)
      );
    });
  }, [courses, cleanQ]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (!cleanQ) return true;
      return (
        a.title.toLowerCase().includes(cleanQ) ||
        a.courseName.toLowerCase().includes(cleanQ) ||
        a.type.toLowerCase().includes(cleanQ) ||
        a.status.toLowerCase().includes(cleanQ) ||
        (a.notes && a.notes.toLowerCase().includes(cleanQ)) ||
        a.dueDate.includes(cleanQ)
      );
    });
  }, [assignments, cleanQ]);

  const filteredLogs = useMemo(() => {
    return studyLogs.filter((l) => {
      if (!cleanQ) return true;
      return (
        l.courseName.toLowerCase().includes(cleanQ) ||
        l.tag.toLowerCase().includes(cleanQ) ||
        l.notes.toLowerCase().includes(cleanQ) ||
        l.date.includes(cleanQ)
      );
    });
  }, [studyLogs, cleanQ]);

  const visibleCourses = useMemo(() => {
    if (categoryFilter !== 'all' && categoryFilter !== 'courses') return [];
    return categoryFilter === 'all' ? filteredCourses.slice(0, 5) : filteredCourses;
  }, [categoryFilter, filteredCourses]);

  const visibleAssignments = useMemo(() => {
    if (categoryFilter !== 'all' && categoryFilter !== 'assignments') return [];
    return categoryFilter === 'all' ? filteredAssignments.slice(0, 5) : filteredAssignments;
  }, [categoryFilter, filteredAssignments]);

  const visibleLogs = useMemo(() => {
    if (categoryFilter !== 'all' && categoryFilter !== 'logs') return [];
    return categoryFilter === 'all' ? filteredLogs.slice(0, 5) : filteredLogs;
  }, [categoryFilter, filteredLogs]);

  // Unified list of visible results for keyboard navigation
  const allVisibleItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'course' | 'assignment' | 'log';
      data: Course | AssignmentItem | StudyLog;
    }> = [];
    visibleCourses.forEach((c) => items.push({ id: c.id, type: 'course', data: c }));
    visibleAssignments.forEach((a) => items.push({ id: a.id, type: 'assignment', data: a }));
    visibleLogs.forEach((l) => items.push({ id: l.id, type: 'log', data: l }));
    return items;
  }, [visibleCourses, visibleAssignments, visibleLogs]);

  const totalResults =
    (categoryFilter === 'all' || categoryFilter === 'courses' ? filteredCourses.length : 0) +
    (categoryFilter === 'all' || categoryFilter === 'assignments' ? filteredAssignments.length : 0) +
    (categoryFilter === 'all' || categoryFilter === 'logs' ? filteredLogs.length : 0);

  // Reset or clamp selectedIndex when query/filter/results change
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (allVisibleItems.length === 0) return -1;
      if (prev >= 0 && prev < allVisibleItems.length) return prev;
      return 0;
    });
  }, [allVisibleItems.length, categoryFilter]);

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && allVisibleItems[selectedIndex]) {
      const activeId = allVisibleItems[selectedIndex].id;
      const el = itemRefs.current[activeId];
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, allVisibleItems]);

  const handleSelectCourse = (c: Course) => {
    setIsOpen(false);
    setQuery('');
    if (onSelectCourse) {
      onSelectCourse(c);
    }
    if (onNavigate) {
      onNavigate('courses-and-curriculum');
    }
  };

  const handleSelectAssignment = (_a: AssignmentItem) => {
    setIsOpen(false);
    setQuery('');
    if (onNavigate) {
      onNavigate('assignments-and-exams');
    }
  };

  const handleSelectLog = (_l: StudyLog) => {
    setIsOpen(false);
    setQuery('');
    if (onNavigate) {
      onNavigate('study-session-tracker');
    }
  };

  // Keyboard navigation inside search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => calculateActiveSearchIndex(prev, 1, allVisibleItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => calculateActiveSearchIndex(prev, -1, allVisibleItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allVisibleItems.length) {
        const item = allVisibleItems[selectedIndex];
        if (item.type === 'course') handleSelectCourse(item.data as Course);
        else if (item.type === 'assignment') handleSelectAssignment(item.data as AssignmentItem);
        else if (item.type === 'log') handleSelectLog(item.data as StudyLog);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const cats: Array<'all' | 'courses' | 'assignments' | 'logs'> = [
        'all',
        'courses',
        'assignments',
        'logs',
      ];
      const curIdx = cats.indexOf(categoryFilter);
      const nextIdx = e.shiftKey
        ? (curIdx - 1 + cats.length) % cats.length
        : (curIdx + 1) % cats.length;
      setCategoryFilter(cats[nextIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      searchInputRef.current?.blur();
    }
  };

  return (
    <header className="bg-[#fdf9f4] dark:bg-[#09090b] border-b border-[#ecedef] dark:border-zinc-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 select-none z-30 transition-colors">
      {/* Left side: Mobile menu, Light/Dark Toggle & Navigation actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onToggleMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-[#3f434a] hover:text-[#2d2f34] dark:text-zinc-300 dark:hover:text-zinc-100 rounded-md"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </Button>
        )}

        {/* Light/Dark Theme Switcher */}
        {onToggleTheme && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
            className="hidden sm:inline-flex gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border-[#ecedef] dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-200 hover:bg-[#f9efe4] dark:hover:bg-zinc-800 cursor-pointer transition-all slite-shadow group"
          >
            <span className="material-symbols-outlined text-[15px] text-[#6366F1] transition-transform duration-300 group-hover:rotate-45">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </Button>
        )}

        {/* Export Data Action */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          title="Export CSV / JSON Report"
          className="hidden lg:inline-flex gap-1.5 text-[#3f434a] hover:text-[#2d2f34] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#f9efe4] text-xs font-medium rounded-md px-3"
        >
          <span className="material-symbols-outlined text-[15px] text-[#6366F1]">
            save
          </span>
          <span>Export</span>
        </Button>
      </div>

      {/* Center: Global Search Bar & Command Palette */}
      <div ref={containerRef} className="flex-1 sm:max-w-md lg:max-w-lg mx-1 sm:mx-3 relative">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined text-[15px] text-[#3f434a]/60 dark:text-zinc-500 absolute left-3 pointer-events-none">
            search
          </span>
          <input
            ref={searchInputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="global-search-results"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search courses, tasks, study logs..."
            className="w-full h-8 pl-8.5 pr-8 text-[11px] sm:text-xs rounded-md border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 placeholder:text-[#3f434a]/60 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 transition-all slite-shadow"
          />
          {query && (
            <div className="absolute right-2.5 flex items-center">
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                className="text-[#3f434a] hover:text-[#2d2f34] dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Search Results Dropdown */}
        {isOpen && (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 rounded-md slite-shadow z-50 overflow-hidden text-xs max-h-[75vh] flex flex-col animate-in fade-in duration-150"
          >
            {/* Filter Pills Header */}
            <div className="p-2 border-b border-[#ecedef] dark:border-zinc-800/80 bg-[#fdf9f4] dark:bg-zinc-900 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap text-xs ${
                  categoryFilter === 'all'
                    ? 'bg-[#6366F1] text-white font-semibold'
                    : 'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-300 hover:bg-[#ebdccf]'
                }`}
              >
                All ({filteredCourses.length + filteredAssignments.length + filteredLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('courses')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 text-xs ${
                  categoryFilter === 'courses'
                    ? 'bg-[#6366F1] text-white font-semibold'
                    : 'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-300 hover:bg-[#ebdccf]'
                }`}
              >
                <span>Courses</span>
                <span className="text-[10px] opacity-80">({filteredCourses.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('assignments')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 text-xs ${
                  categoryFilter === 'assignments'
                    ? 'bg-[#6366F1] text-white font-semibold'
                    : 'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-300 hover:bg-[#ebdccf]'
                }`}
              >
                <span>Assignments</span>
                <span className="text-[10px] opacity-80">({filteredAssignments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('logs')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 text-xs ${
                  categoryFilter === 'logs'
                    ? 'bg-[#6366F1] text-white font-semibold'
                    : 'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-300 hover:bg-[#ebdccf]'
                }`}
              >
                <span>Study Logs</span>
                <span className="text-[10px] opacity-80">({filteredLogs.length})</span>
              </button>
            </div>

            {/* Results Content Area */}
            <div className="overflow-y-auto p-2 space-y-3 flex-1 text-left">
              {totalResults === 0 ? (
                <div className="py-6 px-4 text-center">
                  <span className="material-symbols-outlined text-[24px] text-zinc-400 dark:text-zinc-600 mb-1">
                    search_off
                  </span>
                  <div className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs">
                    No results found
                  </div>
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    No courses, assignments, or study logs matched &ldquo;{query}&rdquo;
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. Courses Results */}
                  {visibleCourses.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">menu_book</span>
                          <span>Courses ({filteredCourses.length})</span>
                        </span>
                        <span className="text-[9.5px] font-normal text-zinc-400">Click to view syllabus</span>
                      </div>
                      <div className="space-y-0.5">
                        {visibleCourses.map((c, cIdx) => {
                          const globalIdx = cIdx;
                          const isSelected = selectedIndex === globalIdx;
                          return (
                            <div
                              key={c.id}
                              ref={(el) => { itemRefs.current[c.id] = el; }}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSelectCourse(c)}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              className={`p-2 rounded-md border flex items-center justify-between gap-2 transition-all cursor-pointer group ${
                                isSelected
                                  ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 ring-1 ring-blue-500'
                                  : 'hover:bg-blue-50/70 dark:hover:bg-blue-950/30 border-transparent hover:border-blue-200/60 dark:hover:border-blue-900/50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[16px]">school</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                                    {c.title}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                                    <span className="font-mono">{c.cfu} CFU</span>
                                    <span>•</span>
                                    <span>Year {c.year}</span>
                                    <span>•</span>
                                    <span>Sem {c.semester}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                <span
                                  className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium border ${
                                    c.status === 'completed'
                                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                      : c.status === 'active'
                                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                      : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  }`}
                                >
                                  {c.status}
                                </span>
                                <span className="material-symbols-outlined text-[14px] text-zinc-400 group-hover:translate-x-0.5 transition-transform">
                                  chevron_right
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. Assignments Results */}
                  {visibleAssignments.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">task_alt</span>
                          <span>Assignments &amp; Exams ({filteredAssignments.length})</span>
                        </span>
                        <span className="text-[9.5px] font-normal text-zinc-400">Click to open registry</span>
                      </div>
                      <div className="space-y-0.5">
                        {visibleAssignments.map((a, aIdx) => {
                          const globalIdx = visibleCourses.length + aIdx;
                          const isSelected = selectedIndex === globalIdx;
                          return (
                            <div
                              key={a.id}
                              ref={(el) => { itemRefs.current[a.id] = el; }}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSelectAssignment(a)}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              className={`p-2 rounded-md border flex items-center justify-between gap-2 transition-all cursor-pointer group ${
                                isSelected
                                  ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-500'
                                  : 'hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 border-transparent hover:border-emerald-200/60 dark:hover:border-emerald-900/50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[16px]">fact_check</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                                    {a.title}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{a.courseName}</span>
                                    <span>•</span>
                                    <span>Due: {a.dueDate}</span>
                                    <span>•</span>
                                    <span>{a.type}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                <span className="text-[9.5px] px-1.5 py-0.5 rounded font-mono font-medium border bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
                                  {a.status}
                                </span>
                                <span className="material-symbols-outlined text-[14px] text-zinc-400 group-hover:translate-x-0.5 transition-transform">
                                  chevron_right
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3. Study Logs Results */}
                  {visibleLogs.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">history_edu</span>
                          <span>Study Logs ({filteredLogs.length})</span>
                        </span>
                        <span className="text-[9.5px] font-normal text-zinc-400">Click to open tracker</span>
                      </div>
                      <div className="space-y-0.5">
                        {visibleLogs.map((l, lIdx) => {
                          const globalIdx = visibleCourses.length + visibleAssignments.length + lIdx;
                          const isSelected = selectedIndex === globalIdx;
                          return (
                            <div
                              key={l.id}
                              ref={(el) => { itemRefs.current[l.id] = el; }}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSelectLog(l)}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              className={`p-2 rounded-md border flex items-center justify-between gap-2 transition-all cursor-pointer group ${
                                isSelected
                                  ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 ring-1 ring-amber-500'
                                  : 'hover:bg-amber-50/70 dark:hover:bg-amber-950/30 border-transparent hover:border-amber-200/60 dark:hover:border-amber-900/50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[16px]">timer</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                                    {l.courseName} <span className="font-normal text-zinc-500 font-mono">({l.durationMinutes}m)</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                                    <span>{l.date}</span>
                                    <span className="mx-1">•</span>
                                    <span className="font-medium text-amber-700 dark:text-amber-300">{l.tag}</span>
                                    {l.notes && <span className="ml-1 text-zinc-400 italic truncate">— {l.notes}</span>}
                                  </div>
                                </div>
                              </div>
                              <span className="material-symbols-outlined text-[14px] text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                                chevron_right
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Quick Footer */}
            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between shrink-0">
              <span>Search across courses, assignments, and study logs</span>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                Global Search
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Mobile Quick Buttons & Desktop User / Sign Out */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Streak indicator if active */}
        {typeof profile?.currentStreak === 'number' && profile.currentStreak > 0 && (
          <div 
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f9efe4] dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 text-xs select-none cursor-default"
            title={`${profile.currentStreak} Day Study Streak`}
          >
            <Flame size={13} className="fill-[#6366F1] text-[#6366F1] shrink-0" />
            <span className="font-semibold font-mono text-[11px] text-[#2d2f34] dark:text-zinc-100">
              {profile.currentStreak}d streak
            </span>
          </div>
        )}

        {onToggleTheme && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="sm:hidden h-7.5 w-7.5 text-[#3f434a] hover:text-[#2d2f34] dark:text-zinc-300 dark:hover:text-zinc-100 flex items-center justify-center p-0 rounded-md"
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[17px] text-[#6366F1]">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </Button>
        )}

        {/* Log-Out Button */}
        {onSignOut && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSignOut}
            className="h-7.5 sm:h-8 p-0 sm:px-3.5 flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-xs font-semibold sm:gap-1.5 cursor-pointer rounded-md shrink-0"
            title="Sign Out / Switch Student Account"
            aria-label="Log-Out"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            <span className="hidden sm:inline">Log-Out</span>
          </Button>
        )}
      </div>
    </header>
  );
};
