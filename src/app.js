import { auth, db } from './lib/firebase.js';
import {
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  getEmailDocId,
  hashPassword,
  verifyPassword,
  dispatchVerificationCode,
  verifyEmailCode,
  loginRateLimiter,
  sanitizeResourceUrl,
  sanitizeCsvCell,
  sanitizeUserProfile,
  sanitizeResourceLinksList,
  formatGoogleAuthError,
  escapeHtml,
  sanitizeTextInput,
  sanitizeEmailInput,
  sanitizeCourseItem,
  sanitizeStudyLogItem,
  sanitizeAssignmentItem,
} from './lib/authService.js';
import {
  fetchUserSquads,
  syncSquadToUserDoc,
  removeSquadFromUserDoc,
  saveSquadMemberToCloud,
} from './lib/squadService.js';
import {
  formatStudyDuration,
  getLocalDateString,
  getWeekDaysSummary,
  groupStudyLogsByWeek,
  calculateTableScrollMaxHeight,
  updateStreak,
  calculateElo,
  generateSquadCode,
} from './utils/telemetry.js';
import {
  calculateMediaGrades,
  getItemExamGrade,
  getExamResult,
  isExamType,
} from './utils/grades.js';

const STORAGE_KEY = 'unisphere_workspace';

const INITIAL_PROFILE = {
  name: '',
  studentId: '',
  degreeName: '',
  degreeType: 'Laurea Triennale',
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
  squadIds: [],
};

const DEFAULT_STARTER_COURSES = [
  {
    id: 'course-analisi-1',
    code: 'MAT-01',
    title: 'Analisi 1',
    shortTitle: 'Analisi 1',
    email: '',
    officeHours: '',
    cfu: 12,
    year: 1,
    semester: 1,
    status: 'active',
    progress: 0,
    color: '#3B77BC',
    notes: '',
  },
];

const DEFAULT_STARTER_LOGS = [
  {
    id: 'log-starter-1',
    courseId: 'course-analisi-1',
    courseName: 'Analisi 1',
    durationMinutes: 90,
    date: '2026-11-10',
    timeRange: '2026-11-10',
    notes: 'Limits, continuity, and derivatives review.',
    rating: 5,
    tag: 'Deep Work',
    timestamp: Date.now(),
  },
];

const DEFAULT_STARTER_RESOURCES = [
  {
    id: 'res-gomp',
    title: 'Gomp Roma Tre',
    url: 'https://gomp.uniroma3.it/',
    category: 'Portal',
    createdAt: Date.now(),
  },
  {
    id: 'res-celestrack',
    title: 'CelesTrack API',
    url: 'https://celestrak.org/',
    category: 'Tools',
    createdAt: Date.now(),
  },
];

const PAGE_PATHS = {
  login: '/pages/login.html',
  dashboard: '/pages/dashboard.html',
  courses: '/pages/courses.html',
  logs: '/pages/logs.html',
  assignments: '/pages/assignments.html',
  squads: '/pages/squads.html',
  settings: '/pages/settings.html',
};

function sanitizeCourseList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => sanitizeCourseItem(item)).filter(Boolean);
}

function sanitizeStudyLogList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => sanitizeStudyLogItem(item)).filter(Boolean);
}

function sanitizeAssignmentList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => sanitizeAssignmentItem(item)).filter(Boolean);
}

function formatStatusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Passed';
  return 'Planned';
}

function formatReadableDate(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  if (monthIdx >= 0 && monthIdx < 12 && !Number.isNaN(day) && !Number.isNaN(year)) {
    return `${day} ${months[monthIdx]} ${year}`;
  }
  return dateStr;
}

