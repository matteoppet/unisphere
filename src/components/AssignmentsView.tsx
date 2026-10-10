import React, { useState, useEffect } from 'react';
import { AssignmentItem, Course } from '../types';

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
  const [newDueDate, setNewDueDate] = useState('2024-11-25');
  const [newEstScore, setNewEstScore] = useState(28);
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
    const today = new Date('2024-11-12'); // matching current term baseline or today
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
      estScore: Number(newEstScore),
      maxScore: 30,
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

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5 select-none relative">
      {/* Top Banner */}
      <fieldset className="border border-gray-200 bg-white rounded-xl p-3 text-xs shadow-sm">
        <legend className="font-semibold text-neutral-800 px-2 py-0.5 flex items-center gap-1.5 bg-white border border-gray-200 rounded-md text-[11px] shadow-2xs">
          <span className="material-symbols-outlined text-[14px] text-emerald-700">
            fact_check
          </span>
          <span>Assignments, Midterms &amp; Exams Registry</span>
        </legend>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-neutral-700">Filter By Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-[11px] py-1 px-2 border border-gray-200 rounded-lg bg-white text-neutral-800"
            >
              <option value="all">All Items</option>
              <option value="Assignment">Assignments Only</option>
              <option value="Midterm">Midterms Only</option>
              <option value="Exam">Exams Only</option>
              <option value="Oral">Oral Exams Only</option>
              <option value="Project">Projects Only</option>
            </select>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="win-button px-2.5 py-1 text-[11px] font-semibold text-blue-900 flex items-center gap-1 hover:bg-blue-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">add</span>
            <span>Add Item</span>
          </button>
        </div>
      </fieldset>

      {/* Centered Modal Dialog for Adding Assignment / Exam */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setShowAddForm(false)}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col text-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Title Bar */}
            <div className="bg-slate-50/90 border-b border-gray-200 px-4 py-3 flex items-center justify-between font-bold text-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">
                  edit_calendar
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Add Assignment or Exam</h3>
                  <p className="text-[10px] font-normal text-slate-500">
                    Schedule coursework, midterms, or exam sessions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAssignment} className="p-4 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Distributed Systems Midterm Exam"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-1">
                    Course
                  </label>
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-blue-500"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-1">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) =>
                      setNewType(e.target.value as AssignmentItem['type'])
                    }
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 font-medium focus:outline-none focus:border-blue-500"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-1">
                    Target Grade (/30)
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={30}
                    value={newEstScore}
                    onChange={(e) => setNewEstScore(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 font-mono tabular-nums focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Raft consensus algorithm, vector clocks, leader election proofs"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 min-w-[96px] text-xs font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 transition-colors shadow-2xs text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-w-[96px] text-xs font-semibold rounded-lg border border-transparent bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors shadow-xs text-center"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignments & Exams Cards Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {filteredAssignments.map((item) => {
          const daysLeft = calculateDaysLeft(item.dueDate);

          // Urgency countdown styling based on deadline proximity
          let countdownBadge = {
            text: daysLeft > 0 ? `In ${daysLeft}d` : daysLeft === 0 ? 'Due Today' : 'Overdue',
            className: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
          };

          if (item.status === 'graded') {
            countdownBadge = {
              text: 'Graded',
              className: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
            };
          } else if (item.status === 'submitted') {
            countdownBadge = {
              text: 'Submitted',
              className: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
            };
          } else if (daysLeft <= 0) {
            countdownBadge = {
              text: daysLeft === 0 ? 'Due Today' : 'Overdue',
              className: 'bg-red-100 text-red-800 border-red-300 font-bold animate-pulse',
            };
          } else if (daysLeft <= 7) {
            countdownBadge = {
              text: `In ${daysLeft}d`,
              className: 'bg-red-100 text-red-800 border-red-300 font-bold',
            };
          } else if (daysLeft <= 14) {
            countdownBadge = {
              text: `In ${daysLeft}d`,
              className: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
            };
          }

          const statusColor =
            item.status === 'graded'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : item.status === 'submitted'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : item.status === 'in-progress'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-slate-50 text-slate-700 border-gray-200';

          return (
            <div
              key={item.id}
              className="border border-gray-200 bg-white rounded-lg shadow-2xs p-3 text-xs flex flex-col justify-between hover:shadow-sm transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-1 pb-1 border-b border-gray-100">
                  <span className="font-bold text-[11px] text-neutral-900 leading-tight line-clamp-1">
                    {item.title}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border font-mono text-[9px] uppercase tracking-wide shrink-0 ${countdownBadge.className}`}
                  >
                    {countdownBadge.text}
                  </span>
                </div>

                <div className="text-[10px] text-neutral-600 font-medium mt-1 truncate">
                  {item.courseName}
                </div>

                {item.notes && (
                  <div className="text-[10px] text-neutral-500 mt-0.5 leading-snug line-clamp-2">
                    {item.notes}
                  </div>
                )}
              </div>

              <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px]">
                <div className="font-mono text-neutral-600 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded text-[9px] font-bold uppercase">
                    {item.type}
                  </span>
                  <span>•</span>
                  <span className="font-bold text-neutral-800 tabular-nums">
                    Est: {item.estScore || 28}/{item.maxScore || 30}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={item.status}
                    onChange={(e) =>
                      onUpdateAssignmentStatus(
                        item.id,
                        e.target.value as AssignmentItem['status']
                      )
                    }
                    className={`py-0.5 px-1.5 border rounded text-[10px] font-semibold ${statusColor}`}
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="submitted">Submitted</option>
                    <option value="graded">Graded</option>
                  </select>

                  <button
                    onClick={() => onDeleteAssignment(item.id)}
                    className="win-button px-1.5 py-0.5 text-red-700 text-[10px] hover:bg-red-50"
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
    </div>
  );
};
