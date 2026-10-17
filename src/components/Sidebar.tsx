import React from 'react';
import {
  LayoutDashboard as DashboardIcon,
  BookOpen as Book,
  Clock,
  CheckCircle2 as CheckCircle,
  Users,
  Settings as SettingsIcon,
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
      color: 'text-indigo-500 dark:text-indigo-400',
      activeColor: 'text-indigo-400 dark:text-indigo-300',
      badge: undefined,
    },
    {
      id: 'courses-and-curriculum' as NavView,
      label: 'Courses',
      icon: Book,
      color: 'text-blue-500 dark:text-blue-400',
      activeColor: 'text-blue-400 dark:text-blue-300',
      badge: undefined,
    },
    {
      id: 'study-session-tracker' as NavView,
      label: 'Study Sessions',
      icon: Clock,
      color: 'text-amber-500 dark:text-amber-400',
      activeColor: 'text-amber-400 dark:text-amber-300',
      badge: undefined,
    },
    {
      id: 'assignments-and-exams' as NavView,
      label: 'Assignments & Exams',
      icon: CheckCircle,
      color: 'text-emerald-500 dark:text-emerald-400',
      activeColor: 'text-emerald-400 dark:text-emerald-300',
      badge: undefined,
    },
    {
      id: 'squads' as NavView,
      label: 'Squads',
      icon: Users,
      color: 'text-[#3B77BC] dark:text-[#689FE1]',
      activeColor: 'text-[#3B77BC] dark:text-[#689FE1]',
      badge: undefined,
    },
    {
      id: 'settings' as NavView,
      label: 'Settings',
      icon: SettingsIcon,
      color: 'text-[#5A738E] dark:text-[#8CA3BA]',
      activeColor: 'text-[#5A738E] dark:text-[#8CA3BA]',
      badge: undefined,
    },
  ];

  const handleNavClick = (id: NavView) => {
    onNavigate(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 select-none">
      <div className="flex flex-col overflow-y-auto">
        {/* Brand Header */}
        <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900">
          <div className="min-w-0">
            {/* Mobile View: Logo + "UniSphere" */}
            <div className="flex md:hidden items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#3B77BC] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[15px]">school</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 tracking-tight leading-none truncate">
                  UniSphere
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium tracking-tight mt-0.5 truncate">
                  Workspace Explorer
                </span>
              </div>
            </div>

            {/* Desktop View: Workspace Explorer */}
            <div className="hidden md:block font-semibold text-xs text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight truncate">
              Workspace Explorer
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded cursor-pointer transition-colors"
              aria-label="Close drawer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Section 1: Main Components Navigation */}
        <div className="p-2.5 space-y-1 font-sans">
          {mainNavItems.map((item) => {
            const isActive = currentView === item.id;
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-[13px] font-medium transition-all duration-150 group cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 shadow-2xs border border-zinc-800 dark:border-zinc-700 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 dark:hover:border-zinc-800/80 border border-transparent active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 truncate">
                  <span
                    className={`shrink-0 inline-flex items-center transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? item.activeColor : item.color
                    }`}
                  >
                    <IconComponent size={18} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none border shrink-0 ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-200 border-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-200 dark:border-zinc-800/80 flex-col shrink-0 h-full">
        {renderContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[85vw] h-full shadow-2xl z-10 border-r border-zinc-200 dark:border-zinc-800 animate-slide-right">
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
};
