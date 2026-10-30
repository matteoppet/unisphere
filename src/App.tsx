/**
 * UniSphere v2.4
 * Degree Workstation & University Organizer
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  NavView,
  Course,
  StudyLog,
  AssignmentItem,
  StudentProfile,
  ResourceLink,
  INITIAL_PROFILE,
  INITIAL_COURSES,
  INITIAL_STUDY_LOGS,
  INITIAL_ASSIGNMENTS,
  INITIAL_RESOURCE_LINKS,
} from './types';
import { auth, db } from './lib/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getEmailDocId } from './lib/authService';

import { QuickToolbar } from './components/QuickToolbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CurriculumView } from './components/CurriculumView';
import { StudyTrackerView } from './components/StudyTrackerView';
import { AssignmentsView } from './components/AssignmentsView';
import { SquadsView } from './components/SquadsView';
import { SettingsView } from './components/SettingsView';
import { AuthView } from './components/AuthView';
import { updateStreak } from './utils/telemetry';
import {
  CourseDetailModal,
  NewCourseModal,
  NewAssignmentModal,
  EmailGroupModal,
  ColumnsModal,
  ExportModal,
} from './components/Modals';
import { QuickStudyModal } from './components/QuickStudyModal';
import { ShortcutsView } from './components/ShortcutsView';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const STORAGE_KEY = 'unisphere_workspace';

export default function App() {
  // --- Persistent Workstation State ---
  const [profile, setProfile] = useState<StudentProfile>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_profile`);
      if (saved) return JSON.parse(saved);
      return INITIAL_PROFILE;
    } catch {
      return INITIAL_PROFILE;
    }
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_courses`);
      if (saved) return JSON.parse(saved);
      return INITIAL_COURSES;
    } catch {
      return INITIAL_COURSES;
    }
  });

  const [studyLogs, setStudyLogs] = useState<StudyLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
      if (saved) return JSON.parse(saved);
      return INITIAL_STUDY_LOGS;
    } catch {
      return INITIAL_STUDY_LOGS;
    }
  });

  const [assignments, setAssignments] = useState<AssignmentItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_assignments`);
      if (saved) return JSON.parse(saved);
      return INITIAL_ASSIGNMENTS;
    } catch {
      return INITIAL_ASSIGNMENTS;
    }
  });

  const [quickNotes, setQuickNotes] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_quick_notes`);
      if (saved !== null) return saved;
    } catch {}
    return '';
  });

  const [checklist, setChecklist] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_checklist`);
      if (saved !== null) return saved;
    } catch {}
    return '';
  });

  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_resource_links`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (r: ResourceLink) =>
              !['res-1', 'res-2', 'res-3', 'res-4'].includes(r.id) &&
              !r.url?.includes('unirand.it')
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(`${STORAGE_KEY}_resource_links`, JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
    } catch {}
    return INITIAL_RESOURCE_LINKS;
  });

  // --- Navigation ---
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // --- Status Message ---
  const [statusMessage, setStatusMessage] = useState<string>('Ready');

  // --- Theme State (warm light default with dark fallback) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_theme`);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'light'; // Default to Slite-inspired warm minimalist aesthetic
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    try {
      localStorage.setItem(`${STORAGE_KEY}_theme`, theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // --- Modals State ---
  const [inspectCourse, setInspectCourse] = useState<Course | null>(null);
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [showNewAssignmentModal, setShowNewAssignmentModal] = useState(false);
  const [showQuickStudyModal, setShowQuickStudyModal] = useState(false);
  const [showEmailGroupModal, setShowEmailGroupModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // --- Authentication Session State ---
  const [sessionEmail, setSessionEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_session_email`);
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(`${STORAGE_KEY}_session_email`));
    } catch {
      return false;
    }
  });

  // Track remote update execution and local write timestamp to eliminate infinite echo loops
  const isApplyingRemoteUpdateRef = useRef(false);
  const syncClientIdRef = useRef<string>(
    `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const hasInitialServerSnapshotRef = useRef(false);

  // Sync session with Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        const cleanEmail = user.email.trim().toLowerCase();
        setSessionEmail(cleanEmail);
        setIsAuthenticated(true);
        try {
          localStorage.setItem(`${STORAGE_KEY}_session_email`, cleanEmail);
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  // Real-time bidirectional synchronization with Firestore across all devices
  useEffect(() => {
    const targetEmail = sessionEmail || profile.email;
    if (!isAuthenticated || !targetEmail) return;

    const docId = getEmailDocId(targetEmail);
    const userRef = doc(db, 'users', docId);
    hasInitialServerSnapshotRef.current = false;

    const unsubscribe = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        // Skip optimistic local writes that haven't been committed by the server yet
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        // Hydrate from the server before allowing this device's local state to autosave.
        // This prevents stale localStorage data from overwriting another device's changes.
        if (snapshot.metadata.fromCache && !hasInitialServerSnapshotRef.current) {
          return;
        }
        hasInitialServerSnapshotRef.current = true;

        if (snapshot.exists()) {
          const data = snapshot.data();
          if (!data) return;

          // Ignore only this client's acknowledged write. Do not compare wall-clock
          // timestamps across devices because tablet/mobile clocks may differ.
          if (data.updatedBy === syncClientIdRef.current) {
            return;
          }

          // Mark that we are applying remote updates to prevent triggering the auto-save loop
          isApplyingRemoteUpdateRef.current = true;

          setProfile((prev) => ({
            ...prev,
            name: data.name ?? prev.name,
            studentId: data.studentId ?? prev.studentId,
            email: data.email ?? prev.email,
            degreeLevel: data.degreeLevel ?? prev.degreeLevel,
            degreeName: data.degreeName ?? prev.degreeName,
            degreeType: data.degreeType ?? prev.degreeType,
            totalTargetCFU: data.totalTargetCFU ?? prev.totalTargetCFU,
            enrolledYear: data.enrolledYear ?? prev.enrolledYear,
            academicYear: data.academicYear ?? prev.academicYear,
            institution: data.institution ?? prev.institution,
            status: data.status ?? prev.status,
            activeSquadId: data.activeSquadId ?? prev.activeSquadId,
            squadIds: Array.isArray(data.squadIds) ? data.squadIds : prev.squadIds,
            xp: typeof data.xp === 'number' ? data.xp : prev.xp,
            currentStreak: typeof data.currentStreak === 'number' ? data.currentStreak : prev.currentStreak,
            minutesStudiedThisWeek:
              typeof data.minutesStudiedThisWeek === 'number'
                ? data.minutesStudiedThisWeek
                : prev.minutesStudiedThisWeek,
            tasksCompletedThisWeek:
              typeof data.tasksCompletedThisWeek === 'number'
                ? data.tasksCompletedThisWeek
                : prev.tasksCompletedThisWeek,
            lastActiveDate: data.lastActiveDate ?? prev.lastActiveDate,
          }));

          if (Array.isArray(data.courses)) setCourses(data.courses);
          if (Array.isArray(data.studyLogs)) setStudyLogs(data.studyLogs);
          if (Array.isArray(data.assignments)) setAssignments(data.assignments);
          if (typeof data.quickNotes === 'string') setQuickNotes(data.quickNotes);
          if (typeof data.checklist === 'string') setChecklist(data.checklist);
          if (Array.isArray(data.resourceLinks)) {
            const cleaned = data.resourceLinks.filter(
              (r: ResourceLink) =>
                !['res-1', 'res-2', 'res-3', 'res-4'].includes(r.id) &&
                !r.url?.includes('unirand.it')
            );
            setResourceLinks(cleaned);
          }

          // Release the lock after state flushes
          setTimeout(() => {
            isApplyingRemoteUpdateRef.current = false;
          }, 150);
        }
      },
      (err) => {
        console.warn('Real-time sync listener notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionEmail, profile.email, isAuthenticated]);

  // Handle mobile and tablet wake-up / tab return to ensure instant state sync
  useEffect(() => {
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        const targetEmail = sessionEmail || profile.email;
        if (!targetEmail) return;
        const docId = getEmailDocId(targetEmail);
        getDoc(doc(db, 'users', docId))
          .then((snap) => {
            if (snap.exists()) {
              const data = snap.data();
              if (!data) return;
              if (data.updatedBy === syncClientIdRef.current) {
                return;
              }

              isApplyingRemoteUpdateRef.current = true;
              if (Array.isArray(data.courses)) setCourses(data.courses);
              if (Array.isArray(data.studyLogs)) setStudyLogs(data.studyLogs);
              if (Array.isArray(data.assignments)) setAssignments(data.assignments);
              if (typeof data.quickNotes === 'string') setQuickNotes(data.quickNotes);
              if (typeof data.checklist === 'string') setChecklist(data.checklist);
              if (Array.isArray(data.resourceLinks)) {
                setResourceLinks(
                  data.resourceLinks.filter(
                    (r: ResourceLink) =>
                      !['res-1', 'res-2', 'res-3', 'res-4'].includes(r.id) &&
                      !r.url?.includes('unirand.it')
                  )
                );
              }
              setTimeout(() => {
                isApplyingRemoteUpdateRef.current = false;
              }, 150);
            }
          })
          .catch((err) => console.warn('Wake-up catchup sync notice:', err));
      }
    };

    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
    };
  }, [sessionEmail, profile.email, isAuthenticated]);

  // Ensure target CFU is synced to 180 if current session is set to legacy 120
  useEffect(() => {
    if (
      profile.totalTargetCFU === 120 &&
      (!profile.degreeType ||
        profile.degreeType.includes('Triennale') ||
        profile.degreeName?.includes('Computer Science') ||
        profile.degreeName?.includes('B.Sc'))
    ) {
      setProfile((prev) => ({
        ...prev,
        totalTargetCFU: 180,
      }));
    }
  }, [profile.totalTargetCFU, profile.degreeType, profile.degreeName]);

  const handleLoginSuccess = (
    newProfile: StudentProfile,
    cloudData?: {
      courses?: Course[];
      studyLogs?: StudyLog[];
      assignments?: AssignmentItem[];
      quickNotes?: string;
      checklist?: string;
      resourceLinks?: ResourceLink[];
    }
  ) => {
    const email = newProfile.email?.toLowerCase().trim() || null;
    if (email) {
      setSessionEmail(email);
      try {
        localStorage.setItem(`${STORAGE_KEY}_session_email`, email);
      } catch {}
    }
    setProfile(newProfile);
    if (cloudData) {
      if (Array.isArray(cloudData.courses)) setCourses(cloudData.courses);
      if (Array.isArray(cloudData.studyLogs)) setStudyLogs(cloudData.studyLogs);
      if (Array.isArray(cloudData.assignments)) setAssignments(cloudData.assignments);
      if (typeof cloudData.quickNotes === 'string') setQuickNotes(cloudData.quickNotes);
      if (typeof cloudData.checklist === 'string') setChecklist(cloudData.checklist);
      if (Array.isArray(cloudData.resourceLinks)) setResourceLinks(cloudData.resourceLinks);
    }
    if (newProfile.activeSquadId || newProfile.squadIds) {
      setProfile((prev) => ({
        ...prev,
        activeSquadId: newProfile.activeSquadId || prev.activeSquadId,
        squadIds: newProfile.squadIds || prev.squadIds,
      }));
    }
    setIsAuthenticated(true);
    try {
      localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(newProfile));
      if (cloudData?.courses) localStorage.setItem(`${STORAGE_KEY}_courses`, JSON.stringify(cloudData.courses));
      if (cloudData?.studyLogs) localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(cloudData.studyLogs));
      if (cloudData?.assignments) localStorage.setItem(`${STORAGE_KEY}_assignments`, JSON.stringify(cloudData.assignments));
      if (typeof cloudData?.quickNotes === 'string') localStorage.setItem(`${STORAGE_KEY}_quick_notes`, cloudData.quickNotes);
      if (typeof cloudData?.checklist === 'string') localStorage.setItem(`${STORAGE_KEY}_checklist`, cloudData.checklist);
      if (Array.isArray(cloudData?.resourceLinks)) localStorage.setItem(`${STORAGE_KEY}_resource_links`, JSON.stringify(cloudData.resourceLinks));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
    setStatusMessage(`Authenticated as ${newProfile.name}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out notice', e);
    }
    try {
      localStorage.removeItem(`${STORAGE_KEY}_session_email`);
    } catch {}
    setSessionEmail(null);
    setIsAuthenticated(false);
    setStatusMessage('Session terminated');
  };

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(profile));
      localStorage.setItem(`${STORAGE_KEY}_courses`, JSON.stringify(courses));
      localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(studyLogs));
      localStorage.setItem(`${STORAGE_KEY}_assignments`, JSON.stringify(assignments));
      localStorage.setItem(`${STORAGE_KEY}_quick_notes`, quickNotes);
      localStorage.setItem(`${STORAGE_KEY}_checklist`, checklist);
      localStorage.setItem(`${STORAGE_KEY}_resource_links`, JSON.stringify(resourceLinks));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [profile, courses, studyLogs, assignments, quickNotes, checklist, resourceLinks]);

  // Fast direct push helper to broadcast changes to Firestore instantly
  const pushWorkstationToCloud = async (overrides?: {
    courses?: Course[];
    studyLogs?: StudyLog[];
    assignments?: AssignmentItem[];
    quickNotes?: string;
    checklist?: string;
    resourceLinks?: ResourceLink[];
    profile?: StudentProfile;
  }) => {
    const targetEmail = sessionEmail || profile.email;
    if (!isAuthenticated || !targetEmail) return;

    const docId = getEmailDocId(targetEmail);

    const currentProfile = overrides?.profile || profile;
    const currentCourses = overrides?.courses || courses;
    const currentStudyLogs = overrides?.studyLogs || studyLogs;
    const currentAssignments = overrides?.assignments || assignments;
    const currentQuickNotes = overrides?.quickNotes !== undefined ? overrides.quickNotes : quickNotes;
    const currentChecklist = overrides?.checklist !== undefined ? overrides.checklist : checklist;
    const currentResourceLinks = overrides?.resourceLinks || resourceLinks;

    try {
      const userRef = doc(db, 'users', docId);
      await setDoc(
        userRef,
        {
          name: currentProfile.name,
          studentId: currentProfile.studentId,
          email: targetEmail.toLowerCase().trim(),
          degreeLevel: currentProfile.degreeLevel,
          degreeName: currentProfile.degreeName,
          degreeType: currentProfile.degreeType,
          totalTargetCFU: currentProfile.totalTargetCFU,
          enrolledYear: currentProfile.enrolledYear,
          academicYear: currentProfile.academicYear,
          institution: currentProfile.institution,
          status: currentProfile.status,
          currentSession: currentProfile.currentSession,
          weeklyGoalHours: currentProfile.weeklyGoalHours,
          avatarUrl: currentProfile.avatarUrl,
          logoUrl: currentProfile.logoUrl,
          thesisPointsExpected: currentProfile.thesisPointsExpected,
          courses: currentCourses,
          studyLogs: currentStudyLogs,
          assignments: currentAssignments,
          quickNotes: currentQuickNotes,
          checklist: currentChecklist,
          resourceLinks: currentResourceLinks,
          activeSquadId: currentProfile.activeSquadId || null,
          squadIds: currentProfile.squadIds || [],
          xp: currentProfile.xp ?? 0,
          currentStreak: currentProfile.currentStreak ?? 0,
          minutesStudiedThisWeek: currentProfile.minutesStudiedThisWeek ?? 0,
          tasksCompletedThisWeek: currentProfile.tasksCompletedThisWeek ?? 0,
          lastActiveDate: currentProfile.lastActiveDate ?? null,
          updatedAt: Date.now(),
          updatedBy: syncClientIdRef.current,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Multi-device cloud sync notice', err);
    }
  };

  // Synchronize student workstation changes to Firestore (safety net for quickNotes and checklist typing)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isApplyingRemoteUpdateRef.current) return;
    if (!hasInitialServerSnapshotRef.current) return;
    const targetEmail = sessionEmail || profile.email;
    if (!targetEmail) return;

    const timer = setTimeout(() => {
      pushWorkstationToCloud();
    }, 200);

    return () => clearTimeout(timer);
  }, [isAuthenticated, sessionEmail, profile, courses, studyLogs, assignments, quickNotes, checklist, resourceLinks]);

  // Modal & Overlay Dismissal Stack for Escape
  const handleEscape = () => {
    if (inspectCourse) {
      setInspectCourse(null);
      return;
    }
    if (showNewCourseModal) {
      setShowNewCourseModal(false);
      return;
    }
    if (showNewAssignmentModal) {
      setShowNewAssignmentModal(false);
      return;
    }
    if (showQuickStudyModal) {
      setShowQuickStudyModal(false);
      return;
    }
    if (showExportModal) {
      setShowExportModal(false);
      return;
    }
    if (showEmailGroupModal) {
      setShowEmailGroupModal(false);
      return;
    }
    if (showColumnsModal) {
      setShowColumnsModal(false);
      return;
    }
    if (mobileDrawerOpen) {
      setMobileDrawerOpen(false);
      return;
    }
    if (currentView === 'shortcuts') {
      setCurrentView('dashboard');
      return;
    }
  };

  const handleSaveSync = () => {
    const formSubmitBtn = document.querySelector<HTMLButtonElement>('form button[type="submit"]');
    if (formSubmitBtn) {
      formSubmitBtn.click();
    } else {
      pushWorkstationToCloud();
      setStatusMessage('Workspace state synchronized');
      setTimeout(() => setStatusMessage('Ready'), 2000);
    }
  };

  const handleFocusSearch = () => {
    const searchInput = document.querySelector<HTMLInputElement>('header input[role="combobox"]');
    if (searchInput) {
      searchInput.focus();
    }
  };

  const hasOpenModal = Boolean(
    inspectCourse ||
    showNewCourseModal ||
    showNewAssignmentModal ||
    showQuickStudyModal ||
    showEmailGroupModal ||
    showColumnsModal ||
    showExportModal ||
    mobileDrawerOpen
  );

  // Global Keyboard Shortcuts Suite
  useKeyboardShortcuts({
    currentView,
    onNavigate: (view) => {
      setCurrentView(view);
      setMobileDrawerOpen(false);
    },
    onOpenNewCourse: () => setShowNewCourseModal(true),
    onOpenNewAssignment: () => setShowNewAssignmentModal(true),
    onOpenQuickStudy: () => setShowQuickStudyModal(true),
    onOpenExport: () => setShowExportModal(true),
    onSaveSync: handleSaveSync,
    onToggleTheme: handleToggleTheme,
    onFocusSearch: handleFocusSearch,
    onEscape: handleEscape,
    onNotify: (msg) => {
      setStatusMessage(msg);
      setTimeout(() => setStatusMessage('Ready'), 2500);
    },
    hasOpenModal,
  });

  // Actions
  const handleAddStudyLog = (logData: Omit<StudyLog, 'id' | 'timestamp'>) => {
    const newLog: StudyLog = {
      ...logData,
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
    };
    const nextLogs = [newLog, ...studyLogs];
    setStudyLogs(nextLogs);

    // Academic Telemetry: XP & Streak progression
    const xpGained = Math.max(20, Math.round(logData.durationMinutes * 2));
    const { streak, today } = updateStreak(profile.currentStreak || 0, profile.lastActiveDate);

    const nextProfile: StudentProfile = {
      ...profile,
      xp: (profile.xp || 0) + xpGained,
      currentStreak: streak,
      minutesStudiedThisWeek: (profile.minutesStudiedThisWeek || 0) + logData.durationMinutes,
      lastActiveDate: today,
    };
    setProfile(nextProfile);

    // Immediate multi-device cloud push
    pushWorkstationToCloud({ studyLogs: nextLogs, profile: nextProfile });

    setStatusMessage(`Saved Study Record: ${logData.courseName} (+${xpGained} XP)`);
    setTimeout(() => setStatusMessage('Ready'), 3000);
  };

  const handleDeleteStudyLog = (id: string) => {
    const nextLogs = studyLogs.filter((l) => l.id !== id);
    setStudyLogs(nextLogs);
    pushWorkstationToCloud({ studyLogs: nextLogs });
    setStatusMessage('Deleted Study Record');
    setTimeout(() => setStatusMessage('Ready'), 2000);
  };

  const handleUpdateCourse = (updated: Course) => {
    const nextCourses = courses.map((c) => (c.id === updated.id ? updated : c));
    setCourses(nextCourses);
    pushWorkstationToCloud({ courses: nextCourses });
    setStatusMessage(`Updated Course: ${updated.title}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleDeleteCourse = (courseId: string) => {
    const target = courses.find((c) => c.id === courseId);
    const nextCourses = courses.filter((c) => c.id !== courseId);
    setCourses(nextCourses);
    setInspectCourse(null);
    pushWorkstationToCloud({ courses: nextCourses });
    setStatusMessage(`Deleted Course: ${target?.title || courseId}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleAddCourse = (newCourse: Course) => {
    const nextCourses = [newCourse, ...courses];
    setCourses(nextCourses);
    pushWorkstationToCloud({ courses: nextCourses });
    setStatusMessage(`Added Course: ${newCourse.title}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleAddAssignment = (asgData: Omit<AssignmentItem, 'id'>) => {
    const newAsg: AssignmentItem = {
      ...asgData,
      id: `asg-${Date.now()}`,
    };
    const nextAssignments = [newAsg, ...assignments];
    setAssignments(nextAssignments);
    pushWorkstationToCloud({ assignments: nextAssignments });
    setStatusMessage(`Added Exam/Assignment: ${asgData.title}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleUpdateAssignmentStatus = (
    id: string,
    status: AssignmentItem['status']
  ) => {
    const existing = assignments.find((a) => a.id === id);
    const isNowCompleted = status === 'completed' && existing?.status !== 'completed';

    const nextAssignments = assignments.map((a) =>
      a.id === id ? { ...a, status, completedAt: status === 'completed' ? Date.now() : a.completedAt } : a
    );
    setAssignments(nextAssignments);

    let nextProfile = profile;
    if (isNowCompleted) {
      const { streak, today } = updateStreak(profile.currentStreak || 0, profile.lastActiveDate);
      nextProfile = {
        ...profile,
        xp: (profile.xp || 0) + 25,
        tasksCompletedThisWeek: (profile.tasksCompletedThisWeek || 0) + 1,
        currentStreak: streak,
        lastActiveDate: today,
      };
      setProfile(nextProfile);
      setStatusMessage('Task Completed (+25 XP)');
      setTimeout(() => setStatusMessage('Ready'), 2500);
    }

    pushWorkstationToCloud({ assignments: nextAssignments, profile: nextProfile });
  };

  const handleDeleteAssignment = (id: string) => {
    const nextAssignments = assignments.filter((a) => a.id !== id);
    setAssignments(nextAssignments);
    pushWorkstationToCloud({ assignments: nextAssignments });
  };

  const handleUpdateAssignment = (updated: AssignmentItem) => {
    const nextAssignments = assignments.map((assignment) =>
      assignment.id === updated.id ? updated : assignment
    );
    setAssignments(nextAssignments);
    pushWorkstationToCloud({ assignments: nextAssignments });
  };

  const handleUpdateResources = (updated: ResourceLink[]) => {
    setResourceLinks(updated);
    pushWorkstationToCloud({ resourceLinks: updated });
  };

  const handleUpdateProfile = (
    updater: StudentProfile | ((prev: StudentProfile) => StudentProfile)
  ) => {
    setProfile((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pushWorkstationToCloud({ profile: next });
      return next;
    });
  };

  const handleResetData = () => {
    setProfile(INITIAL_PROFILE);
    setCourses([]);
    setStudyLogs([]);
    setAssignments([]);
    setQuickNotes('');
    setChecklist('');
    setResourceLinks([]);
    try {
      localStorage.removeItem(`${STORAGE_KEY}_profile`);
      localStorage.removeItem(`${STORAGE_KEY}_courses`);
      localStorage.removeItem(`${STORAGE_KEY}_logs`);
      localStorage.removeItem(`${STORAGE_KEY}_assignments`);
      localStorage.removeItem(`${STORAGE_KEY}_quick_notes`);
      localStorage.removeItem(`${STORAGE_KEY}_checklist`);
      localStorage.removeItem(`${STORAGE_KEY}_resource_links`);
    } catch {}
    pushWorkstationToCloud({
      profile: INITIAL_PROFILE,
      courses: [],
      studyLogs: [],
      assignments: [],
      quickNotes: '',
      checklist: '',
      resourceLinks: [],
    });
    setStatusMessage('Data Cleared');
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleExportJson = () => {
    const fullState = {
      profile,
      courses,
      studyLogs,
      assignments,
      quickNotes,
      checklist,
      resourceLinks,
      exportTimestamp: new Date().toISOString(),
      version: '2.4.0',
    };
    const blob = new Blob([JSON.stringify(fullState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unisphere-workstation-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.profile) setProfile(parsed.profile);
      if (parsed.courses) setCourses(parsed.courses);
      if (parsed.studyLogs) setStudyLogs(parsed.studyLogs);
      if (parsed.assignments) setAssignments(parsed.assignments);
      if (typeof parsed.quickNotes === 'string') setQuickNotes(parsed.quickNotes);
      if (typeof parsed.checklist === 'string') setChecklist(parsed.checklist);
      if (Array.isArray(parsed.resourceLinks)) setResourceLinks(parsed.resourceLinks);
      pushWorkstationToCloud({
        profile: parsed.profile,
        courses: parsed.courses,
        studyLogs: parsed.studyLogs,
        assignments: parsed.assignments,
        quickNotes: parsed.quickNotes,
        checklist: parsed.checklist,
        resourceLinks: parsed.resourceLinks,
      });
      setStatusMessage('Workstation Restored from JSON');
    } catch (e) {
      alert('Failed to parse backup JSON file.');
    }
  };

  const earnedCFU = courses
    .filter((c) => c.status === 'completed')
    .reduce((sum, c) => sum + c.cfu, 0);

  if (!isAuthenticated) {
    return (
      <AuthView
        onLoginSuccess={handleLoginSuccess}
        defaultEmail={profile.email}
        isDark={theme === 'dark'}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return (
    <div className="font-sans text-xs select-none antialiased min-h-screen flex flex-col h-[100dvh] overflow-hidden bg-[#fdf9f4] dark:bg-[#09090b] text-[#2d2f34] dark:text-zinc-100 transition-colors">
      {/* Quick Toolbar */}
      <QuickToolbar
        profile={profile}
        earnedCFU={earnedCFU}
        courses={courses}
        assignments={assignments}
        studyLogs={studyLogs}
        onSelectCourse={setInspectCourse}
        onNavigate={setCurrentView}
        onNewSession={() => setCurrentView('dashboard')}
        onExport={() => setShowExportModal(true)}
        onSignOut={handleSignOut}
        onToggleMobileMenu={() => setMobileDrawerOpen((prev) => !prev)}
        isDark={theme === 'dark'}
        onToggleTheme={handleToggleTheme}
      />

      {/* 3. Main Split View: Sidebar + Active Canvas */}
      <div className="flex-1 flex overflow-hidden relative bg-[#fdf9f4] dark:bg-[#09090b]">
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          profile={profile}
          earnedCFU={earnedCFU}
          onSignOut={handleSignOut}
          mobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
        />

        {currentView === 'dashboard' && (
          <DashboardView
            profile={profile}
            courses={courses}
            assignments={assignments}
            studyLogs={studyLogs}
            quickNotes={quickNotes}
            onUpdateQuickNotes={setQuickNotes}
            checklist={checklist}
            onUpdateChecklist={setChecklist}
            resources={resourceLinks}
            onUpdateResources={handleUpdateResources}
            onAddStudyLog={handleAddStudyLog}
            onDeleteStudyLog={handleDeleteStudyLog}
            onOpenCourseDetail={setInspectCourse}
            onOpenColumnsModal={() => setShowColumnsModal(true)}
            onOpenEmailGroup={() => setShowEmailGroupModal(true)}
            onNavigateToCurriculum={() => setCurrentView('courses-and-curriculum')}
            onNavigateToStudyTracker={() => setCurrentView('study-session-tracker')}
            onOpenNewCourse={() => setShowNewCourseModal(true)}
            onUpdateCourse={handleUpdateCourse}
            onDeleteCourse={handleDeleteCourse}
            onAddAssignment={handleAddAssignment}
            onNavigateToAssignments={() => setCurrentView('assignments-and-exams')}
            onUpdateAssignmentStatus={handleUpdateAssignmentStatus}
          />
        )}

        {currentView === 'courses-and-curriculum' && (
          <CurriculumView
            courses={courses}
            profile={profile}
            onOpenCourseDetail={setInspectCourse}
            onOpenNewCourse={() => setShowNewCourseModal(true)}
            onUpdateCourse={handleUpdateCourse}
            onDeleteCourse={handleDeleteCourse}
          />
        )}

        {currentView === 'study-session-tracker' && (
          <StudyTrackerView
            studyLogs={studyLogs}
            courses={courses}
            onAddStudyLog={handleAddStudyLog}
            onDeleteStudyLog={handleDeleteStudyLog}
            onExportCsv={() => setShowExportModal(true)}
          />
        )}

        {currentView === 'assignments-and-exams' && (
          <AssignmentsView
            assignments={assignments}
            courses={courses}
            onAddAssignment={handleAddAssignment}
            onUpdateAssignmentStatus={handleUpdateAssignmentStatus}
            onUpdateAssignment={handleUpdateAssignment}
            onDeleteAssignment={handleDeleteAssignment}
          />
        )}

        {currentView === 'squads' && (
          <SquadsView
            profile={profile}
            courses={courses}
            studyLogs={studyLogs}
            assignments={assignments}
            onAddStudyLog={handleAddStudyLog}
            onUpdateProfileTelemetry={(telemetry) => {
              handleUpdateProfile((prev) => ({ ...prev, ...telemetry }));
            }}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onResetData={handleResetData}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onSignOut={handleSignOut}
            isDark={theme === 'dark'}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {currentView === 'shortcuts' && (
          <ShortcutsView onNavigate={setCurrentView} />
        )}
      </div>

      {/* 5. Modals & Dialogs */}
      {inspectCourse && (
        <CourseDetailModal
          course={inspectCourse}
          onClose={() => setInspectCourse(null)}
          onSave={handleUpdateCourse}
          onDelete={handleDeleteCourse}
        />
      )}

      {showNewCourseModal && (
        <NewCourseModal
          onClose={() => setShowNewCourseModal(false)}
          onAdd={handleAddCourse}
        />
      )}

      {showNewAssignmentModal && (
        <NewAssignmentModal
          courses={courses}
          onClose={() => setShowNewAssignmentModal(false)}
          onAdd={handleAddAssignment}
        />
      )}

      {showQuickStudyModal && (
        <QuickStudyModal
          courses={courses}
          isOpen={showQuickStudyModal}
          onClose={() => setShowQuickStudyModal(false)}
          onAddStudyLog={handleAddStudyLog}
          onSuccessNotification={(msg) => {
            setStatusMessage(msg);
            setTimeout(() => setStatusMessage('Ready'), 3000);
          }}
        />
      )}

      {showEmailGroupModal && (
        <EmailGroupModal
          courses={courses}
          onClose={() => setShowEmailGroupModal(false)}
        />
      )}

      {showColumnsModal && (
        <ColumnsModal onClose={() => setShowColumnsModal(false)} />
      )}

      {showExportModal && (
        <ExportModal
          studyLogs={studyLogs}
          courses={courses}
          onClose={() => setShowExportModal(false)}
          onExportJson={handleExportJson}
        />
      )}

      {/* Floating Status Notification Pill */}
      {statusMessage && statusMessage !== 'Ready' && (
        <div className="fixed bottom-3 right-3 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 text-xs px-3 py-1.5 rounded-md shadow-lg border border-zinc-700/50 dark:border-zinc-300 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] animate-pulse" />
            <span>{statusMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
