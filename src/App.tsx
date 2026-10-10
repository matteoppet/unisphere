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
} from './types';
import {
  INITIAL_PROFILE,
  INITIAL_COURSES,
  INITIAL_STUDY_LOGS,
  INITIAL_ASSIGNMENTS,
} from './mockData';
import { playClickBeep } from './utils/audio';
import { auth } from './lib/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';

import { QuickToolbar } from './components/QuickToolbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CurriculumView } from './components/CurriculumView';
import { StudyTrackerView } from './components/StudyTrackerView';
import { AssignmentsView } from './components/AssignmentsView';
import { SettingsView } from './components/SettingsView';
import { AuthView } from './components/AuthView';
import {
  CourseDetailModal,
  NewCourseModal,
  EmailGroupModal,
  ColumnsModal,
  ExportModal,
} from './components/Modals';

const STORAGE_KEY = 'alma_academic_suite_v24';

export default function App() {
  // --- Persistent Workstation State ---
  const [profile, setProfile] = useState<StudentProfile>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_profile`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.totalTargetCFU === 120 &&
          (!parsed.degreeType ||
            parsed.degreeType.includes('Triennale') ||
            parsed.degreeName?.includes('Computer Science') ||
            parsed.degreeName?.includes('B.Sc'))
        ) {
          parsed.totalTargetCFU = 180;
        }
        return parsed;
      }
      return INITIAL_PROFILE;
    } catch {
      return INITIAL_PROFILE;
    }
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_courses`);
      return saved ? JSON.parse(saved) : INITIAL_COURSES;
    } catch {
      return INITIAL_COURSES;
    }
  });

  const [studyLogs, setStudyLogs] = useState<StudyLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
      return saved ? JSON.parse(saved) : INITIAL_STUDY_LOGS;
    } catch {
      return INITIAL_STUDY_LOGS;
    }
  });

  const [assignments, setAssignments] = useState<AssignmentItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_assignments`);
      return saved ? JSON.parse(saved) : INITIAL_ASSIGNMENTS;
    } catch {
      return INITIAL_ASSIGNMENTS;
    }
  });

  const [quickNotes, setQuickNotes] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_quick_notes`);
      if (saved !== null) return saved;
    } catch {}
    return (
      "• [ ] Office hours with Prof. Bianchi (15:30, Room 2.4 - review Ch. 4 proof)\n" +
      "• [ ] Submit Distributed Systems lab benchmark before 23:59\n" +
      "• [ ] Return reserve monograph 'Database Internals' to Central Library\n" +
      "• [ ] Verify AY 2024/25 study plan submission deadline"
    );
  });

  // --- Navigation ---
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // --- Status Message ---
  const [statusMessage, setStatusMessage] = useState<string>('Ready');

  // Clean up any lingering dark theme class or storage to restore original theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    try {
      localStorage.removeItem(`${STORAGE_KEY}_theme`);
    } catch {}
  }, []);

  // --- Modals State ---
  const [inspectCourse, setInspectCourse] = useState<Course | null>(null);
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [showEmailGroupModal, setShowEmailGroupModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // --- Authentication Session State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_auth_session`);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Sync Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        localStorage.setItem(`${STORAGE_KEY}_auth_session`, 'true');
      }
    });
    return () => unsubscribe();
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

  const handleLoginSuccess = (newProfile: StudentProfile) => {
    setProfile(newProfile);
    setIsAuthenticated(true);
    try {
      localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(newProfile));
      localStorage.setItem(`${STORAGE_KEY}_auth_session`, 'true');
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
    setIsAuthenticated(false);
    try {
      localStorage.setItem(`${STORAGE_KEY}_auth_session`, 'false');
    } catch (e) {
      console.warn('Storage sync error', e);
    }
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
    setStatusMessage(`Saved Study Record: ${logData.courseName}`);
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
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const handleDeleteAssignment = (id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleRefresh = () => {
    playClickBeep();
    setStatusMessage(
      `Synchronized Telemetry at ${new Date().toLocaleTimeString()}`
    );
    setTimeout(() => setStatusMessage('Ready'), 3000);
  };

  const handleResetData = () => {
    setProfile(INITIAL_PROFILE);
    setCourses(INITIAL_COURSES);
    setStudyLogs(INITIAL_STUDY_LOGS);
    setAssignments(INITIAL_ASSIGNMENTS);
    setQuickNotes(
      "• [ ] Office hours with Prof. Bianchi (15:30, Room 2.4 - review Ch. 4 proof)\n" +
      "• [ ] Submit Distributed Systems lab benchmark before 23:59\n" +
      "• [ ] Return reserve monograph 'Database Internals' to Central Library\n" +
      "• [ ] Verify AY 2024/25 study plan submission deadline"
    );
    setStatusMessage('Demo Data Restored');
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
      />
    );
  }

  return (
    <div className="font-sans text-xs select-none antialiased min-h-screen flex flex-col h-[100dvh] overflow-hidden bg-gray-50 text-slate-900">
      {/* Quick Toolbar */}
      <QuickToolbar
        profile={profile}
        earnedCFU={earnedCFU}
        onRefresh={handleRefresh}
        onNewSession={() => setCurrentView('dashboard')}
        onExport={() => setShowExportModal(true)}
        onSignOut={handleSignOut}
        onToggleMobileMenu={() => setMobileDrawerOpen((prev) => !prev)}
      />

      {/* 3. Main Split View: Sidebar + Active Canvas */}
      <div className="flex-1 flex overflow-hidden relative bg-gray-50">
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
            studyLogs={studyLogs}
            quickNotes={quickNotes}
            onUpdateQuickNotes={setQuickNotes}
            onAddStudyLog={handleAddStudyLog}
            onOpenCourseDetail={setInspectCourse}
            onOpenColumnsModal={() => setShowColumnsModal(true)}
            onOpenEmailGroup={() => setShowEmailGroupModal(true)}
            onNavigateToCurriculum={() => setCurrentView('courses-and-curriculum')}
          />
        )}

        {currentView === 'courses-and-curriculum' && (
          <CurriculumView
            courses={courses}
            profile={profile}
            onOpenCourseDetail={setInspectCourse}
            onOpenNewCourse={() => setShowNewCourseModal(true)}
            onUpdateCourse={handleUpdateCourse}
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

        {currentView === 'settings' && (
          <SettingsView
            profile={profile}
            onUpdateProfile={setProfile}
            onResetData={handleResetData}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onSignOut={handleSignOut}
          />
        )}
      </div>

      {/* 5. Modals & Dialogs */}
      {inspectCourse && (
        <CourseDetailModal
          course={inspectCourse}
          onClose={() => setInspectCourse(null)}
          onSave={handleUpdateCourse}
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
