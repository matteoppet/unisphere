import React from 'react';
import {
  LayoutDashboard as DashboardIcon,
  BookOpen as Book,
  CheckCircle2 as CheckCircle,
  Users,
  Settings as SettingsIcon,
  Keyboard,
} from 'lucide-react';
import { NavView, StudentProfile } from '../types';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  profile?: StudentProfile;
  earnedCFU?: number;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const mainNavItems = [
    {
      id: 'dashboard' as NavView,
      label: 'Dashboard',
      icon: DashboardIcon,
    },
    {
      id: 'courses-and-curriculum' as NavView,
      label: 'Courses',
      icon: Book,
    },
    {
      id: 'assignments-and-exams' as NavView,
      label: 'Assignments & Exams',
      icon: CheckCircle,
    },
    {
      id: 'squads' as NavView,
      label: 'Friends',
      icon: Users,
    },
  ];

  const handleNavClick = (id: NavView) => {
    onNavigate(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full justify-between bg-[#fdf9f4] dark:bg-[#09090b] text-[#2d2f34] dark:text-zinc-100 select-none">
      <div className="flex flex-col overflow-y-auto">
        {/* Brand Header: Workspace Explorer */}
        <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-[#ecedef] dark:border-zinc-900">
          <div className="min-w-0">
            {/* Mobile View */}
            <div className="flex md:hidden items-center min-w-0">
              <span className="font-semibold text-xs text-[#2d2f34] dark:text-zinc-100 tracking-tight leading-none truncate">
                Workspace Explorer
              </span>
            </div>

            {/* Desktop View: Explorer */}
            <div className="hidden md:flex items-center">
              <span className="font-semibold text-xs text-[#3f434a] dark:text-zinc-400">
                Workspace Explorer
              </span>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1 text-[#3f434a] hover:text-[#2d2f34] dark:text-zinc-400 dark:hover:text-zinc-200 rounded cursor-pointer transition-colors"
              aria-label="Close drawer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Section 1: Main Components Navigation with Slite Ghost Buttons */}
        <div className="p-3 space-y-1 font-sans">
          {mainNavItems.map((item) => {
            const isActive =
              currentView === item.id ||
              (item.id === 'courses-and-curriculum' && currentView === 'study-session-tracker');
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 border border-[#ecedef] dark:border-zinc-800 font-semibold slite-shadow'
                    : 'text-[#3f434a] dark:text-zinc-400 hover:text-[#2d2f34] dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-zinc-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 truncate">
                  <span
                    className={`shrink-0 inline-flex items-center transition-colors duration-150 ${
                      isActive ? 'text-[#6366F1]' : 'text-[#3f434a] dark:text-zinc-400 group-hover:text-[#2d2f34]'
                    }`}
                  >
                    <IconComponent size={16} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] shrink-0" title="Active View" />
                )}
              </button>
            );
          })}

          {/* Separator */}
          <div className="pt-2 pb-1">
            <div className="border-t border-[#ecedef] dark:border-zinc-800" />
          </div>

          {/* Settings Nav Item */}
          <button
            type="button"
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              currentView === 'settings'
                ? 'bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 border border-[#ecedef] dark:border-zinc-800 font-semibold slite-shadow'
                : 'text-[#3f434a] dark:text-zinc-400 hover:text-[#2d2f34] dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <span className={`shrink-0 inline-flex items-center transition-colors duration-150 ${currentView === 'settings' ? 'text-[#6366F1]' : 'text-[#3f434a] dark:text-zinc-400 group-hover:text-[#2d2f34]'}`}>
                <SettingsIcon size={16} />
              </span>
              <span className="truncate">Settings</span>
            </div>
            {currentView === 'settings' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] shrink-0" title="Active View" />
            )}
          </button>

          {/* Shortcuts Nav Item */}
          <button
            type="button"
            onClick={() => handleNavClick('shortcuts')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              currentView === 'shortcuts'
                ? 'bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-100 border border-[#ecedef] dark:border-zinc-800 font-semibold slite-shadow'
                : 'text-[#3f434a] dark:text-zinc-400 hover:text-[#2d2f34] dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <span className={`shrink-0 inline-flex items-center transition-colors duration-150 ${currentView === 'shortcuts' ? 'text-[#6366F1]' : 'text-[#3f434a] dark:text-zinc-400 group-hover:text-[#2d2f34]'}`}>
                <Keyboard size={16} />
              </span>
              <span className="truncate">Shortcuts</span>
            </div>
            {currentView === 'shortcuts' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] shrink-0" title="Active View" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-60 border-r border-[#ecedef] dark:border-zinc-800/80 flex-col shrink-0 h-full bg-[#fdf9f4] dark:bg-[#09090b]">
        {renderContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[85vw] h-full slite-shadow z-10 border-r border-[#ecedef] dark:border-zinc-800 animate-slide-right bg-[#fdf9f4]">
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
};
