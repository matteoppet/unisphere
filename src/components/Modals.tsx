import React, { useState } from 'react';
import { Course, StudyLog } from '../types';

/* --- 1. COURSE DETAIL MODAL --- */
interface CourseDetailModalProps {
  course: Course;
  onClose: () => void;
  onSave: (updated: Course) => void;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  course,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Course>({ ...course });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col text-[11px] overflow-hidden animate-fadeIn">
        {/* Title Bar */}
        <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">
              menu_book
            </span>
            <span className="text-xs font-semibold truncate">{formData.title}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs sm:text-sm font-medium text-gray-700">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Instructor
              </label>
              <input
                type="text"
                value={formData.instructor}
                onChange={(e) =>
                  setFormData({ ...formData, instructor: e.target.value })
                }
                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                CFU (Credits)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={formData.cfu}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cfu: parseInt(e.target.value) || 6,
                  })
                }
                className="w-full p-2 border border-gray-200 rounded-lg bg-white font-mono focus:outline-none focus:border-blue-500 text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as Course['status'],
                  })
                }
                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value="active">Active (Enrolled)</option>
                <option value="completed">Completed (Passed)</option>
                <option value="planned">Planned (Upcoming)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Estimated / Final Grade (/30)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="18"
                  max="30"
                  value={formData.estGrade}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estGrade: parseInt(e.target.value) || 28,
                      finalGrade: parseInt(e.target.value) || 28,
                    })
                  }
                  className="w-full p-2 border border-gray-200 rounded-lg bg-white font-mono focus:outline-none focus:border-blue-500 text-xs tabular-nums"
                />
                <label className="flex items-center gap-1 text-[11px] whitespace-nowrap text-gray-700 font-medium">
                  <input
                    type="checkbox"
                    checked={formData.isLaude || false}
                    onChange={(e) =>
                      setFormData({ ...formData, isLaude: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <span>Lode</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Syllabus Progress ({formData.progress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    progress: parseInt(e.target.value),
                  })
                }
                className="w-full mt-2"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-neutral-700 uppercase block mb-1">
              Office Hours &amp; Location
            </label>
            <input
              type="text"
              value={formData.officeHours || ''}
              onChange={(e) =>
                setFormData({ ...formData, officeHours: e.target.value })
              }
              placeholder="e.g. Tuesdays 14:00 - 15:30 (Room 204 / Zoom)"
              className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-neutral-700 uppercase block mb-1">
              Syllabus Study Notes &amp; Exam Requirements
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full p-2 border border-gray-200 rounded-lg bg-white resize-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <a
              href={`mailto:${formData.email}`}
              className="win-button px-3 py-1 text-blue-700 flex items-center gap-1.5 font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">mail</span>
              <span>Contact Professor</span>
            </a>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="win-button px-3 py-1 text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="win-button px-3.5 py-1 font-bold text-blue-900"
              >
                Save Record
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* --- 2. NEW COURSE MODAL --- */
interface NewCourseModalProps {
  onClose: () => void;
  onAdd: (course: Course) => void;
}

export const NewCourseModal: React.FC<NewCourseModalProps> = ({
  onClose,
  onAdd,
}) => {
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [cfu, setCfu] = useState(6);
  const [year, setYear] = useState(2);
  const [semester, setSemester] = useState<1 | 2>(1);
  const [status, setStatus] = useState<Course['status']>('active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    onAdd({
      id: `course-${Date.now()}`,
      title,
      shortTitle: title.split(' ')[0] || title,
      code: '',
      instructor: '',
      email: email || 'faculty@uni.edu',
      cfu: Number(cfu),
      year: Number(year),
      semester,
      status,
      estGrade: 28,
      progress: status === 'completed' ? 100 : 30,
      color: '#2563eb',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col text-[11px] overflow-hidden animate-fadeIn">
        <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-600">
              library_add
            </span>
            <span className="text-xs">Add Course to Curriculum</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs sm:text-sm font-medium text-gray-700">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Computer Graphics & WebGL"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-1 flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                CFU (ECTS)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={cfu}
                onChange={(e) => setCfu(parseInt(e.target.value) || 6)}
                className="w-full p-2 border border-gray-200 rounded-lg bg-white font-mono focus:outline-none focus:border-blue-500 text-xs tabular-nums text-center sm:text-left"
              />
            </div>
            <div className="sm:col-span-3 flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Contact Email
              </label>
              <input
                type="email"
                placeholder="name@uni.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value={1}>Year 1</option>
                <option value={2}>Year 2</option>
                <option value={3}>Year 3</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(parseInt(e.target.value) as 1 | 2)}
                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Course['status'])}
                className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="planned">Planned</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="win-button px-3 py-1.5 text-xs text-neutral-700 hover:text-neutral-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              Add to Study Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* --- 3. EMAIL GROUP MODAL --- */
interface EmailGroupModalProps {
  courses: Course[];
  onClose: () => void;
}

export const EmailGroupModal: React.FC<EmailGroupModalProps> = ({
  courses,
  onClose,
}) => {
  const activeCourses = courses.filter((c) => c.status === 'active');
  const recipientList = activeCourses.map((c) => c.email).join(', ');
  const [subject, setSubject] = useState(
    '[Academic Inquiry] B.Sc. Computer Science & Engineering - Elena Rossi'
  );
  const [body, setBody] = useState(
    'Dear Professors,\n\nI am contacting you regarding academic term updates, exam registration protocols, and syllabus deliverables for the ongoing semester.\n\nBest regards,\nElena Rossi (Matricola #49281)'
  );
  const [copied, setCopied] = useState(false);

  const handleCopyRecipients = () => {
    navigator.clipboard.writeText(recipientList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoLink = `mailto:${recipientList}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col text-[11px] overflow-hidden animate-fadeIn">
        <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-600">
              forward_to_inbox
            </span>
            <span className="text-xs">Compose Group Mail</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-semibold text-neutral-700 uppercase">
                Recipients ({activeCourses.length} Professors)
              </label>
              <button
                onClick={handleCopyRecipients}
                className="text-blue-700 hover:underline text-[10px] cursor-pointer"
              >
                {copied ? '✓ Copied Emails' : 'Copy All Addresses'}
              </button>
            </div>
            <div className="p-2 border border-gray-200 rounded-lg bg-slate-50 font-mono text-[10px] text-neutral-800 break-all">
              {recipientList}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-neutral-700 uppercase block mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-neutral-700 uppercase block mb-1">
              Message Body
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg bg-white font-sans resize-none focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <span className="text-[10px] text-neutral-500 font-mono">
              University Domain: @uni.edu
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="win-button px-3 py-1 text-neutral-700"
              >
                Close
              </button>
              <a
                href={mailtoLink}
                className="win-button px-3.5 py-1 font-bold text-blue-900 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">send</span>
                <span>Open Mail Client</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- 4. COLUMNS CUSTOMIZER MODAL --- */
interface ColumnsModalProps {
  onClose: () => void;
}

export const ColumnsModal: React.FC<ColumnsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm text-[11px] overflow-hidden animate-fadeIn">
        <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-600">
              view_column
            </span>
            <span className="text-xs">Table Column Customizer</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-neutral-700 font-medium">
            Visible Columns in Active Courses Data Grid:
          </div>

          <div className="space-y-2 border border-gray-200 p-2.5 rounded-lg bg-slate-50/50 shadow-2xs">
            {[
              'Course Title & Instructor',
              'CFU (Credits)',
              'Incoming',
              'Actions (View Course)',
            ].map((col) => (
              <label
                key={col}
                className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:text-slate-900"
              >
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-0" />
                <span>{col}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-1 pt-3 border-t border-gray-100">
            <button onClick={onClose} className="win-button px-3.5 py-1 font-bold text-blue-900">
              Apply Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- 6. EXPORT MODAL --- */
interface ExportModalProps {
  studyLogs: StudyLog[];
  courses: Course[];
  onClose: () => void;
  onExportJson: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  studyLogs,
  courses,
  onClose,
  onExportJson,
}) => {
  const downloadCsvLogs = () => {
    const headers = ['Date', 'TimeRange', 'Course', 'DurationMinutes', 'Rating', 'Tag', 'Notes'];
    const rows = studyLogs.map((l) => [
      `"${l.date}"`,
      `"${l.timeRange}"`,
      `"${l.courseName.replace(/"/g, '""')}"`,
      l.durationMinutes,
      l.rating,
      `"${l.tag}"`,
      `"${l.notes.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alma-study-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsvCourses = () => {
    const headers = ['Title', 'Instructor', 'Email', 'CFU', 'Year', 'Semester', 'Status', 'Grade', 'Progress'];
    const rows = courses.map((c) => [
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.instructor.replace(/"/g, '""')}"`,
      `"${c.email}"`,
      c.cfu,
      c.year,
      c.semester,
      `"${c.status}"`,
      c.finalGrade || c.estGrade,
      c.progress,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alma-curriculum-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col text-[11px] overflow-hidden animate-fadeIn">
        <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-600">
              download_for_offline
            </span>
            <span className="text-xs">Export Academic Telemetry &amp; Audits</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="p-3 border border-gray-200 rounded-lg bg-slate-50/50 flex items-center justify-between shadow-2xs">
            <div>
              <div className="font-bold text-neutral-900">
                Study Activity Audit Trail (CSV)
              </div>
              <div className="text-[10px] text-neutral-500 leading-relaxed">
                Contains {studyLogs.length} verified sessions, ratings, and timestamps.
              </div>
            </div>
            <button
              onClick={downloadCsvLogs}
              className="win-button px-3 py-1 font-semibold"
            >
              Export CSV
            </button>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg bg-slate-50/50 flex items-center justify-between shadow-2xs">
            <div>
              <div className="font-bold text-neutral-900">
                Curriculum Study Plan (CSV)
              </div>
              <div className="text-[10px] text-neutral-500 leading-relaxed">
                Contains {courses.length} courses, CFU weights, and grades.
              </div>
            </div>
            <button
              onClick={downloadCsvCourses}
              className="win-button px-3 py-1 font-semibold"
            >
              Export CSV
            </button>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg bg-slate-50/50 flex items-center justify-between shadow-2xs">
            <div>
              <div className="font-bold text-neutral-900">
                Full Workstation Snapshot (JSON)
              </div>
              <div className="text-[10px] text-neutral-500 leading-relaxed">
                Complete database backup for import or migration.
              </div>
            </div>
            <button
              onClick={onExportJson}
              className="win-button px-3 py-1 font-semibold text-blue-900"
            >
              Export JSON
            </button>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button onClick={onClose} className="win-button px-3.5 py-1 text-neutral-700">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- 7. ABOUT MODAL --- */
export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm text-[11px] overflow-hidden animate-fadeIn">
        <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-600">
              info
            </span>
            <span className="text-xs">About UniSphere</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 text-neutral-800">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              UNI
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">UniSphere Workstation</div>
              <div className="text-neutral-500 font-mono text-[10px]">
                Version 2.4.0 (Build 49281)
              </div>
            </div>
          </div>

          <p className="text-[11px] text-neutral-600 leading-relaxed">
            Enterprise academic workstation and degree organizer designed for university students, researchers, and degree candidates. Features real-time CFU telemetry and curriculum audit.
          </p>

          <div className="p-2.5 bg-slate-50 border border-gray-200 rounded-lg font-mono text-[10px] space-y-1 text-slate-700 shadow-2xs">
            <div>Degree: B.Sc. Computer Science &amp; Engineering</div>
            <div>Regulation: Laurea Triennale (DM 270/04)</div>
            <div>Target: 180 CFU • Passing Grade: 18/30</div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button onClick={onClose} className="win-button px-4 py-1 font-bold text-blue-900">
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
