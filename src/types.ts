export type NavView =
  | 'dashboard'
  | 'courses-and-curriculum'
  | 'study-session-tracker'
  | 'assignments-and-exams'
  | 'squads'
  | 'settings';

export type StudyTag = 'Deep Work' | 'Problem Solving' | 'Review' | 'Lab Work' | 'Exam Prep';

export interface Course {
  id: string;
  code: string;
  title: string;
  shortTitle: string;
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
  status: 'todo' | 'in-progress' | 'submitted' | 'completed';
  notes?: string;
  completedAt?: number;
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
  
  // Gamification & Academic Telemetry
  xp?: number;
  currentStreak?: number;
  minutesStudiedThisWeek?: number;
  tasksCompletedThisWeek?: number;
  lastActiveDate?: string;
  audioEnabled?: boolean;
  activeSquadId?: string;
  squadIds?: string[];
}

export const INITIAL_PROFILE: StudentProfile = {
  name: '',
  studentId: '',
  degreeName: '',
  degreeType: '',
  status: 'Enrolled',
  currentSession: 'Current Semester',
  academicYear: 'Year 1',
  enrolledYear: '',
  totalTargetCFU: 180,
  weeklyGoalHours: 20,
  avatarUrl: '',
  logoUrl: '',
  thesisPointsExpected: 0,
  institution: '',
  xp: 0,
  currentStreak: 0,
  minutesStudiedThisWeek: 0,
  tasksCompletedThisWeek: 0,
  audioEnabled: true,
  squadIds: [],
};

// --- Squads Hub Types ---

export interface Squad {
  id: string;
  name: string;
  code: string; // 6-character alphanumeric code
  createdAt: string;
  createdBy: string;
  creatorName: string;
  memberCount: number;
  memberUids?: string[];
}

export interface SquadMember {
  uid: string;
  displayName: string;
  email?: string;
  color: string; // Neon accent (Cyan, Purple, Emerald, Amber, Rose)
  elo: number; // Subject ELO / Power Rating
  minutesThisWeek: number;
  tasksThisWeek: number;
  currentStreak?: number;
  avatarUrl?: string;
  joinedAt: string;
}

export interface SquadPresence {
  uid: string;
  displayName: string;
  courseId?: string;
  courseName: string;
  startedAt: number; // Date.now()
  status: 'locked-in' | 'idle';
  color?: string;
  updatedAt?: number;
}

export interface SquadActivity {
  id: string;
  uid: string;
  displayName: string;
  type: 'session_complete' | 'task_complete' | 'loot_drop';
  title: string;
  xpEarned: number;
  timestamp: number;
}

export interface GhostMilestone {
  minute: number;
  taskLabel?: string;
}

export interface GhostSession {
  id: string;
  uid: string;
  memberName: string;
  courseName: string;
  durationMinutes: number;
  milestones: GhostMilestone[];
  timestamp: number;
}

export interface LootDropReward {
  xp: number;
  title: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  description: string;
}

export const INITIAL_COURSES: Course[] = [];
export const INITIAL_STUDY_LOGS: StudyLog[] = [];
export const INITIAL_SCHEDULE_EVENTS: ScheduleEvent[] = [];
export const INITIAL_ASSIGNMENTS: AssignmentItem[] = [];
