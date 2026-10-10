export type NavView =
  | 'dashboard'
  | 'courses-and-curriculum'
  | 'study-session-tracker'
  | 'assignments-and-exams'
  | 'settings';

export type StudyTag = 'Deep Work' | 'Problem Solving' | 'Review' | 'Lab Work' | 'Exam Prep';

export interface Course {
  id: string;
  code: string;
  title: string;
  shortTitle: string;
  instructor: string;
  email: string;
  officeHours?: string;
  cfu: number;
  year: number; // 1, 2, 3
  semester: 1 | 2;
  status: 'active' | 'completed' | 'planned';
  nextDeliverable?: {
    type: string;
    title: string;
    date: string;
    badgeColor?: string;
  };
  estGrade: number; // e.g. 29
  finalGrade?: number; // e.g. 30
  isLaude?: boolean; // 30 e Lode
  progress: number; // 0 to 100
  color: string;
  notes?: string;
}

export interface StudyLog {
  id: string;
  courseId?: string;
  courseName: string;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
  timeRange: string; // e.g. "Today 14:00 - 16:30"
  notes: string;
  rating: number; // 1 to 5
  tag: StudyTag;
  timestamp: number;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  courseName: string;
  type: 'lecture' | 'lab' | 'office-hours' | 'study' | 'exam';
  startTime: string; // "10:00"
  endTime: string; // "12:00"
  date: string; // "2024-11-12" or "today"
  dayOfWeek?: number; // 0-6 (Sun-Sat)
  location: string;
  locationType: 'room' | 'zoom' | 'library' | 'lab';
  instructor?: string;
  color?: string;
}

export type AssignmentType =
  | 'Assignment'
  | 'Midterm'
  | 'Exam'
  | 'Final'
  | 'Project'
  | 'Oral'
  | 'Lab Report';

export interface AssignmentItem {
  id: string;
  courseName: string;
  title: string;
  type: AssignmentType;
  dueDate: string; // YYYY-MM-DD
  weightPercent?: number;
  status: 'todo' | 'in-progress' | 'submitted' | 'graded';
  estScore?: number;
  maxScore: number;
  notes?: string;
}

export interface StudentProfile {
  name: string;
  studentId: string;
  email?: string;
  degreeLevel?: string; // Bachelor's, Master's, etc.
  institution?: string; // e.g. Alma Mater Studiorum
  degreeName: string;
  degreeType: string; // e.g. Laurea Triennale
  status: string; // e.g. Regular Enrolled
  currentSession: string; // Fall 2024
  academicYear: string; // Year 2
  enrolledYear: string; // AY 2024/25
  totalTargetCFU: number; // 180
  weeklyGoalHours: number; // 25
  avatarUrl: string;
  logoUrl: string;
  thesisPointsExpected: number; // e.g. 4
}
