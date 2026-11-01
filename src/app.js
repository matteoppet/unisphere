import { auth, db } from './lib/firebase.js';
import {
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
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
  dispatchVerificationCode,
  verifyEmailCode,
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

function escapeHtml(value) {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
      if (saved) return JSON.parse(saved);
    } catch {}
    return { ...INITIAL_PROFILE };
  })();

  let courses = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_courses`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [...DEFAULT_STARTER_COURSES];
  })();

  let studyLogs = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [...DEFAULT_STARTER_LOGS];
  })();

  let assignments = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_assignments`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  })();

  let quickNotes = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_quick_notes`);
      if (saved !== null) return saved;
    } catch {}
    return '';
  })();

  let checklist = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_checklist`);
      if (saved !== null) return saved;
    } catch {}
    return '';
  })();

  let resourceLinks = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_resource_links`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (r) =>
              !['res-1', 'res-2', 'res-3', 'res-4'].includes(r.id) &&
              !r.url?.includes('unirand.it')
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
    if (!isAuthenticated || !targetEmail) return;

    const docId = getEmailDocId(targetEmail);
    try {
      const userRef = doc(db, 'users', docId);
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
    if (!isAuthenticated || !targetEmail) {
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

        profile = {
          ...profile,
          name: data.name ?? profile.name,
          studentId: data.studentId ?? profile.studentId,
          email: data.email ?? profile.email,
          degreeLevel: data.degreeLevel ?? profile.degreeLevel,
          degreeName: data.degreeName ?? profile.degreeName,
          degreeType: data.degreeType ?? profile.degreeType,
          totalTargetCFU: data.totalTargetCFU ?? profile.totalTargetCFU,
          enrolledYear: data.enrolledYear ?? profile.enrolledYear,
          academicYear: data.academicYear ?? profile.academicYear,
          institution: data.institution ?? profile.institution,
          status: data.status ?? profile.status,
          activeSquadId: data.activeSquadId ?? profile.activeSquadId,
          squadIds: Array.isArray(data.squadIds) ? data.squadIds : profile.squadIds,
          xp: typeof data.xp === 'number' ? data.xp : profile.xp,
          currentStreak:
            typeof data.currentStreak === 'number' ? data.currentStreak : profile.currentStreak,
          minutesStudiedThisWeek:
            typeof data.minutesStudiedThisWeek === 'number'
              ? data.minutesStudiedThisWeek
              : profile.minutesStudiedThisWeek,
          tasksCompletedThisWeek:
            typeof data.tasksCompletedThisWeek === 'number'
              ? data.tasksCompletedThisWeek
              : profile.tasksCompletedThisWeek,
          lastActiveDate: data.lastActiveDate ?? profile.lastActiveDate,
        };

        if (Array.isArray(data.courses)) courses = data.courses;
        if (Array.isArray(data.studyLogs)) studyLogs = data.studyLogs;
        if (Array.isArray(data.assignments)) assignments = data.assignments;
        if (typeof data.quickNotes === 'string') quickNotes = data.quickNotes;
        if (typeof data.checklist === 'string') checklist = data.checklist;
        if (Array.isArray(data.resourceLinks)) {
          resourceLinks = data.resourceLinks.filter(
            (r) =>
              !['res-1', 'res-2', 'res-3', 'res-4'].includes(r.id) &&
              !r.url?.includes('unirand.it')
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
      await signOut(auth);
    } catch {}
    try {
      localStorage.removeItem(`${STORAGE_KEY}_session_email`);
    } catch {}
    sessionEmail = null;
    isAuthenticated = false;
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
    const { weekDays, weekTotalMinutes } = getWeekDaysSummary(studyLogs);
    const fiveDayWeek = weekDays.slice(0, 5);

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
      dash5DayThead.innerHTML = fiveDayWeek
        .map(
          (d) =>
            `<th>${escapeHtml(d.shortDay)}<span class="day-sub">${escapeHtml(d.formattedDate)}</span></th>`
        )
        .join('');
    }

    const dash5DayTbody = document.getElementById('dash-5day-tbody');
    if (dash5DayTbody) {
      dash5DayTbody.innerHTML = fiveDayWeek
        .map(
          (d) =>
            `<td><strong class="${d.minutes > 0 ? 'study-hours-positive' : 'study-hours-zero'}">${escapeHtml(d.hours)}</strong></td>`
        )
        .join('');
    }

    const logsTbody = document.getElementById('dash-logs-tbody');
    if (logsTbody) {
      logsTbody.innerHTML =
        studyLogs.length === 0
          ? `<tr><td colspan="4" class="empty-cell">No session logs recorded yet.</td></tr>`
          : studyLogs
              .slice(0, 10)
              .map(
                (l) => `
              <tr>
                <td>${escapeHtml(formatReadableDate(l.date))}</td>
                <td>${escapeHtml(l.courseName)}</td>
                <td>${escapeHtml(formatStudyDuration(l.durationMinutes))}</td>
                <td><a href="#" data-delete-log="${escapeHtml(l.id)}">Delete</a></td>
              </tr>`
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
              .map(
                (r) => `
              <li>
                <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>
                <span class="item-meta">(<a href="#" data-delete-resource="${escapeHtml(r.id)}">Delete</a>)</span>
              </li>`
              )
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
              .map(
                (c) => `
              <tr>
                <td>${escapeHtml(c.title)}</td>
                <td>Year ${escapeHtml(c.year)} / Sem ${escapeHtml(c.semester)}</td>
                <td>${escapeHtml(formatStatusLabel(c.status))}</td>
                <td>${escapeHtml(c.cfu)}</td>
                <td>${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : '-'}</td>
                <td>${escapeHtml(c.officeHours || '-')}</td>
                <td>
                  <a href="#" data-open-course="${escapeHtml(c.id)}">Open</a> |
                  <a href="#" data-delete-course="${escapeHtml(c.id)}">Delete</a>
                </td>
              </tr>`
              )
              .join('');
    }
  }

  function populateLogsPage() {
    const { weekDays } = getWeekDaysSummary(studyLogs);
    const fiveDayWeek = weekDays.slice(0, 5);
    const totalMinutesAllTime = studyLogs.reduce((sum, l) => sum + l.durationMinutes, 0);

    const headerEl = document.getElementById('logs-5day-header');
    if (headerEl) {
      headerEl.textContent = `Current 5-Day Week Study Time (Total All-Time: ${formatStudyDuration(totalMinutesAllTime)})`;
    }

    const theadEl = document.getElementById('logs-5day-thead');
    if (theadEl) {
      theadEl.innerHTML = fiveDayWeek
        .map((d) => `<th>${escapeHtml(d.shortDay)} (${escapeHtml(d.formattedDate)})</th>`)
        .join('');
    }

    const tbodyEl = document.getElementById('logs-5day-tbody');
    if (tbodyEl) {
      tbodyEl.innerHTML = fiveDayWeek
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
      registryTbody.innerHTML =
        filteredLogs.length === 0
          ? `<tr><td colspan="6" class="empty-cell">No study session logs recorded.</td></tr>`
          : filteredLogs
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
              .join('');
    }
  }

  function populateAssignmentsPage() {
    const media = calculateMediaGrades(assignments, courses);

    const summaryTbody = document.getElementById('assignments-summary-tbody');
    if (summaryTbody) {
      summaryTbody.innerHTML = `
        <tr>
          <td>${media.examCount}</td>
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
                <td>${escapeHtml(m.displayName || m.email || 'Student')}</td>
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
      const loaded = await fetchUserSquads(email, uid, profile.squadIds);
      if (loaded.length > 0) {
        squads = loaded;
        if (!activeSquadId || !squads.some((s) => s.id === activeSquadId)) {
          activeSquadId = squads[0].id;
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
    if (!squadId) {
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
      `"${(l.date || '').replace(/"/g, '""')}"`,
      `"${(l.courseName || '').replace(/"/g, '""')}"`,
      l.durationMinutes || 0,
      `"${(l.tag || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
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
      profile,
      courses,
      studyLogs,
      assignments,
      quickNotes,
      checklist,
      resourceLinks,
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
      profile = {
        ...profile,
        name: userData.name ?? profile.name,
        studentId: userData.studentId ?? profile.studentId,
        email: normalizedEmail,
        degreeName: userData.degreeName ?? profile.degreeName,
        degreeType: userData.degreeType ?? profile.degreeType,
        totalTargetCFU: userData.totalTargetCFU ?? profile.totalTargetCFU,
        academicYear: userData.academicYear ?? profile.academicYear,
        institution: userData.institution ?? profile.institution,
        xp: typeof userData.xp === 'number' ? userData.xp : profile.xp,
        currentStreak:
          typeof userData.currentStreak === 'number'
            ? userData.currentStreak
            : profile.currentStreak,
        minutesStudiedThisWeek:
          typeof userData.minutesStudiedThisWeek === 'number'
            ? userData.minutesStudiedThisWeek
            : profile.minutesStudiedThisWeek,
      };
      if (Array.isArray(userData.courses)) courses = userData.courses;
      if (Array.isArray(userData.studyLogs)) studyLogs = userData.studyLogs;
      if (Array.isArray(userData.assignments)) assignments = userData.assignments;
      if (typeof userData.quickNotes === 'string') quickNotes = userData.quickNotes;
      if (typeof userData.checklist === 'string') checklist = userData.checklist;
      if (Array.isArray(userData.resourceLinks)) resourceLinks = userData.resourceLinks;
    } else {
      profile = { ...profile, email: normalizedEmail };
    }

    authNotice = null;
    saveToLocalStorage();
    setupRealtimeFirestoreSync();
    void loadAndRenderPage('dashboard', true);
    setStatus(`Logged in as ${normalizedEmail}`);
  }

  function bindAuthEvents() {
    document.getElementById('form-auth-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('auth-login-email');
      const passInput = document.getElementById('auth-login-password');
      const normalizedEmail = emailInput?.value.trim().toLowerCase() || '';
      const password = passInput?.value || '';
      if (!normalizedEmail || !password) return;

      try {
        const docId = getEmailDocId(normalizedEmail);
        const userRef = doc(db, 'users', docId);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          authNotice = {
            type: 'error',
            text: 'No account found with this email. Please register on the right.',
          };
          populateLoginPage();
          return;
        }

        const data = snap.data();
        const inputHash = await hashPassword(password);
        if (data.passwordHash && data.passwordHash !== inputHash) {
          authNotice = { type: 'error', text: 'Incorrect password. Please try again.' };
          populateLoginPage();
          return;
        }
        try {
          await signInWithEmailAndPassword(auth, normalizedEmail, password);
        } catch {}
        completeCloudLogin(data, normalizedEmail);
      } catch (err) {
        authNotice = {
          type: 'error',
          text: err instanceof Error ? err.message : 'Sign-in failed.',
        };
        populateLoginPage();
      }
    });

    document.getElementById('btn-google-sso')?.addEventListener('click', async () => {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const res = await signInWithPopup(auth, provider);
        const mail = res.user?.email?.trim().toLowerCase() || '';
        if (!mail) return;
        const docId = getEmailDocId(mail);
        const userRef = doc(db, 'users', docId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          completeCloudLogin(snap.data(), mail);
        } else {
          const newRecord = {
            uid: docId,
            email: mail,
            name: res.user.displayName || mail.split('@')[0],
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
          await setDoc(userRef, newRecord, { merge: true });
          completeCloudLogin(newRecord, mail);
        }
      } catch (err) {
        authNotice = {
          type: 'error',
          text: err instanceof Error ? err.message : 'Google Sign-In popup failed.',
        };
        populateLoginPage();
      }
    });

    document.getElementById('btn-send-otp')?.addEventListener('click', async () => {
      const regEmail = document
        .getElementById('auth-reg-email')
        ?.value.trim()
        .toLowerCase();
      if (!regEmail) {
        authNotice = { type: 'error', text: 'Enter your email first to receive a code.' };
        populateLoginPage();
        return;
      }
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
    });

    document.getElementById('form-auth-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const regName = document.getElementById('auth-reg-name').value.trim();
      const regEmail = document.getElementById('auth-reg-email').value.trim().toLowerCase();
      const regDegree = document.getElementById('auth-reg-degree').value.trim();
      const regInstitution = document.getElementById('auth-reg-institution').value.trim();
      const regCFU = Number(document.getElementById('auth-reg-cfu').value) || 180;
      const regPass = document.getElementById('auth-reg-password').value;
      const regCode = document.getElementById('auth-reg-code').value.trim();

      if (!regName || !regEmail || regPass.length < 6) return;

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

        const docId = getEmailDocId(regEmail);
        const userRef = doc(db, 'users', docId);
        const passwordHash = await hashPassword(regPass);

        const newRecord = {
          uid: docId,
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

        await setDoc(userRef, newRecord, { merge: true });
        try {
          const cred = await createUserWithEmailAndPassword(auth, regEmail, regPass);
          await updateProfile(cred.user, { displayName: regName });
        } catch {}

        completeCloudLogin(newRecord, regEmail);
      } catch (err) {
        authNotice = {
          type: 'error',
          text: err instanceof Error ? err.message : 'Registration error.',
        };
        populateLoginPage();
      }
    });
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
          quickNotes = notesEl.value;
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
        const name = nameInput?.value.trim() || '';
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
          creatorName: profile.name || 'Student',
          memberCount: 1,
          memberUids: [uid],
        };

        try {
          await setDoc(doc(db, 'squads', squadId), newSquad);
          const member = {
            uid,
            displayName: profile.name || sessionEmail || 'Student',
            email: sessionEmail || profile.email,
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
        const code = codeInput?.value.trim().toUpperCase() || '';
        if (!code) return;

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
            displayName: profile.name || sessionEmail || 'Student',
            email: sessionEmail || profile.email,
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
        const name = document.getElementById('set-name').value.trim();
        const email = document.getElementById('set-email').value.trim();
        const studentId = document.getElementById('set-student-id').value.trim();
        const institution = document.getElementById('set-institution').value.trim();
        const degreeName = document.getElementById('set-degree-name').value.trim();
        const degreeType = document.getElementById('set-degree-type').value;
        const academicYear = document.getElementById('set-academic-year').value;
        const totalTargetCFU = Number(document.getElementById('set-target-cfu').value) || 180;
        const weeklyGoalHours = Number(document.getElementById('set-weekly-goal').value) || 20;

        profile = {
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
        };
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
            if (parsed.profile) profile = parsed.profile;
            if (Array.isArray(parsed.courses)) courses = parsed.courses;
            if (Array.isArray(parsed.studyLogs)) studyLogs = parsed.studyLogs;
            if (Array.isArray(parsed.assignments)) {
              assignments = parsed.assignments;
            }
            if (typeof parsed.quickNotes === 'string') quickNotes = parsed.quickNotes;
            if (typeof parsed.checklist === 'string') checklist = parsed.checklist;
            if (Array.isArray(parsed.resourceLinks)) {
              resourceLinks = parsed.resourceLinks;
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
    const target = e.target;
    if (!target || typeof target.getAttribute !== 'function') return;

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
    if (courseForm && !courseForm.dataset.bound) {
      courseForm.dataset.bound = 'true';
      courseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('course-id').value.trim();
        const title = document.getElementById('course-title').value.trim();
        const status = document.getElementById('course-status').value;
        const cfu = Number(document.getElementById('course-cfu').value) || 6;
        const year = Number(document.getElementById('course-year').value) || 1;
        const semester = Number(document.getElementById('course-semester').value) || 1;
        const email = document.getElementById('course-email').value.trim();
        const officeHours = document.getElementById('course-office').value.trim();
        const notes = document.getElementById('course-notes').value.trim();

        if (!title) return;

        if (id) {
          courses = courses.map((c) =>
            c.id === id
              ? {
                  ...c,
                  title,
                  shortTitle: title,
                  status,
                  cfu,
                  year,
                  semester,
                  email,
                  officeHours,
                  notes,
                }
              : c
          );
          setStatus(`Updated course: ${title}`);
        } else {
          const newCourse = {
            id: `course-${Date.now()}`,
            code: title.slice(0, 6).toUpperCase(),
            title,
            shortTitle: title,
            email,
            officeHours,
            cfu,
            year,
            semester,
            status,
            progress: status === 'completed' ? 100 : 0,
            color: '#3B77BC',
            notes,
          };
          courses = [newCourse, ...courses];
          setStatus(`Added course: ${title}`);
        }

        document.getElementById('modal-course')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
      });

      document.getElementById('btn-delete-course')?.addEventListener('click', () => {
        const id = document.getElementById('course-id').value.trim();
        if (!id) return;
        courses = courses.filter((c) => c.id !== id);
        document.getElementById('modal-course')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus('Course deleted');
      });
    }

    const logForm = document.getElementById('form-log');
    if (logForm && !logForm.dataset.bound) {
      logForm.dataset.bound = 'true';
      logForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const subject = document.getElementById('log-subject').value.trim();
        const date = document.getElementById('log-date').value;
        const durationMinutes = Number(document.getElementById('log-minutes').value) || 60;
        const tag = document.getElementById('log-tag').value;
        const notes = document.getElementById('log-notes').value.trim();

        if (!subject || !date) return;

        const matchedCourse = courses.find((c) => c.title.toLowerCase() === subject.toLowerCase());
        const newLog = {
          id: `log-${Date.now()}`,
          courseId: matchedCourse?.id,
          courseName: matchedCourse ? matchedCourse.title : subject,
          durationMinutes,
          date,
          timeRange: date,
          notes,
          rating: 5,
          tag,
          timestamp: Date.now(),
        };

        studyLogs = [newLog, ...studyLogs];

        const xpGained = Math.max(20, Math.round(durationMinutes * 2));
        const { streak, today } = updateStreak(profile.currentStreak || 0, profile.lastActiveDate);
        profile = {
          ...profile,
          xp: (profile.xp || 0) + xpGained,
          currentStreak: streak,
          minutesStudiedThisWeek: (profile.minutesStudiedThisWeek || 0) + durationMinutes,
          lastActiveDate: today,
        };

        document.getElementById('modal-log')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus(`Added session log: ${subject} (${formatStudyDuration(durationMinutes)})`);
      });
    }

    const resourceForm = document.getElementById('form-resource');
    if (resourceForm && !resourceForm.dataset.bound) {
      resourceForm.dataset.bound = 'true';
      resourceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('resource-title').value.trim();
        const url = document.getElementById('resource-url').value.trim();
        const category = document.getElementById('resource-category').value;

        if (!title || !url) return;

        const newRes = {
          id: `res-${Date.now()}`,
          title,
          url,
          category,
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
    if (assignmentForm && !assignmentForm.dataset.bound) {
      assignmentForm.dataset.bound = 'true';
      assignmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('assignment-id').value.trim();
        const title = document.getElementById('assignment-title').value.trim();
        const courseName = document.getElementById('assignment-course').value.trim();
        const type = document.getElementById('assignment-type').value;
        const dueDate = document.getElementById('assignment-due').value;
        let status = document.getElementById('assignment-status').value;
        const gradeRaw = document.getElementById('assignment-grade').value.trim();
        const es1Raw = document.getElementById('assignment-esonero1').value.trim();
        const es2Raw = document.getElementById('assignment-esonero2').value.trim();
        const notes = document.getElementById('assignment-notes').value.trim();

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

        if (id) {
          assignments = assignments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  title,
                  courseName,
                  type,
                  dueDate,
                  status,
                  grade,
                  examParts,
                  notes,
                  completedAt:
                    status === 'completed' ? a.completedAt || Date.now() : a.completedAt,
                }
              : a
          );
          setStatus(`Updated: ${title}`);
        } else {
          const newAsg = {
            id: `asg-${Date.now()}`,
            title,
            courseName,
            type,
            dueDate,
            status,
            grade,
            examParts,
            notes,
            completedAt: status === 'completed' ? Date.now() : undefined,
          };
          assignments = [newAsg, ...assignments];
          setStatus(`Added: ${title}`);
        }

        document.getElementById('modal-assignment')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
      });

      document.getElementById('btn-delete-assignment')?.addEventListener('click', () => {
        const id = document.getElementById('assignment-id').value.trim();
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
  onAuthStateChanged(auth, (user) => {
    if (user?.email) {
      const cleanEmail = user.email.trim().toLowerCase();
      sessionEmail = cleanEmail;
      isAuthenticated = true;
      try {
        localStorage.setItem(`${STORAGE_KEY}_session_email`, cleanEmail);
      } catch {}
      setupRealtimeFirestoreSync();
      void loadAndRenderPage(getRouteFromLocation(), false);
    }
  });

  window.addEventListener('popstate', () => {
    void loadAndRenderPage(getRouteFromLocation(), false);
  });

  // Initial startup
  document
    .getElementById('btn-header-logout')
    ?.addEventListener('click', () => void handleLogout());
  bindDialogFormEvents();
  setupRealtimeFirestoreSync();
  void loadAndRenderPage(getRouteFromLocation(), false);
}
