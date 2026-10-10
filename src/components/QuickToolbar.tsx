import React from 'react';
import { StudentProfile } from '../types';

interface QuickToolbarProps {
  profile?: StudentProfile;
  earnedCFU?: number;
  onRefresh: () => void;
  onNewSession: () => void;
  onExport: () => void;
  onSignOut?: () => void;
  onToggleMobileMenu?: () => void;
}

export const QuickToolbar: React.FC<QuickToolbarProps> = ({
  profile,
  earnedCFU,
  onRefresh,
  onNewSession,
  onExport,
  onSignOut,
  onToggleMobileMenu,
}) => {
  return (
    <header className="bg-white border-b border-gray-200 px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 select-none shadow-2xs z-20">
      {/* Left side: Mobile Menu Hamburger & Brand / Desktop Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* Mobile Hamburger Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg active:bg-slate-200 transition-colors flex items-center justify-center"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        )}

        {/* Mobile Brand Mark */}
        <div className="flex md:hidden items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[13px]">school</span>
          </div>
          <span className="font-bold text-xs text-slate-900 truncate">UniSphere</span>
        </div>

        {/* Desktop Quick Actions */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <button
            className="win-toolbar-btn px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-slate-700 font-medium"
            onClick={onRefresh}
            title="Refresh Telemetry & Recalculate Metrics"
          >
            <span className="material-symbols-outlined text-[15px] text-blue-600">
              refresh
            </span>
            <span>Refresh</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-200 mx-0.5" />

          <button
            className="win-toolbar-btn px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-slate-700 font-medium"
            onClick={onNewSession}
            title="Log New Study Session"
          >
            <span className="material-symbols-outlined text-[15px] text-emerald-600">
              note_add
            </span>
            <span>New Session</span>
          </button>

          <button
            className="win-toolbar-btn px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-slate-700 font-medium"
            onClick={onExport}
            title="Export CSV / JSON Report"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-600">
              save
            </span>
            <span>Export Data</span>
          </button>
        </div>
      </div>

      {/* Right side: Mobile Quick Buttons & Desktop User / Sign Out */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Mobile Action Buttons */}
        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={onNewSession}
            className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 shadow-xs active:bg-indigo-700"
            title="Log new study session"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Log</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 active:bg-slate-200"
            title="Refresh telemetry metrics"
          >
            <span className="material-symbols-outlined text-[17px]">refresh</span>
          </button>
        </div>


        {/* Desktop Sign Out Button */}
        {onSignOut && (
          <button
            onClick={onSignOut}
            title="Sign Out / Switch Student Account"
            className="hidden md:flex win-toolbar-btn px-2 py-1 items-center gap-1 text-[11px] text-red-700 hover:bg-red-50 hover:border-red-200"
          >
            <span className="material-symbols-outlined text-[13px]">logout</span>
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </header>
  );
};
