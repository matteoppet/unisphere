import React, { useState, useEffect } from 'react';
import { Course, StudyLog, StudyTag } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { playClickBeep, playFuturisticChime, playMechanicalClick } from '../utils/audio';
import { fireCelebrationConfetti } from '../utils/confetti';

interface QuickStudyModalProps {
  courses: Course[];
  isOpen: boolean;
  onClose: () => void;
  onAddStudyLog: (log: Omit<StudyLog, 'id' | 'timestamp'>) => void;
  onSuccessNotification?: (message: string) => void;
  // Timer sync with floating button
  isTimerRunning?: boolean;
  timerSeconds?: number;
  timerCourse?: string;
  onToggleTimer?: (courseName: string, tag: StudyTag) => void;
  onResetTimer?: () => void;
}

const PRESET_DURATIONS = [
  { mins: 25, label: '25m', sub: 'Pomodoro', xp: 50 },
  { mins: 45, label: '45m', sub: 'Focus Block', xp: 90 },
  { mins: 60, label: '60m', sub: 'Deep Work', xp: 120 },
  { mins: 90, label: '90m', sub: 'Intensive', xp: 180 },
  { mins: 120, label: '120m', sub: 'Long Run', xp: 240 },
];

const STUDY_TAGS: StudyTag[] = ['Deep Work', 'Problem Solving', 'Review', 'Lab Work', 'Exam Prep'];

const QUICK_TOPIC_IDEAS = [
  'Reviewed lecture slides & notes',
  'Worked through practice problem set',
  'Prepared for upcoming exam',
  'Summarized key textbook chapters',
  'Lab coding & assignment debugging',
];

