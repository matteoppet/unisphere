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
  INITIAL_PROFILE,
  INITIAL_COURSES,
  INITIAL_STUDY_LOGS,
  INITIAL_ASSIGNMENTS,
} from './types';
import { playClickBeep } from './utils/audio';
import { auth, db } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  EmailGroupModal,
  ColumnsModal,
  ExportModal,
} from './components/Modals';

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

  // --- Navigation ---
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // --- Status Message ---
  const [statusMessage, setStatusMessage] = useState<string>('Ready');

  // --- Theme State (Dark Mode following ObsidianUI) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_theme`);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark'; // Always default to dark Obsidian theme as requested
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
  const [showEmailGroupModal, setShowEmailGroupModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // --- Authentication Session State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(`${STORAGE_KEY}_session_email`));
    } catch {
      return false;
    }
  });

  // Restore & sync session from Firestore on startup
  useEffect(() => {
    let activeEmail: string | null = null;
    try {
      activeEmail = localStorage.getItem(`${STORAGE_KEY}_session_email`);
    } catch {}

    if (activeEmail) {
      setIsAuthenticated(true);
      const docId = activeEmail.trim().toLowerCase().replace(/\//g, '_');
      getDoc(doc(db, 'users', docId))
        .then((userSnap) => {
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data) {
              setProfile((prev) => ({
                ...prev,
                name: data.name || prev.name,
                studentId: data.studentId || prev.studentId,
                email: data.email || prev.email,
                degreeLevel: data.degreeLevel || prev.degreeLevel,
                degreeName: data.degreeName || prev.degreeName,
                degreeType: data.degreeType || prev.degreeType,
                totalTargetCFU: data.totalTargetCFU || prev.totalTargetCFU,
                enrolledYear: data.enrolledYear || prev.enrolledYear,
                academicYear: data.academicYear || prev.academicYear,
                institution: data.institution || prev.institution,
                status: data.status || prev.status,
                activeSquadId: data.activeSquadId || prev.activeSquadId,
                squadIds: Array.isArray(data.squadIds) ? data.squadIds : prev.squadIds,
              }));
              if (Array.isArray(data.courses)) setCourses(data.courses);
              if (Array.isArray(data.studyLogs)) setStudyLogs(data.studyLogs);
              if (Array.isArray(data.assignments)) setAssignments(data.assignments);
              if (typeof data.quickNotes === 'string') setQuickNotes(data.quickNotes);
            }
          }
        })
        .catch((err) => {
          console.warn('Initial multi-device sync notice', err);
        });
    }
  }, []);

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
    }
  ) => {
    setProfile(newProfile);
    if (cloudData) {
      if (Array.isArray(cloudData.courses)) setCourses(cloudData.courses);
      if (Array.isArray(cloudData.studyLogs)) setStudyLogs(cloudData.studyLogs);
      if (Array.isArray(cloudData.assignments)) setAssignments(cloudData.assignments);
      if (typeof cloudData.quickNotes === 'string') setQuickNotes(cloudData.quickNotes);
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
      if (newProfile.email) {
        localStorage.setItem(`${STORAGE_KEY}_session_email`, newProfile.email.toLowerCase().trim());
      }
      localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(newProfile));
      if (cloudData?.courses) localStorage.setItem(`${STORAGE_KEY}_courses`, JSON.stringify(cloudData.courses));
      if (cloudData?.studyLogs) localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(cloudData.studyLogs));
      if (cloudData?.assignments) localStorage.setItem(`${STORAGE_KEY}_assignments`, JSON.stringify(cloudData.assignments));
      if (typeof cloudData?.quickNotes === 'string') localStorage.setItem(`${STORAGE_KEY}_quick_notes`, cloudData.quickNotes);
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
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [profile, courses, studyLogs, assignments, quickNotes]);

  // Synchronize student workstation changes to Firestore for multi-device sync
  useEffect(() => {
    if (!isAuthenticated || !profile.email) return;
    const currentEmail = profile.email;

    const timer = setTimeout(async () => {
      try {
        const docId = currentEmail.toLowerCase().trim().replace(/\//g, '_');
        const userRef = doc(db, 'users', docId);
        await setDoc(
          userRef,
          {
            name: profile.name,
            studentId: profile.studentId,
            email: currentEmail.toLowerCase().trim(),
            degreeLevel: profile.degreeLevel,
            degreeName: profile.degreeName,
            degreeType: profile.degreeType,
            totalTargetCFU: profile.totalTargetCFU,
            enrolledYear: profile.enrolledYear,
            academicYear: profile.academicYear,
            institution: profile.institution,
            status: profile.status,
            courses,
            studyLogs,
            assignments,
            quickNotes,
            activeSquadId: profile.activeSquadId || null,
            squadIds: profile.squadIds || [],
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Multi-device cloud sync notice', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, profile, courses, studyLogs, assignments, quickNotes]);

  // Keyboard Shortcuts: Ctrl+S / Ctrl+E / Ctrl+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowExportModal(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCurrentView('dashboard');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // If there's an active study form submit button, click it
        const formSubmitBtn = document.querySelector<HTMLButtonElement>('form button[type="submit"]');
        if (formSubmitBtn) {
          formSubmitBtn.click();
        } else {
          setStatusMessage('Workspace state synchronized (Ctrl+S)');
          setTimeout(() => setStatusMessage('Ready'), 2000);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actions
  const handleAddStudyLog = (logData: Omit<StudyLog, 'id' | 'timestamp'>) => {
    const newLog: StudyLog = {
      ...logData,
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
    };
    setStudyLogs((prev) => [newLog, ...prev]);

    // Academic Telemetry: XP & Streak progression
    const xpGained = Math.max(20, Math.round(logData.durationMinutes * 2));
    const { streak, today } = updateStreak(profile.currentStreak || 0, profile.lastActiveDate);

    setProfile((prev) => ({
      ...prev,
      xp: (prev.xp || 0) + xpGained,
      currentStreak: streak,
      minutesStudiedThisWeek: (prev.minutesStudiedThisWeek || 0) + logData.durationMinutes,
      lastActiveDate: today,
    }));

    setStatusMessage(`Saved Study Record: ${logData.courseName} (+${xpGained} XP)`);
    setTimeout(() => setStatusMessage('Ready'), 3000);
  };

  const handleDeleteStudyLog = (id: string) => {
    setStudyLogs((prev) => prev.filter((l) => l.id !== id));
    setStatusMessage('Deleted Study Record');
    setTimeout(() => setStatusMessage('Ready'), 2000);
  };

  const handleUpdateCourse = (updated: Course) => {
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setStatusMessage(`Updated Course: ${updated.title}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleDeleteCourse = (courseId: string) => {
    const target = courses.find((c) => c.id === courseId);
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    setInspectCourse(null);
    setStatusMessage(`Deleted Course: ${target?.title || courseId}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleAddCourse = (newCourse: Course) => {
    setCourses((prev) => [newCourse, ...prev]);
    setStatusMessage(`Added Course: ${newCourse.title}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleAddAssignment = (asgData: Omit<AssignmentItem, 'id'>) => {
    const newAsg: AssignmentItem = {
      ...asgData,
      id: `asg-${Date.now()}`,
    };
    setAssignments((prev) => [newAsg, ...prev]);
    setStatusMessage(`Added Exam/Assignment: ${asgData.title}`);
    setTimeout(() => setStatusMessage('Ready'), 2500);
  };

  const handleUpdateAssignmentStatus = (
    id: string,
    status: AssignmentItem['status']
  ) => {
    const existing = assignments.find((a) => a.id === id);
    const isNowCompleted = status === 'completed' && existing?.status !== 'completed';

    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status, completedAt: status === 'completed' ? Date.now() : a.completedAt } : a))
    );

    if (isNowCompleted) {
      const { streak, today } = updateStreak(profile.currentStreak || 0, profile.lastActiveDate);
      setProfile((prev) => ({
        ...prev,
        xp: (prev.xp || 0) + 25,
        tasksCompletedThisWeek: (prev.tasksCompletedThisWeek || 0) + 1,
        currentStreak: streak,
        lastActiveDate: today,
      }));
      setStatusMessage('Task Completed (+25 XP)');
      setTimeout(() => setStatusMessage('Ready'), 2500);
    }
  };

  const handleDeleteAssignment = (id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };


  const handleResetData = () => {
    setProfile(INITIAL_PROFILE);
    setCourses([]);
    setStudyLogs([]);
    setAssignments([]);
    setQuickNotes('');
    try {
      localStorage.removeItem(`${STORAGE_KEY}_profile`);
      localStorage.removeItem(`${STORAGE_KEY}_courses`);
      localStorage.removeItem(`${STORAGE_KEY}_logs`);
      localStorage.removeItem(`${STORAGE_KEY}_assignments`);
      localStorage.removeItem(`${STORAGE_KEY}_quick_notes`);
    } catch {}
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
    <div className="font-sans text-xs select-none antialiased min-h-screen flex flex-col h-[100dvh] overflow-hidden bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
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
      <div className="flex-1 flex overflow-hidden relative bg-gray-50 dark:bg-zinc-950">
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
            onAddStudyLog={handleAddStudyLog}
            onOpenCourseDetail={setInspectCourse}
            onOpenColumnsModal={() => setShowColumnsModal(true)}
            onOpenEmailGroup={() => setShowEmailGroupModal(true)}
            onNavigateToCurriculum={() => setCurrentView('courses-and-curriculum')}
            onOpenNewCourse={() => setShowNewCourseModal(true)}
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
              setProfile((prev) => ({ ...prev, ...telemetry }));
            }}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            profile={profile}
            onUpdateProfile={setProfile}
            onResetData={handleResetData}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onSignOut={handleSignOut}
            isDark={theme === 'dark'}
            onToggleTheme={handleToggleTheme}
          />
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
    </div>
  );
}
