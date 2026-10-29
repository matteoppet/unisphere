import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from './ui/dialog';
import { Button } from './ui/button';
import { WORKSTATION_SHORTCUTS, ShortcutItem } from '../utils/keyboard';
import { NavView } from '../types';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: NavView) => void;
}

const CATEGORY_META: Record<
  ShortcutItem['category'],
  { label: string; icon: string; color: string }
> = {
  navigation: {
    label: 'Navigation',
    icon: 'explore',
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
  },
  actions: {
    label: 'Quick Actions',
    icon: 'bolt',
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
  },
  search: {
    label: 'Search & Palette',
    icon: 'search',
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
  },
  system: {
    label: 'System & UI',
    icon: 'tune',
    color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800',
  },
};

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ShortcutItem['category']>('all');

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return WORKSTATION_SHORTCUTS.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.description.toLowerCase().includes(q) ||
        item.keys.some((k) => k.toLowerCase().includes(q)) ||
        CATEGORY_META[item.category].label.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  const grouped = useMemo(() => {
    const groups: Record<ShortcutItem['category'], ShortcutItem[]> = {
      navigation: [],
      actions: [],
      search: [],
      system: [],
    };
    filteredShortcuts.forEach((item) => {
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredShortcuts]);

  const handleShortcutClick = (item: ShortcutItem) => {
    if (!onNavigate) return;
    if (item.id === 'nav-dashboard') {
      onNavigate('dashboard');
      onClose();
    } else if (item.id === 'nav-courses') {
      onNavigate('courses-and-curriculum');
      onClose();
    } else if (item.id === 'nav-assignments') {
      onNavigate('assignments-and-exams');
      onClose();
    } else if (item.id === 'nav-squads') {
      onNavigate('squads');
      onClose();
    } else if (item.id === 'nav-settings') {
      onNavigate('settings');
      onClose();
    } else if (item.id === 'nav-tracker') {
      onNavigate('study-session-tracker');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col text-xs overflow-hidden bg-white dark:bg-zinc-950 border border-[#ecedef] dark:border-zinc-800 rounded-lg slite-shadow">
        {/* Header */}
        <DialogHeader className="border-b border-[#ecedef] dark:border-zinc-800 px-4 py-3 bg-[#fdf9f4] dark:bg-zinc-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="material-symbols-outlined text-[20px] text-[#6366F1] shrink-0">
              keyboard
            </span>
            <div>
              <DialogTitle className="text-sm font-bold text-[#2d2f34] dark:text-zinc-100">
                Keyboard Shortcuts &amp; Navigations
              </DialogTitle>
              <p className="text-[11px] font-normal text-[#3f434a]/70 dark:text-zinc-400">
                Navigate UniSphere at the speed of thought
              </p>
            </div>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-[#3f434a] hover:text-[#2d2f34] dark:text-zinc-400 dark:hover:text-zinc-100 rounded-md"
              aria-label="Close shortcuts modal"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        {/* Search & Category Filter Toolbar */}
        <div className="p-3 border-b border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4]/50 dark:bg-zinc-900/50 flex flex-col gap-2 shrink-0">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined text-[16px] text-zinc-400 absolute left-3 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts (e.g. 'theme', 'course', 'search', 'export')..."
              autoFocus
              className="w-full h-8 pl-8.5 pr-8 text-[11px] sm:text-xs rounded-md border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                title="Clear filter"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-0.5 rounded-md font-medium text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-[#6366F1] text-white font-semibold'
                  : 'bg-white dark:bg-zinc-900 text-[#3f434a] dark:text-zinc-400 border border-[#ecedef] dark:border-zinc-800 hover:bg-[#f9efe4] dark:hover:bg-zinc-800'
              }`}
            >
              All ({WORKSTATION_SHORTCUTS.length})
            </button>
            {(['navigation', 'actions', 'search', 'system'] as const).map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = WORKSTATION_SHORTCUTS.filter((s) => s.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-0.5 rounded-md font-medium text-[11px] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    selectedCategory === cat
                      ? 'bg-[#6366F1] text-white font-semibold'
                      : 'bg-white dark:bg-zinc-900 text-[#3f434a] dark:text-zinc-400 border border-[#ecedef] dark:border-zinc-800 hover:bg-[#f9efe4] dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{meta.label}</span>
                  <span className="text-[9.5px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {filteredShortcuts.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 dark:text-zinc-500">
              <span className="material-symbols-outlined text-[30px] mb-1">search_off</span>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No shortcuts found</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Try a different keyword</p>
            </div>
          ) : (
            (['navigation', 'actions', 'search', 'system'] as const).map((cat) => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              const meta = CATEGORY_META[cat];
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#3f434a]/80 dark:text-zinc-400 px-1">
                    <span className="material-symbols-outlined text-[15px]">{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  <div className="border border-[#ecedef] dark:border-zinc-800/80 rounded-md overflow-hidden divide-y divide-[#ecedef] dark:divide-zinc-800/80 bg-white dark:bg-zinc-900/60">
                    {items.map((item) => {
                      const isNavigable = item.category === 'navigation' && item.id.startsWith('nav-') && !item.id.includes('cycle');
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleShortcutClick(item)}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                            isNavigable
                              ? 'hover:bg-[#f9efe4]/60 dark:hover:bg-zinc-800/50 cursor-pointer group'
                              : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-[#2d2f34] dark:text-zinc-200">
                              {item.description}
                            </span>
                            {isNavigable && (
                              <span className="text-[10px] text-[#6366F1] dark:text-indigo-400 opacity-0 group-hover:opacity-100 ml-2 transition-opacity inline-flex items-center gap-0.5">
                                Click to jump →
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {item.keys.map((k, kIdx) => (
                              <React.Fragment key={k}>
                                {kIdx > 0 && <span className="text-zinc-400 text-[10px]">or</span>}
                                <kbd className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[#2d2f34] dark:text-zinc-200 font-semibold shadow-2xs">
                                  {k}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4] dark:bg-zinc-900/80 flex items-center justify-between text-[10px] text-[#3f434a]/80 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Tip: Press <kbd className="font-mono px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[9.5px]">?</kbd> anywhere to open</span>
          </div>
          <span className="font-medium text-[#6366F1] dark:text-indigo-400">
            UniSphere Workstation
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
