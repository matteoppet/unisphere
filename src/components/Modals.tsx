import React, { useState } from 'react';
import { Course, StudyLog, AssignmentItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from './ui/dialog';

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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col text-[11px] overflow-hidden">
        {/* Title Bar */}
        <DialogHeader>
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600 shrink-0">
              menu_book
            </span>
            <DialogTitle>{formData.title}</DialogTitle>
            <StatusBadge status={formData.status} size="sm" />
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs sm:text-sm font-medium text-gray-700">
              Course Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Contact Email
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                CFU (Credits)
              </label>
              <Input
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
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Appealing Interactive Status Picker */}
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50/70 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-slate-600 dark:text-zinc-400">
                  flag
                </span>
                <span>Course Standing &amp; Status</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Tap to change status
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* 1. Active */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'active' })}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  formData.status === 'active'
                    ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-500 dark:border-blue-600 text-blue-900 dark:text-blue-200 shadow-sm ring-1 ring-blue-500 font-bold'
                    : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    formData.status === 'active'
                      ? 'bg-blue-600 dark:bg-blue-400 ring-2 ring-blue-400/40'
                      : 'bg-gray-300 dark:bg-zinc-600'
                  }`}
                />
                <span className="text-xs font-bold">Active</span>
              </button>

              {/* 2. Passed (Completed) */}
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    status: 'completed',
                    progress: formData.progress < 100 ? 100 : formData.progress,
                  })
                }
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  formData.status === 'completed'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500 font-bold'
                    : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    formData.status === 'completed'
                      ? 'bg-emerald-600 dark:bg-emerald-400 ring-2 ring-emerald-400/40'
                      : 'bg-gray-300 dark:bg-zinc-600'
                  }`}
                />
                <span className="text-xs font-bold">Passed</span>
              </button>

              {/* 3. Planned */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'planned' })}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  formData.status === 'planned'
                    ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-500 dark:border-amber-600 text-amber-900 dark:text-amber-200 shadow-sm ring-1 ring-amber-500 font-bold'
                    : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    formData.status === 'planned'
                      ? 'bg-amber-600 dark:bg-amber-400 ring-2 ring-amber-400/40'
                      : 'bg-gray-300 dark:bg-zinc-600'
                  }`}
                />
                <span className="text-xs font-bold">Planned</span>
              </button>
            </div>
          </div>

          {/* Syllabus Progress */}
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50/70 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">
                  trending_up
                </span>
                <span>Syllabus Completion</span>
              </label>
              <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded">
                {formData.progress}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={formData.progress}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  progress: parseInt(e.target.value) || 0,
                })
              }
              className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-1"
            />

            <div className="flex items-center justify-between gap-1 pt-1">
              {[0, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setFormData({ ...formData, progress: pct })}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-mono transition-colors cursor-pointer ${
                    formData.progress === pct
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 uppercase block mb-1">
              Office Hours &amp; Location
            </label>
            <Input
              type="text"
              value={formData.officeHours || ''}
              onChange={(e) =>
                setFormData({ ...formData, officeHours: e.target.value })
              }
              placeholder="Office hours schedule and room / Zoom details"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 uppercase block mb-1">
              Syllabus Study Notes &amp; Exam Requirements
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 dark:text-zinc-100 resize-none focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-zinc-800 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`mailto:${formData.email}`}
                className="text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 font-medium"
              >
                <span className="material-symbols-outlined text-[14px]">mail</span>
                <span>Contact Professor</span>
              </a>
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
              >
                Save Record
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
      email: email || 'faculty@uni.edu',
      cfu: Number(cfu),
      year: Number(year),
      semester,
      status,
      progress: status === 'completed' ? 100 : 30,
      color: '#2563eb',
    });
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col text-[11px] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600">
              library_add
            </span>
            <DialogTitle>Add Course to Curriculum</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs sm:text-sm font-medium text-gray-700">
              Course Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems & Algorithms"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Professor / Contact Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="faculty@unibo.it"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                CFU (Credits)
              </label>
              <Input
                type="number"
                min="1"
                max="24"
                value={cfu}
                onChange={(e) => setCfu(parseInt(e.target.value) || 6)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 text-xs"
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
                className="w-full p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50/70 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
            <label className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center justify-between">
              <span>Initial Status</span>
              <span className="text-[10px] text-slate-500">Select course standing</span>
            </label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  status === 'active'
                    ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-500 dark:border-blue-600 text-blue-900 dark:text-blue-200 shadow-sm ring-1 ring-blue-500 font-bold'
                    : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    status === 'active'
                      ? 'bg-blue-600 dark:bg-blue-400 ring-2 ring-blue-400/40'
                      : 'bg-gray-300 dark:bg-zinc-600'
                  }`}
                />
                <span className="text-xs font-bold">Active</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  status === 'completed'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500 font-bold'
                    : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    status === 'completed'
                      ? 'bg-emerald-600 dark:bg-emerald-400 ring-2 ring-emerald-400/40'
                      : 'bg-gray-300 dark:bg-zinc-600'
                  }`}
                />
                <span className="text-xs font-bold">Passed</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('planned')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  status === 'planned'
                    ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-500 dark:border-amber-600 text-amber-900 dark:text-amber-200 shadow-sm ring-1 ring-amber-500 font-bold'
                    : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                    status === 'planned'
                      ? 'bg-amber-600 dark:bg-amber-400 ring-2 ring-amber-400/40'
                      : 'bg-gray-300 dark:bg-zinc-600'
                  }`}
                />
                <span className="text-xs font-bold">Planned</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
            >
              Add to Study Plan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* --- 3. COMPOSE GROUP EMAIL MODAL --- */
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
    '[UniSphere Academic Notice] Question regarding curriculum schedule'
  );
  const [body, setBody] = useState(
    'Dear Professors,\n\nI am contacting you regarding academic term updates and syllabus deliverables for the ongoing semester.\n\nBest regards,'
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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col text-[11px] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600">
              forward_to_inbox
            </span>
            <DialogTitle>Compose Group Mail</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                Recipients ({activeCourses.length} Professors)
              </label>
              <button
                onClick={handleCopyRecipients}
                className="text-indigo-600 hover:underline text-[10px] cursor-pointer"
              >
                {copied ? '✓ Copied Emails' : 'Copy All Addresses'}
              </button>
            </div>
            <div className="p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-950/70 font-mono text-[10px] text-zinc-800 dark:text-zinc-200 dark:text-zinc-200 break-all">
              {recipientList}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block mb-1">
              Subject
            </label>
            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase block mb-1">
              Message Body
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 dark:text-zinc-100 placeholder:text-zinc-400 dark:text-zinc-500 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 font-sans text-xs"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyRecipients}
            >
              {copied ? 'Copied' : 'Copy Emails'}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                asChild
              >
                <a
                  href={mailtoLink}
                  className="inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  <span>Open Email Client</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* --- 4. COLUMNS CUSTOMIZER MODAL --- */
interface ColumnsModalProps {
  onClose: () => void;
}

export const ColumnsModal: React.FC<ColumnsModalProps> = ({ onClose }) => {
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm text-[11px] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600">
              view_column
            </span>
            <DialogTitle>Table Column Customizer</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="p-4 space-y-3">
          <div className="text-zinc-700 dark:text-zinc-300 font-medium">
            Visible Columns in Active Courses Data Grid:
          </div>

          <div className="space-y-2 border border-gray-200 dark:border-zinc-800 p-2.5 rounded-lg bg-slate-50/50 dark:bg-zinc-950/50 shadow-2xs">
            {[
              'Course Title',
              'CFU (Credits)',
              'Status',
              'Incoming',
              'Actions (View Course)',
            ].map((col) => (
              <label
                key={col}
                className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 dark:text-zinc-300 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-zinc-100"
              >
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-indigo-600 focus:ring-0" />
                <span>{col}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-1 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <Button size="sm" onClick={onClose}>
              Apply Layout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* --- 5. EXPORT MODAL --- */
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
    const headers = ['Title', 'Email', 'CFU', 'Year', 'Semester', 'Status', 'Progress'];
    const rows = courses.map((c) => [
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.email}"`,
      c.cfu,
      c.year,
      c.semester,
      `"${c.status}"`,
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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col text-[11px] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-600">
              download_for_offline
            </span>
            <DialogTitle>Export Academic Telemetry &amp; Audits</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="p-3 border border-gray-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-950/50 flex items-center justify-between shadow-2xs">
            <div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 dark:text-zinc-100">
                Study Activity Audit Trail (CSV)
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 leading-relaxed">
                Contains {studyLogs.length} verified sessions, ratings, and timestamps.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCsvLogs}
            >
              Export CSV
            </Button>
          </div>

          <div className="p-3 border border-gray-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-950/50 flex items-center justify-between shadow-2xs">
            <div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 dark:text-zinc-100">
                Curriculum Study Plan (CSV)
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 leading-relaxed">
                Contains {courses.length} courses and CFU weights.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCsvCourses}
            >
              Export CSV
            </Button>
          </div>

          <div className="p-3 border border-gray-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-950/50 flex items-center justify-between shadow-2xs">
            <div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 dark:text-zinc-100">
                Full Workstation Snapshot (JSON)
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 leading-relaxed">
                Complete database backup for import or migration.
              </div>
            </div>
            <Button
              size="sm"
              onClick={onExportJson}
            >
              Export JSON
            </Button>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-zinc-800">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* --- 6. ABOUT MODAL --- */
export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm text-[11px] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600">
              info
            </span>
            <DialogTitle>About UniSphere</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="p-4 space-y-3 text-zinc-800 dark:text-zinc-200">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-zinc-800 pb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              UNI
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">UniSphere Workstation</div>
              <div className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">
                Version 2.4.0
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Academic workstation and degree organizer designed for university students, researchers, and degree candidates. Features real-time CFU telemetry and curriculum audit.
          </p>

          <div className="p-2.5 bg-slate-50 border border-gray-200 rounded-lg font-mono text-[10px] space-y-1 text-slate-700 shadow-2xs">
            <div>Degree: B.Sc. Computer Science &amp; Engineering</div>
            <div>Regulation: Laurea Triennale (DM 270/04)</div>
            <div>Target: 180 CFU</div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-zinc-800">
            <Button size="sm" onClick={onClose}>
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* --- 7. QUICK NEW TASK / ASSIGNMENT MODAL --- */
interface NewAssignmentModalProps {
  courses: Course[];
  onClose: () => void;
  onAdd: (asg: Omit<AssignmentItem, 'id'>) => void;
}

export const NewAssignmentModal: React.FC<NewAssignmentModalProps> = ({
  courses,
  onClose,
  onAdd,
}) => {
  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState(
    courses.find((c) => c.status === 'active')?.title || courses[0]?.title || 'General'
  );
  const [type, setType] = useState<AssignmentItem['type']>('Assignment');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      courseName,
      type,
      dueDate,
      status: 'todo',
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col text-xs overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">
              add_task
            </span>
            <DialogTitle>Quick Add Task / Exam</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              autoFocus
              placeholder="e.g. Midterm prep, Problem Set 3, Essay outline"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                Course
              </label>
              <select
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                {courses.length > 0 ? (
                  courses.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.title}
                    </option>
                  ))
                ) : (
                  <option value="General">General</option>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AssignmentItem['type'])}
                className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="Assignment">Assignment</option>
                <option value="Midterm">Midterm</option>
                <option value="Exam">Exam</option>
                <option value="Oral">Oral Exam</option>
                <option value="Project">Project</option>
                <option value="Lab Report">Lab Report</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Chapters, requirements, submission portal..."
              className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 resize-none font-sans"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Add Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* --- 8. QUICK STUDY LOG MODAL --- */
interface NewStudyLogModalProps {
  courses: Course[];
  onClose: () => void;
  onAdd: (log: Omit<StudyLog, 'id' | 'timestamp'>) => void;
}

export const NewStudyLogModal: React.FC<NewStudyLogModalProps> = ({
  courses,
  onClose,
  onAdd,
}) => {
  const [courseName, setCourseName] = useState(
    courses.find((c) => c.status === 'active')?.title || courses[0]?.title || 'General'
  );
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [tag, setTag] = useState<StudyLog['tag']>('Deep Work');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = courses.find((c) => c.title === courseName || c.shortTitle === courseName);
    const todayStr = new Date().toISOString().split('T')[0];
    const prefix = date === todayStr ? 'Today' : date;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    onAdd({
      courseName: matched ? matched.shortTitle : courseName,
      courseId: matched?.id,
      durationMinutes: Number(durationMinutes),
      date,
      timeRange: `${prefix} ${nowTime}`,
      notes: notes.trim() || 'Study session & syllabus review',
      rating: 5,
      tag,
    });
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col text-xs overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">
              history_edu
            </span>
            <DialogTitle>Quick Log Study Session</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              Course
            </label>
            <select
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            >
              {courses.length > 0 ? (
                courses.map((c) => (
                  <option key={c.id} value={c.title}>
                    {c.title}
                  </option>
                ))
              ) : (
                <option value="General">General</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                Date
              </label>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                Focus Tag
              </label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as StudyLog['tag'])}
                className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="Deep Work">Deep Work</option>
                <option value="Problem Solving">Problem Solving</option>
                <option value="Review">Review</option>
                <option value="Lab Work">Lab Work</option>
                <option value="Exam Prep">Exam Prep</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                Duration (minutes)
              </label>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {durationMinutes} min ({Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m)
              </span>
            </div>
            <Input
              type="number"
              min={5}
              max={720}
              step={5}
              required
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
            {/* Quick Presets */}
            <div className="flex gap-1.5 mt-1.5">
              {[30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    durationMinutes === mins
                      ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              Topics / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Chapters covered, practice exercises, key takeaways..."
              className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 resize-none font-sans"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Record Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
