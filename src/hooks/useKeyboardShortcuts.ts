import { useEffect, useRef } from 'react';
import { NavView } from '../types';
import { isTypingInInput, getNextView } from '../utils/keyboard';

export interface UseKeyboardShortcutsOptions {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  onOpenNewCourse?: () => void;
  onOpenNewAssignment?: () => void;
  onOpenQuickStudy?: () => void;
  onOpenExport?: () => void;
  onSaveSync?: () => void;
  onToggleTheme?: () => void;
  onToggleShortcutsModal?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  onNotify?: (message: string) => void;
  hasOpenModal?: boolean;
}

export function useKeyboardShortcuts({
  currentView,
  onNavigate,
  onOpenNewCourse,
  onOpenNewAssignment,
  onOpenQuickStudy,
  onOpenExport,
  onSaveSync,
  onToggleTheme,
  onToggleShortcutsModal,
  onFocusSearch,
  onEscape,
  onNotify,
  hasOpenModal = false,
}: UseKeyboardShortcutsOptions) {
  // Sequential key tracker for chords like "g d", "g c"
  const pendingGRef = useRef(false);
  const pendingGTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep latest refs to avoid re-binding listener on every state change
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  const hasOpenModalRef = useRef(hasOpenModal);
  hasOpenModalRef.current = hasOpenModal;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = isTypingInInput(e.target);
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // 1. ESCAPE - Always handled (close modals, cancel pending keys)
      if (e.key === 'Escape') {
        if (pendingGRef.current) {
          pendingGRef.current = false;
          if (pendingGTimerRef.current) clearTimeout(pendingGTimerRef.current);
          return;
        }
        if (onEscape) {
          onEscape();
        }
        return;
      }

      // 2. GLOBAL SHORTCUTS (allowed even when in input if modifiers match)
      // Ctrl/Cmd + K: Focus global search
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        if (onFocusSearch) onFocusSearch();
        return;
      }

      // Ctrl/Cmd + S: Save / Synchronize
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        if (onSaveSync) {
          onSaveSync();
        }
        return;
      }

      // Ctrl/Cmd + E: Export modal
      if ((e.ctrlKey || e.metaKey) && key === 'e') {
        e.preventDefault();
        if (onOpenExport) {
          onOpenExport();
        }
        return;
      }

      // Ctrl + / or Cmd + /: Toggle shortcuts modal
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        if (onToggleShortcutsModal) {
          onToggleShortcutsModal();
        }
        return;
      }

      // Alt + T or Ctrl + Shift + L: Toggle theme
      if ((e.altKey && key === 't') || ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'l')) {
        e.preventDefault();
        if (onToggleTheme) {
          onToggleTheme();
          if (onNotify) onNotify('Theme toggled');
        }
        return;
      }

      // Alt + 1..5 Direct View Navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          onNavigate('dashboard');
          if (onNotify) onNotify('Jumped to Dashboard (Alt+1)');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          onNavigate('courses-and-curriculum');
          if (onNotify) onNotify('Jumped to Courses (Alt+2)');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          onNavigate('assignments-and-exams');
          if (onNotify) onNotify('Jumped to Assignments (Alt+3)');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          onNavigate('squads');
          if (onNotify) onNotify('Jumped to Friends & Squads (Alt+4)');
          return;
        }
        if (e.key === '5') {
          e.preventDefault();
          onNavigate('settings');
          if (onNotify) onNotify('Jumped to Settings (Alt+5)');
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = getNextView(currentViewRef.current, 'prev');
          onNavigate(prev);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = getNextView(currentViewRef.current, 'next');
          onNavigate(next);
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          if (onOpenNewCourse) onOpenNewCourse();
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          if (onOpenNewAssignment) onOpenNewAssignment();
          return;
        }
        if (key === 's') {
          e.preventDefault();
          if (onOpenQuickStudy) onOpenQuickStudy();
          return;
        }
      }

      // 3. STOP HERE IF USER IS TYPING IN AN INPUT OR A MODAL IS ACTIVE
      if (isInput || hasOpenModalRef.current) {
        // Reset any pending chords if focus is in input
        pendingGRef.current = false;
        return;
      }

      // 4. SEQUENTIAL "G" CHORDS (e.g. 'g' then 'd' for dashboard)
      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (pendingGTimerRef.current) clearTimeout(pendingGTimerRef.current);

        if (key === 'd') {
          e.preventDefault();
          onNavigate('dashboard');
          if (onNotify) onNotify('Jumped to Dashboard (G D)');
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          onNavigate('courses-and-curriculum');
          if (onNotify) onNotify('Jumped to Courses (G C)');
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          onNavigate('assignments-and-exams');
          if (onNotify) onNotify('Jumped to Assignments (G A)');
          return;
        }
        if (key === 's' || key === 'f') {
          e.preventDefault();
          onNavigate('squads');
          if (onNotify) onNotify('Jumped to Friends & Squads (G S)');
          return;
        }
        if (key === 't') {
          e.preventDefault();
          onNavigate('study-session-tracker');
          if (onNotify) onNotify('Jumped to Study Tracker (G T)');
          return;
        }
        if (key === 'p' || key === ',') {
          e.preventDefault();
          onNavigate('settings');
          if (onNotify) onNotify('Jumped to Settings (G P)');
          return;
        }
      }

      // First key in sequence: 'g'
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'g') {
        pendingGRef.current = true;
        if (onNotify) onNotify('Go to: D (Dashboard), C (Courses), A (Assignments), S (Friends), T (Tracker), P (Settings)...');
        if (pendingGTimerRef.current) clearTimeout(pendingGTimerRef.current);
        pendingGTimerRef.current = setTimeout(() => {
          pendingGRef.current = false;
        }, 1500);
        return;
      }

      // 5. SINGLE-KEY GLOBAL SHORTCUTS (when not in input & no modal)
      // View cycle shortcuts: [ and ]
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
        e.preventDefault();
        const prev = getNextView(currentViewRef.current, 'prev');
        onNavigate(prev);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
        e.preventDefault();
        const next = getNextView(currentViewRef.current, 'next');
        onNavigate(next);
        return;
      }

      // Help cheat sheet: ? (Shift + /)
      if (e.key === '?') {
        e.preventDefault();
        if (onToggleShortcutsModal) onToggleShortcutsModal();
        return;
      }

      // Search focus: /
      if (e.key === '/') {
        e.preventDefault();
        if (onFocusSearch) onFocusSearch();
        return;
      }

      // Actions:
      // 'c' -> New Course
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'c') {
        e.preventDefault();
        if (onOpenNewCourse) onOpenNewCourse();
        return;
      }

      // 'a' or 'n' -> New Assignment/Task
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (key === 'a' || key === 'n')) {
        e.preventDefault();
        if (onOpenNewAssignment) onOpenNewAssignment();
        return;
      }

      // 's' -> Quick Study Session
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 's') {
        e.preventDefault();
        if (onOpenQuickStudy) onOpenQuickStudy();
        return;
      }

      // 'e' -> Export Data
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'e') {
        e.preventDefault();
        if (onOpenExport) onOpenExport();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (pendingGTimerRef.current) clearTimeout(pendingGTimerRef.current);
    };
  }, [
    onNavigate,
    onOpenNewCourse,
    onOpenNewAssignment,
    onOpenQuickStudy,
    onOpenExport,
    onSaveSync,
    onToggleTheme,
    onToggleShortcutsModal,
    onFocusSearch,
    onEscape,
    onNotify,
  ]);
}
