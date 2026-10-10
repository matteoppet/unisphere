import React, { useState } from 'react';
import { StudentProfile } from '../types';

interface SettingsViewProps {
  profile: StudentProfile;
  onUpdateProfile: (profile: StudentProfile) => void;
  onResetData: () => void;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
  onSignOut?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  onResetData,
  onExportJson,
  onImportJson,
  onSignOut,
}) => {
  const [formData, setFormData] = useState<StudentProfile>(profile);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
    <div className="flex-1 bg-gray-50 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5 select-none">
      <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Widget Header with title inside */}
        <div className="bg-slate-50/80 border-b border-gray-200 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800">
            <span className="material-symbols-outlined text-[15px] text-neutral-700">
              settings
            </span>
            <span>Settings</span>
          </div>
        </div>

        <div className="p-3 text-xs">
          <form onSubmit={handleSubmit} className="space-y-3 text-[11px]">
            {savedSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg font-semibold text-[11px] flex items-center gap-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-[15px] text-emerald-600">
                  check_circle
                </span>
                <span>Settings and registry parameters saved successfully.</span>
              </div>
            )}

          {/* Student Identity */}
          <div className="border border-gray-200 p-3 rounded-lg bg-slate-50/40 space-y-2.5">
            <div className="font-bold text-neutral-900 border-b border-gray-200 pb-1.5">
              Student Credentials
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
                  Educational Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white font-mono focus:outline-none focus:border-blue-500"
                  placeholder="student@institution.edu"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
                  Student ID (Matricola)
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) =>
                    setFormData({ ...formData, studentId: e.target.value })
                  }
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
                  Degree Program Title
                </label>
                <input
                  type="text"
                  value={formData.degreeName}
                  onChange={(e) =>
                    setFormData({ ...formData, degreeName: e.target.value })
                  }
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
                  Degree Track
                </label>
                <select
                  value={formData.degreeType}
                  onChange={(e) =>
                    setFormData({ ...formData, degreeType: e.target.value })
                  }
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Laurea Triennale">Laurea Triennale (180 CFU)</option>
                  <option value="Laurea Magistrale">Laurea Magistrale (120 CFU)</option>
                  <option value="Master of Science">Master of Science (120 ECTS)</option>
                  <option value="Cycle Unico">Ciclo Unico (300 CFU)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
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
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
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
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-neutral-700 uppercase block">
                  Current Session
                </label>
                <input
                  type="text"
                  value={formData.currentSession}
                  onChange={(e) =>
                    setFormData({ ...formData, currentSession: e.target.value })
                  }
                  className="w-full text-[11px] p-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-1 pt-1">
            <button
              type="submit"
              className="win-button px-4 py-1.5 font-bold text-blue-900 text-[11px] flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">save</span>
              <span>Save System Settings</span>
            </button>
          </div>
        </form>
        </div>
      </div>

      {/* Data Backup & Disaster Recovery */}
      <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Widget Header with title inside */}
        <div className="bg-slate-50/80 border-b border-gray-200 px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-neutral-800">
            <span className="material-symbols-outlined text-[15px] text-blue-600">
              database
            </span>
            <span>Data Settings</span>
          </div>
        </div>

        <div className="p-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
            <div className="p-3 border border-gray-200 rounded-lg bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="font-bold text-neutral-900">Export State Backup</div>
                <div className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">
                  Download a JSON snapshot containing all courses, audit records, and schedule blocks.
                </div>
              </div>
              <button
                onClick={onExportJson}
                className="win-button mt-2.5 py-1 px-2.5 text-[11px] font-semibold"
              >
                Export JSON Backup
              </button>
            </div>

            <div className="p-3 border border-gray-200 rounded-lg bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="font-bold text-neutral-900">Restore Snapshot</div>
                <div className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">
                  Upload a previously saved UniSphere JSON snapshot to replace current workstation state.
                </div>
              </div>
              <label className="win-button mt-2.5 py-1 px-2.5 text-[11px] font-semibold text-center cursor-pointer block">
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
              <div className="p-3 border border-red-200 rounded-lg bg-red-50/40 flex flex-col justify-between md:col-span-2">
                <div>
                  <div className="font-bold text-red-900 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">logout</span>
                    <span>Sign Out Workstation</span>
                  </div>
                  <div className="text-[10px] text-neutral-600 mt-0.5 leading-relaxed">
                    Exit current student session and return to the Login / Registration gateway.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="win-button mt-2.5 py-1 px-2.5 text-[11px] text-red-700 font-semibold hover:bg-red-100 cursor-pointer self-start"
                >
                  Sign Out / Switch Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
