import React, { useState, useMemo } from 'react';
import { NavView } from '../types';
import { WORKSTATION_SHORTCUTS, ShortcutItem } from '../utils/keyboard';

interface ShortcutsViewProps {
  onNavigate: (view: NavView) => void;
}

const CATEGORY_META: Record<
  ShortcutItem['category'],
  { label: string; icon: string }
> = {
  navigation: {
    label: 'Navigation',
    icon: 'explore',
  },
  actions: {
    label: 'Quick Actions',
    icon: 'bolt',
  },
  search: {
    label: 'Search & Command Palette',
    icon: 'search',
  },
  system: {
    label: 'System & Accessibility',
    icon: 'tune',
  },
};

export const ShortcutsView: React.FC<ShortcutsViewProps> = ({ onNavigate }) => {
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
    if (item.id === 'nav-dashboard') {
      onNavigate('dashboard');
    } else if (item.id === 'nav-courses') {
      onNavigate('courses-and-curriculum');
    } else if (item.id === 'nav-assignments') {
      onNavigate('assignments-and-exams');
    } else if (item.id === 'nav-squads') {
      onNavigate('squads');
    } else if (item.id === 'nav-settings') {
      onNavigate('settings');
    } else if (item.id === 'nav-tracker') {
      onNavigate('study-session-tracker');
    }
  };

  return (
    <div className="flex-1 bg-[#fdf9f4] dark:bg-[#09090b] text-[#2d2f34] dark:text-zinc-100 overflow-y-auto p-3 sm:p-5 space-y-4 select-none transition-colors">
      {/* Header Banner */}
      <div className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-4 sm:p-5 slite-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">keyboard</span>
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-[#2d2f34] dark:text-zinc-100">
              Keyboard Shortcuts
            </h1>
            <p className="text-[11px] sm:text-xs text-[#3f434a]/70 dark:text-zinc-400">
              Complete reference guide for navigating UniSphere with your keyboard
            </p>
          </div>
        </div>

        {/* Search input inside header */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined text-[15px] text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4] dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer whitespace-nowrap ${
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
              className={`px-3 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                selectedCategory === cat
                  ? 'bg-[#6366F1] text-white font-semibold'
                  : 'bg-white dark:bg-zinc-900 text-[#3f434a] dark:text-zinc-400 border border-[#ecedef] dark:border-zinc-800 hover:bg-[#f9efe4] dark:hover:bg-zinc-800'
              }`}
            >
              <span>{meta.label}</span>
              <span className="text-[10px] opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Shortcut Groups Grid */}
      <div className="space-y-4">
        {filteredShortcuts.length === 0 ? (
          <div className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-8 text-center text-zinc-400">
            <span className="material-symbols-outlined text-[32px] mb-1">search_off</span>
            <p className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-200">No shortcuts found</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Try searching for another keyword</p>
          </div>
        ) : (
          (['navigation', 'actions', 'search', 'system'] as const).map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];

            return (
              <div
                key={cat}
                className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md overflow-hidden slite-shadow"
              >
                <div className="bg-[#fdf9f4] dark:bg-zinc-900/90 border-b border-[#ecedef] dark:border-zinc-800 px-4 py-2.5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px] text-[#6366F1]">
                    {meta.icon}
                  </span>
                  <h2 className="font-bold text-xs text-[#2d2f34] dark:text-zinc-100">
                    {meta.label}
                  </h2>
                </div>

                <div className="divide-y divide-[#ecedef] dark:divide-zinc-800/80">
                  {items.map((item) => {
                    const isNavigable =
                      item.category === 'navigation' &&
                      item.id.startsWith('nav-') &&
                      !item.id.includes('cycle');

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleShortcutClick(item)}
                        className={`px-4 py-3 flex items-center justify-between gap-4 transition-colors ${
                          isNavigable
                            ? 'hover:bg-[#f9efe4]/60 dark:hover:bg-zinc-850 cursor-pointer group'
                            : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-xs text-[#2d2f34] dark:text-zinc-200">
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
                              {kIdx > 0 && (
                                <span className="text-zinc-400 text-[10px]">or</span>
                              )}
                              <kbd className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[#2d2f34] dark:text-zinc-200 font-semibold shadow-2xs">
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
    </div>
  );
};
