import React, { useState, useEffect, useRef } from 'react';
import { playClickBeep } from '../utils/audio';

interface QuickNotesSectionProps {
  notes: string;
  onUpdateNotes: (notes: string) => void;
  actionButton?: React.ReactNode;
  className?: string;
}

export const QuickNotesSection: React.FC<QuickNotesSectionProps> = ({
  notes,
  onUpdateNotes,
  actionButton,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'scratchpad' | 'checklist'>('scratchpad');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletedNotesBackup, setDeletedNotesBackup] = useState<string | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [autoResetDaily, setAutoResetDaily] = useState<boolean>(() => {
    try {
      return localStorage.getItem('unisphere_notes_auto_reset') === 'true';
    } catch {
      return false;
    }
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const todayDateStr = new Date().toISOString().split('T')[0];
  const formattedToday = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Track note date
  const [noteDate, setNoteDate] = useState<string>(() => {
    try {
      return localStorage.getItem('unisphere_notes_date') || todayDateStr;
    } catch {
      return todayDateStr;
    }
  });

  // Handle ephemeral daily reset check on mount
  useEffect(() => {
    try {
      const storedDate = localStorage.getItem('unisphere_notes_date');
      if (storedDate && storedDate !== todayDateStr) {
        if (autoResetDaily && notes.trim().length > 0) {
          // Keep a backup just in case
          setDeletedNotesBackup(notes);
          onUpdateNotes('');
          setNoteDate(todayDateStr);
          localStorage.setItem('unisphere_notes_date', todayDateStr);
          setShowUndoToast(true);
        }
      }
    } catch (e) {
      console.warn('Note date check error', e);
    }
  }, []);

  const handleNotesChange = (text: string) => {
    onUpdateNotes(text);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastSavedTime(timeStr);
    try {
      localStorage.setItem('unisphere_notes_date', todayDateStr);
      setNoteDate(todayDateStr);
    } catch {}
  };

  const handleToggleAutoReset = () => {
    playClickBeep();
    const nextVal = !autoResetDaily;
    setAutoResetDaily(nextVal);
    try {
      localStorage.setItem('unisphere_notes_auto_reset', String(nextVal));
    } catch {}
  };

  const handleCopyToClipboard = async () => {
    playClickBeep();
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearNotes = () => {
    playClickBeep();
    if (!notes.trim()) return;

    setDeletedNotesBackup(notes);
    handleNotesChange('');
    setShowClearConfirm(false);
    setShowUndoToast(true);

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndoToast(false);
      setDeletedNotesBackup(null);
    }, 8000);
  };

  const handleUndoClear = () => {
    playClickBeep();
    if (deletedNotesBackup !== null) {
      handleNotesChange(deletedNotesBackup);
      setDeletedNotesBackup(null);
      setShowUndoToast(false);
    }
  };

  const handleStartFreshToday = () => {
    playClickBeep();
    setDeletedNotesBackup(notes);
    handleNotesChange('');
    setNoteDate(todayDateStr);
    try {
      localStorage.setItem('unisphere_notes_date', todayDateStr);
    } catch {}
    setShowUndoToast(true);
  };

  // Parse lines for Checklist Mode
  const lines = notes.split('\n');
  const checklistItems = lines
    .map((line, index) => {
      const trimmed = line.trim();
      const isCompleted = /^(\s*[-*•]\s*\[x\]|\s*\[x\])/i.test(trimmed);
      const isTodo = /^(\s*[-*•]\s*\[\s\]|\s*\[\s\])/i.test(trimmed);
      const isBullet = /^(\s*[-*•]\s*)/.test(trimmed) && !isTodo && !isCompleted;

      let cleanText = trimmed;
      if (isCompleted) {
        cleanText = trimmed.replace(/^(\s*[-*•]\s*\[x\]|\s*\[x\])\s*/i, '');
      } else if (isTodo) {
        cleanText = trimmed.replace(/^(\s*[-*•]\s*\[\s\]|\s*\[\s\])\s*/i, '');
      } else if (isBullet) {
        cleanText = trimmed.replace(/^(\s*[-*•]\s*)\s*/, '');
      }

      return {
        originalIndex: index,
        line,
        text: cleanText,
        isCheckable: isCompleted || isTodo || isBullet || trimmed.length > 0,
        isCompleted,
        raw: trimmed,
      };
    })
    .filter((item) => item.raw.length > 0);

  const toggleChecklistItem = (index: number) => {
    playClickBeep();
    const newLines = [...lines];
    const targetLine = newLines[index];
    const isCompleted = /^(\s*[-*•]\s*\[x\]|\s*\[x\])/i.test(targetLine);

    if (isCompleted) {
      // Uncheck it
      newLines[index] = targetLine.replace(/\[x\]/i, '[ ]');
    } else if (/^(\s*[-*•]\s*\[\s\]|\s*\[\s\])/i.test(targetLine)) {
      // Check it
      newLines[index] = targetLine.replace(/\[\s\]/i, '[x]');
    } else if (/^(\s*[-*•]\s*)/.test(targetLine)) {
      // Add checked box to bullet
      newLines[index] = targetLine.replace(/^(\s*[-*•]\s*)/, '• [x] ');
    } else {
      // Add checked box
      newLines[index] = `• [x] ${targetLine}`;
    }

    handleNotesChange(newLines.join('\n'));
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    playClickBeep();
    const newLine = `• [ ] ${newChecklistText.trim()}`;
    const updated = notes.trim() ? `${notes}\n${newLine}` : newLine;
    handleNotesChange(updated);
    setNewChecklistText('');
  };

  const handleClearCompletedChecklist = () => {
    playClickBeep();
    const newLines = lines.filter((l) => !/^(\s*[-*•]\s*\[x\]|\s*\[x\])/i.test(l.trim()));
    handleNotesChange(newLines.join('\n'));
  };

  const totalItemsCount = checklistItems.length;
  const completedCount = checklistItems.filter((i) => i.isCompleted).length;
  const isFromPreviousDay = noteDate !== todayDateStr && notes.trim().length > 0;

  return (
    <div className={`border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-xs overflow-hidden flex flex-col flex-1 min-h-0 h-full relative transition-colors ${className}`}>
      {/* Widget Header with title matching sketch: Quick Note taking */}
      <div className="shrink-0 bg-slate-50/80 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
          <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">
            sticky_note_2
          </span>
          <span>Quick Note taking</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
          <span className="material-symbols-outlined text-[12px] text-blue-700 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110">
            today
          </span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formattedToday}</span>
        </div>
      </div>

      <div className="p-2.5 sm:p-3 text-xs flex flex-col flex-1 min-h-0">
        {/* Mode Tabs & Save Status */}
        <div className="shrink-0 flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-zinc-800 gap-1 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span>
              {lastSavedTime === 'Just now' ? 'Autosaved' : `Saved ${lastSavedTime}`}
            </span>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-gray-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => {
                playClickBeep();
                setActiveTab('scratchpad');
              }}
              className={`px-2 py-0.5 text-[10px] rounded-md transition-all font-medium flex items-center gap-1 ${
                activeTab === 'scratchpad'
                  ? 'bg-white dark:bg-zinc-900 text-blue-800 dark:text-indigo-400 shadow-2xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Freeform text scratchpad"
            >
              <span className="material-symbols-outlined text-[11px]">edit_note</span>
              <span>Scratchpad</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClickBeep();
                setActiveTab('checklist');
              }}
              className={`px-2 py-0.5 text-[10px] rounded-md transition-all font-medium flex items-center gap-1 ${
                activeTab === 'checklist'
                  ? 'bg-white dark:bg-zinc-900 text-blue-800 dark:text-indigo-400 shadow-2xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Interactive daily reminders checklist"
            >
              <span className="material-symbols-outlined text-[11px]">checklist</span>
              <span>Checklist</span>
              {totalItemsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-slate-200 dark:bg-zinc-700 rounded-full text-[9px] font-mono">
                  {completedCount}/{totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

      {/* Previous day banner warning */}
      {isFromPreviousDay && (
        <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 rounded-lg text-[10px] text-amber-900 dark:text-amber-200 flex items-center justify-between gap-1 shadow-2xs">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-amber-700 dark:text-amber-400">
              history
            </span>
            <span>
              Contains notes from <strong>{noteDate}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleStartFreshToday}
            className="win-button px-2 py-0.5 text-[9px] font-semibold text-amber-900 dark:text-amber-300"
            title="Wipe previous day's notes to start today clean"
          >
            Start Fresh for Today
          </button>
        </div>
      )}

      {/* Undo Toast Banner */}
      {showUndoToast && (
        <div className="mb-2 p-2 bg-neutral-800 dark:bg-zinc-800 text-white rounded-lg text-[10px] flex items-center justify-between gap-2 shadow-md animate-fade-in">
          <div className="flex items-center gap-1 font-mono">
            <span className="material-symbols-outlined text-[13px] text-emerald-400">
              check_circle
            </span>
            <span>Ephemeral notes cleared.</span>
          </div>
          <button
            type="button"
            onClick={handleUndoClear}
            className="px-2 py-0.5 bg-neutral-700 hover:bg-neutral-600 border border-neutral-500 rounded text-[10px] font-semibold text-yellow-300 flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[11px]">undo</span>
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Content Area: Scratchpad Mode */}
      {activeTab === 'scratchpad' && (
        <div className="flex-1 min-h-[160px] flex flex-col space-y-1">
          <div className="flex-1 min-h-[150px] relative border border-amber-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-[#fffdf0] dark:bg-zinc-950 shadow-inner focus-within:border-amber-400 dark:focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-300/40 flex flex-col">
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Jot down quick thoughts, room numbers, questions for office hours, library books, or ephemeral reminders for today..."
              className="w-full flex-1 min-h-[140px] text-[11px] p-2.5 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none resize-none font-sans leading-relaxed selection:bg-amber-200 dark:selection:bg-amber-900/60"
            />
          </div>
        </div>
      )}

      {/* Content Area: Checklist Mode */}
      {activeTab === 'checklist' && (
        <div className="flex-1 min-h-[160px] flex flex-col space-y-2">
          {/* Quick Add Checklist Input */}
          <form onSubmit={handleAddChecklistItem} className="shrink-0 flex gap-1.5">
            <input
              type="text"
              value={newChecklistText}
              onChange={(e) => setNewChecklistText(e.target.value)}
              placeholder="Add reminder..."
              className="flex-1 text-[11px] py-1 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:border-blue-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            <button
              type="submit"
              className="group px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px] text-blue-700 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110">
                add
              </span>
              <span>Add</span>
            </button>
          </form>

          {/* Checklist Items Container */}
          <div className="flex-1 min-h-[150px] border border-gray-200 dark:border-zinc-800 rounded-lg bg-slate-50/40 dark:bg-zinc-950/40 p-2 overflow-y-auto space-y-1">
            {checklistItems.length === 0 ? (
              <div className="py-4 text-center text-zinc-400 dark:text-zinc-500 text-[11px]">
                <p>No active reminders for today.</p>
                <p className="text-[10px] mt-0.5 text-zinc-500 dark:text-zinc-500">
                  Type above or switch to Scratchpad to add quick notes.
                </p>
              </div>
            ) : (
              checklistItems.map((item) => (
                <div
                  key={item.originalIndex}
                  onClick={() => toggleChecklistItem(item.originalIndex)}
                  className={`flex items-start gap-1.5 p-1.5 rounded-md transition-colors cursor-pointer group ${
                    item.isCompleted ? 'bg-slate-100/70 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500' : 'hover:bg-amber-50/70 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => {}} // Handled by container onClick
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span
                    className={`text-[11px] leading-tight select-text flex-1 break-words ${
                      item.isCompleted ? 'line-through opacity-70' : 'font-normal'
                    }`}
                  >
                    {item.text}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Checklist Actions */}
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 pt-0.5">
            <span>
              {completedCount} of {totalItemsCount} completed
            </span>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleClearCompletedChecklist}
                className="text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[11px]">
                  cleaning_services
                </span>
                <span>Clear completed</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer Toolbar */}
      <div className="shrink-0 pt-2 mt-1.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-1 flex-wrap">
        {/* Left: Ephemeral settings toggle */}
        <label
          className="flex items-center gap-1.5 text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer select-none"
          title="Automatically reset notes when a new calendar day begins"
        >
          <input
            type="checkbox"
            checked={autoResetDaily}
            onChange={handleToggleAutoReset}
            className="rounded border-gray-300 dark:border-zinc-700 text-amber-600 focus:ring-0"
          />
          <span>Auto-clear daily</span>
        </label>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyToClipboard}
            disabled={!notes.trim()}
            className="group px-2 py-0.5 text-[10px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
            title="Copy notes to clipboard"
          >
            <span className="material-symbols-outlined text-[12px] text-blue-700 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {showClearConfirm ? (
            <div className="flex items-center gap-0.5 bg-red-50 dark:bg-red-950/60 p-0.5 rounded-md border border-red-200 dark:border-red-900/60">
              <span className="text-[9px] text-red-800 dark:text-red-300 font-semibold px-0.5">Clear?</span>
              <button
                type="button"
                onClick={handleClearNotes}
                className="px-1.5 py-0.2 bg-red-600 text-white rounded text-[9px] font-bold hover:bg-red-700"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-[9px] hover:bg-zinc-300 dark:hover:bg-zinc-600"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (notes.trim()) setShowClearConfirm(true);
              }}
              disabled={!notes.trim()}
              className="group px-2 py-0.5 text-[10px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
              title="Clear all ephemeral text"
            >
              <span className="material-symbols-outlined text-[12px] text-red-600 dark:text-red-400 transition-transform duration-200 group-hover:scale-110">
                delete
              </span>
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Embedded Action Button (e.g. Floating (+) Speed Dial as sketched) */}
      {actionButton && (
        <div className="shrink-0 flex justify-end p-2 pt-1 border-t border-gray-100 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-950/40">
          {actionButton}
        </div>
      )}
    </div>
  );
};