export function initApp() {
  // --- Application State ---
  let profile = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_profile`);
      if (saved) return sanitizeUserProfile(JSON.parse(saved), INITIAL_PROFILE);
    } catch {}
    return { ...INITIAL_PROFILE };
  })();

  let courses = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_courses`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sanitizeCourseList(parsed);
      }
    } catch {}
    return [...DEFAULT_STARTER_COURSES];
  })();

  let studyLogs = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sanitizeStudyLogList(parsed);
      }
    } catch {}
    return [...DEFAULT_STARTER_LOGS];
  })();

  let assignments = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_assignments`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sanitizeAssignmentList(parsed);
      }
    } catch {}
    return [];
  })();

  let quickNotes = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_quick_notes`);
      if (saved !== null) return sanitizeTextInput(saved, 5000, true);
    } catch {}
    return '';
  })();

  let checklist = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_checklist`);
      if (saved !== null) return sanitizeTextInput(saved, 5000, true);
    } catch {}
    return '';
  })();

  let resourceLinks = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_resource_links`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = sanitizeResourceLinksList(
            parsed.filter(
              (r) =>
                !['res-1', 'res-2', 'res-3', 'res-4'].includes(r?.id) &&
                !r?.url?.includes('unirand.it')
            )
          );
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {}
    return [...DEFAULT_STARTER_RESOURCES];
  })();

  let sessionEmail = (() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_session_email`);
    } catch {
      return null;
    }
  })();

  let isAuthenticated = Boolean(sessionEmail);

  // Filter states for views
  let dashCourseStatusFilter = 'active';
  let dashResourceNotesTab = 'resources';
  let courseYearFilter = 'all';
  let courseStatusFilter = 'active';
  let courseSearchQuery = '';
  let logSubjectFilter = 'all';
  let assignmentTypeFilter = 'all';

  // Squads state (isolated to squads.html)
  let squads = [];
  let activeSquadId = profile.activeSquadId || null;
  let squadMembers = [];
  let squadMembersUnsub = null;

  // Auth UI state
  let authNotice = null;
  let verificationSentTo = null;

  // HTML page template cache for instant switching between /pages/*.html
  const pageHtmlCache = new Map();

  // Firestore real-time listener management
  let userSnapshotUnsub = null;
  let hasInitialServerSnapshot = false;
  const syncClientId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // --- Helpers ---
  function setStatus(msg, autoResetMs = 3000) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const baseStatus =
      isAuthenticated && (sessionEmail || profile.email)
        ? `Synced (${sessionEmail || profile.email})`
        : 'Not Signed In';
    el.textContent = msg === 'Ready' ? baseStatus : `${msg} — ${baseStatus}`;
    if (autoResetMs > 0 && msg !== 'Ready') {
      window.setTimeout(() => {
        if (el.textContent?.startsWith(msg)) {
          el.textContent = baseStatus;
        }
      }, autoResetMs);
    }
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(profile));
      localStorage.setItem(`${STORAGE_KEY}_courses`, JSON.stringify(courses));
      localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(studyLogs));
      localStorage.setItem(`${STORAGE_KEY}_assignments`, JSON.stringify(assignments));
      localStorage.setItem(`${STORAGE_KEY}_quick_notes`, quickNotes);
      localStorage.setItem(`${STORAGE_KEY}_checklist`, checklist);
      localStorage.setItem(`${STORAGE_KEY}_resource_links`, JSON.stringify(resourceLinks));
    } catch (err) {
      console.warn('Local storage save notice:', err);
    }
  }

  async function pushWorkstationToCloud() {
    saveToLocalStorage();
    const targetEmail = sessionEmail || profile.email;
    if (!isAuthenticated || !targetEmail || !db) return;

    const docId = getEmailDocId(targetEmail);
    try {
      const userRef = doc(db, 'users', docId);
      // Prevent accidental overwrite of existing cloud workspace with starter local defaults
      // before the initial server snapshot has been received.
      if (!hasInitialServerSnapshot) {
        try {
          const existingSnap = await getDoc(userRef);
          if (existingSnap.exists()) {
            const existingData = existingSnap.data();
            const isDefaultStarterState =
              courses.length === 1 &&
              courses[0]?.id === 'course-analisi-1' &&
              Array.isArray(existingData?.courses) &&
              existingData.courses.length > 1;
            if (isDefaultStarterState) {
              hasInitialServerSnapshot = true;
              profile = sanitizeUserProfile(existingData, profile, targetEmail);
              courses = sanitizeCourseList(existingData.courses);
              if (Array.isArray(existingData.studyLogs)) {
                studyLogs = sanitizeStudyLogList(existingData.studyLogs);
              }
              if (Array.isArray(existingData.assignments)) {
                assignments = sanitizeAssignmentList(existingData.assignments);
              }
              saveToLocalStorage();
              populateCurrentPageData();
              return;
            }
          }
        } catch {}
      }

      await setDoc(
        userRef,
        {
          name: profile.name,
          studentId: profile.studentId,
          email: targetEmail.toLowerCase().trim(),
          degreeLevel: profile.degreeLevel || '',
          degreeName: profile.degreeName,
          degreeType: profile.degreeType,
          totalTargetCFU: profile.totalTargetCFU,
          enrolledYear: profile.enrolledYear,
          academicYear: profile.academicYear,
          institution: profile.institution || '',
          status: profile.status,
          currentSession: profile.currentSession,
          weeklyGoalHours: profile.weeklyGoalHours,
          avatarUrl: profile.avatarUrl || '',
          logoUrl: profile.logoUrl || '',
          thesisPointsExpected: profile.thesisPointsExpected || 0,
          courses,
          studyLogs,
          assignments,
          quickNotes,
          checklist,
          resourceLinks,
          activeSquadId: profile.activeSquadId || null,
          squadIds: profile.squadIds || [],
          xp: profile.xp ?? 0,
          currentStreak: profile.currentStreak ?? 0,
          minutesStudiedThisWeek: profile.minutesStudiedThisWeek ?? 0,
          tasksCompletedThisWeek: profile.tasksCompletedThisWeek ?? 0,
          lastActiveDate: profile.lastActiveDate ?? null,
          updatedAt: Date.now(),
          updatedBy: syncClientId,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Cloud sync push notice:', err);
    }
  }

  function setupRealtimeFirestoreSync() {
    if (userSnapshotUnsub) {
      userSnapshotUnsub();
      userSnapshotUnsub = null;
    }

    const targetEmail = sessionEmail || profile.email;
    if (!isAuthenticated || !targetEmail || !db) {
      setStatus('Ready', 0);
      return;
    }

    const docId = getEmailDocId(targetEmail);
    const userRef = doc(db, 'users', docId);
    hasInitialServerSnapshot = false;

    userSnapshotUnsub = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;
        if (snapshot.metadata.fromCache && !hasInitialServerSnapshot) return;
        hasInitialServerSnapshot = true;

        if (!snapshot.exists()) return;
        const data = snapshot.data();
        if (!data || data.updatedBy === syncClientId) return;

        profile = sanitizeUserProfile(data, profile, targetEmail);

        if (Array.isArray(data.courses)) courses = sanitizeCourseList(data.courses);
        if (Array.isArray(data.studyLogs)) studyLogs = sanitizeStudyLogList(data.studyLogs);
        if (Array.isArray(data.assignments)) assignments = sanitizeAssignmentList(data.assignments);
        if (typeof data.quickNotes === 'string') {
          quickNotes = sanitizeTextInput(data.quickNotes, 5000, true);
        }
        if (typeof data.checklist === 'string') {
          checklist = sanitizeTextInput(data.checklist, 5000, true);
        }
        if (Array.isArray(data.resourceLinks)) {
          resourceLinks = sanitizeResourceLinksList(
            data.resourceLinks.filter(
              (r) =>
                !['res-1', 'res-2', 'res-3', 'res-4'].includes(r?.id) &&
                !r?.url?.includes('unirand.it')
            )
          );
        }

        saveToLocalStorage();
        populateCurrentPageData();
      },
      (err) => {
        console.warn('Firestore real-time listener notice:', err);
      }
    );

    setStatus('Ready', 0);
  }

  function clearLocalWorkspaceStorage() {
    const keysToRemove = [
      `${STORAGE_KEY}_session_email`,
      `${STORAGE_KEY}_profile`,
      `${STORAGE_KEY}_courses`,
      `${STORAGE_KEY}_logs`,
      `${STORAGE_KEY}_assignments`,
      `${STORAGE_KEY}_quick_notes`,
      `${STORAGE_KEY}_checklist`,
      `${STORAGE_KEY}_resource_links`,
      'unisphere_workstation_v1_logs',
    ];
    for (const k of keysToRemove) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
  }

  async function handleLogout() {
    if (userSnapshotUnsub) {
      userSnapshotUnsub();
      userSnapshotUnsub = null;
    }
    if (squadMembersUnsub) {
      squadMembersUnsub();
      squadMembersUnsub = null;
    }
    try {
      if (auth) await signOut(auth);
    } catch {}
    clearLocalWorkspaceStorage();
    sessionEmail = null;
    isAuthenticated = false;
    verificationSentTo = null;
    profile = { ...INITIAL_PROFILE };
    courses = [...DEFAULT_STARTER_COURSES];
    studyLogs = [...DEFAULT_STARTER_LOGS];
    assignments = [];
    quickNotes = '';
    checklist = '';
    resourceLinks = [...DEFAULT_STARTER_RESOURCES];
    squads = [];
    activeSquadId = null;
    squadMembers = [];
    authNotice = { type: 'success', text: 'You have been logged out.' };
    await loadAndRenderPage('login', true);
    setStatus('Logged out');
  }

  // --- Multi-Page HTML Detection & Loader ---
  function getRouteFromLocation() {
    const pathname = window.location.pathname.toLowerCase();
    const hash = window.location.hash.replace('#', '').trim().toLowerCase();

    if (pathname.endsWith('/login.html') || hash === 'login') return 'login';
    if (pathname.endsWith('/courses.html') || hash === 'courses') return 'courses';
    if (pathname.endsWith('/logs.html') || hash === 'logs') return 'logs';
    if (pathname.endsWith('/assignments.html') || hash === 'assignments') return 'assignments';
    if (pathname.endsWith('/squads.html') || hash === 'squads') return 'squads';
    if (pathname.endsWith('/settings.html') || hash === 'settings') return 'settings';
    return 'dashboard';
  }

  function updateNavHighlight(route) {
    const navList = document.getElementById('nav-list');
    if (navList) {
      navList.hidden = !isAuthenticated;
    }
    const headerLogoutBtn = document.getElementById('btn-header-logout');
    if (headerLogoutBtn) {
      headerLogoutBtn.hidden = !isAuthenticated;
    }
    const links = document.querySelectorAll('#nav-list a[data-nav]');
    links.forEach((a) => {
      if (a.dataset.nav === route) {
        a.classList.add('active-nav');
      } else {
        a.classList.remove('active-nav');
      }
    });
  }

  function updateCourseSuggestionsDatalist() {
    const datalist = document.getElementById('course-suggestions');
    if (!datalist) return;
    datalist.innerHTML = courses
      .map((c) => `<option value="${escapeHtml(c.title)}"></option>`)
      .join('');
  }

  async function loadAndRenderPage(targetRoute, pushHistory = false) {
    const effectiveRoute = !isAuthenticated ? 'login' : targetRoute === 'login' ? 'dashboard' : targetRoute;
    updateNavHighlight(effectiveRoute);
    const mainEl = document.getElementById('app-main');
    if (!mainEl) return;

    const currentLoadedPage = mainEl.getAttribute('data-page');
    if (currentLoadedPage && !pageHtmlCache.has(currentLoadedPage)) {
      pageHtmlCache.set(currentLoadedPage, mainEl.innerHTML);
    }

    if (currentLoadedPage !== effectiveRoute) {
      let mainHtml = pageHtmlCache.get(effectiveRoute);
      if (!mainHtml) {
        try {
          const res = await fetch(PAGE_PATHS[effectiveRoute]);
          if (res.ok) {
            const text = await res.text();
            const parser = new DOMParser();
            const docDom = parser.parseFromString(text, 'text/html');
            const fetchedMain = docDom.getElementById('app-main');
            if (fetchedMain) {
              mainHtml = fetchedMain.innerHTML;
              pageHtmlCache.set(effectiveRoute, mainHtml);
            }
            // Ensure any dialogs from the fetched page exist in current document
            const rootEl = document.getElementById('root');
            if (rootEl) {
              docDom.querySelectorAll('dialog').forEach((dlg) => {
                if (dlg.id && !document.getElementById(dlg.id)) {
                  rootEl.appendChild(dlg.cloneNode(true));
                  bindDialogFormEvents();
                }
              });
            }
          }
        } catch (err) {
          console.warn('Page fetch notice:', err);
        }
      }

      if (mainHtml !== undefined) {
        mainEl.setAttribute('data-page', effectiveRoute);
        mainEl.innerHTML = mainHtml;
      }
    }

    if (pushHistory && PAGE_PATHS[effectiveRoute]) {
      const targetPath = PAGE_PATHS[effectiveRoute];
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ route: effectiveRoute }, '', targetPath);
      }
    }

    if (isAuthenticated && effectiveRoute === 'squads') {
      void loadUserSquads();
    } else if (squadMembersUnsub && effectiveRoute !== 'squads') {
      squadMembersUnsub();
      squadMembersUnsub = null;
    }

    updateNavHighlight(effectiveRoute);
    updateCourseSuggestionsDatalist();
    populateCurrentPageData();
    bindDynamicViewEvents(effectiveRoute);
  }

  function updateScrollableTablesMaxHeight() {
    const scrollContainers = document.querySelectorAll('.table-scroll');
    if (scrollContainers.length === 0) return;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    scrollContainers.forEach((el) => {
      const elementTop = el.getBoundingClientRect().top + window.scrollY;
      const maxH = calculateTableScrollMaxHeight(viewportHeight, elementTop, viewportWidth);
      el.style.maxHeight = `${maxH}px`;
    });
  }

  // --- Populate HTML Elements in Current Page ---
  function populateCurrentPageData() {
    const mainEl = document.getElementById('app-main');
    if (!mainEl) return;
    const page = mainEl.getAttribute('data-page');

    updateNavHighlight(page);
    updateCourseSuggestionsDatalist();

    if (page === 'login') {
      populateLoginPage();
    } else if (page === 'dashboard') {
      populateDashboardPage();
    } else if (page === 'courses') {
      populateCoursesPage();
    } else if (page === 'logs') {
      populateLogsPage();
    } else if (page === 'assignments') {
      populateAssignmentsPage();
    } else if (page === 'squads') {
      populateSquadsPage();
    } else if (page === 'settings') {
      populateSettingsPage();
    }

    updateScrollableTablesMaxHeight();
  }

  function populateLoginPage() {
    const noticeContainer = document.getElementById('auth-notice-container');
    if (noticeContainer) {
      noticeContainer.innerHTML = authNotice
        ? `<div class="notice-box ${authNotice.type === 'error' ? 'notice-error' : 'notice-success'}">${escapeHtml(authNotice.text)}</div>`
        : '';
    }
    const loginEmail = document.getElementById('auth-login-email');
    if (loginEmail && !loginEmail.value && profile.email) {
      loginEmail.value = profile.email;
    }
    const regEmail = document.getElementById('auth-reg-email');
    if (regEmail && !regEmail.value && (verificationSentTo || profile.email)) {
      regEmail.value = verificationSentTo || profile.email || '';
    }
  }

  function populateDashboardPage() {
    const completedCFU = courses
      .filter((c) => c.status === 'completed')
      .reduce((sum, c) => sum + c.cfu, 0);
    const targetCFU = profile.totalTargetCFU || 180;
    const media = calculateMediaGrades(assignments, courses);
    const { widgetDays, weekTotalMinutes } = getWeekDaysSummary(studyLogs);

    const elDegree = document.getElementById('summary-degree');
    if (elDegree) elDegree.textContent = profile.degreeName || 'Not set';

    const elInst = document.getElementById('summary-institution');
    if (elInst) elInst.textContent = profile.institution || 'Not set';

    const elCfu = document.getElementById('summary-cfu');
    if (elCfu) elCfu.textContent = `${completedCFU} / ${targetCFU} CFU`;

    const elGrade = document.getElementById('summary-grade');
    if (elGrade) {
      elGrade.textContent =
        media.weightedAverage !== null
          ? `${media.weightedAverage} / 30 (${media.laureaBase} / 110)`
          : '- / 30';
    }

    const elWeekly = document.getElementById('summary-weekly-study');
    if (elWeekly) elWeekly.textContent = formatStudyDuration(weekTotalMinutes);

    const statusSelect = document.getElementById('dash-course-status');
    if (statusSelect) statusSelect.value = dashCourseStatusFilter;

    const filteredDashCourses = courses.filter(
      (c) => dashCourseStatusFilter === 'all' || c.status === dashCourseStatusFilter
    );

    const coursesTbody = document.getElementById('dash-courses-tbody');
    if (coursesTbody) {
      coursesTbody.innerHTML =
        filteredDashCourses.length === 0
          ? `<tr><td colspan="4" class="empty-cell">No matching courses found.</td></tr>`
          : filteredDashCourses
              .map(
                (c) => `
              <tr>
                <td>${escapeHtml(c.title)}</td>
                <td>${escapeHtml(formatStatusLabel(c.status))}</td>
                <td>${escapeHtml(c.cfu)}</td>
                <td><a href="#" data-open-course="${escapeHtml(c.id)}">Open</a></td>
              </tr>`
              )
              .join('');
    }

    const dash5DayThead = document.getElementById('dash-5day-thead');
    if (dash5DayThead) {
      dash5DayThead.innerHTML = widgetDays
        .map(
          (d) =>
            `<th>${escapeHtml(d.shortDay)}<span class="day-sub">${escapeHtml(d.formattedDate)}</span></th>`
        )
        .join('');
    }

    const dash5DayTbody = document.getElementById('dash-5day-tbody');
    if (dash5DayTbody) {
      dash5DayTbody.innerHTML = widgetDays
        .map(
          (d) =>
            `<td><strong class="${d.minutes > 0 ? 'study-hours-positive' : 'study-hours-zero'}">${escapeHtml(d.hours)}</strong></td>`
        )
        .join('');
    }

    const logsTbody = document.getElementById('dash-logs-tbody');
    if (logsTbody) {
      const weekGroups = groupStudyLogsByWeek(studyLogs);
      logsTbody.innerHTML =
        weekGroups.length === 0
          ? `<tr><td colspan="4" class="empty-cell">No session logs recorded yet.</td></tr>`
          : weekGroups
              .map(
                (group) => `
              <tr class="week-separator-row">
                <td colspan="4">${escapeHtml(group.label)}</td>
              </tr>
              ${group.logs
                .map(
                  (l) => `
              <tr>
                <td>${escapeHtml(formatReadableDate(l.date))}</td>
                <td>${escapeHtml(l.courseName)}</td>
                <td>${escapeHtml(formatStudyDuration(l.durationMinutes))}</td>
                <td><a href="#" data-delete-log="${escapeHtml(l.id)}">Delete</a></td>
              </tr>`
                )
                .join('')}`
              )
              .join('');
    }

    const isNotesTab = dashResourceNotesTab === 'notes';
    const tabResBtn = document.getElementById('tab-dash-resources');
    const tabNotesBtn = document.getElementById('tab-dash-notes');
    const resPanel = document.getElementById('dash-resources-panel');
    const notesPanel = document.getElementById('dash-notes-panel');
    const addResBtn = document.getElementById('btn-dash-add-resource');
    const saveNotesBtn = document.getElementById('btn-dash-save-notes');

    if (tabResBtn) {
      tabResBtn.classList.toggle('active', !isNotesTab);
      tabResBtn.setAttribute('aria-selected', String(!isNotesTab));
    }
    if (tabNotesBtn) {
      tabNotesBtn.classList.toggle('active', isNotesTab);
      tabNotesBtn.setAttribute('aria-selected', String(isNotesTab));
    }
    if (resPanel) resPanel.hidden = isNotesTab;
    if (notesPanel) notesPanel.hidden = !isNotesTab;
    if (addResBtn) addResBtn.hidden = isNotesTab;
    if (saveNotesBtn) saveNotesBtn.hidden = !isNotesTab;

    const resList = document.getElementById('dash-resources-list');
    if (resList) {
      resList.innerHTML =
        resourceLinks.length === 0
          ? `<li class="empty-cell">No resource links added yet.</li>`
          : resourceLinks
              .map((r) => {
                const safeHref = sanitizeResourceUrl(r.url) || '#';
                return `
              <li>
                <a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>
                <span class="item-meta">(<a href="#" data-delete-resource="${escapeHtml(r.id)}">Delete</a>)</span>
              </li>`;
              })
              .join('');
    }

    const notesEl = document.getElementById('dash-quick-notes');
    if (notesEl && document.activeElement !== notesEl) {
      notesEl.value = quickNotes;
    }
  }

  function populateCoursesPage() {
    const completedCFU = courses
      .filter((c) => c.status === 'completed')
      .reduce((sum, c) => sum + c.cfu, 0);
    const activeCFU = courses
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => sum + c.cfu, 0);
    const plannedCFU = courses
      .filter((c) => c.status === 'planned')
      .reduce((sum, c) => sum + c.cfu, 0);
    const targetCFU = profile.totalTargetCFU || 180;
    const media = calculateMediaGrades(assignments, courses);

    const summaryTbody = document.getElementById('courses-summary-tbody');
    if (summaryTbody) {
      summaryTbody.innerHTML = `
        <tr>
          <td>${completedCFU} / ${targetCFU} CFU (${Math.round((completedCFU / targetCFU) * 100)}%)</td>
          <td>${activeCFU} CFU</td>
          <td>${plannedCFU} CFU</td>
          <td>${media.weightedAverage !== null ? `${media.weightedAverage} / 30` : '-'}</td>
          <td>${media.laureaBase !== null ? `${media.laureaBase} / 110` : '-'}</td>
        </tr>
      `;
    }

    const yearSelect = document.getElementById('filter-course-year');
    if (yearSelect) yearSelect.value = courseYearFilter;

    const statusSelect = document.getElementById('filter-course-status');
    if (statusSelect) statusSelect.value = courseStatusFilter;

    const searchInput = document.getElementById('filter-course-search');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = courseSearchQuery;
    }

    const filtered = courses.filter((c) => {
      if (courseYearFilter !== 'all' && String(c.year) !== courseYearFilter) return false;
      if (courseStatusFilter !== 'all' && c.status !== courseStatusFilter) return false;
      if (courseSearchQuery.trim()) {
        const q = courseSearchQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });

    const registryTbody = document.getElementById('courses-registry-tbody');
    if (registryTbody) {
      registryTbody.innerHTML =
        filtered.length === 0
          ? `<tr><td colspan="7" class="empty-cell">No matching courses found.</td></tr>`
          : filtered
              .map((c) => {
                const validProfEmail =
                  c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email).trim())
                    ? String(c.email).trim()
                    : '';
                return `
              <tr>
                <td>${escapeHtml(c.title)}</td>
                <td>Year ${escapeHtml(c.year)} / Sem ${escapeHtml(c.semester)}</td>
                <td>${escapeHtml(formatStatusLabel(c.status))}</td>
                <td>${escapeHtml(c.cfu)}</td>
                <td>${validProfEmail ? `<a href="mailto:${escapeHtml(validProfEmail)}">${escapeHtml(validProfEmail)}</a>` : '-'}</td>
                <td>${escapeHtml(c.officeHours || '-')}</td>
                <td>
                  <a href="#" data-open-course="${escapeHtml(c.id)}">Open</a> |
                  <a href="#" data-delete-course="${escapeHtml(c.id)}">Delete</a>
                </td>
              </tr>`;
              })
              .join('');
    }
  }

  function populateLogsPage() {
    const { widgetDays } = getWeekDaysSummary(studyLogs);
    const totalMinutesAllTime = studyLogs.reduce((sum, l) => sum + l.durationMinutes, 0);

    const headerEl = document.getElementById('logs-5day-header');
    if (headerEl) {
      headerEl.textContent = `Current 6-Day Week Study Time (Total All-Time: ${formatStudyDuration(totalMinutesAllTime)})`;
    }

    const theadEl = document.getElementById('logs-5day-thead');
    if (theadEl) {
      theadEl.innerHTML = widgetDays
        .map((d) => `<th>${escapeHtml(d.shortDay)} (${escapeHtml(d.formattedDate)})</th>`)
        .join('');
    }

    const tbodyEl = document.getElementById('logs-5day-tbody');
    if (tbodyEl) {
      tbodyEl.innerHTML = widgetDays
        .map(
          (d) =>
            `<td><strong class="${d.minutes > 0 ? 'study-hours-positive' : 'study-hours-zero'}">${escapeHtml(d.hours)}</strong></td>`
        )
        .join('');
    }

    const uniqueSubjects = Array.from(
      new Set([
        ...courses.map((c) => c.title),
        ...studyLogs.map((l) => l.courseName),
      ].filter(Boolean))
    );

    const subjSelect = document.getElementById('filter-log-subject');
    if (subjSelect) {
      subjSelect.innerHTML = `
        <option value="all" ${logSubjectFilter === 'all' ? 'selected' : ''}>All Subjects</option>
        ${uniqueSubjects
          .map(
            (subj) =>
              `<option value="${escapeHtml(subj)}" ${logSubjectFilter === subj ? 'selected' : ''}>${escapeHtml(subj)}</option>`
          )
          .join('')}
      `;
    }

    const filteredLogs = studyLogs.filter((l) => {
      if (logSubjectFilter !== 'all' && l.courseName !== logSubjectFilter) return false;
      return true;
    });

    const registryTbody = document.getElementById('logs-registry-tbody');
    if (registryTbody) {
      const weekGroups = groupStudyLogsByWeek(filteredLogs);
      registryTbody.innerHTML =
        weekGroups.length === 0
          ? `<tr><td colspan="6" class="empty-cell">No study session logs recorded.</td></tr>`
          : weekGroups
              .map(
                (group) => `
              <tr class="week-separator-row">
                <td colspan="6">${escapeHtml(group.label)}</td>
              </tr>
              ${group.logs
                .map(
                  (l) => `
              <tr>
                <td>${escapeHtml(formatReadableDate(l.date))}</td>
                <td>${escapeHtml(l.courseName)}</td>
                <td>${escapeHtml(formatStudyDuration(l.durationMinutes))}</td>
                <td>${escapeHtml(l.tag)}</td>
                <td>${escapeHtml(l.notes || '-')}</td>
                <td><a href="#" data-delete-log="${escapeHtml(l.id)}">Delete</a></td>
              </tr>`
                )
                .join('')}`
              )
              .join('');
    }
  }

  function populateAssignmentsPage() {
    const media = calculateMediaGrades(assignments, courses);

    const summaryTbody = document.getElementById('assignments-summary-tbody');
    if (summaryTbody) {
      summaryTbody.innerHTML = `
        <tr>
          <td>${media.gradedExamsCount}</td>
          <td>${media.arithmeticAverage !== null ? `${media.arithmeticAverage} / 30` : '-'}</td>
          <td>${media.weightedAverage !== null ? `${media.weightedAverage} / 30` : '-'}</td>
          <td>${media.laureaBase !== null ? `${media.laureaBase} / 110` : '-'}</td>
        </tr>
      `;
    }

    const typeSelect = document.getElementById('filter-assignment-type');
    if (typeSelect) typeSelect.value = assignmentTypeFilter;

    const filtered = assignments.filter((a) => {
      if (assignmentTypeFilter !== 'all' && a.type !== assignmentTypeFilter) return false;
      return true;
    });

    const registryTbody = document.getElementById('assignments-registry-tbody');
    if (registryTbody) {
      registryTbody.innerHTML =
        filtered.length === 0
          ? `<tr><td colspan="7" class="empty-cell">No exams or assignments found.</td></tr>`
          : filtered
              .map((a) => {
                const finalGrade = getItemExamGrade(a);
                let gradeDisplay = finalGrade !== null ? `${finalGrade} / 30` : '-';
                if (Array.isArray(a.examParts) && a.examParts.length > 0) {
                  const partsText = a.examParts
                    .filter((p) => typeof p.grade === 'number')
                    .map((p) => `${p.label}: ${p.grade}`)
                    .join(', ');
                  if (partsText) {
                    gradeDisplay = `${gradeDisplay} (${partsText})`;
                  }
                }
                return `
                <tr>
                  <td>${escapeHtml(a.title)}</td>
                  <td>${escapeHtml(a.courseName)}</td>
                  <td>${escapeHtml(a.type)}</td>
                  <td>${escapeHtml(formatReadableDate(a.dueDate))}</td>
                  <td>${escapeHtml(a.status)}</td>
                  <td>${escapeHtml(gradeDisplay)}</td>
                  <td>
                    <a href="#" data-open-assignment="${escapeHtml(a.id)}">Open</a> |
                    <a href="#" data-toggle-assignment="${escapeHtml(a.id)}">${a.status === 'completed' ? 'Reopen' : 'Mark Done'}</a> |
                    <a href="#" data-delete-assignment="${escapeHtml(a.id)}">Delete</a>
                  </td>
                </tr>`;
              })
              .join('');
    }
  }

  function populateSquadsPage() {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (activeSquad && activeSquad.id !== activeSquadId) {
      activeSquadId = activeSquad.id;
    }

    const squadsTbody = document.getElementById('squads-list-tbody');
    if (squadsTbody) {
      squadsTbody.innerHTML =
        squads.length === 0
          ? `<tr><td colspan="3" class="empty-cell">You have not joined or created any squads yet.</td></tr>`
          : squads
              .map(
                (s) => `
              <tr>
                <td><strong>${escapeHtml(s.name)}</strong> ${s.id === activeSquadId ? '(Active)' : ''}</td>
                <td><code>${escapeHtml(s.code)}</code></td>
                <td>
                  <a href="#" data-select-squad="${escapeHtml(s.id)}">View</a> |
                  <a href="#" data-leave-squad="${escapeHtml(s.id)}">Leave</a>
                </td>
              </tr>`
              )
              .join('');
    }

    const lbHeader = document.getElementById('squads-leaderboard-header');
    if (lbHeader) {
      lbHeader.textContent = `Weekly Leaderboard ${activeSquad ? `— ${activeSquad.name} (Code: ${activeSquad.code})` : ''}`;
    }

    const sortedMembers = [...squadMembers].sort((a, b) => (b.elo || 0) - (a.elo || 0));
    const lbTbody = document.getElementById('squads-leaderboard-tbody');
    if (lbTbody) {
      lbTbody.innerHTML =
        !activeSquad || sortedMembers.length === 0
          ? `<tr><td colspan="5" class="empty-cell">${activeSquad ? 'No members found in this squad.' : 'Select or create a squad to view its leaderboard.'}</td></tr>`
          : sortedMembers
              .map(
                (m, idx) => `
              <tr>
                <td>#${idx + 1}</td>
                <td>${escapeHtml(m.displayName || 'Student')}</td>
                <td>${escapeHtml(formatStudyDuration(m.minutesThisWeek || 0))}</td>
                <td>${escapeHtml(m.currentStreak || 0)} days</td>
                <td>${escapeHtml(m.elo || 1000)}</td>
              </tr>`
              )
              .join('');
    }
  }

  function populateSettingsPage() {
    const setField = (id, val) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = val ?? '';
    };

    setField('set-name', profile.name || '');
    setField('set-email', sessionEmail || profile.email || '');
    const emailEl = document.getElementById('set-email');
    if (emailEl) {
      emailEl.readOnly = Boolean(isAuthenticated && sessionEmail);
    }
    setField('set-student-id', profile.studentId || '');
    setField('set-institution', profile.institution || '');
    setField('set-degree-name', profile.degreeName || '');
    setField('set-degree-type', profile.degreeType || 'Laurea Triennale');
    setField('set-academic-year', profile.academicYear || 'Year 1');
    setField('set-target-cfu', profile.totalTargetCFU || 180);
    setField('set-weekly-goal', profile.weeklyGoalHours || 20);

    const accountTbody = document.getElementById('settings-account-tbody');
    if (accountTbody) {
      accountTbody.innerHTML = `
        <tr>
          <th>Sync Account</th>
          <td>${escapeHtml(sessionEmail || profile.email || 'Local Only')}</td>
        </tr>
        <tr>
          <th>Courses Stored</th>
          <td>${courses.length}</td>
        </tr>
        <tr>
          <th>Session Logs Stored</th>
          <td>${studyLogs.length}</td>
        </tr>
        <tr>
          <th>Exams &amp; Assignments</th>
          <td>${assignments.length}</td>
        </tr>
      `;
    }
  }

  // --- Squads Real-time Helpers ---
  async function loadUserSquads() {
    const email = sessionEmail || profile.email;
    const uid = email ? getEmailDocId(email) : 'local_student';
    try {
      const result = await fetchUserSquads(uid, email);
      const loaded = Array.isArray(result)
        ? result
        : Array.isArray(result?.squads)
        ? result.squads
        : [];
      if (loaded.length > 0) {
        squads = loaded;
        if (!activeSquadId || !squads.some((s) => s.id === activeSquadId)) {
          activeSquadId = result?.activeSquadId || squads[0].id;
        }
        subscribeToSquadMembers(activeSquadId);
      }
      populateCurrentPageData();
    } catch (err) {
      console.warn('Squad fetch notice:', err);
    }
  }

  function subscribeToSquadMembers(squadId) {
    if (squadMembersUnsub) {
      squadMembersUnsub();
      squadMembersUnsub = null;
    }
    if (!squadId || !db) {
      squadMembers = [];
      populateCurrentPageData();
      return;
    }
    try {
      const membersRef = collection(db, 'squads', squadId, 'members');
      squadMembersUnsub = onSnapshot(
        membersRef,
        (snap) => {
          squadMembers = snap.docs.map((d) => d.data());
          populateCurrentPageData();
        },
        (err) => {
          console.warn('Squad members listener notice:', err);
        }
      );
    } catch (err) {
      console.warn('Squad members subscription notice:', err);
    }
  }

  // --- Modal Helpers ---
  function openCourseModal(courseToEdit = null) {
    const dialog = document.getElementById('modal-course');
    if (!dialog) return;

    const titleHeading = document.getElementById('modal-course-title');
    const deleteBtn = document.getElementById('btn-delete-course');

    document.getElementById('course-id').value = courseToEdit ? courseToEdit.id : '';
    document.getElementById('course-title').value = courseToEdit ? courseToEdit.title : '';
    document.getElementById('course-status').value = courseToEdit ? courseToEdit.status : 'active';
    document.getElementById('course-cfu').value = courseToEdit ? courseToEdit.cfu : 6;
    document.getElementById('course-year').value = courseToEdit ? courseToEdit.year : 1;
    document.getElementById('course-semester').value = courseToEdit ? courseToEdit.semester : 1;
    document.getElementById('course-email').value = courseToEdit ? courseToEdit.email || '' : '';
    document.getElementById('course-office').value = courseToEdit
      ? courseToEdit.officeHours || ''
      : '';
    document.getElementById('course-notes').value = courseToEdit ? courseToEdit.notes || '' : '';

    if (titleHeading) {
      titleHeading.textContent = courseToEdit ? 'Edit Course' : 'Add Course';
    }
    if (deleteBtn) {
      deleteBtn.hidden = !courseToEdit;
    }

    dialog.showModal();
  }

  function openLogModal() {
    const dialog = document.getElementById('modal-log');
    if (!dialog) return;
    document.getElementById('log-subject').value = courses[0]?.title || '';
    document.getElementById('log-date').value = getLocalDateString();
    document.getElementById('log-minutes').value = 90;
    document.getElementById('log-tag').value = 'Deep Work';
    document.getElementById('log-notes').value = '';
    dialog.showModal();
  }

  function openResourceModal() {
    const dialog = document.getElementById('modal-resource');
    if (!dialog) return;
    document.getElementById('resource-title').value = '';
    document.getElementById('resource-url').value = '';
    document.getElementById('resource-category').value = 'Portal';
    dialog.showModal();
  }

  function openAssignmentModal(itemToEdit = null) {
    const dialog = document.getElementById('modal-assignment');
    if (!dialog) return;

    const heading = document.getElementById('modal-assignment-title');
    const deleteBtn = document.getElementById('btn-delete-assignment');

    document.getElementById('assignment-id').value = itemToEdit ? itemToEdit.id : '';
    document.getElementById('assignment-title').value = itemToEdit ? itemToEdit.title : '';
    document.getElementById('assignment-course').value = itemToEdit
      ? itemToEdit.courseName
      : courses[0]?.title || '';
    document.getElementById('assignment-type').value = itemToEdit ? itemToEdit.type : 'Exam';
    document.getElementById('assignment-due').value = itemToEdit
      ? itemToEdit.dueDate
      : getLocalDateString();
    document.getElementById('assignment-status').value = itemToEdit ? itemToEdit.status : 'todo';
    document.getElementById('assignment-grade').value =
      itemToEdit && typeof itemToEdit.grade === 'number' ? itemToEdit.grade : '';

    const es1 = itemToEdit?.examParts?.[0]?.grade;
    const es2 = itemToEdit?.examParts?.[1]?.grade;
    document.getElementById('assignment-esonero1').value = typeof es1 === 'number' ? es1 : '';
    document.getElementById('assignment-esonero2').value = typeof es2 === 'number' ? es2 : '';
    document.getElementById('assignment-notes').value = itemToEdit ? itemToEdit.notes || '' : '';

    if (heading) {
      heading.textContent = itemToEdit ? 'Edit Exam / Assignment' : 'Add Exam / Assignment';
    }
    if (deleteBtn) {
      deleteBtn.hidden = !itemToEdit;
    }

    dialog.showModal();
  }

  // --- Export Helpers ---
  function exportLogsCsv() {
    const headers = ['Date', 'Subject', 'DurationMinutes', 'Tag', 'Notes'];
    const rows = studyLogs.map((l) => [
      sanitizeCsvCell(l.date || ''),
      sanitizeCsvCell(l.courseName || ''),
      Number(l.durationMinutes) || 0,
      sanitizeCsvCell(l.tag || ''),
      sanitizeCsvCell(l.notes || ''),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unisphere-session-logs-${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportWorkspaceJson() {
    const payload = {
      profile: sanitizeUserProfile(profile, INITIAL_PROFILE, sessionEmail || profile.email),
      courses,
      studyLogs,
      assignments,
      quickNotes,
      checklist,
      resourceLinks: sanitizeResourceLinksList(resourceLinks),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unisphere-backup-${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Auth Events & Cloud Restoration ---
  function completeCloudLogin(userData, emailStr) {
    const normalizedEmail = emailStr.toLowerCase().trim();
    sessionEmail = normalizedEmail;
    isAuthenticated = true;
    try {
      localStorage.setItem(`${STORAGE_KEY}_session_email`, normalizedEmail);
    } catch {}

    if (userData) {
      profile = sanitizeUserProfile(userData, profile, normalizedEmail);
      if (Array.isArray(userData.courses)) courses = sanitizeCourseList(userData.courses);
      if (Array.isArray(userData.studyLogs)) studyLogs = sanitizeStudyLogList(userData.studyLogs);
      if (Array.isArray(userData.assignments)) {
        assignments = sanitizeAssignmentList(userData.assignments);
      }
      if (typeof userData.quickNotes === 'string') {
        quickNotes = sanitizeTextInput(userData.quickNotes, 5000, true);
      }
      if (typeof userData.checklist === 'string') {
        checklist = sanitizeTextInput(userData.checklist, 5000, true);
      }
      if (Array.isArray(userData.resourceLinks)) {
        resourceLinks = sanitizeResourceLinksList(userData.resourceLinks);
      }
    } else {
      profile = sanitizeUserProfile(profile, INITIAL_PROFILE, normalizedEmail);
    }

    authNotice = null;
    saveToLocalStorage();
    setupRealtimeFirestoreSync();
    void loadAndRenderPage('dashboard', true);
    setStatus(`Logged in as ${normalizedEmail}`);
  }

  async function completeGoogleUserSignIn(googleUser) {
    const mail = googleUser?.email?.trim().toLowerCase() || '';
    if (!mail) {
      authNotice = {
        type: 'error',
        text: 'Google account did not return an email address.',
      };
      populateLoginPage();
      return;
    }

    const docId = getEmailDocId(mail);
    const fallbackRecord = {
      uid: docId,
      authUid: googleUser.uid || docId,
      email: mail,
      name: sanitizeTextInput(googleUser.displayName || profile.name || mail.split('@')[0], 100),
      studentId: profile.studentId || '',
      authProvider: 'google',
      emailVerified: true,
      degreeName: profile.degreeName || '',
      institution: profile.institution || '',
      degreeType: profile.degreeType || 'Laurea Triennale',
      totalTargetCFU: profile.totalTargetCFU || 180,
      academicYear: profile.academicYear || 'Year 1',
      courses,
      studyLogs,
      assignments,
      quickNotes,
      checklist,
      resourceLinks,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
    };

    if (!db) {
      completeCloudLogin(fallbackRecord, mail);
      return;
    }

    const userRef = doc(db, 'users', docId);

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const existingData = snap.data();
        await setDoc(
          userRef,
          {
            authUid: googleUser.uid || existingData.authUid || docId,
            authProvider: existingData.authProvider || 'google',
            emailVerified: true,
            updatedAt: Date.now(),
          },
          { merge: true }
        ).catch(() => {});
        completeCloudLogin(existingData, mail);
        return;
      }

      await setDoc(userRef, fallbackRecord, { merge: true });
      completeCloudLogin(fallbackRecord, mail);
    } catch (firestoreErr) {
      console.warn('Firestore profile sync after Google SSO notice:', firestoreErr);
      completeCloudLogin(fallbackRecord, mail);
    }
  }

  const boundElements = new WeakSet();
  let isEmailAuthPending = false;
  let isGoogleSignInPending = false;

  function getDocWithTimeout(docRef, timeoutMs = 10000) {
    return Promise.race([
      getDoc(docRef),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Cloud connection timed out. Please check your internet connection and try again.')),
          timeoutMs
        )
      ),
    ]);
  }

  async function handleGoogleSignIn() {
    if (isGoogleSignInPending) return;
    isGoogleSignInPending = true;

    const googleBtn = document.getElementById('btn-google-sso');
    if (googleBtn) {
      googleBtn.disabled = true;
      googleBtn.textContent = 'Signing in with Google...';
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });

      const res = await signInWithPopup(auth, provider);
      if (res?.user) {
        await completeGoogleUserSignIn(res.user);
      }
    } catch (err) {
      const classified = formatGoogleAuthError(err);
      if (classified.shouldFallbackToRedirect) {
        authNotice = {
          type: 'success',
          text: classified.message,
        };
        populateLoginPage();
        try {
          const redirectProvider = new GoogleAuthProvider();
          redirectProvider.addScope('email');
          redirectProvider.addScope('profile');
          redirectProvider.setCustomParameters({ prompt: 'select_account' });
          await signInWithRedirect(auth, redirectProvider);
          return;
        } catch (redirectErr) {
          const redirectClassified = formatGoogleAuthError(redirectErr);
          authNotice = {
            type: 'error',
            text: redirectClassified.message,
          };
          populateLoginPage();
        }
      } else {
        authNotice = {
          type: 'error',
          text: classified.message,
        };
        populateLoginPage();
      }
    } finally {
      isGoogleSignInPending = false;
      const btnAfter = document.getElementById('btn-google-sso');
      if (btnAfter) {
        btnAfter.disabled = false;
        btnAfter.textContent = 'Sign In with Google';
      }
    }
  }

  function bindAuthEvents() {
    const loginForm = document.getElementById('form-auth-login');
    if (loginForm && !boundElements.has(loginForm)) {
      boundElements.add(loginForm);
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('auth-login-email');
        const passInput = document.getElementById('auth-login-password');
        const normalizedEmail = sanitizeEmailInput(emailInput?.value);
        const password = String(passInput?.value || '');
        if (!normalizedEmail || !password) {
          authNotice = {
            type: 'error',
            text: 'Please enter a valid email address and password.',
          };
          populateLoginPage();
          return;
        }

        const rateStatus = loginRateLimiter.check(normalizedEmail);
        if (!rateStatus.allowed) {
          authNotice = {
            type: 'error',
            text: `Too many failed sign-in attempts. Please wait ${rateStatus.retryAfterSeconds}s before trying again.`,
          };
          populateLoginPage();
          return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.textContent : 'Log-In';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Signing in...';
        }
        isEmailAuthPending = true;

        try {
          if (!db) {
            loginRateLimiter.reset(normalizedEmail);
            completeCloudLogin(null, normalizedEmail);
            return;
          }

          const docId = getEmailDocId(normalizedEmail);
          const userRef = doc(db, 'users', docId);

          let firebaseAuthSucceeded = false;
          if (auth) {
            try {
              await signInWithEmailAndPassword(auth, normalizedEmail, password);
              firebaseAuthSucceeded = true;
            } catch (fbErr) {
              const fbCode = String(fbErr?.code || '');
              if (fbCode === 'auth/too-many-requests') {
                loginRateLimiter.consume(normalizedEmail);
                authNotice = {
                  type: 'error',
                  text: 'Account temporarily locked due to too many failed attempts. Please try again later.',
                };
                populateLoginPage();
                return;
              }
            }
          }

          let snap = null;
          try {
            snap = await getDocWithTimeout(userRef, 10000);
          } catch (docErr) {
            if (firebaseAuthSucceeded) {
              loginRateLimiter.reset(normalizedEmail);
              completeCloudLogin(null, normalizedEmail);
              return;
            }
            throw docErr;
          }

          if (!snap || !snap.exists()) {
            if (firebaseAuthSucceeded) {
              loginRateLimiter.reset(normalizedEmail);
              completeCloudLogin(null, normalizedEmail);
              return;
            }
            loginRateLimiter.consume(normalizedEmail);
            authNotice = {
              type: 'error',
              text: 'No account found with this email. Please register on the right.',
            };
            populateLoginPage();
            return;
          }

          const data = snap.data();

          if (!firebaseAuthSucceeded) {
            if (!data.passwordHash) {
              loginRateLimiter.consume(normalizedEmail);
              authNotice = {
                type: 'error',
                text:
                  data.authProvider === 'google'
                    ? 'This account uses Google Sign-In. Please click "Sign In with Google".'
                    : 'Incorrect email or password. Please try again.',
              };
              populateLoginPage();
              return;
            }

            const isPasswordValid = await verifyPassword(password, data.passwordHash);
            if (!isPasswordValid) {
              const consumed = loginRateLimiter.consume(normalizedEmail);
              authNotice = {
                type: 'error',
                text: consumed.allowed
                  ? `Incorrect password. Please try again (${consumed.remaining} attempts remaining).`
                  : `Too many failed sign-in attempts. Please wait ${consumed.retryAfterSeconds}s.`,
              };
              populateLoginPage();
              return;
            }

            // Upgrade legacy unsalted SHA-256 hash to salted PBKDF2 hash transparently
            if (!String(data.passwordHash).startsWith('pbkdf2$')) {
              const upgradedHash = await hashPassword(password);
              await setDoc(userRef, { passwordHash: upgradedHash }, { merge: true }).catch(() => {});
            }

            // Ensure legacy Firestore account also exists in Firebase Auth
            if (auth) {
              try {
                await createUserWithEmailAndPassword(auth, normalizedEmail, password);
              } catch {}
            }
          } else if (data.passwordHash && !String(data.passwordHash).startsWith('pbkdf2$')) {
            const upgradedHash = await hashPassword(password);
            await setDoc(userRef, { passwordHash: upgradedHash }, { merge: true }).catch(() => {});
          }

          loginRateLimiter.reset(normalizedEmail);
          completeCloudLogin(data, normalizedEmail);
        } catch (err) {
          loginRateLimiter.consume(normalizedEmail);
          authNotice = {
            type: 'error',
            text: err instanceof Error ? err.message : 'Sign-in failed.',
          };
          populateLoginPage();
        } finally {
          isEmailAuthPending = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
          }
        }
      });
    }

    const googleBtn = document.getElementById('btn-google-sso');
    if (googleBtn && !boundElements.has(googleBtn)) {
      boundElements.add(googleBtn);
      googleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        void handleGoogleSignIn();
      });
    }

    const otpBtn = document.getElementById('btn-send-otp');
    if (otpBtn && !boundElements.has(otpBtn)) {
      boundElements.add(otpBtn);
      otpBtn.addEventListener('click', async () => {
        const regEmail = sanitizeEmailInput(
          document.getElementById('auth-reg-email')?.value
        );
        if (!regEmail) {
          authNotice = { type: 'error', text: 'Enter a valid email first to receive a code.' };
          populateLoginPage();
          return;
        }
        const origText = otpBtn.textContent;
        otpBtn.disabled = true;
        otpBtn.textContent = 'Sending...';
        try {
          verificationSentTo = regEmail;
          const res = await dispatchVerificationCode(regEmail, db);
          if (res.success) {
            authNotice = {
              type: 'success',
              text: `Verification code sent to ${regEmail}. Check your inbox.`,
            };
          } else {
            authNotice = {
              type: 'error',
              text: res.error || 'Could not send verification code.',
            };
          }
          populateLoginPage();
        } finally {
          otpBtn.disabled = false;
          otpBtn.textContent = origText;
        }
      });
    }

    const regForm = document.getElementById('form-auth-register');
    if (regForm && !boundElements.has(regForm)) {
      boundElements.add(regForm);
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const regName = sanitizeTextInput(document.getElementById('auth-reg-name').value, 100);
        const regEmail = sanitizeEmailInput(document.getElementById('auth-reg-email').value);
        const regDegree = sanitizeTextInput(document.getElementById('auth-reg-degree').value, 120);
        const regInstitution = sanitizeTextInput(
          document.getElementById('auth-reg-institution').value,
          120
        );
        const regCFU = Math.min(
          360,
          Math.max(30, Number(document.getElementById('auth-reg-cfu').value) || 180)
        );
        const regPass = String(document.getElementById('auth-reg-password').value || '');
        const regCode = sanitizeTextInput(document.getElementById('auth-reg-code').value, 6);

        if (!regName || !regEmail || regPass.length < 6) {
          authNotice = {
            type: 'error',
            text: 'Please provide your name, a valid email, and a password of at least 6 characters.',
          };
          populateLoginPage();
          return;
        }

        const regSubmitBtn = regForm.querySelector('button[type="submit"]');
        const origRegBtnText = regSubmitBtn ? regSubmitBtn.textContent : 'Create Account';
        if (regSubmitBtn) {
          regSubmitBtn.disabled = true;
          regSubmitBtn.textContent = 'Creating account...';
        }
        isEmailAuthPending = true;

        try {
          if (regCode) {
            const ver = await verifyEmailCode(regEmail, regCode, db);
            if (!ver.success) {
              authNotice = {
                type: 'error',
                text: ver.error || 'Invalid verification code.',
              };
              populateLoginPage();
              return;
            }
          }

          let authUid = null;
          if (auth) {
            try {
              const cred = await createUserWithEmailAndPassword(auth, regEmail, regPass);
              authUid = cred.user?.uid || null;
              await updateProfile(cred.user, { displayName: regName });
            } catch (fbErr) {
              if (fbErr?.code === 'auth/email-already-in-use') {
                authNotice = {
                  type: 'error',
                  text: 'An account with this email already exists. Please sign in on the left.',
                };
                populateLoginPage();
                return;
              }
            }
          }

          const docId = getEmailDocId(regEmail);
          const passwordHash = await hashPassword(regPass);

          const newRecord = {
            uid: docId,
            authUid: authUid || docId,
            email: regEmail,
            name: regName,
            studentId: profile.studentId || '',
            passwordHash,
            emailVerified: Boolean(regCode),
            degreeName: regDegree,
            institution: regInstitution,
            degreeType: profile.degreeType || 'Laurea Triennale',
            totalTargetCFU: regCFU,
            academicYear: profile.academicYear || 'Year 1',
            courses,
            studyLogs,
            assignments,
            quickNotes,
            checklist,
            resourceLinks,
            createdAt: new Date().toISOString(),
            updatedAt: Date.now(),
          };

          if (db) {
            const userRef = doc(db, 'users', docId);
            await setDoc(userRef, newRecord, { merge: true });
          }
          completeCloudLogin(newRecord, regEmail);
        } catch (err) {
          authNotice = {
            type: 'error',
            text: err instanceof Error ? err.message : 'Registration error.',
          };
          populateLoginPage();
        } finally {
          isEmailAuthPending = false;
          if (regSubmitBtn) {
            regSubmitBtn.disabled = false;
            regSubmitBtn.textContent = origRegBtnText;
          }
        }
      });
    }
  }

  // --- Bind Events for Active Route ---
  function bindDynamicViewEvents(route) {
    if (route === 'login') {
      bindAuthEvents();
      return;
    }

    if (route === 'dashboard') {
      document.getElementById('dash-course-status')?.addEventListener('change', (e) => {
        dashCourseStatusFilter = e.target.value;
        populateDashboardPage();
      });
      document.getElementById('tab-dash-resources')?.addEventListener('click', () => {
        dashResourceNotesTab = 'resources';
        populateDashboardPage();
      });
      document.getElementById('tab-dash-notes')?.addEventListener('click', () => {
        dashResourceNotesTab = 'notes';
        populateDashboardPage();
      });
      document
        .getElementById('btn-dash-add-course')
        ?.addEventListener('click', () => openCourseModal());
      document
        .getElementById('btn-dash-add-log')
        ?.addEventListener('click', () => openLogModal());
      document
        .getElementById('btn-dash-add-resource')
        ?.addEventListener('click', () => openResourceModal());
      document.getElementById('btn-dash-save-notes')?.addEventListener('click', () => {
        const notesEl = document.getElementById('dash-quick-notes');
        if (notesEl) {
          quickNotes = sanitizeTextInput(notesEl.value, 5000, true);
          notesEl.value = quickNotes;
          void pushWorkstationToCloud();
          setStatus('Notes saved');
        }
      });
    }

    if (route === 'courses') {
      document
        .getElementById('btn-courses-add')
        ?.addEventListener('click', () => openCourseModal());
      document.getElementById('filter-course-year')?.addEventListener('change', (e) => {
        courseYearFilter = e.target.value;
        populateCoursesPage();
      });
      document.getElementById('filter-course-status')?.addEventListener('change', (e) => {
        courseStatusFilter = e.target.value;
        populateCoursesPage();
      });
      document.getElementById('filter-course-search')?.addEventListener('input', (e) => {
        courseSearchQuery = e.target.value;
        populateCoursesPage();
      });
    }

    if (route === 'logs') {
      document.getElementById('btn-logs-add')?.addEventListener('click', () => openLogModal());
      document
        .getElementById('btn-export-logs-csv')
        ?.addEventListener('click', () => exportLogsCsv());
      document.getElementById('filter-log-subject')?.addEventListener('change', (e) => {
        logSubjectFilter = e.target.value;
        populateLogsPage();
      });
    }

    if (route === 'assignments') {
      document
        .getElementById('btn-assignments-add')
        ?.addEventListener('click', () => openAssignmentModal());
      document.getElementById('filter-assignment-type')?.addEventListener('change', (e) => {
        assignmentTypeFilter = e.target.value;
        populateAssignmentsPage();
      });
    }

    if (route === 'squads') {
      document.getElementById('form-create-squad')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('squad-new-name');
        const name = sanitizeTextInput(nameInput?.value, 50);
        if (!name) return;

        const code = generateSquadCode();
        const squadId = `squad-${Date.now()}`;
        const uid = getEmailDocId(sessionEmail || profile.email || 'local_student');
        const newSquad = {
          id: squadId,
          name,
          code,
          createdAt: new Date().toISOString(),
          createdBy: uid,
          creatorName: sanitizeTextInput(profile.name || 'Student', 100),
          memberCount: 1,
          memberUids: [uid],
        };

        try {
          if (db) {
            await setDoc(doc(db, 'squads', squadId), newSquad);
          }
          const member = {
            uid,
            displayName: sanitizeTextInput(profile.name || 'Student', 100),
            color: '#3B77BC',
            elo: calculateElo(
              profile.minutesStudiedThisWeek || 0,
              profile.tasksCompletedThisWeek || 0,
              profile.currentStreak || 0
            ),
            minutesThisWeek: profile.minutesStudiedThisWeek || 0,
            tasksThisWeek: profile.tasksCompletedThisWeek || 0,
            currentStreak: profile.currentStreak || 0,
            joinedAt: new Date().toISOString(),
          };
          await saveSquadMemberToCloud(squadId, member);
          await syncSquadToUserDoc(sessionEmail || profile.email, uid, squadId, true);
        } catch (err) {
          console.warn('Create squad cloud notice:', err);
        }

        squads = [newSquad, ...squads];
        activeSquadId = squadId;
        profile = {
          ...profile,
          activeSquadId: squadId,
          squadIds: Array.from(new Set([...(profile.squadIds || []), squadId])),
        };
        if (nameInput) nameInput.value = '';
        void pushWorkstationToCloud();
        subscribeToSquadMembers(squadId);
        populateSquadsPage();
        setStatus(`Created Squad: ${name}`);
      });

      document.getElementById('form-join-squad')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('squad-join-code');
        const code = sanitizeTextInput(codeInput?.value, 8)
          .replace(/[^A-Z0-9]/gi, '')
          .toUpperCase();
        if (!code || !db) return;

        try {
          const q = query(collection(db, 'squads'), where('code', '==', code));
          const snap = await getDocs(q);
          if (snap.empty) {
            alert(`No squad found with code "${code}".`);
            return;
          }
          const foundSquad = snap.docs[0].data();
          const uid = getEmailDocId(sessionEmail || profile.email || 'local_student');
          const member = {
            uid,
            displayName: sanitizeTextInput(profile.name || 'Student', 100),
            color: '#3B77BC',
            elo: calculateElo(
              profile.minutesStudiedThisWeek || 0,
              profile.tasksCompletedThisWeek || 0,
              profile.currentStreak || 0
            ),
            minutesThisWeek: profile.minutesStudiedThisWeek || 0,
            tasksThisWeek: profile.tasksCompletedThisWeek || 0,
            currentStreak: profile.currentStreak || 0,
            joinedAt: new Date().toISOString(),
          };
          await saveSquadMemberToCloud(foundSquad.id, member);
          await syncSquadToUserDoc(sessionEmail || profile.email, uid, foundSquad.id, true);

          if (!squads.some((s) => s.id === foundSquad.id)) {
            squads = [foundSquad, ...squads];
          }
          activeSquadId = foundSquad.id;
          profile = {
            ...profile,
            activeSquadId: foundSquad.id,
            squadIds: Array.from(new Set([...(profile.squadIds || []), foundSquad.id])),
          };
          if (codeInput) codeInput.value = '';
          void pushWorkstationToCloud();
          subscribeToSquadMembers(foundSquad.id);
          populateSquadsPage();
          setStatus(`Joined Squad: ${foundSquad.name}`);
        } catch (err) {
          console.warn('Join squad error:', err);
          alert('Could not join squad. Check your internet connection.');
        }
      });
    }

    if (route === 'settings') {
      document.getElementById('form-settings-profile')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = sanitizeTextInput(document.getElementById('set-name').value, 100);
        const inputEmail = sanitizeEmailInput(document.getElementById('set-email').value);
        const email = sessionEmail || inputEmail;
        const studentId = sanitizeTextInput(document.getElementById('set-student-id').value, 40);
        const institution = sanitizeTextInput(
          document.getElementById('set-institution').value,
          120
        );
        const degreeName = sanitizeTextInput(
          document.getElementById('set-degree-name').value,
          120
        );
        const degreeType = sanitizeTextInput(document.getElementById('set-degree-type').value, 80);
        const academicYear = sanitizeTextInput(
          document.getElementById('set-academic-year').value,
          40
        );
        const totalTargetCFU = Math.min(
          360,
          Math.max(30, Number(document.getElementById('set-target-cfu').value) || 180)
        );
        const weeklyGoalHours = Math.min(
          100,
          Math.max(1, Number(document.getElementById('set-weekly-goal').value) || 20)
        );

        profile = sanitizeUserProfile(
          {
            ...profile,
            name,
            email,
            studentId,
            institution,
            degreeName,
            degreeType,
            academicYear,
            totalTargetCFU,
            weeklyGoalHours,
          },
          profile,
          sessionEmail || null
        );
        void pushWorkstationToCloud();
        populateSettingsPage();
        setStatus('Settings saved');
      });

      document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
        await pushWorkstationToCloud();
        setStatus('Synchronized with Firebase');
      });

      document
        .getElementById('btn-sign-out')
        ?.addEventListener('click', () => void handleLogout());

      document
        .getElementById('btn-export-json')
        ?.addEventListener('click', () => exportWorkspaceJson());

      document.getElementById('input-import-json')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = JSON.parse(String(ev.target?.result || '{}'));
            if (parsed.profile && typeof parsed.profile === 'object') {
              profile = sanitizeUserProfile(
                parsed.profile,
                profile,
                sessionEmail || profile.email || null
              );
            }
            if (Array.isArray(parsed.courses)) courses = sanitizeCourseList(parsed.courses);
            if (Array.isArray(parsed.studyLogs)) studyLogs = sanitizeStudyLogList(parsed.studyLogs);
            if (Array.isArray(parsed.assignments)) {
              assignments = sanitizeAssignmentList(parsed.assignments);
            }
            if (typeof parsed.quickNotes === 'string') {
              quickNotes = sanitizeTextInput(parsed.quickNotes, 5000, true);
            }
            if (typeof parsed.checklist === 'string') {
              checklist = sanitizeTextInput(parsed.checklist, 5000, true);
            }
            if (Array.isArray(parsed.resourceLinks)) {
              resourceLinks = sanitizeResourceLinksList(parsed.resourceLinks);
            }
            void pushWorkstationToCloud();
            populateCurrentPageData();
            setStatus('Backup restored from JSON');
          } catch {
            alert('Invalid JSON backup file.');
          }
        };
        reader.readAsText(file);
      });

      document.getElementById('btn-reset-data')?.addEventListener('click', () => {
        if (!window.confirm('Are you sure you want to clear all local workspace data?')) return;
        profile = { ...INITIAL_PROFILE };
        courses = [];
        studyLogs = [];
        assignments = [];
        quickNotes = '';
        checklist = '';
        resourceLinks = [];
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus('All data cleared');
      });
    }
  }

  // --- Global Delegated Click Listeners for Navigation, Table Links & Modals ---
  document.addEventListener('click', (e) => {
    const rawTarget = e.target;
    const target =
      rawTarget && typeof rawTarget.closest === 'function'
        ? rawTarget.closest(
            '[data-nav], [data-close-modal], [data-open-course], [data-delete-course], [data-delete-log], [data-delete-resource], [data-open-assignment], [data-toggle-assignment], [data-delete-assignment], [data-select-squad], [data-leave-squad], #btn-google-sso, #btn-header-logout'
          ) || rawTarget
        : rawTarget;
    if (!target || typeof target.getAttribute !== 'function') return;

    if (target.id === 'btn-header-logout') {
      e.preventDefault();
      void handleLogout();
      return;
    }

    if (target.id === 'btn-google-sso') {
      e.preventDefault();
      void handleGoogleSignIn();
      return;
    }

    const navTarget = target.getAttribute('data-nav');
    if (navTarget) {
      e.preventDefault();
      void loadAndRenderPage(navTarget, true);
      return;
    }

    const closeModalId = target.getAttribute('data-close-modal');
    if (closeModalId) {
      const dialog = document.getElementById(closeModalId);
      dialog?.close();
      return;
    }

    const openCourseId = target.getAttribute('data-open-course');
    if (openCourseId) {
      e.preventDefault();
      const found = courses.find((c) => c.id === openCourseId);
      if (found) openCourseModal(found);
      return;
    }

    const deleteCourseId = target.getAttribute('data-delete-course');
    if (deleteCourseId) {
      e.preventDefault();
      courses = courses.filter((c) => c.id !== deleteCourseId);
      void pushWorkstationToCloud();
      populateCurrentPageData();
      setStatus('Course deleted');
      return;
    }

    const deleteLogId = target.getAttribute('data-delete-log');
    if (deleteLogId) {
      e.preventDefault();
      studyLogs = studyLogs.filter((l) => l.id !== deleteLogId);
      void pushWorkstationToCloud();
      populateCurrentPageData();
      setStatus('Session log deleted');
      return;
    }

    const deleteResourceId = target.getAttribute('data-delete-resource');
    if (deleteResourceId) {
      e.preventDefault();
      resourceLinks = resourceLinks.filter((r) => r.id !== deleteResourceId);
      void pushWorkstationToCloud();
      populateCurrentPageData();
      setStatus('Resource deleted');
      return;
    }

    const openAssignmentId = target.getAttribute('data-open-assignment');
    if (openAssignmentId) {
      e.preventDefault();
      const found = assignments.find((a) => a.id === openAssignmentId);
      if (found) openAssignmentModal(found);
      return;
    }

    const toggleAssignmentId = target.getAttribute('data-toggle-assignment');
    if (toggleAssignmentId) {
      e.preventDefault();
      assignments = assignments.map((a) => {
        if (a.id !== toggleAssignmentId) return a;
        const nextStatus = a.status === 'completed' ? 'todo' : 'completed';
        return {
          ...a,
          status: nextStatus,
          completedAt: nextStatus === 'completed' ? Date.now() : a.completedAt,
        };
      });
      void pushWorkstationToCloud();
      populateCurrentPageData();
      setStatus('Updated status');
      return;
    }

    const deleteAssignmentId = target.getAttribute('data-delete-assignment');
    if (deleteAssignmentId) {
      e.preventDefault();
      assignments = assignments.filter((a) => a.id !== deleteAssignmentId);
      void pushWorkstationToCloud();
      populateCurrentPageData();
      setStatus('Deleted item');
      return;
    }

    const selectSquadId = target.getAttribute('data-select-squad');
    if (selectSquadId) {
      e.preventDefault();
      activeSquadId = selectSquadId;
      profile = { ...profile, activeSquadId: selectSquadId };
      void pushWorkstationToCloud();
      subscribeToSquadMembers(selectSquadId);
      populateSquadsPage();
      return;
    }

    const leaveSquadId = target.getAttribute('data-leave-squad');
    if (leaveSquadId) {
      e.preventDefault();
      const uid = getEmailDocId(sessionEmail || profile.email || 'local_student');
      squads = squads.filter((s) => s.id !== leaveSquadId);
      const nextActive = squads[0]?.id || null;
      activeSquadId = nextActive;
      profile = {
        ...profile,
        activeSquadId: nextActive || undefined,
        squadIds: (profile.squadIds || []).filter((id) => id !== leaveSquadId),
      };
      void removeSquadFromUserDoc(sessionEmail || profile.email, uid, leaveSquadId, nextActive);
      void pushWorkstationToCloud();
      subscribeToSquadMembers(nextActive);
      populateSquadsPage();
      setStatus('Left squad');
      return;
    }
  });

  // --- Modal Form Submissions ---
  function bindDialogFormEvents() {
    const courseForm = document.getElementById('form-course');
    if (courseForm && !boundElements.has(courseForm)) {
      boundElements.add(courseForm);
      courseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = sanitizeTextInput(document.getElementById('course-id').value, 80);
        const sanitized = sanitizeCourseItem({
          id: id || `course-${Date.now()}`,
          title: document.getElementById('course-title').value,
          status: document.getElementById('course-status').value,
          cfu: document.getElementById('course-cfu').value,
          year: document.getElementById('course-year').value,
          semester: document.getElementById('course-semester').value,
          email: document.getElementById('course-email').value,
          officeHours: document.getElementById('course-office').value,
          notes: document.getElementById('course-notes').value,
        });

        if (!sanitized) return;

        if (id) {
          courses = courses.map((c) => (c.id === id ? { ...c, ...sanitized } : c));
          setStatus(`Updated course: ${sanitized.title}`);
        } else {
          courses = [sanitized, ...courses];
          setStatus(`Added course: ${sanitized.title}`);
        }

        document.getElementById('modal-course')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
      });

      document.getElementById('btn-delete-course')?.addEventListener('click', () => {
        const id = sanitizeTextInput(document.getElementById('course-id').value, 80);
        if (!id) return;
        courses = courses.filter((c) => c.id !== id);
        document.getElementById('modal-course')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus('Course deleted');
      });
    }

    const logForm = document.getElementById('form-log');
    if (logForm && !boundElements.has(logForm)) {
      boundElements.add(logForm);
      logForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const rawSubject = sanitizeTextInput(document.getElementById('log-subject').value, 120);
        const date = document.getElementById('log-date').value;
        if (!rawSubject || !date) return;

        const matchedCourse = courses.find(
          (c) => c.title.toLowerCase() === rawSubject.toLowerCase()
        );
        const newLog = sanitizeStudyLogItem({
          id: `log-${Date.now()}`,
          courseId: matchedCourse?.id,
          courseName: matchedCourse ? matchedCourse.title : rawSubject,
          durationMinutes: document.getElementById('log-minutes').value,
          date,
          notes: document.getElementById('log-notes').value,
          rating: 5,
          tag: document.getElementById('log-tag').value,
          timestamp: Date.now(),
        });

        if (!newLog) return;

        studyLogs = [newLog, ...studyLogs];

        const xpGained = Math.max(20, Math.round(newLog.durationMinutes * 2));
        const { streak, today } = updateStreak(profile.currentStreak || 0, profile.lastActiveDate);
        profile = {
          ...profile,
          xp: (profile.xp || 0) + xpGained,
          currentStreak: streak,
          minutesStudiedThisWeek: (profile.minutesStudiedThisWeek || 0) + newLog.durationMinutes,
          lastActiveDate: today,
        };

        document.getElementById('modal-log')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus(
          `Added session log: ${newLog.courseName} (${formatStudyDuration(newLog.durationMinutes)})`
        );
      });
    }

    const resourceForm = document.getElementById('form-resource');
    if (resourceForm && !boundElements.has(resourceForm)) {
      boundElements.add(resourceForm);
      resourceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = sanitizeTextInput(document.getElementById('resource-title').value, 200);
        const rawUrl = document.getElementById('resource-url').value.trim();
        const category = sanitizeTextInput(document.getElementById('resource-category').value, 64);

        const safeUrl = sanitizeResourceUrl(rawUrl);
        if (!title || !safeUrl) {
          alert('Please enter a valid title and http:// or https:// resource URL.');
          return;
        }

        const newRes = {
          id: `res-${Date.now()}`,
          title,
          url: safeUrl,
          category: category || 'Portal',
          createdAt: Date.now(),
        };

        resourceLinks = [...resourceLinks, newRes];
        document.getElementById('modal-resource')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus(`Added resource: ${title}`);
      });
    }

    const assignmentForm = document.getElementById('form-assignment');
    if (assignmentForm && !boundElements.has(assignmentForm)) {
      boundElements.add(assignmentForm);
      assignmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = sanitizeTextInput(document.getElementById('assignment-id').value, 80);
        const title = sanitizeTextInput(document.getElementById('assignment-title').value, 150);
        const courseName = sanitizeTextInput(
          document.getElementById('assignment-course').value,
          120
        );
        const type = document.getElementById('assignment-type').value;
        const dueDate = document.getElementById('assignment-due').value;
        let status = document.getElementById('assignment-status').value;
        const gradeRaw = document.getElementById('assignment-grade').value.trim();
        const es1Raw = document.getElementById('assignment-esonero1').value.trim();
        const es2Raw = document.getElementById('assignment-esonero2').value.trim();
        const notes = sanitizeTextInput(
          document.getElementById('assignment-notes').value,
          1000,
          true
        );

        if (!title || !courseName || !dueDate) return;

        let grade = undefined;
        let examParts = undefined;

        if (es1Raw !== '' || es2Raw !== '') {
          const g1 = es1Raw !== '' ? Math.min(30, Math.max(0, Number(es1Raw))) : undefined;
          const g2 = es2Raw !== '' ? Math.min(30, Math.max(0, Number(es2Raw))) : undefined;
          examParts = [
            { label: 'Esonero 1', grade: g1 },
            { label: 'Esonero 2', grade: g2 },
          ];
          if (getExamResult(examParts) !== null) {
            status = 'completed';
          }
        } else if (gradeRaw !== '') {
          grade = Math.min(30, Math.max(0, Number(gradeRaw)));
          if (isExamType(type) && grade >= 18) {
            status = 'completed';
          }
        }

        const sanitizedAsg = sanitizeAssignmentItem({
          id: id || `asg-${Date.now()}`,
          title,
          courseName,
          type,
          dueDate,
          status,
          grade,
          examParts,
          notes,
          completedAt: status === 'completed' ? Date.now() : undefined,
        });

        if (!sanitizedAsg) return;

        if (id) {
          assignments = assignments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...sanitizedAsg,
                  completedAt:
                    sanitizedAsg.status === 'completed'
                      ? a.completedAt || Date.now()
                      : a.completedAt,
                }
              : a
          );
          setStatus(`Updated: ${sanitizedAsg.title}`);
        } else {
          assignments = [sanitizedAsg, ...assignments];
          setStatus(`Added: ${sanitizedAsg.title}`);
        }

        document.getElementById('modal-assignment')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
      });

      document.getElementById('btn-delete-assignment')?.addEventListener('click', () => {
        const id = sanitizeTextInput(document.getElementById('assignment-id').value, 80);
        if (!id) return;
        assignments = assignments.filter((a) => a.id !== id);
        document.getElementById('modal-assignment')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus('Deleted item');
      });
    }
  }

  // --- Firebase Auth Listener & Browser History Navigation ---
  if (auth) {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          void completeGoogleUserSignIn(res.user);
        }
      })
      .catch((err) => {
        const classified = formatGoogleAuthError(err);
        if (classified.code) {
          authNotice = { type: 'error', text: classified.message };
          populateLoginPage();
        }
      });

    onAuthStateChanged(auth, (user) => {
      if (isEmailAuthPending) return;
      if (user?.email) {
        const cleanEmail = user.email.trim().toLowerCase();
        const wasUnauthenticated = !isAuthenticated;
        sessionEmail = cleanEmail;
        isAuthenticated = true;
        try {
          localStorage.setItem(`${STORAGE_KEY}_session_email`, cleanEmail);
        } catch {}
        setupRealtimeFirestoreSync();
        if (wasUnauthenticated) {
          void completeGoogleUserSignIn(user);
        } else {
          void loadAndRenderPage(getRouteFromLocation(), false);
        }
      }
    });
  }

  window.addEventListener('popstate', () => {
    void loadAndRenderPage(getRouteFromLocation(), false);
  });

  window.addEventListener('resize', () => {
    updateScrollableTablesMaxHeight();
  });

  // Initial startup
  bindDialogFormEvents();
  setupRealtimeFirestoreSync();
  setStatus('Ready');
  void loadAndRenderPage(getRouteFromLocation(), !isAuthenticated);
}
