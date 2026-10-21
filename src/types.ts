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
  color?: string;
  accentColor?: string;
}

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const COLOR_PALETTE: PaletteColor[] = [
  { id: 'tibet-blue', name: 'Tibet Blue', hex: '#3B77BC', bgClass: 'bg-[#3B77BC]', textClass: 'text-[#3B77BC] dark:text-[#689FE1]', borderClass: 'border-[#3B77BC]/50' },
  { id: 'mint-green', name: 'Mint Green', hex: '#81C046', bgClass: 'bg-[#81C046]', textClass: 'text-[#81C046] dark:text-[#95D45B]', borderClass: 'border-[#81C046]/50' },
  { id: 'dark-yellow', name: 'Dark Yellow', hex: '#FCCF03', bgClass: 'bg-[#FCCF03]', textClass: 'text-[#FCCF03]', borderClass: 'border-[#FCCF03]/50' },
  { id: 'palm-red', name: 'Palm Red', hex: '#DE482B', bgClass: 'bg-[#DE482B]', textClass: 'text-[#DE482B] dark:text-[#F37055]', borderClass: 'border-[#DE482B]/50' },
  { id: 'slate-blue', name: 'Slate Blue', hex: '#5A738E', bgClass: 'bg-[#5A738E]', textClass: 'text-[#5A738E] dark:text-[#8CA3BA]', borderClass: 'border-[#5A738E]/50' },
  { id: 'emerald', name: 'Emerald', hex: '#10B981', bgClass: 'bg-[#10B981]', textClass: 'text-[#10B981]', borderClass: 'border-[#10B981]/50' },
  { id: 'indigo', name: 'Obsidian Indigo', hex: '#6366F1', bgClass: 'bg-[#6366F1]', textClass: 'text-[#6366F1]', borderClass: 'border-[#6366F1]/50' },
  { id: 'rose', name: 'Crimson Rose', hex: '#F43F5E', bgClass: 'bg-[#F43F5E]', textClass: 'text-[#F43F5E]', borderClass: 'border-[#F43F5E]/50' },
];

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

export type ResourceCategory =
  | 'Portal'
  | 'Course Material'
  | 'Library'
  | 'Drive'
  | 'Schedule'
  | 'Tools'
  | 'Other';

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  category: ResourceCategory;
  courseName?: string;
  notes?: string;
  isPinned?: boolean;
  createdAt: number;
}

export const INITIAL_RESOURCE_LINKS: ResourceLink[] = [];

export const INITIAL_COURSES: Course[] = [];
export const INITIAL_STUDY_LOGS: StudyLog[] = [];
export const INITIAL_SCHEDULE_EVENTS: ScheduleEvent[] = [];
export const INITIAL_ASSIGNMENTS: AssignmentItem[] = [];
