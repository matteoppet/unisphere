import React from 'react';
import { NavView, StudentProfile } from '../types';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  profile: StudentProfile;
  earnedCFU: number;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  profile,
  earnedCFU,
  onSignOut,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const targetCFU = profile.totalTargetCFU || 180;
  const currentProgression = earnedCFU ?? 0;
  const registryPercent = Math.min(100, Math.round((currentProgression / targetCFU) * 100));

  const navItems: { id: NavView; label: string; icon: string; iconColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'desktop_windows' },
    { id: 'courses-and-curriculum', label: 'Courses', icon: 'view_list', iconColor: 'text-indigo-600' },
    { id: 'study-session-tracker', label: 'Study Sessions', icon: 'query_stats', iconColor: 'text-amber-600' },
    { id: 'assignments-and-exams', label: 'Assignments & Exams', icon: 'fact_check', iconColor: 'text-emerald-600' },
    { id: 'settings', label: 'Settings', icon: 'settings', iconColor: 'text-neutral-600' },
  ];

  const handleNavClick = (id: NavView) => {
    onNavigate(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavList = (isMobile: boolean = false) => (
    <div className={`space-y-0.5 font-sans ${isMobile ? 'p-2.5 text-xs' : 'p-1 text-[11px]'}`}>
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-1.5 px-2.5 transition-all text-left ${
              isMobile ? 'py-2 min-h-[38px]' : 'py-1.5'
            } ${
              isActive
                ? 'bg-blue-50 font-medium text-blue-700 border-l-2 border-blue-600 rounded-r-lg'
                : 'hover:bg-slate-100 text-slate-700 active:bg-slate-200 rounded-lg'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[17px] ${
                isActive ? 'text-blue-600' : item.iconColor || 'text-slate-500'
              }`}
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderRegistryPanel = (isMobile: boolean = false) => (
    <div className={`border-t border-gray-200/80 ${isMobile ? 'p-3' : 'px-3 py-2'}`}>
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Active Term" />
          <span className="text-slate-600 font-medium truncate">{profile.currentSession}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">
          {registryPercent}% CFU
        </span>
      </div>

      {isMobile && onSignOut && (
        <div className="pt-2 border-t border-gray-200/80 mt-2">
          <button
            onClick={() => {
              if (onCloseMobile) onCloseMobile();
              onSignOut();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 text-xs font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            <span>Sign Out Session</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col justify-between flex-shrink-0 select-none shadow-xs">
        <div className="flex flex-col">
          {/* Workspace Explorer Header */}
          <div className="bg-slate-50/80 px-2.5 py-1.5 border-b border-gray-200 font-semibold text-[11px] text-slate-700 flex items-center justify-between">
            <span>Workspace Explorer</span>
            <span className="material-symbols-outlined text-[13px] text-slate-400">folder_open</span>
          </div>

          {/* Navigation Items */}
          {renderNavList(false)}
        </div>

        {/* Current Registry Panel at bottom */}
        {renderRegistryPanel(false)}
      </aside>

      {/* Mobile Drawer (Visible when mobileOpen is true on small screens) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col justify-between shadow-2xl z-10 animate-slide-right select-none">
            <div className="flex flex-col">
              {/* Header with App Logo & Close Button */}
              <div className="p-3.5 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[17px]">school</span>
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 block leading-tight">UniSphere</span>
                    <span className="text-[10px] text-slate-500 font-sans block">{profile.name}</span>
                  </div>
                </div>
                <button
                  onClick={onCloseMobile}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 active:bg-slate-300 transition-colors"
                  aria-label="Close menu"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Navigation Items */}
              {renderNavList(true)}
            </div>

            {/* Registry Info on bottom of mobile drawer */}
            {renderRegistryPanel(true)}
          </div>
        </div>
      )}
    </>
  );
};
