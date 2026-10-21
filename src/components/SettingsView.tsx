import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../types';
import { Button } from './ui/button';
import { isAudioMuted, toggleAudioMuted, playMechanicalClick, playFuturisticChime } from '../utils/audio';
import { Volume2, VolumeX, Sparkles, Flame } from 'lucide-react';

interface SettingsViewProps {
  profile: StudentProfile;
  onUpdateProfile: (profile: StudentProfile) => void;
  onResetData: () => void;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
  onSignOut?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  onResetData: _onResetData,
  onExportJson,
  onImportJson,
  onSignOut,
  isDark = true,
  onToggleTheme,
}) => {
  const [formData, setFormData] = useState<StudentProfile>(profile);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [audioMuted, setAudioMutedState] = useState(() => isAudioMuted());

  useEffect(() => {
    const handleAudioSync = () => {
      setAudioMutedState(isAudioMuted());
    };
    window.addEventListener('unisphere-audio-toggle', handleAudioSync);
    return () => window.removeEventListener('unisphere-audio-toggle', handleAudioSync);
  }, []);

  const handleToggleAudio = () => {
    const next = toggleAudioMuted();
    setAudioMutedState(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        onImportJson(text);
        alert('Workstation database restored successfully!');
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5 select-none transition-colors">
      {/* 1. Theme & Appearance Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md shadow-xs overflow-hidden flex flex-col transition-all">
        <div className="bg-zinc-50/80 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-zinc-900 dark:text-zinc-100 group">
            <span className="material-symbols-outlined text-[15px] text-amber-500 dark:text-amber-400 transition-transform duration-300 group-hover:rotate-12">
              dark_mode
            </span>
            <span>Theme &amp; Appearance</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            ObsidianUI System
          </span>
        </div>

        <div className="p-3 text-xs space-y-3">
          {/* Theme Mode Toggle (Dark / Light) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 transition-colors">
            <div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 group">
                <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  {isDark ? 'dark_mode' : 'light_mode'}
                </span>
                <span>Active Theme: {isDark ? 'Dark Theme (Obsidian)' : 'Light Theme'}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Toggle between pure Obsidian dark workstation mode and clean daylight paper mode.
              </p>
            </div>

            {onToggleTheme && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  onClick={onToggleTheme}
                  variant={isDark ? 'outline' : 'default'}
                  className="gap-2 group transition-all duration-200 active:scale-[0.98] shadow-xs cursor-pointer font-semibold"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-500 dark:text-amber-400 transition-transform duration-300 group-hover:rotate-45">
                    {isDark ? 'light_mode' : 'dark_mode'}
                  </span>
                  <span>Switch to {isDark ? 'Light Theme' : 'Dark Theme'}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Sensory Audio & Academic Telemetry Card */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-md shadow-xs overflow-hidden flex flex-col transition-all">
        <div className="bg-zinc-50/80 dark:bg-black/90 border-b border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-zinc-900 dark:text-zinc-100 group">
            <Sparkles size={14} className="text-[#3B77BC] dark:text-[#689FE1]" />
            <span>Sensory Audio &amp; Study Telemetry</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>{profile.currentStreak || 0}d Streak</span>
            <span>•</span>
            <span>{Math.round((profile.minutesStudiedThisWeek || 0) / 60)}h Studied</span>
          </div>
        </div>

        <div className="p-3 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-black transition-colors">
            <div className="space-y-0.5">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                {audioMuted ? <VolumeX size={15} className="text-zinc-400" /> : <Volume2 size={15} className="text-[#3B77BC] dark:text-[#689FE1]" />}
                <span>Tactile Audio Micro-Interactions: {audioMuted ? 'Muted' : 'Active'}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Crisp mechanical click on task completions and sleek futuristic chime when study timer finishes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  playMechanicalClick();
                  setTimeout(() => playFuturisticChime(), 200);
                }}
                variant="outline"
                size="sm"
                className="text-xs h-8"
              >
                Test Sound
              </Button>
              <Button
                type="button"
                onClick={handleToggleAudio}
                variant={audioMuted ? 'default' : 'outline'}
                size="sm"
                className={`text-xs h-8 ${audioMuted ? 'bg-[#3B77BC] hover:bg-[#2B5D99] text-white font-semibold' : ''}`}
              >
                {audioMuted ? 'Enable Audio' : 'Mute Audio'}
              </Button>
            </div>
          </div>

          {/* Telemetry Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-md bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Degree CFU Target</div>
              <div className="font-mono font-bold text-sm text-[#3B77BC] dark:text-[#689FE1]">{profile.totalTargetCFU || 180} CFU</div>
            </div>
            <div className="p-2 rounded-md bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Weekly Goal</div>
              <div className="font-mono font-bold text-sm text-amber-500">{profile.weeklyGoalHours || 25} Hours</div>
            </div>
            <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Active Streak</div>
              <div className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">{profile.currentStreak || 0} Days</div>
            </div>
            <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Weekly Study</div>
              <div className="font-mono font-bold text-sm text-emerald-500">{Math.round((profile.minutesStudiedThisWeek || 0) / 60)} Hours</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Student Identity & Degree Settings */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md shadow-xs overflow-hidden flex flex-col transition-all">
        {/* Widget Header */}
        <div className="bg-zinc-50/80 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-zinc-900 dark:text-zinc-100 group">
            <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400 transition-transform duration-300 group-hover:rotate-45">
              settings
            </span>
            <span>Settings</span>
          </div>
        </div>

        <div className="p-3 text-xs">
          <form onSubmit={handleSubmit} className="space-y-3 text-[11px]">
            {savedSuccess && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-md font-semibold text-[11px] flex items-center gap-1.5 shadow-2xs animate-fade-in">
                <span className="material-symbols-outlined text-[15px] text-emerald-600 dark:text-emerald-400 transition-transform duration-200 scale-110">
                  check_circle
                </span>
                <span>Settings and registry parameters saved successfully.</span>
              </div>
            )}

            {/* Student Identity */}
            <div className="border border-zinc-200 dark:border-zinc-800 p-3 rounded-md bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2.5">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1.5">
                Student Credentials
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full text-[11px] p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block">
                    Educational Email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full text-[11px] p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    placeholder="student@institution.edu"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block">
                    Student ID (Matricola)
                  </label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) =>
                      setFormData({ ...formData, studentId: e.target.value })
                    }
                    className="w-full text-[11px] p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block">
                    Degree Program Title
                  </label>
                  <input
                    type="text"
                    value={formData.degreeName}
                    onChange={(e) =>
                      setFormData({ ...formData, degreeName: e.target.value })
                    }
                    className="w-full text-[11px] p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block">
                    Degree Track
                  </label>
                  <select
                    value={formData.degreeType}
                    onChange={(e) =>
                      setFormData({ ...formData, degreeType: e.target.value })
                    }
                    className="w-full text-[11px] p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all cursor-pointer"
                  >
                    <option value="Laurea Triennale">Laurea Triennale (180 CFU)</option>
                    <option value="Laurea Magistrale">Laurea Magistrale (120 CFU)</option>
                    <option value="Master of Science">Master of Science (120 ECTS)</option>
                    <option value="Cycle Unico">Ciclo Unico (300 CFU)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block">
                    Target Degree CFU
                  </label>
                  <input
                    type="number"
                    value={formData.totalTargetCFU}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        totalTargetCFU: parseInt(e.target.value) || 180,
                      })
                    }
                    className="w-full text-[11px] p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block">
                    Weekly Goal Focus (Hours)
                  </label>
                  <input
                    type="number"
                    value={formData.weeklyGoalHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weeklyGoalHours: parseInt(e.target.value) || 25,
                      })
                    }
                    className="w-full text-[11px] p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-1 pt-1">
              <Button
                type="submit"
                variant="default"
                size="sm"
                className="gap-1.5 group font-bold transition-all shadow-xs"
              >
                <span className="material-symbols-outlined text-[15px] transition-transform duration-200 group-hover:scale-110">
                  save
                </span>
                <span>Save System Settings</span>
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* 3. Data Backup & Disaster Recovery */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md shadow-xs overflow-hidden flex flex-col transition-all">
        {/* Widget Header with title inside */}
        <div className="bg-zinc-50/80 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-zinc-900 dark:text-zinc-100 group">
            <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400 transition-transform duration-300 group-hover:scale-110">
              database
            </span>
            <span>Data Settings</span>
          </div>
        </div>

        <div className="p-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
            <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col justify-between transition-colors">
              <div>
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Export State Backup</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Download a JSON snapshot containing all courses, audit records, and schedule blocks.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExportJson}
                className="mt-2.5 self-start gap-1.5 group font-semibold shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px] text-amber-500 transition-transform duration-200 group-hover:-translate-y-0.5">
                  download
                </span>
                <span>Export JSON Backup</span>
              </Button>
            </div>

            <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col justify-between transition-colors">
              <div>
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Restore Snapshot</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Upload a previously saved UniSphere JSON snapshot to replace current workstation state.
                </div>
              </div>
              <label className="mt-2.5 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 h-7 px-2.5 py-1 text-[11px] cursor-pointer group transition-all duration-150 active:scale-[0.98] self-start">
                <span className="material-symbols-outlined text-[15px] text-indigo-500 transition-transform duration-200 group-hover:translate-y-0.5">
                  upload_file
                </span>
                <span>Import JSON File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>

            {onSignOut && (
              <div className="p-3 border border-red-200 dark:border-red-900/60 rounded-md bg-red-50/40 dark:bg-red-950/30 flex flex-col justify-between md:col-span-2 transition-colors">
                <div>
                  <div className="font-bold text-red-900 dark:text-red-300 flex items-center gap-1 group">
                    <span className="material-symbols-outlined text-[14px] transition-transform duration-200 group-hover:-translate-x-0.5">
                      logout
                    </span>
                    <span>Sign Out Workstation</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Exit current student session and return to the Login / Registration gateway.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onSignOut}
                  className="mt-2.5 gap-1.5 group self-start shadow-xs font-semibold"
                >
                  <span className="material-symbols-outlined text-[14px] transition-transform duration-200 group-hover:-translate-x-0.5">
                    logout
                  </span>
                  <span>Sign Out / Switch Account</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