export const QuickStudyModal: React.FC<QuickStudyModalProps> = ({
  courses,
  isOpen,
  onClose,
  onAddStudyLog,
  onSuccessNotification,
  isTimerRunning = false,
  timerSeconds = 0,
  timerCourse,
  onToggleTimer,
  onResetTimer,
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'timer'>(isTimerRunning ? 'timer' : 'log');
  
  // Quick Log Form State
  const [selectedCourse, setSelectedCourse] = useState<string>(() => {
    return timerCourse || courses.find((c) => c.status === 'active')?.title || courses[0]?.title || 'General Deep Work';
  });
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [tag, setTag] = useState<StudyTag>('Deep Work');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  // Local timer state if not running globally
  const [localTimerRunning, setLocalTimerRunning] = useState(isTimerRunning);
  const [localSeconds, setLocalSeconds] = useState(timerSeconds);

  useEffect(() => {
    setLocalTimerRunning(isTimerRunning);
    setLocalSeconds(timerSeconds);
    if (isTimerRunning) {
      setActiveTab('timer');
    }
  }, [isTimerRunning, timerSeconds]);

  // Keep selected course updated if timer course is provided
  useEffect(() => {
    if (timerCourse) {
      setSelectedCourse(timerCourse);
    }
  }, [timerCourse]);

  // Handle local seconds tick if running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (localTimerRunning) {
      interval = setInterval(() => {
        setLocalSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [localTimerRunning]);

  const calculateXP = (mins: number) => Math.max(20, Math.round(mins * 2));

  const handleQuickLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSession(selectedCourse, durationMinutes, tag, notes, date);
  };

  const submitSession = (
    cName: string,
    duration: number,
    sTag: StudyTag,
    sNotes: string,
    sDate: string
  ) => {
    const matched = courses.find((c) => c.title === cName || c.shortTitle === cName);
    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = sDate === todayStr ? 'Today' : sDate;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const finalDuration = Math.max(5, duration);
    const finalCourseName = matched ? matched.shortTitle : cName;

    onAddStudyLog({
      courseName: finalCourseName,
      courseId: matched?.id,
      durationMinutes: finalDuration,
      date: sDate,
      timeRange: `${prefix} ${nowTime}`,
      notes: sNotes.trim() || `${sTag} session on ${finalCourseName}`,
      rating: 5,
      tag: sTag,
    });

    playFuturisticChime();
    fireCelebrationConfetti();

    const xp = calculateXP(finalDuration);
    if (onSuccessNotification) {
      onSuccessNotification(`⚡ Quick Study recorded: ${finalCourseName} (${finalDuration}m) • +${xp} XP gained!`);
    }

    // Reset timer if it was running
    if (onResetTimer) onResetTimer();
    setLocalTimerRunning(false);
    setLocalSeconds(0);

    onClose();
  };

  const handleFinishTimer = () => {
    const elapsedMins = Math.max(1, Math.round(localSeconds / 60));
    submitSession(
      selectedCourse,
      elapsedMins,
      tag,
      notes.trim() || `Live timer focus session (${elapsedMins} min)`,
      new Date().toISOString().split('T')[0]
    );
  };

  const formatTimerTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] p-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#4F46E5]/10 via-[#4F46E5]/5 to-transparent dark:from-[#4F46E5]/20 dark:via-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div>
            <DialogTitle className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>Quick Study</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#4F46E5]/15 text-[#4F46E5] dark:text-[#818CF8] font-bold">
                Instant Record
              </span>
            </DialogTitle>
            <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400">
              Instantly log focus minutes without leaving the Dashboard
            </p>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-sm font-bold leading-none"
            >
              ✕
            </button>
          </DialogClose>
        </div>

        {/* Tab Switcher: Quick Log vs Live Timer */}
        <div className="px-4 pt-3 pb-1 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between gap-2">
          <div className="grid grid-cols-2 gap-1 w-full bg-zinc-200/70 dark:bg-zinc-800/80 p-0.5 rounded-md text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('log');
                playClickBeep();
              }}
              className={`flex items-center justify-center py-1.5 px-3 rounded-md transition-all cursor-pointer ${
                activeTab === 'log'
                  ? 'bg-white dark:bg-black text-[#4F46E5] dark:text-[#818CF8] shadow-2xs font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Instant Log</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('timer');
                playClickBeep();
              }}
              className={`flex items-center justify-center py-1.5 px-3 rounded-md transition-all cursor-pointer ${
                activeTab === 'timer'
                  ? 'bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>Live Stopwatch</span>
              {localTimerRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* Body Content */}
        {activeTab === 'log' ? (
          <form onSubmit={handleQuickLogSubmit} className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
            {/* Course Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Course
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {courses.length} courses enrolled
                </span>
              </div>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              >
                {courses.length > 0 ? (
                  courses.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.shortTitle || c.title} {c.status === 'active' ? '(Active)' : ''}
                    </option>
                  ))
                ) : (
                  <option value="General Deep Work">General Deep Work</option>
                )}
              </select>
            </div>

            {/* 1-Click Duration Presets Bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Quick Presets
                </label>
                <span className="text-[11px] font-mono font-bold text-[#4F46E5] dark:text-[#818CF8]">
                  +{calculateXP(durationMinutes)} XP
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_DURATIONS.map((preset) => {
                  const isSelected = durationMinutes === preset.mins;
                  return (
                    <button
                      key={preset.mins}
                      type="button"
                      onClick={() => {
                        setDurationMinutes(preset.mins);
                        playMechanicalClick();
                      }}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4F46E5]/10 border-[#4F46E5] text-[#4F46E5] dark:text-[#818CF8] shadow-2xs font-extrabold ring-1 ring-[#4F46E5]/40'
                          : 'bg-zinc-50 dark:bg-black border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-xs font-mono font-bold leading-none">{preset.label}</span>
                      <span className="text-[8.5px] text-zinc-400 truncate mt-1 leading-none">{preset.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Duration & Steppers */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  Custom Focus Duration
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDurationMinutes((m) => Math.max(5, m - 5))}
                    className="w-6 h-6 rounded-md bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs font-bold hover:bg-zinc-100 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-xs px-2 text-[#4F46E5] dark:text-[#818CF8]">
                    {durationMinutes} min ({Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m)
                  </span>
                  <button
                    type="button"
                    onClick={() => setDurationMinutes((m) => Math.min(480, m + 5))}
                    className="w-6 h-6 rounded-md bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs font-bold hover:bg-zinc-100 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={5}
                max={240}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-md appearance-none cursor-pointer accent-[#4F46E5]"
              />
            </div>

            {/* Focus Tag & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Focus Tag
                </label>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value as StudyTag)}
                  className="w-full text-xs font-medium p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                >
                  {STUDY_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Session Date
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-xs h-9 bg-zinc-50 dark:bg-black border-zinc-200 dark:border-zinc-800"
                />
              </div>
            </div>

            {/* Optional Topic / Quick Note */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Session Notes (Optional)
                </label>
                <span className="text-[9.5px] text-zinc-400">What did you work on?</span>
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key concepts, practice questions, textbook chapters covered..."
                className="w-full text-xs p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none"
              />
              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1 mt-1">
                {QUICK_TOPIC_IDEAS.slice(0, 3).map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setNotes(idea)}
                    className="text-[9.5px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-[#4F46E5] hover:bg-[#4F46E5]/10 transition-colors cursor-pointer truncate max-w-full"
                  >
                    + {idea}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs h-9 px-5 rounded-md shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Record Session (+{calculateXP(durationMinutes)} XP)
              </Button>
            </div>
          </form>
        ) : (
          /* Live Stopwatch / Study Timer Tab */
          <div className="p-5 space-y-4 text-center">
            {/* Course Selector for Timer */}
            <div className="text-left">
              <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Course to Focus On
              </label>
              <select
                value={selectedCourse}
                disabled={localTimerRunning}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] disabled:opacity-60"
              >
                {courses.length > 0 ? (
                  courses.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.shortTitle || c.title}
                    </option>
                  ))
                ) : (
                  <option value="General Deep Work">General Deep Work</option>
                )}
              </select>
            </div>

            {/* Live Clock Display */}
            <div className="p-6 rounded-md bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
              {localTimerRunning && (
                <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />
              )}
              <div className="font-mono text-4xl sm:text-5xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                {formatTimerTime(localSeconds)}
              </div>
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${localTimerRunning ? 'bg-emerald-500 animate-ping' : 'bg-zinc-400'}`} />
                <span>{localTimerRunning ? 'Deep Focus Active' : localSeconds > 0 ? 'Paused' : 'Ready to Start'}</span>
                <span>•</span>
                <span className="font-mono text-[#4F46E5] font-bold">
                  +{calculateXP(Math.max(1, Math.round(localSeconds / 60)))} XP
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              {!localTimerRunning ? (
                <Button
                  type="button"
                  onClick={() => {
                    playClickBeep();
                    setLocalTimerRunning(true);
                    if (onToggleTimer) onToggleTimer(selectedCourse, tag);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-6 rounded-md shadow-md cursor-pointer"
                >
                  {localSeconds > 0 ? 'Resume Timer' : 'Start Focus'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    playClickBeep();
                    setLocalTimerRunning(false);
                    if (onToggleTimer) onToggleTimer(selectedCourse, tag);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-md shadow-md cursor-pointer"
                >
                  Pause Timer
                </Button>
              )}

              {localSeconds > 0 && !localTimerRunning && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    playMechanicalClick();
                    setLocalSeconds(0);
                    if (onResetTimer) onResetTimer();
                  }}
                  className="text-xs h-10 px-4 rounded-md border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold cursor-pointer"
                  title="Reset Timer"
                >
                  Reset
                </Button>
              )}
            </div>

            {/* Finish & Record Button */}
            {localSeconds >= 60 ? (
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleFinishTimer}
                  className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs h-10 rounded-md shadow-lg flex items-center justify-center cursor-pointer"
                >
                  Finish &amp; Record {Math.round(localSeconds / 60)} min (+{calculateXP(Math.round(localSeconds / 60))} XP)
                </Button>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400">
                Focus for at least 1 minute to record the session and claim academic XP.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
