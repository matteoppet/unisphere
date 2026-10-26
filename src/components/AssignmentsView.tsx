import React, { useState, useEffect, useMemo } from 'react';
import { AssignmentItem, Course, ExamPart } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { fireTaskConfetti } from '../utils/confetti';
import { CheckCircle2, Circle } from 'lucide-react';
import {
  calculateMediaGrades,
  getItemExamGrade,
  isExamType,
  getExamResult,
} from '../utils/grades';
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
  onUpdateAssignment: (assignment: AssignmentItem) => void;
  onDeleteAssignment: (id: string) => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments,
  courses,
  onAddAssignment,
  onUpdateAssignmentStatus,
  onUpdateAssignment,
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
  const [newExamMode, setNewExamMode] = useState<'single' | 'split'>('single');
  const [newSingleGrade, setNewSingleGrade] = useState('');
  const [newEsonero1, setNewEsonero1] = useState('');
  const [newEsonero2, setNewEsonero2] = useState('');

  const gradeSummary = useMemo(() => {
    return calculateMediaGrades(assignments, courses);
  }, [assignments, courses]);

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

    let examParts: ExamPart[] | undefined = undefined;
    let singleGrade: number | undefined = undefined;
    let isPassed = false;

    if (isExamType(newType)) {
      if (newExamMode === 'split') {
        const p1 = Number(newEsonero1);
        const p2 = Number(newEsonero2);
        const part1Grade =
          newEsonero1 !== '' && Number.isFinite(p1)
            ? Math.min(30, Math.max(0, p1))
            : undefined;
        const part2Grade =
          newEsonero2 !== '' && Number.isFinite(p2)
            ? Math.min(30, Math.max(0, p2))
            : undefined;
        examParts = [
          { label: 'Esonero 1', grade: part1Grade },
          { label: 'Esonero 2', grade: part2Grade },
        ];
        const finalGrade = getExamResult(examParts);
        isPassed = finalGrade !== null;
      } else {
        const g = Number(newSingleGrade);
        singleGrade =
          newSingleGrade !== '' && Number.isFinite(g)
            ? Math.min(30, Math.max(0, g))
            : undefined;
        isPassed = typeof singleGrade === 'number' && singleGrade >= 18;
      }
    }

    onAddAssignment({
      title: newTitle.trim(),
      courseName: newCourse || courses[0]?.title || 'General',
      type: newType,
      dueDate: newDueDate,
      status: isPassed ? 'completed' : 'todo',
      notes: newNotes.trim(),
      examParts,
      grade: singleGrade,
      completedAt: isPassed ? Date.now() : undefined,
    });

    setNewTitle('');
    setNewNotes('');
    setNewExamMode('single');
    setNewSingleGrade('');
    setNewEsonero1('');
    setNewEsonero2('');
    setShowAddForm(false);
  };

  const handleExamGradeChange = (item: AssignmentItem, index: number, value: string) => {
    if (!item.examParts) return;
    const parsedGrade = Number(value);
    const grade =
      value === '' || !Number.isFinite(parsedGrade)
        ? undefined
        : Math.min(30, Math.max(0, parsedGrade));
    const examParts = item.examParts.map((part, partIndex) =>
      partIndex === index ? { ...part, grade } : part
    );
    const finalGrade = getExamResult(examParts);
    onUpdateAssignment({
      ...item,
      examParts,
      status: finalGrade !== null ? 'completed' : item.status === 'completed' ? 'todo' : item.status,
      completedAt: finalGrade !== null ? item.completedAt || Date.now() : item.completedAt,
    });
  };

  const handleSingleExamGradeChange = (item: AssignmentItem, value: string) => {
    const parsedGrade = Number(value);
    const grade =
      value === '' || !Number.isFinite(parsedGrade)
        ? undefined
        : Math.min(30, Math.max(0, parsedGrade));
    const isPassed = typeof grade === 'number' && grade >= 18;
    onUpdateAssignment({
      ...item,
      grade,
      status: isPassed
        ? 'completed'
        : item.status === 'completed' && grade === undefined
        ? 'todo'
        : item.status,
      completedAt: isPassed ? item.completedAt || Date.now() : item.completedAt,
    });
  };

  const handleToggleSplitExam = (item: AssignmentItem, makeSplit: boolean) => {
    if (makeSplit) {
      onUpdateAssignment({
        ...item,
        examParts: [
          { label: 'Esonero 1', grade: item.grade },
          { label: 'Esonero 2' },
        ],
        grade: undefined,
      });
    } else {
      const avg = getExamResult(item.examParts);
      onUpdateAssignment({
        ...item,
        examParts: undefined,
        grade: avg !== null ? Math.round(avg) : undefined,
      });
    }
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
      if (e) {
        fireTaskConfetti({ x: e.clientX, y: e.clientY });
      } else {
        fireTaskConfetti();
      }
    }
    onUpdateAssignmentStatus(id, newStatus);
  };

  return (
    <div className="flex-1 bg-[#fdf9f4] dark:bg-[#09090b] text-[#2d2f34] dark:text-zinc-100 overflow-y-auto p-2.5 sm:p-4 space-y-4 select-none relative transition-colors">
      {/* Top Banner */}
      <fieldset className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-3.5 text-xs slite-shadow">
        <legend className="font-semibold text-[#2d2f34] dark:text-zinc-200 px-2.5 py-0.5 flex items-center gap-1.5 bg-[#f9efe4] dark:bg-zinc-800 border border-[#ecedef] dark:border-zinc-700 rounded-md text-[11px]">
          <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">
            fact_check
          </span>
          <span>Assignments, Midterms &amp; Exams Registry</span>
        </legend>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#3f434a] dark:text-zinc-300">Filter By Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-[11px] py-1 px-2.5 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-[#fdf9f4] dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-200 focus:outline-none focus:border-[#6366F1]"
              >
                <option value="all">All Items</option>
                <option value="Assignment">Assignments Only</option>
                <option value="Midterm">Midterms Only</option>
                <option value="Exam">Exams Only</option>
                <option value="Oral">Oral Exams Only</option>
                <option value="Project">Projects Only</option>
              </select>
            </div>

            {gradeSummary.gradedExamsCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#f9efe4] dark:bg-zinc-800 border border-[#ecedef] dark:border-zinc-700 font-mono text-[11px]">
                <span className="text-[#3f434a] dark:text-zinc-400 font-sans font-semibold">Media:</span>
                <span className="font-bold text-[#2d2f34] dark:text-zinc-100">
                  {gradeSummary.weightedAverage !== null ? `${gradeSummary.weightedAverage.toFixed(1)}/30` : '—'}
                </span>
                {gradeSummary.laureaBase !== null && (
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    ({gradeSummary.laureaBase.toFixed(1)}/110)
                  </span>
                )}
                <span className="text-zinc-400 dark:text-zinc-500 font-sans text-[10px]">
                  • {gradeSummary.gradedExamsCount} {gradeSummary.gradedExamsCount === 1 ? 'voto' : 'voti'}
                </span>
              </div>
            )}
          </div>

          <Button
            onClick={handleOpenAddModal}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-medium rounded-md text-xs h-7 px-3.5 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Item</span>
          </Button>
        </div>
      </fieldset>

      {/* Centered Modal Dialog for Adding Assignment / Exam */}
      {showAddForm && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setShowAddForm(false); }}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col text-xs overflow-hidden bg-white dark:bg-zinc-900 border border-[#ecedef] dark:border-zinc-800 rounded-md slite-shadow">
            <DialogHeader className="border-b border-[#ecedef] dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="material-symbols-outlined text-[18px] text-[#6366F1] shrink-0">
                  edit_calendar
                </span>
                <div>
                  <DialogTitle className="text-sm font-semibold text-[#2d2f34] dark:text-zinc-100">Add Assignment or Exam</DialogTitle>
                  <p className="text-[10px] font-normal text-[#3f434a] dark:text-zinc-400">
                    Schedule coursework, midterms, or exam sessions
                  </p>
                </div>
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-[#3f434a] hover:text-[#2d2f34] dark:hover:text-zinc-200 rounded-md"
                >
                  ✕
                </Button>
              </DialogClose>
            </DialogHeader>

            <form onSubmit={handleCreateAssignment} className="p-4 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                  Title <span className="text-[#6366F1]">*</span>
                </label>
                <Input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter assignment or exam title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded-md border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4]/50 dark:bg-zinc-950 focus:border-[#6366F1]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                    Course
                  </label>
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full text-xs p-2 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-[#fdf9f4]/50 dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 focus:outline-none focus:border-[#6366F1]"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => {
                      const type = e.target.value as AssignmentItem['type'];
                      setNewType(type);
                      if (!['Midterm', 'Exam', 'Final', 'Oral'].includes(type)) {
                        setNewExamMode('single');
                      }
                    }}
                    className="w-full text-xs p-2 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-[#fdf9f4]/50 dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 font-medium focus:outline-none focus:border-[#6366F1]"
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

              {['Midterm', 'Exam', 'Final', 'Oral'].includes(newType) && (
              <div>
                <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                  Exam format
                </label>
                <select
                  value={newExamMode}
                  onChange={(e) => setNewExamMode(e.target.value as 'single' | 'split')}
                  className="w-full text-xs p-2 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-[#fdf9f4]/50 dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 font-medium focus:outline-none focus:border-[#6366F1]"
                >
                  <option value="single">Single exam (Esame totale)</option>
                  <option value="split">Two parts: Esonero 1 + Esonero 2</option>
                </select>
                {newExamMode === 'split' ? (
                  <p className="text-[10px] text-[#3f434a] dark:text-zinc-400 mt-1">
                    Pass both parts to calculate the final grade as their arithmetic average.
                  </p>
                ) : (
                  <p className="text-[10px] text-[#3f434a] dark:text-zinc-400 mt-1">
                    Single total exam evaluated with a single grade out of 30.
                  </p>
                )}
              </div>
              )}

              {['Midterm', 'Exam', 'Final', 'Oral'].includes(newType) && newExamMode === 'single' && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                    Exam Grade (optional, 18-30)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    placeholder="e.g. 28 (leave empty if not taken yet)"
                    value={newSingleGrade}
                    onChange={(e) => setNewSingleGrade(e.target.value)}
                    className="font-mono rounded-md border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4]/50 dark:bg-zinc-950 focus:border-[#6366F1]"
                  />
                </div>
              )}

              {['Midterm', 'Exam', 'Final', 'Oral'].includes(newType) && newExamMode === 'split' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                      Esonero 1 (optional)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      step="1"
                      placeholder="e.g. 27"
                      value={newEsonero1}
                      onChange={(e) => setNewEsonero1(e.target.value)}
                      className="font-mono rounded-md border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4]/50 dark:bg-zinc-950 focus:border-[#6366F1]"
                    />
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                      Esonero 2 (optional)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      step="1"
                      placeholder="e.g. 29"
                      value={newEsonero2}
                      onChange={(e) => setNewEsonero2(e.target.value)}
                      className="font-mono rounded-md border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4]/50 dark:bg-zinc-950 focus:border-[#6366F1]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                  Due Date <span className="text-[#6366F1]">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="font-mono rounded-md border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4]/50 dark:bg-zinc-950 focus:border-[#6366F1]"
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-[#2d2f34] dark:text-zinc-300 block mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes, deliverables, or syllabus requirements..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs p-2 border border-[#ecedef] dark:border-zinc-800 rounded-md bg-[#fdf9f4]/50 dark:bg-zinc-950 text-[#2d2f34] dark:text-zinc-100 placeholder:text-neutral-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#6366F1] resize-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-[#ecedef] dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-md border-[#ecedef] dark:border-zinc-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-md font-medium"
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
        <div className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md slite-shadow p-8 text-center text-[#3f434a] dark:text-zinc-400">
          <span className="material-symbols-outlined text-[36px] text-zinc-300 dark:text-zinc-600 block mb-1.5">
            fact_check
          </span>
          <p className="text-xs font-semibold text-[#2d2f34] dark:text-zinc-200">No deliverables or exams recorded</p>
          <p className="text-[11px] text-[#3f434a] dark:text-zinc-400 mt-0.5 mb-3">Keep track of your midterms, oral exams, projects, and deadlines.</p>
          <Button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-md font-medium"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add First Assignment</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredAssignments.map((item) => {
            const daysLeft = calculateDaysLeft(item.dueDate);
            const finalExamGrade = getExamResult(item.examParts);

            // Urgency countdown styling based on deadline proximity
            let countdownBadge = {
              text: daysLeft > 0 ? `In ${daysLeft}d` : daysLeft === 0 ? 'Due Today' : 'Overdue',
              className: 'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-300 border border-[#ecedef] dark:border-zinc-700 font-medium',
            };

            if (item.status === 'completed') {
              countdownBadge = {
                text: 'Completed',
                className: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold',
              };
            } else if (item.status === 'submitted') {
              countdownBadge = {
                text: 'Submitted',
                className: 'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200 border border-[#ecedef] dark:border-zinc-700 font-bold',
              };
            } else if (daysLeft <= 0) {
              countdownBadge = {
                text: daysLeft === 0 ? 'Due Today' : 'Overdue',
                className: 'bg-[#6366F1]/15 dark:bg-red-950/80 text-[#6366F1] dark:text-red-300 border border-[#6366F1]/30 dark:border-red-800 font-bold animate-pulse',
              };
            } else if (daysLeft <= 7) {
              countdownBadge = {
                text: `In ${daysLeft}d`,
                className: 'bg-[#6366F1]/15 dark:bg-red-950/70 text-[#6366F1] dark:text-red-300 border border-[#6366F1]/30 dark:border-red-800 font-bold',
              };
            } else if (daysLeft <= 14) {
              countdownBadge = {
                text: `In ${daysLeft}d`,
                className: 'bg-amber-100/70 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold',
              };
            }

            const statusColor =
              item.status === 'completed'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : item.status === 'submitted'
                ? 'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200 border-[#ecedef] dark:border-zinc-700'
                : item.status === 'in-progress'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-[#fdf9f4] dark:bg-zinc-800/60 text-[#3f434a] dark:text-zinc-300 border-[#ecedef] dark:border-zinc-700';

            return (
              <div
                key={item.id}
                className="border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md slite-shadow p-3.5 text-xs flex flex-col justify-between hover:border-[#6366F1]/40 dark:hover:border-zinc-700 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-[#ecedef] dark:border-zinc-800">
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
                      <span className={`font-semibold text-[11px] leading-tight line-clamp-1 ${
                        item.status === 'completed' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-[#2d2f34] dark:text-zinc-100'
                      }`}>
                        {item.title}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[9px] uppercase tracking-wide shrink-0 ${countdownBadge.className}`}
                    >
                      {countdownBadge.text}
                    </span>
                  </div>

                  <div className="text-[10px] text-[#3f434a] dark:text-zinc-400 font-medium mt-1.5 truncate">
                    {item.courseName}
                  </div>

                  {item.notes && (
                    <div className="text-[10px] text-[#3f434a]/80 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                      {item.notes}
                    </div>
                  )}

                  {item.examParts && item.examParts.length === 2 && (
                    <div className="mt-2 rounded-md border border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/70 dark:bg-indigo-950/30 p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-semibold text-[10px] text-indigo-900 dark:text-indigo-100">
                          Esame diviso in due prove
                        </span>
                        <span className={`text-[10px] font-bold ${finalExamGrade !== null ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                          {finalExamGrade !== null ? `Media: ${finalExamGrade}/30` : 'Passa entrambe le prove'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {item.examParts.map((part, partIndex) => (
                          <label key={part.label} className="text-[10px] font-medium text-indigo-900/80 dark:text-indigo-200/80">
                            {part.label}
                            <input
                              type="number"
                              min="0"
                              max="30"
                              step="1"
                              value={part.grade ?? ''}
                              onChange={(e) => handleExamGradeChange(item, partIndex, e.target.value)}
                              placeholder="—"
                              aria-label={`${part.label} grade`}
                              className="mt-1 w-full rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-mono text-[#2d2f34] dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-indigo-200/50 dark:border-indigo-900/50">
                        <p className="text-[9px] text-indigo-800/80 dark:text-indigo-200/80">
                          Pass mark: at least 18/30 each.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleToggleSplitExam(item, false)}
                          className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                        >
                          Passa a esame unico
                        </button>
                      </div>
                    </div>
                  )}

                  {isExamType(item.type) && (!item.examParts || item.examParts.length === 0) && (
                    <div className="mt-2 rounded-md border border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/70 dark:bg-indigo-950/30 p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-semibold text-[10px] text-indigo-900 dark:text-indigo-100">
                          Esame totale
                        </span>
                        <span className={`text-[10px] font-bold ${typeof item.grade === 'number' && item.grade >= 18 ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                          {typeof item.grade === 'number'
                            ? item.grade >= 18
                              ? `Voto: ${item.grade}/30`
                              : `Non superato (${item.grade}/30)`
                            : 'Inserisci voto'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1">
                        <label className="text-[10px] font-medium text-indigo-900/80 dark:text-indigo-200/80">
                          Voto esame (0-30)
                          <input
                            type="number"
                            min="0"
                            max="30"
                            step="1"
                            value={item.grade ?? ''}
                            onChange={(e) => handleSingleExamGradeChange(item, e.target.value)}
                            placeholder="—"
                            aria-label="Single exam grade"
                            className="mt-1 w-full rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-mono text-[#2d2f34] dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                          />
                        </label>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-indigo-200/50 dark:border-indigo-900/50">
                        <p className="text-[9px] text-indigo-800/80 dark:text-indigo-200/80">
                          Pass mark: at least 18/30.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleToggleSplitExam(item, true)}
                          className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                        >
                          Dividi in 2 esoneri
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#ecedef] dark:border-zinc-800 flex items-center justify-between text-[10px]">
                  <div className="font-mono text-[#3f434a] dark:text-zinc-400 flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[9px] py-0 px-2 font-bold rounded-md bg-[#f9efe4] text-[#2d2f34]">
                      {item.type}
                    </Badge>
                    <span>•</span>
                    <span className="text-[10px] text-[#3f434a] dark:text-zinc-400 font-mono">
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
                      className={`py-0.5 px-2 border rounded-md text-[10px] font-semibold cursor-pointer focus:outline-none ${statusColor}`}
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="completed">Completed</option>
                    </select>

                    <button
                      onClick={() => onDeleteAssignment(item.id)}
                      className="px-2 py-0.5 rounded-md border border-[#ecedef] dark:border-zinc-800 bg-[#fdf9f4] dark:bg-zinc-900 text-red-600 dark:text-red-400 text-[10px] hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900 active:scale-[0.98] transition-all cursor-pointer"
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
