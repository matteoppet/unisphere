import { NavView } from '../types';

export interface ShortcutItem {
  id: string;
  keys: string[];
  description: string;
  category: 'navigation' | 'actions' | 'search' | 'system';
}

export const MAIN_NAV_ORDER: NavView[] = [
  'dashboard',
  'courses-and-curriculum',
  'assignments-and-exams',
  'squads',
  'settings',
];

/**
 * Checks if the target element is an input, textarea, select, or editable element
 * where single-key shortcuts should be ignored.
 */
export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target) return false;
  // Guard for environment where HTMLElement is defined
  if (typeof HTMLElement !== 'undefined' && !(target instanceof HTMLElement)) {
    return false;
  }
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tagName = el.tagName?.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Returns the next or previous view in the primary navigation loop.
 */
export function getNextView(currentView: NavView, direction: 'prev' | 'next'): NavView {
  const currentIndex = MAIN_NAV_ORDER.indexOf(currentView);
  if (currentIndex === -1) {
    return 'dashboard';
  }
  if (direction === 'next') {
    return MAIN_NAV_ORDER[(currentIndex + 1) % MAIN_NAV_ORDER.length];
  } else {
    return MAIN_NAV_ORDER[(currentIndex - 1 + MAIN_NAV_ORDER.length) % MAIN_NAV_ORDER.length];
  }
}

/**
 * Calculates wrapped index for search dropdown arrow navigation.
 */
export function calculateActiveSearchIndex(
  currentIndex: number,
  delta: number,
  totalCount: number
): number {
  if (totalCount <= 0) return -1;
  if (currentIndex === -1) {
    return delta > 0 ? 0 : totalCount - 1;
  }
  const nextIndex = (currentIndex + delta + totalCount) % totalCount;
  return nextIndex;
}

/**
 * Complete list of workstation keyboard shortcuts
 */
export const WORKSTATION_SHORTCUTS: ShortcutItem[] = [
  // Navigation
  {
    id: 'nav-dashboard',
    keys: ['Alt + 1', 'G then D'],
    description: 'Jump to Main Dashboard',
    category: 'navigation',
  },
  {
    id: 'nav-courses',
    keys: ['Alt + 2', 'G then C'],
    description: 'Jump to Courses & Curriculum',
    category: 'navigation',
  },
  {
    id: 'nav-assignments',
    keys: ['Alt + 3', 'G then A'],
    description: 'Jump to Assignments & Exams',
    category: 'navigation',
  },
  {
    id: 'nav-squads',
    keys: ['Alt + 4', 'G then S'],
    description: 'Jump to Squads & Friends Hub',
    category: 'navigation',
  },
  {
    id: 'nav-settings',
    keys: ['Alt + 5', 'G then P'],
    description: 'Jump to Workstation Settings',
    category: 'navigation',
  },
  {
    id: 'nav-tracker',
    keys: ['G then T'],
    description: 'Jump to Study Session Tracker',
    category: 'navigation',
  },
  {
    id: 'nav-cycle-prev',
    keys: ['[', 'Alt + ←'],
    description: 'Switch to Previous View',
    category: 'navigation',
  },
  {
    id: 'nav-cycle-next',
    keys: [']', 'Alt + →'],
    description: 'Switch to Next View',
    category: 'navigation',
  },

  // Quick Actions
  {
    id: 'action-new-course',
    keys: ['C', 'Alt + C'],
    description: 'Create New Academic Course',
    category: 'actions',
  },
  {
    id: 'action-new-assignment',
    keys: ['A', 'N', 'Alt + A'],
    description: 'Add New Assignment or Exam',
    category: 'actions',
  },
  {
    id: 'action-quick-study',
    keys: ['S', 'Alt + S'],
    description: 'Record Quick Study Session',
    category: 'actions',
  },
  {
    id: 'action-export',
    keys: ['E', 'Ctrl + E'],
    description: 'Export Workspace Data (JSON/CSV)',
    category: 'actions',
  },
  {
    id: 'action-sync',
    keys: ['Ctrl + S', '⌘ + S'],
    description: 'Instant Cloud Sync / Save State',
    category: 'actions',
  },

  // Global Search & Command
  {
    id: 'search-focus',
    keys: ['Ctrl + K', '⌘ + K', '/'],
    description: 'Focus Global Search & Command Bar',
    category: 'search',
  },
  {
    id: 'search-navigate',
    keys: ['↑', '↓'],
    description: 'Navigate Search Results',
    category: 'search',
  },
  {
    id: 'search-select',
    keys: ['Enter ↵'],
    description: 'Open Selected Course, Task, or Log',
    category: 'search',
  },
  {
    id: 'search-tab-filter',
    keys: ['Tab'],
    description: 'Cycle Result Categories (All, Courses, Tasks, Logs)',
    category: 'search',
  },
  {
    id: 'search-dismiss',
    keys: ['Escape'],
    description: 'Dismiss Search Dropdown',
    category: 'search',
  },

  // System & Accessibility
  {
    id: 'system-shortcuts-modal',
    keys: ['?', 'Ctrl + /', '⌘ + /'],
    description: 'Open Keyboard Shortcuts Reference',
    category: 'system',
  },
  {
    id: 'system-theme-toggle',
    keys: ['Alt + T', 'Ctrl + Shift + L'],
    description: 'Toggle Deep Obsidian / Light Theme',
    category: 'system',
  },
  {
    id: 'system-escape',
    keys: ['Escape'],
    description: 'Close Active Modal, Drawer, or Palette',
    category: 'system',
  },
];
