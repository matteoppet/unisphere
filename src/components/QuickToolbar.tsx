import React, { useState, useEffect, useRef } from 'react';
import { Course, AssignmentItem, StudyLog, NavView, StudentProfile } from '../types';
import { Button } from './ui/button';
import { playClickBeep, isAudioMuted, toggleAudioMuted } from '../utils/audio';
import { calculateLevel } from '../utils/telemetry';
import { Volume2, VolumeX, Flame, Zap } from 'lucide-react';

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [audioMuted, setAudioMutedState] = useState(() => isAudioMuted());

  useEffect(() => {
    const handleAudioSync = () => {
      setAudioMutedState(isAudioMuted());
    };
    window.addEventListener('unisphere-audio-toggle', handleAudioSync);
    return () => window.removeEventListener('unisphere-audio-toggle', handleAudioSync);
  }, []);

  const handleToggleAudio = () => {
    const next = toggleAudioMuted();
    setAudioMutedState(next);
    if (!next) {
      playClickBeep();
    }
  };

  const levelInfo = calculateLevel(profile?.xp || 0);

  // Global hotkey: Ctrl+K or Cmd+K focuses search
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

  const filteredCourses = courses.filter((c) => {
    if (!cleanQ) return true;
    return (
      c.title.toLowerCase().includes(cleanQ) ||
      c.shortTitle.toLowerCase().includes(cleanQ) ||
      c.code.toLowerCase().includes(cleanQ) ||
      c.status.toLowerCase().includes(cleanQ) ||
      c.email.toLowerCase().includes(cleanQ)
    );
  });

  const filteredAssignments = assignments.filter((a) => {
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

  const filteredLogs = studyLogs.filter((l) => {
    if (!cleanQ) return true;
    return (
      l.courseName.toLowerCase().includes(cleanQ) ||
      l.tag.toLowerCase().includes(cleanQ) ||
      l.notes.toLowerCase().includes(cleanQ) ||
      l.date.includes(cleanQ)
    );
  });

  const totalResults =
    (categoryFilter === 'all' || categoryFilter === 'courses' ? filteredCourses.length : 0) +
    (categoryFilter === 'all' || categoryFilter === 'assignments' ? filteredAssignments.length : 0) +
    (categoryFilter === 'all' || categoryFilter === 'logs' ? filteredLogs.length : 0);

  const handleSelectCourse = (c: Course) => {
    playClickBeep();
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
    playClickBeep();
    setIsOpen(false);
    setQuery('');
    if (onNavigate) {
      onNavigate('assignments-and-exams');
    }
  };

  const handleSelectLog = (_l: StudyLog) => {
    playClickBeep();
    setIsOpen(false);
    setQuery('');
    if (onNavigate) {
      onNavigate('study-session-tracker');
    }
  };

  return (
    <header className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/90 dark:border-zinc-800 px-2.5 sm:px-3.5 py-1.5 flex items-center justify-between gap-2 select-none shadow-2xs z-30 transition-colors">
      {/* Left side: Mobile Hamburger & Desktop Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onToggleMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </Button>
        )}

        {/* Desktop Quick Export */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <Button
            variant="compact"
            size="sm"
            onClick={onExport}
            title="Export CSV / JSON Report"
            className="gap-1.5 text-zinc-700 dark:text-zinc-200 font-medium group"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-600 dark:text-amber-400 transition-transform duration-200 group-hover:scale-110">
              save
            </span>
            <span>Export Data</span>
          </Button>

          {onToggleTheme && (
            <Button
              variant="compact"
              size="sm"
              onClick={onToggleTheme}
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle theme"
              className="gap-1.5 text-zinc-700 dark:text-zinc-200 group"
            >
              <span className="material-symbols-outlined text-[15px] text-amber-500 dark:text-amber-400 transition-transform duration-300 group-hover:rotate-45">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="font-semibold">{isDark ? 'Light' : 'Dark'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div ref={containerRef} className="flex-1 sm:max-w-md lg:max-w-lg mx-1 sm:mx-3 relative">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined text-[15px] text-zinc-400 dark:text-zinc-500 absolute left-2.5 pointer-events-none">
            search
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search courses, tasks, study logs..."
            className="w-full h-7.5 sm:h-8 pl-8 pr-7 sm:pr-8 text-[11px] sm:text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Global Search Results Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden text-xs max-h-[75vh] flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Filter Pills Header */}
            <div className="p-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/70 flex items-center gap-1 overflow-x-auto text-[11px] shrink-0">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  categoryFilter === 'all'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                All ({filteredCourses.length + filteredAssignments.length + filteredLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('courses')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  categoryFilter === 'courses'
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                }`}
              >
                <span>Courses</span>
                <span className="text-[10px] opacity-80">({filteredCourses.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('assignments')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  categoryFilter === 'assignments'
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <span>Assignments</span>
                <span className="text-[10px] opacity-80">({filteredAssignments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('logs')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  categoryFilter === 'logs'
                    ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                    : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
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
                  {(categoryFilter === 'all' || categoryFilter === 'courses') && filteredCourses.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">menu_book</span>
                          <span>Courses ({filteredCourses.length})</span>
                        </span>
                        <span className="text-[9.5px] font-normal text-zinc-400">Click to view syllabus</span>
                      </div>
                      <div className="space-y-0.5">
                        {filteredCourses.slice(0, 5).map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCourse(c)}
                            className="p-2 rounded-lg hover:bg-blue-50/70 dark:hover:bg-blue-950/30 border border-transparent hover:border-blue-200/60 dark:hover:border-blue-900/50 flex items-center justify-between gap-2 transition-all cursor-pointer group"
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
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Assignments Results */}
                  {(categoryFilter === 'all' || categoryFilter === 'assignments') && filteredAssignments.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">task_alt</span>
                          <span>Assignments &amp; Exams ({filteredAssignments.length})</span>
                        </span>
                        <span className="text-[9.5px] font-normal text-zinc-400">Click to open registry</span>
                      </div>
                      <div className="space-y-0.5">
                        {filteredAssignments.slice(0, 5).map((a) => (
                          <div
                            key={a.id}
                            onClick={() => handleSelectAssignment(a)}
                            className="p-2 rounded-lg hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-200/60 dark:hover:border-emerald-900/50 flex items-center justify-between gap-2 transition-all cursor-pointer group"
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
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Study Logs Results */}
                  {(categoryFilter === 'all' || categoryFilter === 'logs') && filteredLogs.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">history_edu</span>
                          <span>Study Logs ({filteredLogs.length})</span>
                        </span>
                        <span className="text-[9.5px] font-normal text-zinc-400">Click to open tracker</span>
                      </div>
                      <div className="space-y-0.5">
                        {filteredLogs.slice(0, 5).map((l) => (
                          <div
                            key={l.id}
                            onClick={() => handleSelectLog(l)}
                            className="p-2 rounded-lg hover:bg-amber-50/70 dark:hover:bg-amber-950/30 border border-transparent hover:border-amber-200/60 dark:hover:border-amber-900/50 flex items-center justify-between gap-2 transition-all cursor-pointer group"
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
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Quick Footer */}
            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span><kbd className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-[9px]">Esc</kbd> to close</span>
                <span><kbd className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-[9px]">↵</kbd> to jump</span>
              </div>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                Global Workstation Filter
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Mobile Quick Buttons & Desktop User / Sign Out */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Academic Telemetry Level & XP Indicator */}
        <div 
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 select-none cursor-default"
          title={`Academic Level ${levelInfo.level} • ${levelInfo.safeXp} XP (${levelInfo.progressPercent}% towards Level ${levelInfo.level + 1})`}
        >
          <Zap size={13} className="text-amber-500 fill-amber-500 shrink-0" />
          <span className="font-semibold font-mono text-[11px] tracking-tight text-zinc-900 dark:text-zinc-100">
            Lv.{levelInfo.level}
          </span>
          {typeof profile?.currentStreak === 'number' && profile.currentStreak > 0 && (
            <span className="flex items-center gap-0.5 text-orange-500 font-mono text-[11px] font-semibold pl-1 border-l border-zinc-300 dark:border-zinc-700">
              <Flame size={12} className="fill-orange-500 shrink-0" />
              <span>{profile.currentStreak}d</span>
            </span>
          )}
        </div>

        {/* Audio Sensory Toggle */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer border ${
            audioMuted
              ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 shadow-2xs'
          }`}
          title={audioMuted ? 'Tactile Audio Muted. Click to enable sound effects.' : 'Tactile Audio Active. Click to mute.'}
          aria-label={audioMuted ? 'Unmute sensory audio' : 'Mute sensory audio'}
        >
          {audioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        {onToggleTheme && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="md:hidden text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </Button>
        )}

        {/* Mobile Log-Out Button */}
        <div className="flex md:hidden items-center gap-1">
          {onSignOut && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="h-7 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 text-[11px] font-medium gap-1 cursor-pointer"
              title="Sign Out / Switch Student Account"
              aria-label="Log out"
            >
              <span className="material-symbols-outlined text-[15px]">logout</span>
              <span>Log out</span>
            </Button>
          )}
        </div>

        {/* Desktop Sign Out Button */}
        {onSignOut && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            title="Sign Out / Switch Student Account"
            className="hidden md:inline-flex text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-800 dark:hover:text-rose-300"
          >
            <span className="material-symbols-outlined text-[13px]">logout</span>
            <span>Sign Out</span>
          </Button>
        )}
      </div>
    </header>
  );
};
