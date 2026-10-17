import React, { useState, useEffect } from 'react';
import { AssignmentItem, Course } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { playMechanicalClick } from '../utils/audio';
import { fireTaskConfetti } from '../utils/confetti';
import { CheckCircle2, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from './ui/dialog';

interface AssignmentsViewProps {
  assignments: AssignmentItem[];
  courses: Course[];
  onAddAssignment: (assignment: Omit<AssignmentItem, 'id'>) => void;
  onUpdateAssignmentStatus: (id: string, status: AssignmentItem['status']) => void;
  onDeleteAssignment: (id: string) => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments,
  courses,
  onAddAssignment,
  onUpdateAssignmentStatus,
  onDeleteAssignment,
}) => {
  const [filterType, setFilterType] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState(courses[0]?.title || '');
  const [newType, setNewType] = useState<AssignmentItem['type']>('Assignment');
  const [newDueDate, setNewDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newNotes, setNewNotes] = useState('');

  // Close modal on Escape key
  useEffect(() => {
    if (!showAddForm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddForm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddForm]);

  const calculateDaysLeft = (dueDateStr: string) => {
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleOpenAddModal = () => {
    if (!newCourse && courses.length > 0) {
      setNewCourse(courses[0].title);
    }
    setShowAddForm(true);
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddAssignment({
      title: newTitle.trim(),
      courseName: newCourse || courses[0]?.title || 'General',
      type: newType,
      dueDate: newDueDate,
      status: 'todo',
      notes: newNotes.trim(),
    });

    setNewTitle('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const filteredAssignments = assignments.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    return true;
  });

  const handleStatusChange = (
    id: string,
    newStatus: AssignmentItem['status'],
    e?: React.MouseEvent
  ) => {
    if (newStatus === 'completed') {
      playMechanicalClick();
      if (e) {
        fireTaskConfetti({ x: e.clientX, y: e.clientY });
      } else {
        fireTaskConfetti();
      }
    }
    onUpdateAssignmentStatus(id, newStatus);
  };

  return (
    <div className="flex-1 bg-gray-50 dark:bg-zinc-950 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5 select-none relative transition-colors">
      {/* Top Banner */}
      <fieldset className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-3 text-xs shadow-sm">
        <legend className="font-semibold text-neutral-800 dark:text-zinc-200 px-2 py-0.5 flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md text-[11px] shadow-2xs">
          <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">
            fact_check
          </span>
          <span>Assignments, Midterms &amp; Exams Registry</span>
        </legend>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-neutral-700 dark:text-zinc-300">Filter By Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-[11px] py-1 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Items</option>
              <option value="Assignment">Assignments Only</option>
              <option value="Midterm">Midterms Only</option>
              <option value="Exam">Exams Only</option>
              <option value="Oral">Oral Exams Only</option>
              <option value="Project">Projects Only</option>
            </select>
          </div>

          <Button
            onClick={handleOpenAddModal}
            variant="compact"
            size="sm"
            className="text-indigo-600 dark:text-indigo-400 font-semibold"
          >
            <span className="material-symbols-outlined text-[13px]">add</span>
            <span>Add Item</span>
          </Button>
        </div>
      </fieldset>

      {/* Centered Modal Dialog for Adding Assignment / Exam */}
      {showAddForm && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setShowAddForm(false); }}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col text-xs overflow-hidden">
            <DialogHeader>
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-400 shrink-0">
                  edit_calendar
                </span>
                <div>
                  <DialogTitle>Add Assignment or Exam</DialogTitle>
                  <p className="text-[10px] font-normal text-slate-500 dark:text-zinc-400">
                    Schedule coursework, midterms, or exam sessions
                  </p>
                </div>
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                >
                  ✕
                </Button>
              </DialogClose>
            </DialogHeader>

            <form onSubmit={handleCreateAssignment} className="p-4 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter assignment or exam title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                    Course
                  </label>
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) =>
                      setNewType(e.target.value as AssignmentItem['type'])
                    }
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
                <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes, deliverables, or syllabus requirements..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 placeholder:text-neutral-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                >
                  Save Item
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Assignments & Exams Cards Board */}
      {filteredAssignments.length === 0 ? (
        <div className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-8 text-center text-slate-500 dark:text-zinc-400">
          <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-zinc-600 block mb-1.5">
            fact_check
          </span>
          <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">No deliverables or exams recorded</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 mb-3">Keep track of your midterms, oral exams, projects, and deadlines.</p>
          <Button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add First Assignment</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredAssignments.map((item) => {
            const daysLeft = calculateDaysLeft(item.dueDate);

            // Urgency countdown styling based on deadline proximity
            let countdownBadge = {
              text: daysLeft > 0 ? `In ${daysLeft}d` : daysLeft === 0 ? 'Due Today' : 'Overdue',
              className: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 font-medium',
            };

            if (item.status === 'completed') {
              countdownBadge = {
                text: 'Completed',
                className: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold',
              };
            } else if (item.status === 'submitted') {
              countdownBadge = {
                text: 'Submitted',
                className: 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-bold',
              };
            } else if (daysLeft <= 0) {
              countdownBadge = {
                text: daysLeft === 0 ? 'Due Today' : 'Overdue',
                className: 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800 font-bold animate-pulse',
              };
            } else if (daysLeft <= 7) {
              countdownBadge = {
                text: `In ${daysLeft}d`,
                className: 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800 font-bold',
              };
            } else if (daysLeft <= 14) {
              countdownBadge = {
                text: `In ${daysLeft}d`,
                className: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold',
              };
            }

            const statusColor =
              item.status === 'completed'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : item.status === 'submitted'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                : item.status === 'in-progress'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700';

            return (
              <div
                key={item.id}
                className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg shadow-2xs p-3 text-xs flex flex-col justify-between hover:shadow-sm dark:hover:border-zinc-700 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-1 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) =>
                          handleStatusChange(
                            item.id,
                            item.status === 'completed' ? 'todo' : 'completed',
                            e
                          )
                        }
                        className="text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                        title={item.status === 'completed' ? 'Mark incomplete' : 'Complete task (+25 XP)'}
                        aria-label="Toggle task completion"
                      >
                        {item.status === 'completed' ? (
                          <CheckCircle2 size={16} className="text-emerald-500 fill-emerald-500/20" />
                        ) : (
                          <Circle size={16} />
                        )}
                      </button>
                      <span className={`font-bold text-[11px] leading-tight line-clamp-1 ${
                        item.status === 'completed' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-neutral-900 dark:text-zinc-100'
                      }`}>
                        {item.title}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded border font-mono text-[9px] uppercase tracking-wide shrink-0 ${countdownBadge.className}`}
                    >
                      {countdownBadge.text}
                    </span>
                  </div>

                  <div className="text-[10px] text-neutral-600 dark:text-zinc-400 font-medium mt-1 truncate">
                    {item.courseName}
                  </div>

                  {item.notes && (
                    <div className="text-[10px] text-neutral-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                      {item.notes}
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-[10px]">
                  <div className="font-mono text-neutral-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[9px] py-0 px-1 font-bold">
                      {item.type}
                    </Badge>
                    <span>•</span>
                    <span className="text-[10px] text-neutral-500 dark:text-zinc-400 font-mono">
                      Due: {item.dueDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        handleStatusChange(
                          item.id,
                          e.target.value as AssignmentItem['status']
                        )
                      }
                      className={`py-0.5 px-1.5 border rounded text-[10px] font-semibold cursor-pointer focus:outline-none ${statusColor}`}
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="completed">Completed</option>
                    </select>

                    <button
                      onClick={() => onDeleteAssignment(item.id)}
                      className="px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 text-[10px] hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900 active:scale-[0.98] transition-all cursor-pointer"
                      title="Delete item"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
