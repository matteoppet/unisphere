import { auth, db } from './lib/firebase.js';
import {
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
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
  stripUndefinedDeep,
  reconcileStudyLogs,
} from './lib/authService.js';
import {
  fetchUserSquads,
  syncSquadToUserDoc,
  removeSquadFromUserDoc,
  leaveSquadCleanly,
  saveSquadMemberToCloud,
  updateSquadAdminDetails,
  removeMemberFromSquad,
  deleteSquadCompletely,
  setMemberLiveStatus,
  clearMemberLiveStatus,
  addSquadFeedNote,
  deleteSquadFeedNote,
  updateSquadNextSession,
  sendFriendRequest,
  acceptFriendRequest,
  declineOrRemoveFriendship,
  fetchUserFriendships,
  fetchFriendProfileTelemetry,
  FRIENDS_HUB_SQUAD_ID,
  FRIENDSHIPS_STORAGE_KEY,
  hubActivityDocToFriendship,
} from './lib/squadService.js';
import {
  formatStudyDuration,
  getLocalDateString,
  getWeekDaysSummary,
  groupStudyLogsByWeek,
  calculateTableScrollMaxHeight,
  calculateDurationFromHoursMinutes,
  calculateDurationFromRange,
  addMinutesToTimeString,
  updateStreak,
  calculateCurrentStreak,
  countCompletedTasksThisWeek,
  getMemberEffectiveTelemetry,
  getWeeklyDailyMinutesMap,
  getWeeklySubjectMinutesMap,
  aggregateSquadWeeklyDays,
  aggregateSquadSubjectHours,
  getMemberWeekDaysSummary,
  formatLiveElapsed,
  canManageSquad,
  sortSquadMembers,
  deduplicateSquadMembers,
  isCurrentUserRemovedFromSquad,
  getFriendshipId,
  doesFriendshipMatchUser,
  partitionFriendships,
  filterFriendsByQuery,
  buildFriendTelemetrySummary,
  calculateElo,
  generateSquadCode,
} from './utils/telemetry.js';
import {
  calculateMediaGrades,
  getItemExamGrade,
  formatExamDate,
  formatExamDateShort,
  normalizeAssignmentType,
  getAssignmentDisplayGrade,
  getExamUrgencyState,
  sortAssignmentsForTable,
  shouldRenderCompletedDivider,
  findCourseForName,
  clampExamGradeValue,
  isValidGradeInput,
} from './utils/grades.js';
import {
  sanitizeGoalItem,
  normalizeGoalsList,
  sortGoalsForDisplay,
  upsertGoalItem,
  toggleGoalCompletion,
  deleteGoalItem,
} from './utils/checklist.js';
import {
  formatSyncStatus,
  sliceRecentLogsForDashboard,
  parseDashboardQueryParams,
  buildDashboardUrl,
} from './utils/uiState.js';

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
  return list
    .filter((item) => item?.id !== 'course-analisi-1')
    .map((item) => sanitizeCourseItem(item))
    .filter(Boolean);
}

function sanitizeStudyLogList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item?.id !== 'log-starter-1')
    .map((item) => sanitizeStudyLogItem(item))
    .filter(Boolean);
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

function renderWeekDayHoursCell(d) {
  if (d.minutes > 0) {
    return `<td><strong class="study-hours-positive">${escapeHtml(d.hours)}</strong></td>`;
  }
  if (d.isFuture) {
    return `<td><span class="study-hours-future" aria-label="Upcoming day">–</span></td>`;
  }
  return `<td><strong class="study-hours-zero">${escapeHtml(d.hours)}</strong></td>`;
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
    return [];
  })();

  let studyLogs = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_logs`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sanitizeStudyLogList(parsed);
      }
    } catch {}
    return [];
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
      if (saved !== null) return normalizeGoalsList(saved);
    } catch {}
    return [];
  })();

  let resourceLinks = (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_resource_links`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return sanitizeResourceLinksList(
            parsed.filter(
              (r) =>
                !['res-1', 'res-2', 'res-3', 'res-4', 'res-gomp', 'res-celestrack'].includes(
                  r?.id
                ) && !r?.url?.includes('unirand.it')
            )
          );
        }
      }
    } catch {}
    return [];
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
  const initialDashQuery = parseDashboardQueryParams(window.location.search);
  let dashCourseStatusFilter = initialDashQuery.courseStatus;
  let dashResourceNotesTab = initialDashQuery.panel;
  let courseYearFilter = 'all';
  let courseStatusFilter = 'active';
  let courseSearchQuery = '';
  let logSubjectFilter = 'all';
  let assignmentTypeFilter = 'all';
  const expandedAssignmentIds = new Set();
  let lastAssignmentsDateKey = getLocalDateString();
  let assignmentsDailyInterval = null;

  // Squads & Friends state (isolated to squads.html)
  let squads = [];
  let activeSquadId = profile.activeSquadId || null;
  let squadMembers = [];
  let squadPresence = [];
  let squadActivities = [];
  let squadMembersSort = 'hours';
  let myLiveSession = null;
  let squadDocUnsub = null;
  let squadMembersUnsub = null;
  let squadPresenceUnsub = null;
  let squadActivitiesUnsub = null;
  let liveTimerInterval = null;
  let friendships = [];
  let friendSearchQuery = '';
  let selectedFriendUid = null;
  let selectedFriendTelemetry = null;
  let friendActionNotice = null;
  let dismissedIncomingNoticeKey = null;
  let friendshipsUnsub = null;
  let activeFriendshipsUid = null;
  let selectedFriendDocUnsub = null;

  // Auth UI state
  let authNotice = null;
  let verificationSentTo = null;
  let pendingUndo = null;
  let undoTimer = null;
  let quickNotesDirty = false;
  let quickNotesAutosaveTimer = null;

  // HTML page template cache for instant switching between /pages/*.html
  const pageHtmlCache = new Map();
  const pageTitleCache = new Map();
  const PAGE_TITLES = {
    login: 'UniSphere - Login',
    dashboard: 'UniSphere - Dashboard',
    courses: 'UniSphere - Courses',
    logs: 'UniSphere - Session Logs',
    assignments: 'UniSphere - Exams & Assignments',
    squads: 'UniSphere - Squads',
    settings: 'UniSphere - Settings',
  };

  // Firestore real-time listener management
  let userSnapshotUnsub = null;
  let activeSyncDocId = null;
  let hasInitialServerSnapshot = false;
  let lastCloudPullMs = 0;
  let isInitialCloudLoading = Boolean(
    isAuthenticated &&
      db &&
      courses.length === 0 &&
      studyLogs.length === 0 &&
      checklist.length === 0 &&
      resourceLinks.length === 0
  );
  let cloudSyncState = db ? 'syncing' : 'local';
  let currentActionNotice = '';
  let statusResetTimer = null;
  const syncClientId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // --- Helpers ---
  function getSyncedLogIds() {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_synced_log_ids`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveSyncedLogIds(logs) {
    try {
      if (Array.isArray(logs)) {
        const ids = logs.map((l) => l?.id).filter((id) => id && id !== 'log-starter-1');
        localStorage.setItem(`${STORAGE_KEY}_synced_log_ids`, JSON.stringify(ids));
      }
    } catch {}
  }

  function hasPendingLocalSync() {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_pending_sync`) === '1';
    } catch {
      return false;
    }
  }

  function setPendingLocalSync(pending) {
    try {
      if (pending) {
        localStorage.setItem(`${STORAGE_KEY}_pending_sync`, '1');
      } else {
        localStorage.removeItem(`${STORAGE_KEY}_pending_sync`);
      }
    } catch {}
  }

  function renderSyncStatus() {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    const status = formatSyncStatus({
      isAuthenticated,
      email: sessionEmail || profile.email,
      syncState: cloudSyncState,
      isOnline,
      hasPendingLocalSync: hasPendingLocalSync(),
      hasDb: Boolean(db),
      actionMessage: currentActionNotice,
    });

    el.classList.remove('sync-status-ok', 'sync-status-warn', 'sync-status-error');
    if (status.tone === 'ok') el.classList.add('sync-status-ok');
    else if (status.tone === 'warn') el.classList.add('sync-status-warn');
    else if (status.tone === 'error') el.classList.add('sync-status-error');

    el.textContent = status.text;
    if (status.showRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.id = 'btn-sync-retry';
      retryBtn.className = 'sync-retry-btn';
      retryBtn.textContent = 'Retry';
      el.appendChild(document.createTextNode(' '));
      el.appendChild(retryBtn);
    }
  }

  function setStatus(msg, autoResetMs = 3000) {
    if (statusResetTimer) {
      window.clearTimeout(statusResetTimer);
      statusResetTimer = null;
    }
    currentActionNotice = msg && msg !== 'Ready' ? msg : '';
    renderSyncStatus();
    if (autoResetMs > 0 && currentActionNotice) {
      const expectedNotice = currentActionNotice;
      statusResetTimer = window.setTimeout(() => {
        if (currentActionNotice === expectedNotice) {
          currentActionNotice = '';
          renderSyncStatus();
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
      localStorage.setItem(`${STORAGE_KEY}_checklist`, JSON.stringify(normalizeGoalsList(checklist)));
      localStorage.setItem(`${STORAGE_KEY}_resource_links`, JSON.stringify(resourceLinks));
    } catch (err) {
      console.warn('Local storage save notice:', err);
    }
  }

  async function fetchFreshUserDoc(userRef) {
    try {
      return await getDocFromServer(userRef);
    } catch {
      return await getDoc(userRef);
    }
  }

  function applyRemoteWorkspaceData(data, targetEmail, { isInitialHydration = false } = {}) {
    if (!data) return false;
    if (!isInitialHydration && data.updatedBy === syncClientId) return false;

    const pendingSync = hasPendingLocalSync();
    let shouldPushMergedToCloud = false;

    profile = sanitizeUserProfile(data, profile, targetEmail);

    if (Array.isArray(data.courses)) {
      courses = sanitizeCourseList(data.courses);
    }

    if (Array.isArray(data.studyLogs)) {
      const sanitizedRemoteLogs = sanitizeStudyLogList(data.studyLogs);
      if (isInitialHydration || pendingSync) {
        const { logs: mergedLogs, hasUnsyncedLocalAdditions } = reconcileStudyLogs(
          studyLogs,
          sanitizedRemoteLogs,
          data.updatedAt,
          pendingSync,
          getSyncedLogIds()
        );
        studyLogs = mergedLogs;
        if (hasUnsyncedLocalAdditions) {
          shouldPushMergedToCloud = true;
        } else {
          saveSyncedLogIds(studyLogs);
        }
      } else {
        studyLogs = sanitizedRemoteLogs;
        saveSyncedLogIds(studyLogs);
      }
    }

    if (Array.isArray(data.assignments)) {
      assignments = sanitizeAssignmentList(data.assignments);
    }
    if (typeof data.quickNotes === 'string' && !quickNotesDirty) {
      quickNotes = sanitizeTextInput(data.quickNotes, 5000, true);
    }
    if (Array.isArray(data.checklist) || typeof data.checklist === 'string') {
      checklist = normalizeGoalsList(data.checklist);
    }
    if (Array.isArray(data.resourceLinks)) {
      resourceLinks = sanitizeResourceLinksList(
        data.resourceLinks.filter(
          (r) =>
            !['res-1', 'res-2', 'res-3', 'res-4', 'res-gomp', 'res-celestrack'].includes(r?.id) &&
            !r?.url?.includes('unirand.it')
        )
      );
    }

    // Recalculate dynamic weekly metrics from actual logs
    const currentWeekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
    const currentStreak = calculateCurrentStreak(studyLogs, profile);
    profile = {
      ...profile,
      minutesStudiedThisWeek: currentWeekMinutes,
      currentStreak,
    };

    saveToLocalStorage();
    void syncUserSquadTelemetry();
    populateCurrentPageData();

    if (shouldPushMergedToCloud) {
      hasInitialServerSnapshot = true;
      void pushWorkstationToCloud();
    }

    return true;
  }

  async function pullWorkstationFromCloud({ force = false } = {}) {
    const targetEmail = sessionEmail || profile.email;
    if (!isAuthenticated || !targetEmail) return;
    if (!db) {
      cloudSyncState = 'local';
      renderSyncStatus();
      return;
    }

    const now = Date.now();
    if (!force && now - lastCloudPullMs < 1000) return;
    lastCloudPullMs = now;

    const docId = getEmailDocId(targetEmail);
    const userRef = doc(db, 'users', docId);
    cloudSyncState = 'syncing';
    renderSyncStatus();

    try {
      const snap = await fetchFreshUserDoc(userRef);
      const wasInitial = !hasInitialServerSnapshot;
      hasInitialServerSnapshot = true;
      isInitialCloudLoading = false;
      if (snap && snap.exists()) {
        applyRemoteWorkspaceData(snap.data(), targetEmail, { isInitialHydration: wasInitial });
      } else {
        populateCurrentPageData();
      }
      cloudSyncState = hasPendingLocalSync() ? 'pending' : 'synced';
      renderSyncStatus();
    } catch (err) {
      console.warn('Cloud sync pull notice:', err);
      isInitialCloudLoading = false;
      cloudSyncState = 'error';
      populateCurrentPageData();
      renderSyncStatus();
    }
  }

  async function pushWorkstationToCloud() {
    setPendingLocalSync(true);
    saveToLocalStorage();
    const targetEmail = sessionEmail || profile.email;
    if (!isAuthenticated || !targetEmail) return;
    if (!db) {
      cloudSyncState = 'local';
      renderSyncStatus();
      return;
    }

    const docId = getEmailDocId(targetEmail);
    cloudSyncState = 'syncing';
    renderSyncStatus();
    try {
      const userRef = doc(db, 'users', docId);
      // Prevent accidental overwrite of existing cloud workspace with starter local defaults
      // before the initial server snapshot has been received.
      if (!hasInitialServerSnapshot) {
        try {
          const existingSnap = await fetchFreshUserDoc(userRef);
          if (existingSnap.exists()) {
            const existingData = existingSnap.data();
            hasInitialServerSnapshot = true;

            if (Array.isArray(existingData?.studyLogs)) {
              const { logs: mergedLogs } = reconcileStudyLogs(
                studyLogs,
                existingData.studyLogs,
                existingData.updatedAt,
                true,
                getSyncedLogIds()
              );
              studyLogs = mergedLogs;
            }

            const isDefaultStarterState =
              courses.length === 0 &&
              Array.isArray(existingData?.courses) &&
              existingData.courses.length > 0;
            if (isDefaultStarterState) {
              profile = sanitizeUserProfile(existingData, profile, targetEmail);
              courses = sanitizeCourseList(existingData.courses);
              if (Array.isArray(existingData.assignments)) {
                assignments = sanitizeAssignmentList(existingData.assignments);
              }
              if (
                checklist.length === 0 &&
                (Array.isArray(existingData.checklist) || typeof existingData.checklist === 'string')
              ) {
                checklist = normalizeGoalsList(existingData.checklist);
              }
              saveToLocalStorage();
              populateCurrentPageData();
            }
          }
        } catch {}
      }

      const payload = stripUndefinedDeep({
        name: profile.name || '',
        studentId: profile.studentId || '',
        email: targetEmail.toLowerCase().trim(),
        degreeLevel: profile.degreeLevel || '',
        degreeName: profile.degreeName || '',
        degreeType: profile.degreeType || 'Laurea Triennale',
        totalTargetCFU: Number(profile.totalTargetCFU) || 180,
        enrolledYear: profile.enrolledYear ?? '',
        academicYear: profile.academicYear || 'Year 1',
        institution: profile.institution || '',
        status: profile.status || 'Enrolled',
        currentSession: profile.currentSession || 'Current Semester',
        weeklyGoalHours: Number(profile.weeklyGoalHours) || 20,
        avatarUrl: profile.avatarUrl || '',
        logoUrl: profile.logoUrl || '',
        thesisPointsExpected: Number(profile.thesisPointsExpected) || 0,
        courses: sanitizeCourseList(courses),
        studyLogs: sanitizeStudyLogList(studyLogs),
        assignments: sanitizeAssignmentList(assignments),
        quickNotes: typeof quickNotes === 'string' ? quickNotes : '',
        checklist: normalizeGoalsList(checklist),
        resourceLinks: sanitizeResourceLinksList(resourceLinks),
        activeSquadId: profile.activeSquadId || null,
        squadIds: Array.isArray(profile.squadIds) ? profile.squadIds : [],
        xp: profile.xp ?? 0,
        currentStreak: profile.currentStreak ?? 0,
        minutesStudiedThisWeek: Math.min(10080, Math.max(0, Number(profile.minutesStudiedThisWeek) || 0)),
        tasksCompletedThisWeek: profile.tasksCompletedThisWeek ?? 0,
        lastActiveDate: profile.lastActiveDate || null,
        updatedAt: Date.now(),
        updatedBy: syncClientId,
      });

      await setDoc(userRef, payload, { merge: true });
      setPendingLocalSync(false);
      saveSyncedLogIds(studyLogs);
      cloudSyncState = 'synced';
      renderSyncStatus();
    } catch (err) {
      console.warn('Cloud sync push notice:', err);
      cloudSyncState = 'error';
      renderSyncStatus();
    }
  }

  function setupRealtimeFirestoreSync(forceResubscribe = false) {
    const targetEmail = sessionEmail || profile.email;
    if (!isAuthenticated || !targetEmail || !db) {
      if (userSnapshotUnsub) {
        userSnapshotUnsub();
        userSnapshotUnsub = null;
      }
      activeSyncDocId = null;
      isInitialCloudLoading = false;
      cloudSyncState = db ? 'synced' : 'local';
      setStatus('Ready', 0);
      return;
    }

    const docId = getEmailDocId(targetEmail);
    if (!forceResubscribe && userSnapshotUnsub && activeSyncDocId === docId) {
      return;
    }

    if (userSnapshotUnsub) {
      userSnapshotUnsub();
      userSnapshotUnsub = null;
    }

    activeSyncDocId = docId;
    const userRef = doc(db, 'users', docId);
    hasInitialServerSnapshot = false;
    isInitialCloudLoading =
      courses.length === 0 &&
      studyLogs.length === 0 &&
      checklist.length === 0 &&
      resourceLinks.length === 0;
    cloudSyncState = 'syncing';

    userSnapshotUnsub = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;
        if (snapshot.metadata.fromCache && !hasInitialServerSnapshot) return;
        const wasInitial = !hasInitialServerSnapshot;
        hasInitialServerSnapshot = true;
        isInitialCloudLoading = false;

        if (snapshot.exists()) {
          const data = snapshot.data();
          applyRemoteWorkspaceData(data, targetEmail, { isInitialHydration: wasInitial });
        } else {
          populateCurrentPageData();
        }
        cloudSyncState = hasPendingLocalSync() ? 'pending' : 'synced';
        renderSyncStatus();
      },
      (err) => {
        console.warn('Firestore real-time listener notice:', err);
        isInitialCloudLoading = false;
        cloudSyncState = 'error';
        populateCurrentPageData();
        renderSyncStatus();
      }
    );

    void pullWorkstationFromCloud({ force: true });
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
      `${STORAGE_KEY}_synced_log_ids`,
      `${STORAGE_KEY}_pending_sync`,
      'unisphere_workstation_v1_logs',
    ];
    for (const k of keysToRemove) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
  }

  function cleanupActiveSquadListeners() {
    if (squadDocUnsub) {
      squadDocUnsub();
      squadDocUnsub = null;
    }
    if (squadMembersUnsub) {
      squadMembersUnsub();
      squadMembersUnsub = null;
    }
    if (squadPresenceUnsub) {
      squadPresenceUnsub();
      squadPresenceUnsub = null;
    }
    if (squadActivitiesUnsub) {
      squadActivitiesUnsub();
      squadActivitiesUnsub = null;
    }
    if (liveTimerInterval) {
      window.clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }
  }

  function cleanupSquadListeners() {
    cleanupActiveSquadListeners();
    if (friendshipsUnsub) {
      friendshipsUnsub();
      friendshipsUnsub = null;
    }
    activeFriendshipsUid = null;
    if (selectedFriendDocUnsub) {
      selectedFriendDocUnsub();
      selectedFriendDocUnsub = null;
    }
  }

  async function handleLogout() {
    if (userSnapshotUnsub) {
      userSnapshotUnsub();
      userSnapshotUnsub = null;
    }
    activeSyncDocId = null;
    hasInitialServerSnapshot = false;
    isInitialCloudLoading = false;
    cleanupSquadListeners();
    try {
      if (auth) await signOut(auth);
    } catch {}
    clearLocalWorkspaceStorage();
    sessionEmail = null;
    isAuthenticated = false;
    verificationSentTo = null;
    profile = { ...INITIAL_PROFILE };
    courses = [];
    studyLogs = [];
    assignments = [];
    quickNotes = '';
    checklist = [];
    resourceLinks = [];
    squads = [];
    activeSquadId = null;
    squadMembers = [];
    squadPresence = [];
    squadActivities = [];
    myLiveSession = null;
    friendships = [];
    friendSearchQuery = '';
    selectedFriendUid = null;
    selectedFriendTelemetry = null;
    friendActionNotice = null;
    clearUndoBanner();
    if (quickNotesAutosaveTimer) {
      window.clearTimeout(quickNotesAutosaveTimer);
      quickNotesAutosaveTimer = null;
    }
    quickNotesDirty = false;
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
      const isCurrent = a.dataset.nav === route;
      a.classList.toggle('active-nav', isCurrent);
      if (isCurrent) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
  }

  function populateGoalCourseSelect(selectedCourse = '') {
    const goalCourseSelect = document.getElementById('goal-course');
    if (!goalCourseSelect) return;
    const courseTitles = Array.from(
      new Set(courses.map((c) => c.title).filter((t) => t && t !== 'Skill'))
    );
    const hasCustomCourse =
      selectedCourse && selectedCourse !== 'Skill' && !courseTitles.includes(selectedCourse);

    const allOptions = [
      ...(hasCustomCourse ? [selectedCourse] : []),
      ...courseTitles,
    ];

    if (allOptions.length === 0) {
      goalCourseSelect.innerHTML = `<option value="">No courses added yet</option>`;
      goalCourseSelect.value = '';
      return;
    }

    goalCourseSelect.innerHTML = allOptions
      .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
      .join('');

    goalCourseSelect.value =
      selectedCourse && allOptions.includes(selectedCourse) ? selectedCourse : allOptions[0];
  }

  function syncGoalModalFields() {
    const typeEl = document.getElementById('goal-type');
    const courseRow = document.getElementById('goal-course-row');
    const courseSelect = document.getElementById('goal-course');
    if (!typeEl || !courseRow) return;
    const isCourse = typeEl.value === 'course';
    courseRow.hidden = !isCourse;
    if (courseSelect) {
      courseSelect.required = isCourse && courses.length > 0;
    }
  }

  function updateCourseSuggestionsDatalist() {
    const datalist = document.getElementById('course-suggestions');
    if (datalist) {
      datalist.innerHTML = courses
        .map((c) => `<option value="${escapeHtml(c.title)}"></option>`)
        .join('');
    }
    const goalCourseSelect = document.getElementById('goal-course');
    if (goalCourseSelect) {
      populateGoalCourseSelect(goalCourseSelect.value || '');
    }
  }

  async function loadAndRenderPage(targetRoute, pushHistory = false, { replaceHistory = false } = {}) {
    const effectiveRoute = !isAuthenticated ? 'login' : targetRoute === 'login' ? 'dashboard' : targetRoute;
    updateNavHighlight(effectiveRoute);
    const mainEl = document.getElementById('app-main');
    if (!mainEl) {
      document.documentElement.classList.remove('auth-booting');
      return;
    }

    const currentLoadedPage = mainEl.getAttribute('data-page');
    if (currentLoadedPage === 'dashboard' && effectiveRoute !== 'dashboard' && quickNotesDirty) {
      saveQuickNotesFromEditor({ showStatus: false });
    }
    if (currentLoadedPage && !pageHtmlCache.has(currentLoadedPage)) {
      pageHtmlCache.set(currentLoadedPage, mainEl.innerHTML);
    }
    if (currentLoadedPage && !pageTitleCache.has(currentLoadedPage) && document.title) {
      pageTitleCache.set(currentLoadedPage, document.title);
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
            if (docDom.title) {
              pageTitleCache.set(effectiveRoute, docDom.title);
            }
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

    document.title = pageTitleCache.get(effectiveRoute) || PAGE_TITLES[effectiveRoute] || 'UniSphere';

    if (PAGE_PATHS[effectiveRoute]) {
      const targetPath = PAGE_PATHS[effectiveRoute];
      if (window.location.pathname !== targetPath) {
        if (replaceHistory) {
          window.history.replaceState({ route: effectiveRoute }, '', targetPath);
        } else if (pushHistory) {
          window.history.pushState({ route: effectiveRoute }, '', targetPath);
        }
      }
    }

    if (isAuthenticated && effectiveRoute === 'squads') {
      void loadUserSquads();
    } else if (effectiveRoute !== 'squads') {
      cleanupSquadListeners();
    }

    updateNavHighlight(effectiveRoute);
    updateCourseSuggestionsDatalist();
    populateCurrentPageData();
    bindDynamicViewEvents(effectiveRoute);
    document.documentElement.classList.remove('auth-booting');
  }

  function updateScrollableTablesMaxHeight() {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const scrollY = window.scrollY;

    // Phase 1: Batch all layout reads before any style writes to avoid forced reflows
    const scrollContainerMeasurements = [];
    document.querySelectorAll('.table-scroll').forEach((el) => {
      if (el.id === 'assignments-table-scroll') return;
      scrollContainerMeasurements.push({
        el,
        elementTop: el.getBoundingClientRect().top + scrollY,
        isSmall: el.classList.contains('table-scroll-sm')
      });
    });

    const squadFeedEl = document.getElementById('squad-feed-list');
    const squadFeedTop =
      squadFeedEl && !squadFeedEl.closest('[hidden]')
        ? squadFeedEl.getBoundingClientRect().top + scrollY
        : null;

    const friendsSidebarEl = document.getElementById('friends-sidebar');
    const friendsSidebarVisible = Boolean(friendsSidebarEl && !friendsSidebarEl.closest('[hidden]'));
    const friendsSidebarTop =
      friendsSidebarVisible && viewportWidth > 960
        ? friendsSidebarEl.getBoundingClientRect().top + scrollY
        : null;

    const squadUnifiedEl = document.getElementById('squads-active-widgets');
    const squadUnifiedVisible = Boolean(squadUnifiedEl && !squadUnifiedEl.closest('[hidden]'));
    const squadUnifiedTop =
      squadUnifiedVisible && viewportWidth > 960
        ? squadUnifiedEl.getBoundingClientRect().top + scrollY
        : null;

    const friendUnifiedEl = document.getElementById('friend-info-stats-view');
    const friendUnifiedVisible = Boolean(friendUnifiedEl && !friendUnifiedEl.closest('[hidden]'));
    const friendUnifiedTop =
      friendUnifiedVisible && viewportWidth > 960
        ? friendUnifiedEl.getBoundingClientRect().top + scrollY
        : null;

    const assignmentsTableScrollEl = document.getElementById('assignments-table-scroll');
    const assignmentsTableTop =
      assignmentsTableScrollEl && !assignmentsTableScrollEl.closest('[hidden]')
        ? assignmentsTableScrollEl.getBoundingClientRect().top + scrollY
        : null;

    // Phase 2: Apply all computed height writes
    scrollContainerMeasurements.forEach(({ el, elementTop, isSmall }) => {
      if (isSmall) {
        const maxH =
          viewportWidth <= 720
            ? 280
            : Math.max(
                260,
                calculateTableScrollMaxHeight(viewportHeight, elementTop, viewportWidth, 32)
              );
        el.style.maxHeight = `${maxH}px`;
        return;
      }
      const maxH = calculateTableScrollMaxHeight(viewportHeight, elementTop, viewportWidth);
      el.style.maxHeight = `${maxH}px`;
    });

    if (squadFeedTop !== null) {
      const elementTop = squadFeedTop;
      const feedH = calculateTableScrollMaxHeight(viewportHeight, elementTop, viewportWidth, 200);
      squadFeedEl.style.minHeight = `${feedH}px`;
      squadFeedEl.style.maxHeight = `${feedH}px`;
    }

    if (friendsSidebarVisible) {
      if (viewportWidth <= 960) {
        friendsSidebarEl.style.minHeight = '';
        friendsSidebarEl.style.maxHeight = '';
      } else {
        const sidebarH = calculateTableScrollMaxHeight(
          viewportHeight,
          friendsSidebarTop,
          viewportWidth,
          200
        );
        const workspaceMaxH = Math.max(
          sidebarH,
          Math.min(viewportHeight - 100, Math.floor(viewportHeight - friendsSidebarTop - 20))
        );
        friendsSidebarEl.style.minHeight = `${sidebarH}px`;
        friendsSidebarEl.style.maxHeight = `${workspaceMaxH}px`;
      }
    }

    if (squadUnifiedVisible) {
      if (viewportWidth <= 960) {
        squadUnifiedEl.style.maxHeight = '';
      } else {
        const maxH = Math.max(
          360,
          Math.min(viewportHeight - 100, Math.floor(viewportHeight - squadUnifiedTop - 20))
        );
        squadUnifiedEl.style.maxHeight = `${maxH}px`;
      }
    }

    if (friendUnifiedVisible) {
      if (viewportWidth <= 960) {
        friendUnifiedEl.style.maxHeight = '';
      } else {
        const maxH = Math.max(
          360,
          Math.min(viewportHeight - 100, Math.floor(viewportHeight - friendUnifiedTop - 20))
        );
        friendUnifiedEl.style.maxHeight = `${maxH}px`;
      }
    }

    if (assignmentsTableTop !== null) {
      const elementTop = assignmentsTableTop;
      const tableH = calculateTableScrollMaxHeight(viewportHeight, elementTop, viewportWidth, 200);
      assignmentsTableScrollEl.style.minHeight = `${tableH}px`;
      assignmentsTableScrollEl.style.maxHeight = `${tableH}px`;
    }
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
    const loginErrEl = document.getElementById('auth-login-error');
    const regErrEl = document.getElementById('auth-reg-error');

    if (noticeContainer) noticeContainer.innerHTML = '';
    if (loginErrEl) {
      loginErrEl.hidden = true;
      loginErrEl.textContent = '';
    }
    if (regErrEl) {
      regErrEl.hidden = true;
      regErrEl.textContent = '';
    }

    if (authNotice && authNotice.text) {
      if (authNotice.type === 'error' && authNotice.scope === 'login' && loginErrEl) {
        loginErrEl.hidden = false;
        loginErrEl.textContent = authNotice.text;
      } else if (authNotice.type === 'error' && authNotice.scope === 'register' && regErrEl) {
        regErrEl.hidden = false;
        regErrEl.textContent = authNotice.text;
      } else if (noticeContainer) {
        noticeContainer.innerHTML = `<div class="notice-box ${authNotice.type === 'error' ? 'notice-error' : 'notice-success'}">${escapeHtml(authNotice.text)}</div>`;
      }
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

  function renderUndoBanner() {
    const el = document.getElementById('dash-undo-banner');
    if (!el) return;
    if (!pendingUndo) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = `
      <span>${escapeHtml(pendingUndo.message)}</span>
      <span class="undo-banner-actions">
        <button type="button" id="btn-undo-action">Undo</button>
        <button type="button" id="btn-dismiss-undo" class="notice-dismiss-btn" aria-label="Dismiss">&times;</button>
      </span>
    `;
  }

  function clearUndoBanner() {
    if (undoTimer) {
      window.clearTimeout(undoTimer);
      undoTimer = null;
    }
    pendingUndo = null;
    renderUndoBanner();
  }

  function showUndoBanner(message, restoreFn) {
    if (undoTimer) {
      window.clearTimeout(undoTimer);
    }
    pendingUndo = { message, restore: restoreFn };
    renderUndoBanner();
    undoTimer = window.setTimeout(() => {
      pendingUndo = null;
      undoTimer = null;
      renderUndoBanner();
    }, 10000);
  }

  function populateDashboardPage() {
    renderUndoBanner();
    const completedCFU = courses
      .filter((c) => c.status === 'completed')
      .reduce((sum, c) => sum + c.cfu, 0);
    const targetCFU = profile.totalTargetCFU || 180;
    const media = calculateMediaGrades(assignments, courses);
    const { widgetDays, weekTotalMinutes } = getWeekDaysSummary(studyLogs);

    const elDegree = document.getElementById('summary-degree');
    if (elDegree) {
      elDegree.textContent =
        profile.degreeName || (isInitialCloudLoading ? 'Loading…' : 'Not set');
    }

    const elInst = document.getElementById('summary-institution');
    if (elInst) {
      elInst.textContent =
        profile.institution || (isInitialCloudLoading ? 'Loading…' : 'Not set');
    }

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
        isInitialCloudLoading && courses.length === 0
          ? `<tr><td colspan="4" class="empty-cell">Loading courses…</td></tr>`
          : courses.length === 0
          ? `<tr><td colspan="4" class="empty-cell">No courses added yet. Click &quot;Add Course&quot; to add your first course.</td></tr>`
          : filteredDashCourses.length === 0
          ? `<tr><td colspan="4" class="empty-cell">No matching courses found.</td></tr>`
          : filteredDashCourses
              .map(
                (c) => `
              <tr>
                <td>${escapeHtml(c.title)}</td>
                <td>${escapeHtml(formatStatusLabel(c.status))}</td>
                <td>${escapeHtml(c.cfu)}</td>
                <td><button type="button" class="btn-inline-action" data-open-course="${escapeHtml(c.id)}">Open</button></td>
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
      dash5DayTbody.innerHTML = widgetDays.map((d) => renderWeekDayHoursCell(d)).join('');
    }

    const logsTbody = document.getElementById('dash-logs-tbody');
    if (logsTbody) {
      const { logs: recentLogs, totalCount, hiddenCount } = sliceRecentLogsForDashboard(studyLogs);
      const weekGroups = groupStudyLogsByWeek(recentLogs);
      const viewAllRow =
        hiddenCount > 0
          ? `<tr class="logs-view-all-row"><td colspan="4"><a href="/pages/logs.html" data-nav="logs">View all ${totalCount} logs in Session Logs</a></td></tr>`
          : '';
      logsTbody.innerHTML =
        isInitialCloudLoading && studyLogs.length === 0
          ? `<tr><td colspan="4" class="empty-cell">Loading session logs…</td></tr>`
          : weekGroups.length === 0
          ? `<tr><td colspan="4" class="empty-cell">No session logs recorded yet.</td></tr>`
          : `${weekGroups
              .map(
                (group) => `
              <tr class="week-separator-row">
                <td colspan="4">${escapeHtml(group.label)}</td>
              </tr>
              ${group.logs
                .map(
                  (l) => `
              <tr>
                <td>${escapeHtml(formatExamDateShort(l.date))}</td>
                <td>${escapeHtml(l.courseName)}</td>
                <td>${escapeHtml(formatStudyDuration(l.durationMinutes))}</td>
                <td><button type="button" class="btn-inline-danger" data-delete-log="${escapeHtml(l.id)}" aria-label="Delete ${escapeHtml(l.courseName)} session">Delete</button></td>
              </tr>`
                )
                .join('')}`
              )
              .join('')}${viewAllRow}`;
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
      tabResBtn.setAttribute('tabindex', !isNotesTab ? '0' : '-1');
    }
    if (tabNotesBtn) {
      tabNotesBtn.classList.toggle('active', isNotesTab);
      tabNotesBtn.setAttribute('aria-selected', String(isNotesTab));
      tabNotesBtn.setAttribute('tabindex', isNotesTab ? '0' : '-1');
    }
    if (resPanel) resPanel.hidden = isNotesTab;
    if (notesPanel) notesPanel.hidden = !isNotesTab;
    if (addResBtn) addResBtn.hidden = isNotesTab;
    if (saveNotesBtn) saveNotesBtn.hidden = !isNotesTab;

    const resList = document.getElementById('dash-resources-list');
    if (resList) {
      const showResEmpty = resourceLinks.length === 0;
      resList.classList.toggle('resource-list-empty', showResEmpty);
      resList.innerHTML =
        isInitialCloudLoading && showResEmpty
          ? `<li class="empty-cell">Loading resources…</li>`
          : showResEmpty
          ? `<li class="empty-cell">No resource links added yet.</li>`
          : resourceLinks
              .map((r) => {
                const safeHref = sanitizeResourceUrl(r.url) || '#';
                return `
              <li>
                <a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>
                <button type="button" class="btn-inline-danger resource-delete-btn" data-delete-resource="${escapeHtml(r.id)}" aria-label="Delete resource ${escapeHtml(r.title)}">Delete</button>
              </li>`;
              })
              .join('');
    }

    const notesEl = document.getElementById('dash-quick-notes');
    if (notesEl && document.activeElement !== notesEl && !quickNotesDirty) {
      notesEl.value = quickNotes;
    }
    const notesStatusEl = document.getElementById('dash-notes-status');
    if (notesStatusEl && quickNotesDirty) {
      notesStatusEl.textContent = 'Unsaved changes…';
    }

    const goalsListEl = document.getElementById('dash-goals-list');
    if (goalsListEl) {
      const sortedGoals = sortGoalsForDisplay(checklist);
      goalsListEl.innerHTML =
        isInitialCloudLoading && sortedGoals.length === 0
          ? `<li class="empty-cell">Loading goals…</li>`
          : sortedGoals.length === 0
          ? `<li class="empty-cell">No goals added yet.</li>`
          : sortedGoals
              .map(
                (g) => `
              <li class="goal-item${g.completed ? ' goal-completed' : ''}">
                <input
                  type="checkbox"
                  class="goal-checkbox"
                  data-toggle-goal="${escapeHtml(g.id)}"
                  ${g.completed ? 'checked' : ''}
                  aria-label="Mark ${escapeHtml(g.title)} as ${g.completed ? 'incomplete' : 'completed'}"
                />
                <button
                  type="button"
                  class="goal-item-btn"
                  data-open-goal="${escapeHtml(g.id)}"
                  title="Edit or delete goal"
                >
                  <span class="goal-title">${escapeHtml(g.title)}</span>
                  <span class="goal-tag-badge" title="${escapeHtml(g.tag)}">${escapeHtml(g.tag)}</span>
                </button>
              </li>`
              )
              .join('');
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
      headerEl.textContent = `Current 7-Day Week Study Time (Total All-Time: ${formatStudyDuration(totalMinutesAllTime)})`;
    }

    const theadEl = document.getElementById('logs-5day-thead');
    if (theadEl) {
      theadEl.innerHTML = widgetDays
        .map((d) => `<th>${escapeHtml(d.shortDay)} (${escapeHtml(d.formattedDate)})</th>`)
        .join('');
    }

    const tbodyEl = document.getElementById('logs-5day-tbody');
    if (tbodyEl) {
      tbodyEl.innerHTML = widgetDays.map((d) => renderWeekDayHoursCell(d)).join('');
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

  function renderAssignmentGradePartsHtml(gradeInfo) {
    const parts = Array.isArray(gradeInfo?.parts) ? gradeInfo.parts : [];
    if (parts.length === 0) {
      return '<span class="exam-grade-part exam-grade-ungraded">0/30</span>';
    }
    return parts
      .map(
        (part) =>
          `<span class="exam-grade-part exam-grade-${escapeHtml(part.status)}">${escapeHtml(part.displayText)}</span>`
      )
      .join('<span class="exam-grade-sep"> - </span>');
  }

  function renderAssignmentDetailInfoHtml(item, displayType, gradeInfo, urgency) {
    const isCompleted = item.status === 'completed';
    const statusLabel = urgency?.hint ? urgency.hint : isCompleted ? 'Completed' : 'Scheduled';
    const gradeSummaryHtml = gradeInfo.isSplit
      ? `${gradeInfo.parts
          .map(
            (part) =>
              `${escapeHtml(part.label)}: <span class="exam-grade-part exam-grade-${escapeHtml(part.status)}">${escapeHtml(part.displayText)}</span>`
          )
          .join(' · ')} · Average: <span class="exam-grade-part exam-grade-${escapeHtml(gradeInfo.averageStatus)}">${escapeHtml(gradeInfo.averageText)}</span>`
      : `Grade: <span class="exam-grade-part exam-grade-${escapeHtml(gradeInfo.averageStatus)}">${escapeHtml(gradeInfo.averageText === '-' ? 'Pending (0/30)' : gradeInfo.averageText)}</span>`;

    return `
      <div class="assignment-detail-card">
        <div class="assignment-detail-row-meta">
          <span><strong>Type:</strong> ${escapeHtml(displayType)}</span>
          <span><strong>Status:</strong> ${escapeHtml(statusLabel)}</span>
        </div>
        <div class="assignment-detail-grade">${gradeSummaryHtml}</div>
        <div class="assignment-detail-actions">
          <strong>Actions:</strong>
          <a href="#" data-toggle-assignment="${escapeHtml(item.id)}">${isCompleted ? 'Reopen' : 'Mark as complete'}</a> |
          <a href="#" data-open-assignment="${escapeHtml(item.id)}">Edit</a> |
          <a href="#" data-delete-assignment="${escapeHtml(item.id)}">Delete</a>
        </div>
      </div>
    `;
  }

  function toggleAssignmentDetailRow(assignmentId) {
    if (!assignmentId) return;
    if (expandedAssignmentIds.has(assignmentId)) {
      expandedAssignmentIds.delete(assignmentId);
    } else {
      expandedAssignmentIds.add(assignmentId);
    }
    const isExpanded = expandedAssignmentIds.has(assignmentId);
    const mainRow = document.querySelector(
      `tr[data-toggle-assignment-row="${CSS.escape(assignmentId)}"]`
    );
    const detailRow = document.querySelector(
      `tr[data-assignment-detail="${CSS.escape(assignmentId)}"]`
    );
    if (mainRow) {
      mainRow.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      const indicator = mainRow.querySelector('.mobile-expand-indicator');
      if (indicator) indicator.textContent = isExpanded ? '▾' : '▸';
    }
    if (detailRow) {
      detailRow.hidden = !isExpanded;
    }
  }

  function populateAssignmentsPage() {
    const todayRef = new Date();
    lastAssignmentsDateKey = getLocalDateString(todayRef);

    const typeSelect = document.getElementById('filter-assignment-type');
    if (typeSelect) typeSelect.value = assignmentTypeFilter;

    const filtered = assignments.filter((a) => {
      if (assignmentTypeFilter !== 'all' && normalizeAssignmentType(a.type) !== assignmentTypeFilter) {
        return false;
      }
      return true;
    });

    const sorted = sortAssignmentsForTable(filtered, todayRef);
    const visibleIds = new Set(sorted.map((item) => item.id));
    for (const id of expandedAssignmentIds) {
      if (!visibleIds.has(id)) expandedAssignmentIds.delete(id);
    }

    const registryTbody = document.getElementById('assignments-registry-tbody');
    if (registryTbody) {
      registryTbody.innerHTML =
        sorted.length === 0
          ? `<tr><td colspan="5" class="empty-cell">No exams or assignments scheduled yet.</td></tr>`
          : sorted
              .map((a, idx) => {
                const displayType = normalizeAssignmentType(a.type);
                const urgency = getExamUrgencyState(a, todayRef);
                const gradeInfo = getAssignmentDisplayGrade(a);
                const isCompleted = a.status === 'completed';
                const hasCompletedDivider = shouldRenderCompletedDivider(sorted, idx);
                const isExpanded = expandedAssignmentIds.has(a.id);

                const hintHtml = urgency.hint
                  ? `<span class="exam-date-hint">(${escapeHtml(urgency.hint)})</span>`
                  : '';

                return `
                <tr
                  class="${escapeHtml(urgency.rowClass)} assignment-main-row${hasCompletedDivider ? ' assignments-completed-divider' : ''}"
                  data-urgency="${escapeHtml(urgency.level)}"
                  data-toggle-assignment-row="${escapeHtml(a.id)}"
                  tabindex="0"
                  aria-expanded="${isExpanded ? 'true' : 'false'}"
                >
                  <td>
                    <a href="#" data-open-course-info="${escapeHtml(a.courseName)}">${escapeHtml(a.courseName)}</a><span class="mobile-expand-indicator" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
                  </td>
                  <td>${escapeHtml(displayType)}</td>
                  <td>
                    <span class="exam-date-full">${escapeHtml(formatExamDate(a.dueDate))}${hintHtml}</span>
                    <span class="exam-date-short">${escapeHtml(formatExamDateShort(a.dueDate))}</span>
                  </td>
                  <td>${renderAssignmentGradePartsHtml(gradeInfo)}</td>
                  <td>
                    <a href="#" data-toggle-assignment="${escapeHtml(a.id)}">${isCompleted ? 'Reopen' : 'Mark as complete'}</a> |
                    <a href="#" data-open-assignment="${escapeHtml(a.id)}">Edit</a> |
                    <a href="#" data-delete-assignment="${escapeHtml(a.id)}">Delete</a>
                  </td>
                </tr>
                <tr
                  class="assignment-detail-row ${escapeHtml(urgency.rowClass)}"
                  data-assignment-detail="${escapeHtml(a.id)}"
                  ${isExpanded ? '' : 'hidden'}
                >
                  <td colspan="5">${renderAssignmentDetailInfoHtml(a, displayType, gradeInfo, urgency)}</td>
                </tr>`;
              })
              .join('');
    }
  }

  function checkAssignmentsDailyRollover() {
    const todayKey = getLocalDateString();
    if (todayKey === lastAssignmentsDateKey) return;
    lastAssignmentsDateKey = todayKey;
    if (document.getElementById('app-main')?.getAttribute('data-page') === 'assignments') {
      populateAssignmentsPage();
    }
  }

  function formatFeedRelativeTime(val) {
    if (!val) return 'Just now';
    const d = typeof val === 'number' ? new Date(val) : new Date(String(val));
    if (isNaN(d.getTime())) return 'Recently';
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  function getMySquadIdentity() {
    const email = sessionEmail || profile.email || auth?.currentUser?.email || '';
    const myUid = getEmailDocId(email || 'local_student');
    return {
      myUid,
      myDisplayName: sanitizeTextInput(profile.name || 'Student', 100),
      authUid: auth?.currentUser?.uid || '',
      studentId: profile.studentId || '',
      email,
    };
  }

  function isCurrentUserSquadCreator(squad) {
    if (!squad) return false;
    const identity = getMySquadIdentity();
    return canManageSquad(squad, identity.myUid, {
      authUid: identity.authUid,
      studentId: identity.studentId,
      email: identity.email,
      displayName: identity.myDisplayName,
    });
  }

  const cleanedStaleMemberKeys = new Set();
  const removedSquadMemberKeys = new Set();

  function getProcessedSquadMembers(activeSquad) {
    const identity = getMySquadIdentity();
    const { myUid } = identity;
    const myWeekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
    const myStreak = calculateCurrentStreak(studyLogs, profile);
    const myTasksThisWeek = countCompletedTasksThisWeek(assignments);
    const myElo = calculateElo(myWeekMinutes, myTasksThisWeek, myStreak);
    const myDailyMinutes = getWeeklyDailyMinutesMap(studyLogs);
    const mySubjectMinutes = getWeeklySubjectMinutesMap(studyLogs);

    const { members: dedupedMembers, staleLegacyUids } = deduplicateSquadMembers(
      squadMembers,
      identity
    );

    if (activeSquad?.id && staleLegacyUids.length > 0) {
      for (const staleUid of staleLegacyUids) {
        const cleanKey = `${activeSquad.id}:${staleUid}`;
        if (!cleanedStaleMemberKeys.has(cleanKey)) {
          cleanedStaleMemberKeys.add(cleanKey);
          void removeMemberFromSquad(activeSquad.id, staleUid, '', false);
        }
      }
    }

    const removedUidsInCloud = new Map();
    const removedNamesInCloud = new Map();
    const rejoinedUidsInCloud = new Map();
    for (const act of squadActivities) {
      if (!act) continue;
      const actTs = Date.parse(String(act.updatedAt || act.createdAt || '')) || Date.now();
      if (act.type === 'member_removed' && act.status === 'removed') {
        if (act.uid) {
          const k = String(act.uid).trim().toLowerCase();
          removedUidsInCloud.set(k, Math.max(removedUidsInCloud.get(k) || 0, actTs));
        }
        if (act.displayName && act.displayName !== 'Removed Member') {
          const k = String(act.displayName).trim().toLowerCase();
          removedNamesInCloud.set(k, Math.max(removedNamesInCloud.get(k) || 0, actTs));
        }
      } else if (act.type === 'member_rejoined' && act.uid) {
        const k = String(act.uid).trim().toLowerCase();
        rejoinedUidsInCloud.set(k, Math.max(rejoinedUidsInCloud.get(k) || 0, actTs));
      }
    }

    const processedMembersMap = new Map();
    for (const m of dedupedMembers) {
      if (!m || !m.uid) continue;
      if (m.uid === myUid) {
        processedMembersMap.set(myUid, {
          ...m,
          uid: myUid,
          displayName: sanitizeTextInput(profile.name || m.displayName || 'Student', 100),
          minutesThisWeek: myWeekMinutes,
          currentStreak: myStreak,
          tasksThisWeek: myTasksThisWeek,
          dailyMinutes: myDailyMinutes,
          subjectMinutes: mySubjectMinutes,
          status: myLiveSession ? 'live' : m.status || 'online',
          liveSubject: myLiveSession ? myLiveSession.subject : m.liveSubject || null,
          liveStartedAt: myLiveSession ? myLiveSession.startedAt : m.liveStartedAt || null,
          elo: myElo,
          isCurrentWeek: true,
          isStreakActive: myStreak > 0,
        });
      } else {
        const normMemberUid = String(m.uid).trim().toLowerCase();
        const normMemberName = String(m.displayName || '').trim().toLowerCase();
        const joinedAtMs = Date.parse(String(m.joinedAt || '')) || 0;
        const rejoinedAtMs = rejoinedUidsInCloud.get(normMemberUid) || 0;
        const effectiveJoinedAt = Math.max(joinedAtMs, rejoinedAtMs);
        const removedUidAt = removedUidsInCloud.get(normMemberUid) || 0;
        const removedNameAt = normMemberName ? removedNamesInCloud.get(normMemberName) || 0 : 0;
        const latestRemovedAt = Math.max(removedUidAt, removedNameAt);
        if (
          (activeSquad?.id && removedSquadMemberKeys.has(`${activeSquad.id}:${normMemberUid}`)) ||
          (latestRemovedAt > 0 && effectiveJoinedAt <= latestRemovedAt)
        ) {
          continue;
        }
        processedMembersMap.set(m.uid, getMemberEffectiveTelemetry(m));
      }
    }

    if (activeSquad && !processedMembersMap.has(myUid)) {
      processedMembersMap.set(myUid, {
        uid: myUid,
        displayName: sanitizeTextInput(profile.name || 'Student', 100),
        color: '#3B77BC',
        minutesThisWeek: myWeekMinutes,
        currentStreak: myStreak,
        tasksThisWeek: myTasksThisWeek,
        dailyMinutes: myDailyMinutes,
        subjectMinutes: mySubjectMinutes,
        status: myLiveSession ? 'live' : 'online',
        liveSubject: myLiveSession ? myLiveSession.subject : null,
        liveStartedAt: myLiveSession ? myLiveSession.startedAt : null,
        elo: myElo,
        isCurrentWeek: true,
        isStreakActive: myStreak > 0,
      });
    }

    return {
      myUid,
      myWeekMinutes,
      myStreak,
      myTasksThisWeek,
      myElo,
      allMembers: activeSquad ? Array.from(processedMembersMap.values()) : [],
    };
  }

  function populateSquadsPage() {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (activeSquad && activeSquad.id !== activeSquadId) {
      activeSquadId = activeSquad.id;
    } else if (!activeSquad) {
      activeSquadId = null;
    }

    if (
      activeSquad &&
      isCurrentUserRemovedFromSquad(
        activeSquad,
        squadMembers,
        squadActivities,
        getMySquadIdentity()
      )
    ) {
      void performLeaveSquad(activeSquad.id);
      return;
    }

    const { myUid, myWeekMinutes, myStreak, allMembers } = getProcessedSquadMembers(activeSquad);

    // 1. Header Links (#36 Admin Panel only for creator, Leave Squad when in squad)
    const adminBtn = document.getElementById('btn-open-admin-panel');
    if (adminBtn) {
      adminBtn.hidden = !isCurrentUserSquadCreator(activeSquad);
    }
    const leaveBtn = document.getElementById('btn-leave-active-squad');
    if (leaveBtn) {
      leaveBtn.hidden = !activeSquad;
    }

    const emptyStateEl = document.getElementById('squads-empty-state');
    if (emptyStateEl) {
      emptyStateEl.hidden = Boolean(activeSquad);
    }
    const activeWidgetsEl = document.getElementById('squads-active-widgets');
    if (activeWidgetsEl) {
      activeWidgetsEl.hidden = !activeSquad;
    }

    // 2. Top Summary Bar
    const summaryNameEl = document.getElementById('squad-summary-name');
    if (summaryNameEl) {
      summaryNameEl.textContent = activeSquad ? activeSquad.name : 'No Active Squad';
    }

    const activeSelectEl = document.getElementById('squad-active-select');
    if (activeSelectEl) {
      if (squads.length > 1) {
        activeSelectEl.hidden = false;
        activeSelectEl.innerHTML = squads
          .map(
            (s) =>
              `<option value="${escapeHtml(s.id)}" ${s.id === activeSquadId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
          )
          .join('');
      } else {
        activeSelectEl.hidden = true;
        activeSelectEl.innerHTML = '';
      }
    }

    const descEl = document.getElementById('squad-summary-description');
    if (descEl) {
      if (activeSquad?.description) {
        descEl.hidden = false;
        descEl.textContent = activeSquad.description;
      } else {
        descEl.hidden = true;
        descEl.textContent = '';
      }
    }

    const squadTotalMinutes = allMembers.reduce(
      (sum, m) => sum + (Number(m.minutesThisWeek) || 0),
      0
    );
    const squadGoalHours = Math.max(1, Number(activeSquad?.weeklyGoalHours) || 60);
    const squadGoalMinutes = squadGoalHours * 60;
    const squadGoalPct = activeSquad
      ? Math.min(100, Math.round((squadTotalMinutes / squadGoalMinutes) * 100))
      : 0;

    const summaryWeeklyEl = document.getElementById('squad-summary-weekly-time');
    if (summaryWeeklyEl) {
      summaryWeeklyEl.textContent = `${formatStudyDuration(squadTotalMinutes)} / ${squadGoalHours}h`;
    }

    const summaryMyTimeEl = document.getElementById('squad-summary-my-time');
    if (summaryMyTimeEl) {
      summaryMyTimeEl.textContent = formatStudyDuration(myWeekMinutes);
    }

    const summaryStreakEl = document.getElementById('squad-summary-my-streak');
    if (summaryStreakEl) {
      summaryStreakEl.textContent = `${myStreak} days`;
    }

    const summaryCodeEl = document.getElementById('squad-summary-code');
    if (summaryCodeEl) {
      summaryCodeEl.textContent = activeSquad ? activeSquad.code : '-';
    }

    // 3. Left Card: Live Library & Hours by Subject
    const progressFillEl = document.getElementById('squad-goal-progress-fill');
    if (progressFillEl) {
      progressFillEl.style.width = `${squadGoalPct}%`;
    }
    const progressLabelEl = document.getElementById('squad-goal-progress-label');
    if (progressLabelEl) {
      progressLabelEl.textContent = `${formatStudyDuration(squadTotalMinutes)} of ${squadGoalHours}h weekly goal`;
    }
    const progressPctEl = document.getElementById('squad-goal-progress-pct');
    if (progressPctEl) {
      progressPctEl.textContent = `${squadGoalPct}%`;
    }

    // Build unified live studiers list from squadPresence + members with status === 'live'
    const liveMap = new Map();
    for (const p of squadPresence) {
      if (p && p.uid && p.status === 'live') {
        liveMap.set(p.uid, p);
      }
    }
    for (const m of allMembers) {
      if (m && m.uid && m.status === 'live' && m.liveSubject && !liveMap.has(m.uid)) {
        liveMap.set(m.uid, {
          uid: m.uid,
          displayName: m.displayName || 'Student',
          status: 'live',
          subject: m.liveSubject,
          startedAt: m.liveStartedAt || m.updatedAt,
        });
      }
    }
    if (myLiveSession && activeSquad) {
      liveMap.set(myUid, {
        uid: myUid,
        displayName: sanitizeTextInput(profile.name || 'Student', 100),
        status: 'live',
        subject: myLiveSession.subject,
        startedAt: myLiveSession.startedAt,
      });
    }

    const liveStudiers = Array.from(liveMap.values());
    const isMeLive = liveMap.has(myUid);

    const goLiveBtn = document.getElementById('btn-go-live-toggle');
    if (goLiveBtn) {
      goLiveBtn.disabled = !activeSquad;
      if (isMeLive) {
        const myLiveEntry = liveMap.get(myUid);
        const elapsed = formatLiveElapsed(myLiveEntry?.startedAt);
        goLiveBtn.textContent = `End Live (${elapsed.formatted})`;
      } else {
        goLiveBtn.textContent = 'Go Live';
      }
    }

    const liveSummaryEl = document.getElementById('squad-live-library-summary');
    if (liveSummaryEl) {
      if (!activeSquad) {
        liveSummaryEl.textContent = 'Create or join a squad to enter the Live Library.';
      } else if (liveStudiers.length === 0) {
        liveSummaryEl.textContent =
          'No one is studying live right now. Click Go Live to open a study table!';
      } else {
        liveSummaryEl.textContent = `${liveStudiers.length} member${liveStudiers.length === 1 ? '' : 's'} currently studying in the Live Library:`;
      }
    }

    const liveListEl = document.getElementById('squad-live-library-list');
    if (liveListEl) {
      if (!activeSquad || liveStudiers.length === 0) {
        liveListEl.innerHTML = '';
      } else {
        liveListEl.innerHTML = liveStudiers
          .map((liveItem) => {
            const memberRecord = allMembers.find((m) => m.uid === liveItem.uid);
            const weeklyMins = Number(memberRecord?.minutesThisWeek) || 0;
            const elapsed = formatLiveElapsed(liveItem.startedAt);
            const isCurrentUser = liveItem.uid === myUid;
            return `
              <li class="live-library-item">
                <div class="live-library-user">
                  <div>
                    <span class="live-badge-dot" aria-hidden="true"></span>
                    <strong>${escapeHtml(liveItem.displayName || 'Student')}${isCurrentUser ? ' (You)' : ''}</strong>
                    — <span class="live-library-meta">${escapeHtml(liveItem.subject || 'General Study')}</span>
                  </div>
                  <div class="live-library-submeta">
                    Studying live for <strong>${escapeHtml(elapsed.formatted)}</strong> · Weekly total: ${escapeHtml(formatStudyDuration(weeklyMins))}
                  </div>
                </div>
                ${
                  isCurrentUser
                    ? `<div><button type="button" data-stop-live="true">Finish &amp; Log</button></div>`
                    : ''
                }
              </li>`;
          })
          .join('');
      }
    }

    // 4. Right Card: Squad Members & 7-Day Weekly Tracker
    const sortSelectEl = document.getElementById('squad-members-sort');
    if (sortSelectEl) {
      sortSelectEl.value = squadMembersSort;
    }

    const squadWeekDays = aggregateSquadWeeklyDays(allMembers);
    const squad7DayThead = document.getElementById('squad-7day-thead');
    if (squad7DayThead) {
      squad7DayThead.innerHTML = squadWeekDays
        .map(
          (d) =>
            `<th>${escapeHtml(d.shortDay)}<span class="day-sub">${escapeHtml(d.formattedDate)}</span></th>`
        )
        .join('');
    }

    const squad7DayTbody = document.getElementById('squad-7day-tbody');
    if (squad7DayTbody) {
      squad7DayTbody.innerHTML = squadWeekDays.map((d) => renderWeekDayHoursCell(d)).join('');
    }

    if (isAuthenticated && myUid && myUid !== 'local_student' && activeFriendshipsUid !== myUid) {
      void subscribeToUserFriendships(myUid);
    }

    const { acceptedFriends, incomingRequests, outgoingRequests } = partitionFriendships(
      friendships,
      myUid,
      profile.name
    );
    const acceptedSet = new Set(acceptedFriends.map((f) => f.uid));
    const pendingSet = new Set(
      [...incomingRequests, ...outgoingRequests].map((r) => r.uid)
    );

    const sortedMembers = sortSquadMembers(allMembers, squadMembersSort);
    const membersTbody = document.getElementById('squad-members-tbody');
    if (membersTbody) {
      membersTbody.innerHTML =
        !activeSquad || sortedMembers.length === 0
          ? `<tr><td colspan="5" class="empty-cell">${
              activeSquad
                ? 'No members found in this squad.'
                : 'Click "+ Create or Join a Squad" above to get started.'
            }</td></tr>`
          : sortedMembers
              .map((m) => {
                const isMe = m.uid === myUid;
                const normMemberUid = getEmailDocId(m.uid || '');
                const liveEntry = liveMap.get(m.uid);
                let statusHtml = '<span class="status-offline">Offline</span>';
                if (liveEntry) {
                  statusHtml = `<span class="status-live">Live · ${escapeHtml(liveEntry.subject || 'General Study')}</span>`;
                } else if (isMe || m.isStreakActive || m.status === 'online') {
                  statusHtml = '<span class="status-online">Online</span>';
                }

                let friendActionHtml = '';
                if (!isMe && normMemberUid) {
                  if (acceptedSet.has(normMemberUid)) {
                    friendActionHtml = ` · <a href="#" data-select-friend="${escapeHtml(normMemberUid)}">Friend Stats</a>`;
                  } else if (pendingSet.has(normMemberUid)) {
                    friendActionHtml = ` · <span class="item-meta" style="margin-left:0;">Pending</span>`;
                  } else {
                    friendActionHtml = ` · <a href="#" data-send-friend-request="${escapeHtml(normMemberUid)}" data-friend-name="${escapeHtml(m.displayName || 'Student')}">+ Friend</a>`;
                  }
                }

                return `
              <tr>
                <td>
                  <a href="#" class="member-name-link" data-open-friend-calendar="${escapeHtml(m.uid)}" title="View 7-day study calendar">
                    <strong>${escapeHtml(m.displayName || 'Student')}${isMe ? ' (You)' : ''}</strong>
                  </a>
                </td>
                <td>${statusHtml}</td>
                <td>${escapeHtml(formatStudyDuration(m.minutesThisWeek || 0))}</td>
                <td>${escapeHtml(m.currentStreak || 0)} days</td>
                <td>
                  ${
                    isMe
                      ? `<span class="item-meta" style="margin-left: 0;">You · <a href="#" data-open-friend-calendar="${escapeHtml(m.uid)}">Calendar</a></span>`
                      : `<a href="#" data-open-friend-calendar="${escapeHtml(m.uid)}">Calendar</a>${friendActionHtml}`
                  }
                </td>
              </tr>`;
              })
              .join('');
    }

    // 5. Bottom Card: Squad Feed (Bold author names) & Next Group Session
    const visibleFeedActivities = squadActivities.filter(
      (item) =>
        item &&
        item.type !== 'member_removed' &&
        item.type !== 'member_rejoined' &&
        item.type !== 'member_active' &&
        !String(item.id || '').startsWith('removed_')
    );
    const feedListEl = document.getElementById('squad-feed-list');
    if (feedListEl) {
      if (!activeSquad || visibleFeedActivities.length === 0) {
        feedListEl.innerHTML = `<li class="empty-cell">${
          activeSquad
            ? 'No recent notes or shared resources yet. Click "Add Note" to share with your squad.'
            : 'Join or create a squad to view the Squad Feed.'
        }</li>`;
      } else {
        feedListEl.innerHTML = visibleFeedActivities
          .map((item) => {
            const safeUrl = item.url ? sanitizeResourceUrl(item.url) : null;
            const openActionHtml = safeUrl
              ? `(<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Open</a>)`
              : `(<a href="#" data-open-squad-note="${escapeHtml(item.id)}">Open</a>)`;
            const courseSuffix = item.courseName ? ` — ${escapeHtml(item.courseName)}` : '';
            return `
              <li>
                <strong>${escapeHtml(item.displayName || 'Student')}</strong> ${escapeHtml(item.text || '')}${courseSuffix}
                <span class="item-meta">· ${escapeHtml(formatFeedRelativeTime(item.createdAt))} ${openActionHtml} (<a href="#" data-delete-squad-note="${escapeHtml(item.id)}">Delete</a>)</span>
              </li>`;
          })
          .join('');
      }
    }

    const nextSession = activeSquad?.nextSession || null;
    const nextSessionTitleEl = document.getElementById('squad-next-session-title');
    const nextSessionAttendeesEl = document.getElementById('squad-next-session-attendees');
    const attendBtn = document.getElementById('btn-toggle-session-attending');

    if (nextSessionTitleEl) {
      if (nextSession && (nextSession.title || nextSession.when)) {
        nextSessionTitleEl.textContent = `${nextSession.title || 'Group Session'}${
          nextSession.when ? ` — ${nextSession.when}` : ''
        }`;
      } else {
        nextSessionTitleEl.textContent = 'No group session scheduled yet';
      }
    }
    if (nextSessionAttendeesEl) {
      const attendees = Array.isArray(nextSession?.attendees) ? nextSession.attendees : [];
      nextSessionAttendeesEl.textContent =
        attendees.length > 0
          ? `${attendees.join(', ')} attending`
          : activeSquad
          ? 'Be the first to join this session'
          : 'Join a squad to schedule group sessions';
    }
    if (attendBtn) {
      attendBtn.disabled = !activeSquad;
      const myName = sanitizeTextInput(profile.name || 'Student', 100);
      const attendeeUids = Array.isArray(nextSession?.attendeeUids) ? nextSession.attendeeUids : [];
      const attendees = Array.isArray(nextSession?.attendees) ? nextSession.attendees : [];
      const isAttending = attendeeUids.includes(myUid) || attendees.includes(myName);
      attendBtn.textContent = isAttending ? "I'm In ✓" : "I'm In";
    }

    // 6. Populate Modal Tables (#modal-squad-create-join & #modal-squad-admin)
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

    const adminMembersTbody = document.getElementById('admin-members-tbody');
    if (adminMembersTbody && activeSquad) {
      adminMembersTbody.innerHTML =
        sortedMembers.length === 0
          ? `<tr><td colspan="4" class="empty-cell">No members in squad.</td></tr>`
          : sortedMembers
              .map((m) => {
                const isCreator =
                  m.uid === myUid
                    ? isCurrentUserSquadCreator(activeSquad)
                    : canManageSquad(activeSquad, m.uid);
                return `
              <tr>
                <td><strong>${escapeHtml(m.displayName || 'Student')}</strong></td>
                <td>${escapeHtml(formatStudyDuration(m.minutesThisWeek || 0))}</td>
                <td>${isCreator ? 'Creator / Admin' : 'Member'}</td>
                <td>
                  ${
                    isCreator
                      ? '<span class="item-meta" style="margin-left:0;">Creator</span>'
                      : `<a href="#" class="squad-leave-link" data-admin-remove-member="${escapeHtml(m.uid)}" data-admin-remove-name="${escapeHtml(m.displayName || 'Student')}">Remove</a>`
                  }
                </td>
              </tr>`;
              })
              .join('');
    }

    // 7. Populate Friends Left Sidebar & Right Dual-View (#44)
    populateFriendsSidebarAndStatsView(
      myUid,
      acceptedFriends,
      incomingRequests,
      outgoingRequests,
      allMembers,
      liveMap
    );

    updateScrollableTablesMaxHeight();
  }

  function populateFriendsSidebarAndStatsView(
    myUid,
    acceptedFriends = [],
    incomingRequests = [],
    outgoingRequests = [],
    allMembers = [],
    liveMap = new Map()
  ) {
    if (selectedFriendUid && !acceptedFriends.some((f) => f.uid === selectedFriendUid)) {
      selectedFriendUid = null;
      selectedFriendTelemetry = null;
      if (selectedFriendDocUnsub) {
        selectedFriendDocUnsub();
        selectedFriendDocUnsub = null;
      }
    }

    const searchInputEl = document.getElementById('friend-search-input');
    if (searchInputEl && document.activeElement !== searchInputEl) {
      searchInputEl.value = friendSearchQuery;
    }

    const noticeEl = document.getElementById('friend-action-notice');
    if (noticeEl) {
      const incomingSignature = incomingRequests.map((r) => r.friendshipId).join(',');
      if (friendActionNotice && friendActionNotice.text) {
        noticeEl.hidden = false;
        noticeEl.className = `notice-box ${
          friendActionNotice.type === 'error' ? 'notice-error' : 'notice-success'
        }`;
        noticeEl.innerHTML = `<span>${escapeHtml(friendActionNotice.text)}</span><button type="button" class="notice-dismiss-btn" data-dismiss-friend-notice="action" aria-label="Dismiss notification">&times;</button>`;
      } else if (incomingRequests.length > 0 && dismissedIncomingNoticeKey !== incomingSignature) {
        const senderNames = incomingRequests.map((r) => r.displayName).join(', ');
        const msg =
          incomingRequests.length === 1
            ? `New friend request from ${senderNames}! Click Accept below.`
            : `You have ${incomingRequests.length} incoming friend requests (${senderNames}).`;
        noticeEl.hidden = false;
        noticeEl.className = 'notice-box notice-success';
        noticeEl.innerHTML = `<span>${escapeHtml(msg)}</span><button type="button" class="notice-dismiss-btn" data-dismiss-friend-notice="incoming:${escapeHtml(incomingSignature)}" aria-label="Dismiss notification">&times;</button>`;
      } else {
        noticeEl.hidden = true;
        noticeEl.innerHTML = '';
      }
    }

    const requestsSectionEl = document.getElementById('friends-requests-section');
    const incomingWrapEl = document.getElementById('friends-incoming-wrap');
    const incomingListEl = document.getElementById('friends-incoming-list');
    const outgoingWrapEl = document.getElementById('friends-outgoing-wrap');
    const outgoingListEl = document.getElementById('friends-outgoing-list');

    const hasIncoming = incomingRequests.length > 0;
    const hasOutgoing = outgoingRequests.length > 0;

    if (requestsSectionEl) {
      requestsSectionEl.hidden = !hasIncoming && !hasOutgoing;
    }
    if (incomingWrapEl && incomingListEl) {
      incomingWrapEl.hidden = !hasIncoming;
      const incomingLabel = incomingWrapEl.querySelector('.friends-subsection-label');
      if (incomingLabel) {
        incomingLabel.textContent =
          incomingRequests.length > 0
            ? `Incoming Requests (${incomingRequests.length})`
            : 'Incoming Requests';
      }
      incomingListEl.innerHTML = incomingRequests
        .map(
          (req) => `
          <li class="friend-request-item">
            <div>
              <strong>${escapeHtml(req.displayName)}</strong>
              <div class="friend-sidebar-meta">${escapeHtml(req.email)}</div>
            </div>
            <div class="friend-request-actions">
              <button type="button" data-accept-friend-request="${escapeHtml(req.friendshipId)}">Accept</button>
              <button type="button" class="btn-danger" data-decline-friend-request="${escapeHtml(req.friendshipId)}">Decline</button>
            </div>
          </li>`
        )
        .join('');
    }
    if (outgoingWrapEl && outgoingListEl) {
      outgoingWrapEl.hidden = !hasOutgoing;
      outgoingListEl.innerHTML = outgoingRequests
        .map(
          (req) => `
          <li class="friend-request-item">
            <div>
              <strong>${escapeHtml(req.displayName)}</strong>
              <span class="friend-sidebar-meta">(Pending)</span>
            </div>
            <div class="friend-request-actions">
              <a href="#" class="squad-leave-link" data-decline-friend-request="${escapeHtml(req.friendshipId)}">Cancel</a>
            </div>
          </li>`
        )
        .join('');
    }

    const filteredFriends = filterFriendsByQuery(acceptedFriends, friendSearchQuery);
    const friendsListEl = document.getElementById('friends-sidebar-list');
    if (friendsListEl) {
      if (acceptedFriends.length === 0) {
        friendsListEl.innerHTML = `<li class="empty-cell">No friends yet. Enter an email above and click Add to send a request.</li>`;
      } else if (filteredFriends.length === 0) {
        friendsListEl.innerHTML = `<li class="empty-cell">No matching friends. Press Add to send a request to "${escapeHtml(friendSearchQuery.trim())}".</li>`;
      } else {
        friendsListEl.innerHTML = filteredFriends
          .map((friend) => {
            const isSelected = friend.uid === selectedFriendUid;
            const squadMatch = allMembers.find(
              (m) => getEmailDocId(m.uid || '') === friend.uid
            );
            const isLive = liveMap.has(friend.uid) || squadMatch?.status === 'live';
            const isOnline =
              !isLive && (squadMatch?.isStreakActive || squadMatch?.status === 'online');
            let statusLabel = 'Offline';
            let statusClass = 'status-offline';
            if (isLive) {
              statusLabel = 'Live';
              statusClass = 'status-live';
            } else if (isOnline) {
              statusLabel = 'Online';
              statusClass = 'status-online';
            }

            return `
              <li
                class="friend-sidebar-item ${isSelected ? 'active' : ''}"
                data-select-friend="${escapeHtml(friend.uid)}"
                title="View ${escapeHtml(friend.displayName)}'s Infos and Stats"
              >
                <span class="friend-sidebar-name">
                  ${isLive ? '<span class="live-badge-dot" aria-hidden="true"></span>' : ''}
                  ${escapeHtml(friend.displayName)}
                </span>
                <span class="friend-sidebar-meta ${statusClass}">${escapeHtml(statusLabel)}</span>
              </li>`;
          })
          .join('');
      }
    }

    const squadViewContainer = document.getElementById('squads-current-view-container');
    const friendStatsView = document.getElementById('friend-info-stats-view');
    if (squadViewContainer) {
      squadViewContainer.hidden = Boolean(selectedFriendUid);
    }
    if (friendStatsView) {
      friendStatsView.hidden = !selectedFriendUid;
    }

    if (!selectedFriendUid) return;

    const friendObj = acceptedFriends.find((f) => f.uid === selectedFriendUid) || {
      uid: selectedFriendUid,
      displayName: 'Friend',
      email: selectedFriendUid,
    };
    const squadMemberFallback =
      allMembers.find((m) => getEmailDocId(m.uid || '') === selectedFriendUid) || {};
    const stats =
      selectedFriendTelemetry && selectedFriendTelemetry.uid === selectedFriendUid
        ? selectedFriendTelemetry
        : buildFriendTelemetrySummary(squadMemberFallback, friendObj);

    const nameEl = document.getElementById('friend-view-name');
    if (nameEl) {
      nameEl.textContent = stats.displayName;
    }

    const removeBtn = document.getElementById('btn-remove-friend');
    if (removeBtn) {
      removeBtn.setAttribute(
        'data-friendship-id',
        friendObj.friendshipId || getFriendshipId(myUid, selectedFriendUid)
      );
      removeBtn.setAttribute('data-friend-name', stats.displayName || 'Friend');
    }

    const weeklyTimeEl = document.getElementById('friend-summary-weekly-time');
    if (weeklyTimeEl) {
      weeklyTimeEl.textContent = `${stats.weekTotalHours} / ${stats.weeklyGoalHours}h`;
    }
    const goalPctEl = document.getElementById('friend-summary-goal-pct');
    if (goalPctEl) {
      goalPctEl.textContent = `${stats.weeklyGoalPercent}%`;
    }
    const streakEl = document.getElementById('friend-summary-streak');
    if (streakEl) {
      streakEl.textContent = `${stats.currentStreak} days`;
    }
    const eloEl = document.getElementById('friend-summary-elo');
    if (eloEl) {
      eloEl.textContent = String(stats.elo || 1000);
    }

    const thead7Day = document.getElementById('friend-view-7day-thead');
    if (thead7Day) {
      thead7Day.innerHTML = stats.weekDays
        .map(
          (d) =>
            `<th>${escapeHtml(d.shortDay)}<span class="day-sub">${escapeHtml(d.formattedDate)}</span></th>`
        )
        .join('');
    }
    const tbody7Day = document.getElementById('friend-view-7day-tbody');
    if (tbody7Day) {
      tbody7Day.innerHTML = stats.weekDays.map((d) => renderWeekDayHoursCell(d)).join('');
    }

    const subjTbody = document.getElementById('friend-view-subjects-tbody');
    if (subjTbody) {
      subjTbody.innerHTML =
        stats.subjects.length === 0
          ? `<tr><td colspan="2" class="empty-cell">No subjects logged this week yet.</td></tr>`
          : stats.subjects
              .map(
                (s) => `
              <tr>
                <td>${escapeHtml(s.subject)}</td>
                <td><strong>${escapeHtml(s.hours)}</strong></td>
              </tr>`
              )
              .join('');
    }

    const profileTbody = document.getElementById('friend-view-profile-tbody');
    if (profileTbody) {
      profileTbody.innerHTML = `
        <tr>
          <th>Name</th>
          <td><strong>${escapeHtml(stats.displayName)}</strong></td>
        </tr>
        <tr>
          <th>Email</th>
          <td>${escapeHtml(stats.email || '-')}</td>
        </tr>
        <tr>
          <th>Institution</th>
          <td>${escapeHtml(stats.institution || 'Not specified')}</td>
        </tr>
        <tr>
          <th>Degree Program</th>
          <td>${escapeHtml(
            [stats.degreeName, stats.degreeType].filter(Boolean).join(' — ') || 'Not specified'
          )}</td>
        </tr>
        <tr>
          <th>Academic Year &amp; Status</th>
          <td>${escapeHtml([stats.academicYear, stats.status].filter(Boolean).join(' · ') || 'Enrolled')}</td>
        </tr>
      `;
    }

    const coursesTbody = document.getElementById('friend-view-courses-tbody');
    if (coursesTbody) {
      const activeCourses = (Array.isArray(stats.courses) ? stats.courses : []).filter(
        (c) => String(c?.status || '').toLowerCase() === 'active'
      );
      coursesTbody.innerHTML =
        activeCourses.length === 0
          ? `<tr><td colspan="2" class="empty-cell">No active courses shared on profile yet.</td></tr>`
          : activeCourses
              .map(
                (c) => `
              <tr>
                <td><strong>${escapeHtml(c.title)}</strong></td>
                <td>${escapeHtml(c.status || 'Active')}</td>
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
  async function syncUserSquadTelemetry(targetSquadId = null) {
    if (!db) return;
    const email = sessionEmail || profile.email;
    if (!email && !auth?.currentUser) return;
    const uid = getEmailDocId(email || auth?.currentUser?.email || 'local_student');

    const weekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
    const streak = calculateCurrentStreak(studyLogs, profile);
    const tasksThisWeek = countCompletedTasksThisWeek(assignments);
    const elo = calculateElo(weekMinutes, tasksThisWeek, streak);
    const dailyMinutes = getWeeklyDailyMinutesMap(studyLogs);
    const subjectMinutes = getWeeklySubjectMinutesMap(studyLogs);
    const now = new Date().toISOString();

    profile = {
      ...profile,
      minutesStudiedThisWeek: weekMinutes,
      currentStreak: streak,
      tasksCompletedThisWeek: tasksThisWeek,
      lastActiveDate: streak > 0 ? (profile.lastActiveDate || getLocalDateString()) : profile.lastActiveDate,
    };

    const memberPayload = {
      uid,
      displayName: sanitizeTextInput(profile.name || 'Student', 100),
      color: '#3B77BC',
      elo,
      minutesThisWeek: Math.min(10080, Math.max(0, weekMinutes)),
      tasksThisWeek: Math.min(10000, Math.max(0, tasksThisWeek)),
      currentStreak: Math.min(10000, Math.max(0, streak)),
      dailyMinutes,
      subjectMinutes,
      status: myLiveSession ? 'live' : 'online',
      ...(myLiveSession
        ? { liveSubject: myLiveSession.subject, liveStartedAt: myLiveSession.startedAt }
        : {}),
      updatedAt: now,
    };

    const targetSquadIds = targetSquadId
      ? [targetSquadId]
      : Array.from(
          new Set([
            ...squads.map((s) => s.id),
            ...(Array.isArray(profile.squadIds) ? profile.squadIds : []),
            ...(activeSquadId ? [activeSquadId] : []),
          ])
        ).filter(Boolean);

    if (targetSquadIds.length === 0) return;

    for (const sqId of targetSquadIds) {
      try {
        await saveSquadMemberToCloud(sqId, memberPayload);
      } catch (err) {
        console.warn(`Failed to sync squad member telemetry for squad ${sqId}:`, err);
      }
    }
  }

  async function loadUserSquads() {
    const email = sessionEmail || profile.email;
    const uid = email ? getEmailDocId(email) : 'local_student';
    void subscribeToUserFriendships(uid);
    try {
      const result = await fetchUserSquads(uid, email);
      const loaded = Array.isArray(result)
        ? result
        : Array.isArray(result?.squads)
        ? result.squads
        : [];
      squads = loaded;
      if (loaded.length > 0) {
        if (!activeSquadId || !squads.some((s) => s.id === activeSquadId)) {
          activeSquadId = result?.activeSquadId || squads[0].id;
        }
        subscribeToSquadMembers(activeSquadId);
        void syncUserSquadTelemetry(activeSquadId);
      } else {
        activeSquadId = null;
        cleanupActiveSquadListeners();
        squadMembers = [];
        squadPresence = [];
        squadActivities = [];
      }
      populateCurrentPageData();
    } catch (err) {
      console.warn('Squad fetch notice:', err);
    }
  }

  async function subscribeToUserFriendships(myUid) {
    const normUid = getEmailDocId(myUid || sessionEmail || profile.email || 'local_student');
    activeFriendshipsUid = normUid;
    if (friendshipsUnsub) {
      friendshipsUnsub();
      friendshipsUnsub = null;
    }

    try {
      const initial = await fetchUserFriendships(normUid, profile.name);
      if (Array.isArray(initial)) {
        friendships = initial;
        populateCurrentPageData();
      }
    } catch {}

    if (!db || !normUid) return;

    try {
      const hubRef = collection(db, 'squads', FRIENDS_HUB_SQUAD_ID, 'activities');
      friendshipsUnsub = onSnapshot(
        hubRef,
        (snap) => {
          const prevIncomingIds = new Set(
            partitionFriendships(friendships, normUid, profile.name).incomingRequests.map(
              (r) => r.friendshipId
            )
          );
          const merged = new Map();
          for (const item of friendships) {
            if (item?.id && item.status !== 'removed' && item.status !== 'declined') {
              merged.set(item.id, item);
            }
          }
          snap.docs.forEach((d) => {
            const record = hubActivityDocToFriendship(d.id, d.data());
            if (!record || !record.id) return;
            if (record.status === 'removed' || record.status === 'declined') {
              merged.delete(record.id);
              return;
            }
            if (doesFriendshipMatchUser(record, normUid, profile.name)) {
              merged.set(record.id, record);
            }
          });
          friendships = Array.from(merged.values());
          const nextIncoming = partitionFriendships(
            friendships,
            normUid,
            profile.name
          ).incomingRequests;
          const newlyArrived = nextIncoming.find((r) => !prevIncomingIds.has(r.friendshipId));
          if (newlyArrived) {
            setStatus(`New friend request from ${newlyArrived.displayName}!`);
          }
          populateCurrentPageData();
        },
        (err) => {
          console.warn('Friendships listener notice:', err);
        }
      );
    } catch (err) {
      console.warn('Friendships subscription notice:', err);
    }
  }

  async function selectFriendForStatsView(friendUid) {
    const normUid = friendUid ? getEmailDocId(friendUid) : null;
    if (!normUid || selectedFriendUid === normUid) {
      selectedFriendUid = null;
      selectedFriendTelemetry = null;
      if (selectedFriendDocUnsub) {
        selectedFriendDocUnsub();
        selectedFriendDocUnsub = null;
      }
      populateSquadsPage();
      return;
    }

    selectedFriendUid = normUid;
    if (selectedFriendDocUnsub) {
      selectedFriendDocUnsub();
      selectedFriendDocUnsub = null;
    }

    const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
    const { acceptedFriends } = partitionFriendships(friendships, myUid, profile.name);
    const friendMeta = acceptedFriends.find((f) => f.uid === normUid) || {
      uid: normUid,
      email: normUid,
    };
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    const { allMembers } = getProcessedSquadMembers(activeSquad);
    const squadMatch = allMembers.find((m) => getEmailDocId(m.uid || '') === normUid);

    selectedFriendTelemetry = buildFriendTelemetrySummary(squadMatch || {}, friendMeta);
    populateSquadsPage();

    try {
      const fetched = await fetchFriendProfileTelemetry(normUid, {
        ...squadMatch,
        ...friendMeta,
      });
      if (selectedFriendUid === normUid && fetched) {
        selectedFriendTelemetry = fetched;
        populateSquadsPage();
      }
    } catch {}

    if (db) {
      try {
        selectedFriendDocUnsub = onSnapshot(
          doc(db, 'users', normUid),
          (snap) => {
            if (selectedFriendUid !== normUid) return;
            if (snap.exists()) {
              selectedFriendTelemetry = buildFriendTelemetrySummary(snap.data(), {
                ...squadMatch,
                ...friendMeta,
              });
              populateSquadsPage();
            }
          },
          () => {}
        );
      } catch {}
    }
  }

  async function handleSendFriendRequest(targetInput, targetDisplayName = '') {
    const myEmail = sessionEmail || profile.email || auth?.currentUser?.email || 'local_student';
    const myUid = getEmailDocId(myEmail);
    const myName = sanitizeTextInput(profile.name || 'Student', 100);
    let cleanTarget = String(targetInput || '').trim();
    let resolvedDisplayName = targetDisplayName;

    if (!cleanTarget) {
      friendActionNotice = {
        type: 'error',
        text: 'Enter a friend email address in the search bar to send a request.',
      };
      populateSquadsPage();
      return;
    }

    // If user typed a squadmate's name or username prefix, resolve to their squad member UID/email
    if (!cleanTarget.includes('@')) {
      const qLower = cleanTarget.toLowerCase();
      const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
      const { allMembers } = getProcessedSquadMembers(activeSquad);
      const matchedMember = allMembers.find((m) => {
        if (!m || getEmailDocId(m.uid || '') === myUid) return false;
        const mName = String(m.displayName || '').trim().toLowerCase();
        const mUid = String(m.uid || '').trim().toLowerCase();
        const mPrefix = mUid.includes('@') ? mUid.split('@')[0] : mUid;
        return mName === qLower || mPrefix === qLower || mUid === qLower;
      });
      if (matchedMember && matchedMember.uid) {
        cleanTarget = matchedMember.uid;
        resolvedDisplayName = resolvedDisplayName || matchedMember.displayName || '';
      }
    }

    const res = await sendFriendRequest({
      fromUid: myUid,
      fromEmail: myEmail,
      fromName: myName,
      toEmailOrUid: cleanTarget,
      toName: resolvedDisplayName,
    });

    if (!res.ok) {
      friendActionNotice = { type: 'error', text: res.error || 'Could not send friend request.' };
      populateSquadsPage();
      return;
    }

    if (res.friendship) {
      friendships = [
        res.friendship,
        ...friendships.filter((f) => f.id !== res.friendship.id),
      ];
    }

    friendSearchQuery = '';
    const searchInputEl = document.getElementById('friend-search-input');
    if (searchInputEl) searchInputEl.value = '';

    if (res.status === 'already_friends') {
      friendActionNotice = { type: 'success', text: 'You are already friends!' };
    } else if (res.status === 'accepted') {
      friendActionNotice = { type: 'success', text: 'Friend request accepted!' };
    } else {
      friendActionNotice = {
        type: 'success',
        text: `Friend request sent to ${res.friendship?.recipientName || cleanTarget}!`,
      };
    }

    populateSquadsPage();
    setStatus(friendActionNotice.text);
  }

  function subscribeToSquadMembers(squadId) {
    cleanupActiveSquadListeners();
    if (!squadId || !db) {
      squadMembers = [];
      squadPresence = [];
      squadActivities = [];
      populateCurrentPageData();
      return;
    }

    try {
      const squadRef = doc(db, 'squads', squadId);
      squadDocUnsub = onSnapshot(
        squadRef,
        (snap) => {
          if (snap.exists()) {
            const updatedSq = snap.data();
            squads = squads.map((s) => (s.id === squadId ? { ...s, ...updatedSq } : s));
            populateCurrentPageData();
          }
        },
        (err) => {
          console.warn('Squad doc listener notice:', err);
        }
      );

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

      const presenceRef = collection(db, 'squads', squadId, 'presence');
      squadPresenceUnsub = onSnapshot(
        presenceRef,
        (snap) => {
          squadPresence = snap.docs.map((d) => d.data());
          populateCurrentPageData();
        },
        (err) => {
          console.warn('Squad presence listener notice:', err);
        }
      );

      const activitiesRef = collection(db, 'squads', squadId, 'activities');
      squadActivitiesUnsub = onSnapshot(
        activitiesRef,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          items.sort((a, b) => {
            const ta = Date.parse(String(a.createdAt || '')) || 0;
            const tb = Date.parse(String(b.createdAt || '')) || 0;
            return tb - ta;
          });
          squadActivities = items;
          const activeSq = squads.find((s) => s.id === squadId);
          if (
            activeSq &&
            isCurrentUserRemovedFromSquad(
              activeSq,
              squadMembers,
              squadActivities,
              getMySquadIdentity()
            )
          ) {
            void performLeaveSquad(squadId);
            return;
          }
          populateCurrentPageData();
        },
        (err) => {
          console.warn('Squad activities listener notice:', err);
        }
      );

      liveTimerInterval = window.setInterval(() => {
        if (squadPresence.length > 0 || myLiveSession) {
          populateSquadsPage();
        }
      }, 30000);
    } catch (err) {
      console.warn('Squad subscription notice:', err);
    }
  }

  // --- Squad Modal & Action Helpers (#36, #42, #43, Live Library) ---
  function openSquadCreateJoinModal() {
    populateSquadsPage();
    const dialog = document.getElementById('modal-squad-create-join');
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  function openSquadAdminModal() {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (!activeSquad || !isCurrentUserSquadCreator(activeSquad)) {
      alert('Only the creator of this squad can access the Admin Panel.');
      return;
    }
    const nameInput = document.getElementById('admin-squad-name');
    const goalInput = document.getElementById('admin-squad-goal');
    const descInput = document.getElementById('admin-squad-description');
    if (nameInput) nameInput.value = activeSquad.name || '';
    if (goalInput) goalInput.value = Number(activeSquad.weeklyGoalHours) || 60;
    if (descInput) descInput.value = activeSquad.description || '';
    populateSquadsPage();
    const dialog = document.getElementById('modal-squad-admin');
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  function openFriendCalendarModal(memberUid) {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    const { allMembers } = getProcessedSquadMembers(activeSquad);
    const friend = allMembers.find((m) => m.uid === memberUid);
    if (!friend) return;

    const summary = getMemberWeekDaysSummary(friend);
    const titleEl = document.getElementById('friend-calendar-title');
    if (titleEl) {
      titleEl.textContent = `${friend.displayName || 'Student'} — Weekly Study Calendar (${summary.totalHours})`;
    }
    const subEl = document.getElementById('friend-calendar-subtitle');
    if (subEl) {
      subEl.textContent = `Current week study days & hours (Streak: ${friend.currentStreak || 0} days).`;
    }

    const theadEl = document.getElementById('friend-calendar-7day-thead');
    if (theadEl) {
      theadEl.innerHTML = summary.weekDays
        .map(
          (d) =>
            `<th>${escapeHtml(d.shortDay)}<span class="day-sub">${escapeHtml(d.formattedDate)}</span></th>`
        )
        .join('');
    }

    const tbodyEl = document.getElementById('friend-calendar-7day-tbody');
    if (tbodyEl) {
      tbodyEl.innerHTML = summary.weekDays.map((d) => renderWeekDayHoursCell(d)).join('');
    }

    const subjTbody = document.getElementById('friend-calendar-subjects-tbody');
    if (subjTbody) {
      subjTbody.innerHTML =
        summary.subjects.length === 0
          ? `<tr><td colspan="2" class="empty-cell">No subjects logged this week yet.</td></tr>`
          : summary.subjects
              .map(
                (s) => `
              <tr>
                <td>${escapeHtml(s.subject)}</td>
                <td><strong>${escapeHtml(s.hours)}</strong></td>
              </tr>`
              )
              .join('');
    }

    const dialog = document.getElementById('modal-friend-calendar');
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  function openGoLiveModal(prefillSubject = '') {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (!activeSquad) {
      openSquadCreateJoinModal();
      return;
    }
    const subjInput = document.getElementById('live-study-subject');
    if (subjInput) {
      subjInput.value = prefillSubject || courses[0]?.title || 'Analisi 1';
    }
    const dialog = document.getElementById('modal-go-live');
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  async function startLiveStudySession(subjectStr) {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (!activeSquad) return;
    const cleanSubject = sanitizeTextInput(subjectStr || courses[0]?.title || 'General Study', 120) || 'General Study';
    const myUid = getEmailDocId(sessionEmail || profile.email || auth?.currentUser?.email || 'local_student');
    const myName = sanitizeTextInput(profile.name || 'Student', 100);
    const startedAt = new Date().toISOString();

    myLiveSession = {
      squadId: activeSquad.id,
      subject: cleanSubject,
      startedAt,
    };

    const presenceDoc = await setMemberLiveStatus(activeSquad.id, {
      uid: myUid,
      displayName: myName,
      subject: cleanSubject,
      startedAt,
    });
    if (presenceDoc) {
      squadPresence = [
        presenceDoc,
        ...squadPresence.filter((p) => p.uid !== myUid),
      ];
    }
    populateSquadsPage();
    setStatus(`Live in Library: ${cleanSubject}`);
  }

  async function stopLiveStudySession() {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    const myUid = getEmailDocId(sessionEmail || profile.email || auth?.currentUser?.email || 'local_student');
    const existingLive =
      myLiveSession || squadPresence.find((p) => p.uid === myUid && p.status === 'live');

    myLiveSession = null;
    squadPresence = squadPresence.filter((p) => p.uid !== myUid);

    if (activeSquad) {
      await clearMemberLiveStatus(activeSquad.id, myUid);
    }

    if (existingLive && existingLive.startedAt) {
      const elapsed = formatLiveElapsed(existingLive.startedAt);
      if (elapsed.elapsedMinutes >= 5) {
        const matchedCourse = courses.find(
          (c) => c.title.toLowerCase() === String(existingLive.subject || '').toLowerCase()
        );
        const newLog = sanitizeStudyLogItem({
          id: `log-${Date.now()}`,
          courseId: matchedCourse?.id,
          courseName: matchedCourse ? matchedCourse.title : existingLive.subject || 'General Study',
          durationMinutes: Math.min(720, elapsed.elapsedMinutes),
          date: getLocalDateString(),
          notes: 'Live Library session',
          rating: 5,
          tag: 'Deep Work',
          timestamp: Date.now(),
        });
        if (newLog) {
          studyLogs = [newLog, ...studyLogs];
          void pushWorkstationToCloud();
          void syncUserSquadTelemetry();
        }
      }
    }

    populateSquadsPage();
    setStatus('Ended Live Library session');
  }

  function openSquadNoteModal() {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (!activeSquad) {
      openSquadCreateJoinModal();
      return;
    }
    const textInput = document.getElementById('squad-note-text');
    const courseInput = document.getElementById('squad-note-course');
    const urlInput = document.getElementById('squad-note-url');
    if (textInput) textInput.value = '';
    if (courseInput) courseInput.value = courses[0]?.title || '';
    if (urlInput) urlInput.value = '';
    const dialog = document.getElementById('modal-squad-note');
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  function openGroupSessionModal() {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (!activeSquad) {
      openSquadCreateJoinModal();
      return;
    }
    const locInput = document.getElementById('group-session-location');
    const dtInput = document.getElementById('group-session-datetime');
    if (locInput) locInput.value = activeSquad.nextSession?.title || '';
    if (dtInput) dtInput.value = activeSquad.nextSession?.when || '';
    const dialog = document.getElementById('modal-group-session');
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  async function copyActiveSquadInviteCode() {
    const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;
    if (!activeSquad?.code) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(activeSquad.code);
      }
      setStatus(`Copied Invite Code: ${activeSquad.code}`);
    } catch {
      setStatus(`Invite Code: ${activeSquad.code}`);
    }
  }

  async function performLeaveSquad(leaveSquadId) {
    if (!leaveSquadId) return;
    const email = sessionEmail || profile.email;
    const uid = getEmailDocId(email || auth?.currentUser?.email || 'local_student');
    squads = squads.filter((s) => s.id !== leaveSquadId);
    const nextActive = squads[0]?.id || null;
    activeSquadId = nextActive;
    myLiveSession = null;
    profile = {
      ...profile,
      activeSquadId: nextActive,
      squadIds: (profile.squadIds || []).filter((id) => id !== leaveSquadId),
    };
    saveToLocalStorage();
    await leaveSquadCleanly(email, uid, leaveSquadId, nextActive);
    await pushWorkstationToCloud();
    subscribeToSquadMembers(nextActive);
    populateSquadsPage();
    setStatus('Left squad');
  }

  // --- Modal Helpers ---
  function openCourseModal(courseToEdit = null, prefillTitle = '') {
    const dialog = document.getElementById('modal-course');
    if (!dialog) return;

    const titleHeading = document.getElementById('modal-course-title');
    const deleteBtn = document.getElementById('btn-delete-course');

    document.getElementById('course-id').value = courseToEdit ? courseToEdit.id : '';
    document.getElementById('course-title').value = courseToEdit
      ? courseToEdit.title
      : prefillTitle || '';
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

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function openCourseInfoModal(courseName) {
    const dialog = document.getElementById('modal-course-info');
    if (!dialog) return;

    const cleanName = sanitizeTextInput(courseName, 120);
    const course = findCourseForName(courses, cleanName);
    const titleEl = document.getElementById('course-info-title');
    const noticeEl = document.getElementById('course-info-missing-notice');
    const detailsEl = document.getElementById('course-info-details');
    const editBtn = document.getElementById('btn-course-info-edit');

    if (titleEl) {
      titleEl.textContent = course ? course.title : cleanName || 'Course Details';
    }

    if (course) {
      if (noticeEl) noticeEl.hidden = true;
      if (detailsEl) {
        detailsEl.hidden = false;
        const validProfEmail =
          course.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(course.email).trim())
            ? String(course.email).trim()
            : '';
        detailsEl.innerHTML = `
          <div class="course-info-item">
            <span class="course-info-label">Status</span>
            <span class="course-info-value">${escapeHtml(formatStatusLabel(course.status))}</span>
          </div>
          <div class="course-info-item">
            <span class="course-info-label">CFU</span>
            <span class="course-info-value">${escapeHtml(course.cfu)} CFU</span>
          </div>
          <div class="course-info-item">
            <span class="course-info-label">Year / Semester</span>
            <span class="course-info-value">Year ${escapeHtml(course.year)} / Semester ${escapeHtml(course.semester)}</span>
          </div>
          <div class="course-info-item">
            <span class="course-info-label">Office Hours</span>
            <span class="course-info-value">${escapeHtml(course.officeHours || '-')}</span>
          </div>
          <div class="course-info-item course-info-span-2">
            <span class="course-info-label">Professor Email</span>
            <span class="course-info-value">${
              validProfEmail
                ? `<a href="mailto:${escapeHtml(validProfEmail)}">${escapeHtml(validProfEmail)}</a>`
                : '-'
            }</span>
          </div>
          <div class="course-info-item course-info-span-2">
            <span class="course-info-label">Notes / Syllabus</span>
            <span class="course-info-value course-info-notes">${escapeHtml(course.notes || '-')}</span>
          </div>
        `;
      }
      if (editBtn) {
        editBtn.textContent = 'Edit Course';
        editBtn.setAttribute('data-course-info-id', course.id);
        editBtn.setAttribute('data-course-info-name', course.title);
      }
    } else {
      if (noticeEl) noticeEl.hidden = false;
      if (detailsEl) {
        detailsEl.hidden = true;
        detailsEl.innerHTML = '';
      }
      if (editBtn) {
        editBtn.textContent = 'Create Course';
        editBtn.setAttribute('data-course-info-id', '');
        editBtn.setAttribute('data-course-info-name', cleanName);
      }
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  let activeLogTimeMode = 'minutes';

  function updateLogDurationPreview(mins) {
    const canonicalInput = document.getElementById('log-minutes');
    if (canonicalInput) canonicalInput.value = mins;
    const preview = document.getElementById('log-duration-preview');
    if (preview) {
      if (mins >= 5) {
        preview.textContent = `Calculated: ${formatStudyDuration(mins)} (${mins} min)`;
        preview.style.color = '#2b5d95';
      } else {
        preview.textContent = 'Please enter a valid duration (minimum 5 min)';
        preview.style.color = '#aa0000';
      }
    }
  }

  function syncLogModeInputsFromMinutes(mins, targetMode) {
    if (targetMode === 'minutes') {
      const input = document.getElementById('log-minutes-input');
      if (input && mins > 0) input.value = mins;
    } else if (targetMode === 'hours-minutes') {
      const hoursInput = document.getElementById('log-hours');
      const subminutesInput = document.getElementById('log-subminutes');
      if (hoursInput) hoursInput.value = Math.floor(mins / 60);
      if (subminutesInput) subminutesInput.value = mins % 60;
    } else if (targetMode === 'range') {
      const startInput = document.getElementById('log-start-time');
      const endInput = document.getElementById('log-end-time');
      const currentStart = startInput?.value || '14:00';
      if (startInput) startInput.value = currentStart;
      if (endInput) {
        endInput.value = addMinutesToTimeString(currentStart, mins > 0 ? mins : 90);
      }
    }
    updateLogDurationPreview(mins);
  }

  function setLogTimeMode(mode) {
    activeLogTimeMode = mode;
    const modal = document.getElementById('modal-log');
    if (!modal) return;

    modal.querySelectorAll('.log-time-tab').forEach((tab) => {
      const isActive = tab.getAttribute('data-time-mode') === mode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    const panelMinutes = document.getElementById('log-mode-minutes');
    const panelHoursMin = document.getElementById('log-mode-hours-minutes');
    const panelRange = document.getElementById('log-mode-range');

    if (panelMinutes) panelMinutes.classList.toggle('hidden', mode !== 'minutes');
    if (panelHoursMin) panelHoursMin.classList.toggle('hidden', mode !== 'hours-minutes');
    if (panelRange) panelRange.classList.toggle('hidden', mode !== 'range');

    const parsed = parseInt(document.getElementById('log-minutes')?.value, 10);
    const canonicalVal = Number.isFinite(parsed) ? parsed : 90;
    syncLogModeInputsFromMinutes(canonicalVal, mode);
  }

  function openLogModal() {
    const dialog = document.getElementById('modal-log');
    if (!dialog) return;
    document.getElementById('log-subject').value = courses[0]?.title || '';
    document.getElementById('log-date').value = getLocalDateString();
    document.getElementById('log-tag').value = 'Deep Work';
    document.getElementById('log-notes').value = '';

    const defaultMinutes = 90;
    setLogTimeMode('minutes');
    const minInput = document.getElementById('log-minutes-input');
    if (minInput) minInput.value = defaultMinutes;
    const hoursInput = document.getElementById('log-hours');
    if (hoursInput) hoursInput.value = 1;
    const subminInput = document.getElementById('log-subminutes');
    if (subminInput) subminInput.value = 30;
    const startTimeInput = document.getElementById('log-start-time');
    if (startTimeInput) startTimeInput.value = '14:00';
    const endTimeInput = document.getElementById('log-end-time');
    if (endTimeInput) endTimeInput.value = '15:30';
    updateLogDurationPreview(defaultMinutes);

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function openResourceModal() {
    const dialog = document.getElementById('modal-resource');
    if (!dialog) return;
    document.getElementById('resource-title').value = '';
    document.getElementById('resource-url').value = '';
    document.getElementById('resource-category').value = 'Portal';
    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function openGoalModal(goalToEdit = null) {
    const dialog = document.getElementById('modal-goal');
    if (!dialog) return;

    const heading = document.getElementById('modal-goal-title');
    const deleteBtn = document.getElementById('btn-delete-goal');
    const idInput = document.getElementById('goal-id');
    const titleInput = document.getElementById('goal-title');
    const typeInput = document.getElementById('goal-type');
    const completedInput = document.getElementById('goal-completed');

    const isCourseGoal = Boolean(goalToEdit && goalToEdit.tag && goalToEdit.tag !== 'Skill');

    if (idInput) idInput.value = goalToEdit ? goalToEdit.id : '';
    if (titleInput) titleInput.value = goalToEdit ? goalToEdit.title : '';
    if (typeInput) typeInput.value = isCourseGoal ? 'course' : 'skill';
    populateGoalCourseSelect(isCourseGoal ? goalToEdit.tag : courses[0]?.title || '');
    syncGoalModalFields();
    if (completedInput) {
      completedInput.checked = goalToEdit ? Boolean(goalToEdit.completed) : false;
    }
    if (heading) {
      heading.textContent = goalToEdit ? 'Edit Goal' : 'Add Goal';
    }
    if (deleteBtn) {
      deleteBtn.hidden = !goalToEdit;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function validateAssignmentGradeField(inputEl, shouldValidate = true) {
    if (!inputEl) return true;
    if (!shouldValidate) {
      inputEl.setCustomValidity('');
      return true;
    }
    const valid = isValidGradeInput(inputEl.value);
    inputEl.setCustomValidity(
      valid ? '' : 'Enter a valid grade between 0 and 30 (e.g. 29,60 or 29.60).'
    );
    return valid;
  }

  function syncAssignmentModalFields() {
    const typeEl = document.getElementById('assignment-type');
    const singlePanel = document.getElementById('assignment-single-grade-panel');
    const midtermPanel = document.getElementById('assignment-midterm-grades-panel');
    const previewEl = document.getElementById('assignment-esonero-average-preview');
    const gradeEl = document.getElementById('assignment-grade');
    const es1El = document.getElementById('assignment-esonero1');
    const es2El = document.getElementById('assignment-esonero2');
    if (!typeEl || !singlePanel || !midtermPanel) return;

    const isMidterm = typeEl.value === 'Midterm';
    singlePanel.hidden = isMidterm;
    midtermPanel.hidden = !isMidterm;

    validateAssignmentGradeField(gradeEl, !isMidterm);
    validateAssignmentGradeField(es1El, isMidterm);
    validateAssignmentGradeField(es2El, isMidterm);

    if (isMidterm && previewEl && es1El && es2El) {
      const g1 = isValidGradeInput(es1El.value) ? clampExamGradeValue(es1El.value) : null;
      const g2 = isValidGradeInput(es2El.value) ? clampExamGradeValue(es2El.value) : null;

      previewEl.classList.remove('exam-grade-pass', 'exam-grade-fail');
      if (g1 !== null && g2 !== null) {
        const avg = Math.round(((g1 + g2) / 2) * 100) / 100;
        previewEl.textContent = `Average Grade: ${avg} / 30`;
        previewEl.classList.add(avg >= 18 ? 'exam-grade-pass' : 'exam-grade-fail');
      } else {
        previewEl.textContent = 'Average Grade: -';
      }
    }
  }

  function openAssignmentModal(itemToEdit = null) {
    const dialog = document.getElementById('modal-assignment');
    if (!dialog) return;

    const heading = document.getElementById('modal-assignment-title');
    const deleteBtn = document.getElementById('btn-delete-assignment');

    document.getElementById('assignment-id').value = itemToEdit ? itemToEdit.id : '';
    document.getElementById('assignment-course').value = itemToEdit
      ? itemToEdit.courseName
      : courses[0]?.title || '';
    document.getElementById('assignment-type').value = itemToEdit
      ? normalizeAssignmentType(itemToEdit.type)
      : 'Exam';
    document.getElementById('assignment-due').value = itemToEdit
      ? itemToEdit.dueDate
      : getLocalDateString();

    const completedCheckbox = document.getElementById('assignment-completed');
    if (completedCheckbox) {
      completedCheckbox.checked = itemToEdit ? itemToEdit.status === 'completed' : false;
    }

    document.getElementById('assignment-grade').value =
      itemToEdit && typeof itemToEdit.grade === 'number' ? itemToEdit.grade : '';

    const es1 = itemToEdit?.examParts?.[0]?.grade;
    const es2 = itemToEdit?.examParts?.[1]?.grade;
    document.getElementById('assignment-esonero1').value = typeof es1 === 'number' ? es1 : '';
    document.getElementById('assignment-esonero2').value = typeof es2 === 'number' ? es2 : '';

    syncAssignmentModalFields();

    if (heading) {
      heading.textContent = itemToEdit ? 'Edit Exam / Assignment' : 'Add Exam / Assignment';
    }
    if (deleteBtn) {
      deleteBtn.hidden = !itemToEdit;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
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
      checklist: normalizeGoalsList(checklist),
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
      hasInitialServerSnapshot = true;
      isInitialCloudLoading = false;
      applyRemoteWorkspaceData(userData, normalizedEmail, { isInitialHydration: true });
    } else {
      isInitialCloudLoading = false;
      profile = sanitizeUserProfile(profile, INITIAL_PROFILE, normalizedEmail);
      saveToLocalStorage();
    }

    authNotice = null;
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
    const fallbackRecord = stripUndefinedDeep({
      uid: docId,
      authUid: googleUser.uid || docId,
      email: mail,
      name: sanitizeTextInput(googleUser.displayName || profile.name || mail.split('@')[0], 100),
      studentId: '',
      authProvider: 'google',
      emailVerified: true,
      degreeName: '',
      institution: '',
      degreeType: INITIAL_PROFILE.degreeType,
      totalTargetCFU: INITIAL_PROFILE.totalTargetCFU,
      academicYear: INITIAL_PROFILE.academicYear,
      courses: [],
      studyLogs: [],
      assignments: [],
      quickNotes: '',
      checklist: [],
      resourceLinks: [],
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
    });

    if (!db) {
      courses = [];
      studyLogs = [];
      assignments = [];
      quickNotes = '';
      checklist = [];
      resourceLinks = [];
      completeCloudLogin(fallbackRecord, mail);
      return;
    }

    const userRef = doc(db, 'users', docId);

    try {
      const snap = await fetchFreshUserDoc(userRef);
      if (snap.exists()) {
        const existingData = snap.data();
        const targetAuthUid = googleUser.uid || existingData.authUid || docId;
        if (existingData.authUid !== targetAuthUid || !existingData.emailVerified) {
          await setDoc(
            userRef,
            {
              authUid: targetAuthUid,
              authProvider: existingData.authProvider || 'google',
              emailVerified: true,
            },
            { merge: true }
          ).catch(() => {});
        }
        completeCloudLogin(existingData, mail);
        return;
      }

      clearLocalWorkspaceStorage();
      profile = { ...INITIAL_PROFILE };
      courses = [];
      studyLogs = [];
      assignments = [];
      quickNotes = '';
      checklist = [];
      resourceLinks = [];
      await setDoc(userRef, fallbackRecord, { merge: true });
      completeCloudLogin(fallbackRecord, mail);
    } catch (firestoreErr) {
      console.warn('Firestore profile sync after Google SSO notice:', firestoreErr);
      completeCloudLogin(fallbackRecord, mail);
    }
  }

  const boundElements = new WeakSet();
  function bindOnce(el, eventName, handler) {
    if (!el || boundElements.has(el)) return false;
    boundElements.add(el);
    el.addEventListener(eventName, handler);
    return true;
  }
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
            scope: 'login',
            text: 'Please enter a valid email address and password.',
          };
          populateLoginPage();
          return;
        }

        const rateStatus = loginRateLimiter.check(normalizedEmail);
        if (!rateStatus.allowed) {
          authNotice = {
            type: 'error',
            scope: 'login',
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
                  scope: 'login',
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
              scope: 'login',
              text: 'No account found with this email. Use "Register New Account" to create one.',
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
                scope: 'login',
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
                scope: 'login',
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
            scope: 'login',
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

    const forgotBtn = document.getElementById('btn-forgot-password');
    bindOnce(forgotBtn, 'click', async () => {
      const email = sanitizeEmailInput(document.getElementById('auth-login-email')?.value);
      if (!email) {
        authNotice = {
          type: 'error',
          scope: 'login',
          text: 'Enter your email address above, then click "Forgot password?".',
        };
        populateLoginPage();
        return;
      }
      if (!auth) {
        authNotice = {
          type: 'error',
          scope: 'login',
          text: 'Password reset is unavailable because authentication is not configured.',
        };
        populateLoginPage();
        return;
      }
      const origText = forgotBtn.textContent;
      forgotBtn.disabled = true;
      forgotBtn.textContent = 'Sending reset link...';
      try {
        await sendPasswordResetEmail(auth, email);
        authNotice = {
          type: 'success',
          text: `If an account exists for ${email}, a password reset link has been sent.`,
        };
      } catch (err) {
        authNotice = {
          type: 'error',
          scope: 'login',
          text:
            err instanceof Error
              ? err.message
              : 'Could not send password reset email. Please try again.',
        };
      } finally {
        forgotBtn.disabled = false;
        forgotBtn.textContent = origText;
        populateLoginPage();
      }
    });

    const otpBtn = document.getElementById('btn-send-otp');
    if (otpBtn && !boundElements.has(otpBtn)) {
      boundElements.add(otpBtn);
      otpBtn.addEventListener('click', async () => {
        const regEmail = sanitizeEmailInput(
          document.getElementById('auth-reg-email')?.value
        );
        if (!regEmail) {
          authNotice = {
            type: 'error',
            scope: 'register',
            text: 'Enter a valid email first to receive a code.',
          };
          populateLoginPage();
          return;
        }
        const origText = otpBtn.textContent;
        otpBtn.disabled = true;
        otpBtn.textContent = 'Sending...';
        try {
          verificationSentTo = regEmail;
          const res = await dispatchVerificationCode(regEmail, db);
          if (res.success && res.emailSent) {
            authNotice = {
              type: 'success',
              text: `Verification code sent to ${regEmail}. Check your inbox (and spam folder).`,
            };
          } else {
            const rawNotice = String(res.providerNotice || res.error || '');
            const isMissingProviderConfig = /RESEND_API_KEY|not configured/i.test(rawNotice);
            authNotice = {
              type: 'error',
              scope: 'register',
              text:
                isMissingProviderConfig || !rawNotice
                  ? 'Email verification is temporarily unavailable. You can leave the code blank and click Register to continue.'
                  : rawNotice,
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
            scope: 'register',
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
                scope: 'register',
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
                  scope: 'register',
                  text: 'An account with this email already exists. Use "Sign In" instead.',
                };
                populateLoginPage();
                return;
              }
            }
          }

          const docId = getEmailDocId(regEmail);
          const passwordHash = await hashPassword(regPass);

          clearLocalWorkspaceStorage();
          profile = { ...INITIAL_PROFILE };
          courses = [];
          studyLogs = [];
          assignments = [];
          quickNotes = '';
          checklist = [];
          resourceLinks = [];

          const newRecord = {
            uid: docId,
            authUid: authUid || docId,
            email: regEmail,
            name: regName,
            studentId: '',
            passwordHash,
            emailVerified: Boolean(regCode),
            degreeName: regDegree,
            institution: regInstitution,
            degreeType: INITIAL_PROFILE.degreeType,
            totalTargetCFU: regCFU,
            academicYear: INITIAL_PROFILE.academicYear,
            courses: [],
            studyLogs: [],
            assignments: [],
            quickNotes: '',
            checklist: [],
            resourceLinks: [],
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
            scope: 'register',
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

  function saveQuickNotesFromEditor({ showStatus = true } = {}) {
    if (quickNotesAutosaveTimer) {
      window.clearTimeout(quickNotesAutosaveTimer);
      quickNotesAutosaveTimer = null;
    }
    const notesEl = document.getElementById('dash-quick-notes');
    if (!notesEl) return;
    quickNotes = sanitizeTextInput(notesEl.value, 5000, true);
    if (document.activeElement !== notesEl) {
      notesEl.value = quickNotes;
    }
    quickNotesDirty = false;
    const notesStatusEl = document.getElementById('dash-notes-status');
    if (notesStatusEl) {
      notesStatusEl.textContent = 'Saved';
    }
    void pushWorkstationToCloud();
    if (showStatus) {
      setStatus('Notes saved');
    }
  }

  // --- Bind Events for Active Route ---
  function bindDynamicViewEvents(route) {
    if (route === 'login') {
      bindAuthEvents();
      return;
    }

    if (route === 'dashboard') {
      bindOnce(document.getElementById('dash-course-status'), 'change', (e) => {
        dashCourseStatusFilter = e.target.value;
        if (window.history?.replaceState) {
          const nextUrl = buildDashboardUrl(window.location.pathname, window.location.search, {
            courseStatus: dashCourseStatusFilter,
            panel: dashResourceNotesTab,
          });
          if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
            window.history.replaceState(null, '', nextUrl);
          }
        }
        populateDashboardPage();
      });
      bindOnce(document.getElementById('tab-dash-resources'), 'click', () => {
        dashResourceNotesTab = 'resources';
        if (window.history?.replaceState) {
          const nextUrl = buildDashboardUrl(window.location.pathname, window.location.search, {
            courseStatus: dashCourseStatusFilter,
            panel: dashResourceNotesTab,
          });
          if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
            window.history.replaceState(null, '', nextUrl);
          }
        }
        populateDashboardPage();
      });
      bindOnce(document.getElementById('tab-dash-notes'), 'click', () => {
        dashResourceNotesTab = 'notes';
        if (window.history?.replaceState) {
          const nextUrl = buildDashboardUrl(window.location.pathname, window.location.search, {
            courseStatus: dashCourseStatusFilter,
            panel: dashResourceNotesTab,
          });
          if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
            window.history.replaceState(null, '', nextUrl);
          }
        }
        populateDashboardPage();
      });
      bindOnce(document.getElementById('btn-dash-add-course'), 'click', () => openCourseModal());
      const addGoalBtn = document.getElementById('btn-dash-add-goal');
      if (addGoalBtn && !boundElements.has(addGoalBtn)) {
        boundElements.add(addGoalBtn);
        addGoalBtn.addEventListener('click', () => openGoalModal());
      }
      bindOnce(document.getElementById('btn-dash-add-log'), 'click', () => openLogModal());
      bindOnce(document.getElementById('btn-dash-add-resource'), 'click', () => openResourceModal());
      bindOnce(document.getElementById('btn-dash-save-notes'), 'click', () => {
        saveQuickNotesFromEditor({ showStatus: true });
      });
      const quickNotesEl = document.getElementById('dash-quick-notes');
      if (quickNotesEl && !boundElements.has(quickNotesEl)) {
        boundElements.add(quickNotesEl);
        quickNotesEl.addEventListener('input', () => {
          quickNotesDirty = true;
          const notesStatusEl = document.getElementById('dash-notes-status');
          if (notesStatusEl) {
            notesStatusEl.textContent = 'Unsaved changes…';
          }
          if (quickNotesAutosaveTimer) {
            window.clearTimeout(quickNotesAutosaveTimer);
          }
          quickNotesAutosaveTimer = window.setTimeout(() => {
            saveQuickNotesFromEditor({ showStatus: false });
          }, 800);
        });
        quickNotesEl.addEventListener('blur', () => {
          if (quickNotesDirty) {
            saveQuickNotesFromEditor({ showStatus: false });
          }
        });
      }
    }

    if (route === 'courses') {
      bindOnce(document.getElementById('btn-courses-add'), 'click', () => openCourseModal());
      bindOnce(document.getElementById('filter-course-year'), 'change', (e) => {
        courseYearFilter = e.target.value;
        populateCoursesPage();
      });
      bindOnce(document.getElementById('filter-course-status'), 'change', (e) => {
        courseStatusFilter = e.target.value;
        populateCoursesPage();
      });
      bindOnce(document.getElementById('filter-course-search'), 'input', (e) => {
        courseSearchQuery = e.target.value;
        populateCoursesPage();
      });
    }

    if (route === 'logs') {
      bindOnce(document.getElementById('btn-logs-add'), 'click', () => openLogModal());
      bindOnce(document.getElementById('btn-export-logs-csv'), 'click', () => exportLogsCsv());
      bindOnce(document.getElementById('filter-log-subject'), 'change', (e) => {
        logSubjectFilter = e.target.value;
        populateLogsPage();
      });
    }

    if (route === 'assignments') {
      const addAssignmentBtn = document.getElementById('btn-assignments-add');
      if (addAssignmentBtn && !boundElements.has(addAssignmentBtn)) {
        boundElements.add(addAssignmentBtn);
        addAssignmentBtn.addEventListener('click', () => openAssignmentModal());
      }
      const filterAssignmentSelect = document.getElementById('filter-assignment-type');
      if (filterAssignmentSelect && !boundElements.has(filterAssignmentSelect)) {
        boundElements.add(filterAssignmentSelect);
        filterAssignmentSelect.addEventListener('change', (e) => {
          assignmentTypeFilter = e.target.value;
          populateAssignmentsPage();
        });
      }
    }

    if (route === 'squads') {
      const activeSelect = document.getElementById('squad-active-select');
      if (activeSelect && !boundElements.has(activeSelect)) {
        boundElements.add(activeSelect);
        activeSelect.addEventListener('change', (e) => {
          const nextId = e.target.value;
          if (!nextId) return;
          activeSquadId = nextId;
          profile = { ...profile, activeSquadId: nextId };
          void pushWorkstationToCloud();
          subscribeToSquadMembers(nextId);
          void syncUserSquadTelemetry(nextId);
          populateSquadsPage();
        });
      }

      const sortSelect = document.getElementById('squad-members-sort');
      if (sortSelect && !boundElements.has(sortSelect)) {
        boundElements.add(sortSelect);
        sortSelect.addEventListener('change', (e) => {
          squadMembersSort = e.target.value || 'hours';
          populateSquadsPage();
        });
      }

      const friendSearchInput = document.getElementById('friend-search-input');
      if (friendSearchInput && !boundElements.has(friendSearchInput)) {
        boundElements.add(friendSearchInput);
        friendSearchInput.addEventListener('input', (e) => {
          friendSearchQuery = e.target.value || '';
          if (friendActionNotice) friendActionNotice = null;
          populateSquadsPage();
        });
      }

      const friendSearchForm = document.getElementById('form-friend-search-add');
      if (friendSearchForm && !boundElements.has(friendSearchForm)) {
        boundElements.add(friendSearchForm);
        friendSearchForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const inputEl = document.getElementById('friend-search-input');
          const rawVal = inputEl?.value || friendSearchQuery;
          void handleSendFriendRequest(rawVal);
        });
      }
    }

    if (route === 'settings') {
      bindOnce(document.getElementById('form-settings-profile'), 'submit', (e) => {
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

      bindOnce(document.getElementById('btn-sync-now'), 'click', async () => {
        await pullWorkstationFromCloud({ force: true });
        await pushWorkstationToCloud();
        setStatus('Synchronized with Firebase');
      });

      bindOnce(document.getElementById('btn-sign-out'), 'click', () => void handleLogout());

      bindOnce(document.getElementById('btn-export-json'), 'click', () => exportWorkspaceJson());

      bindOnce(document.getElementById('input-import-json'), 'change', (e) => {
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
            if (Array.isArray(parsed.studyLogs)) {
              studyLogs = sanitizeStudyLogList(parsed.studyLogs);
              const currentStreak = calculateCurrentStreak(studyLogs, profile);
              const weekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
              profile = {
                ...profile,
                currentStreak,
                minutesStudiedThisWeek: weekMinutes,
              };
            }
            if (Array.isArray(parsed.assignments)) {
              assignments = sanitizeAssignmentList(parsed.assignments);
            }
            if (typeof parsed.quickNotes === 'string') {
              quickNotes = sanitizeTextInput(parsed.quickNotes, 5000, true);
            }
            if (Array.isArray(parsed.checklist) || typeof parsed.checklist === 'string') {
              checklist = normalizeGoalsList(parsed.checklist);
            }
            if (Array.isArray(parsed.resourceLinks)) {
              resourceLinks = sanitizeResourceLinksList(parsed.resourceLinks);
            }
            void pushWorkstationToCloud();
            void syncUserSquadTelemetry();
            populateCurrentPageData();
            setStatus('Backup restored from JSON');
          } catch {
            alert('Invalid JSON backup file.');
          }
        };
        reader.readAsText(file);
      });

      bindOnce(document.getElementById('btn-reset-data'), 'click', () => {
        if (!window.confirm('Are you sure you want to clear all local workspace data?')) return;
        profile = { ...INITIAL_PROFILE };
        courses = [];
        studyLogs = [];
        assignments = [];
        quickNotes = '';
        checklist = [];
        resourceLinks = [];
        void pushWorkstationToCloud();
        void syncUserSquadTelemetry();
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
            '[data-nav], [data-close-modal], [data-open-course], [data-open-course-info], [data-delete-course], [data-open-goal], [data-toggle-goal], [data-delete-log], [data-delete-resource], [data-open-assignment], [data-toggle-assignment], [data-delete-assignment], [data-toggle-assignment-row], [data-select-squad], [data-leave-squad], [data-open-friend-calendar], [data-stop-live], [data-open-squad-note], [data-delete-squad-note], [data-admin-remove-member], [data-select-friend], [data-send-friend-request], [data-accept-friend-request], [data-decline-friend-request], [data-dismiss-friend-notice], #btn-google-sso, #btn-header-logout, #btn-sync-retry, #btn-undo-action, #btn-dismiss-undo, #btn-course-info-edit, #btn-open-create-join-squad, #btn-empty-create-join-squad, #btn-open-admin-panel, #btn-leave-active-squad, #btn-copy-squad-code-top, #btn-copy-squad-code-card, #btn-go-live-toggle, #btn-add-squad-note, #btn-edit-next-session, #btn-toggle-session-attending, #btn-back-to-squad-view, #btn-remove-friend'
          ) || rawTarget
        : rawTarget;
    if (!target || typeof target.getAttribute !== 'function') return;

    if (target.id === 'btn-undo-action') {
      e.preventDefault();
      const restore = pendingUndo?.restore;
      clearUndoBanner();
      if (typeof restore === 'function') {
        restore();
      }
      return;
    }

    if (target.id === 'btn-dismiss-undo') {
      e.preventDefault();
      clearUndoBanner();
      return;
    }

    if (target.id === 'btn-sync-retry') {
      e.preventDefault();
      void (async () => {
        await pullWorkstationFromCloud({ force: true });
        await pushWorkstationToCloud();
      })();
      return;
    }

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

    if (target.id === 'btn-open-create-join-squad' || target.id === 'btn-empty-create-join-squad') {
      e.preventDefault();
      openSquadCreateJoinModal();
      return;
    }

    if (target.id === 'btn-open-admin-panel') {
      e.preventDefault();
      openSquadAdminModal();
      return;
    }

    if (target.id === 'btn-leave-active-squad') {
      e.preventDefault();
      if (activeSquadId) {
        void performLeaveSquad(activeSquadId);
      }
      return;
    }

    if (target.id === 'btn-copy-squad-code-top' || target.id === 'btn-copy-squad-code-card') {
      e.preventDefault();
      void copyActiveSquadInviteCode();
      return;
    }

    if (target.id === 'btn-go-live-toggle') {
      e.preventDefault();
      const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
      const isLiveNow =
        (myLiveSession && myLiveSession.squadId === activeSquadId) ||
        squadPresence.some((p) => p.uid === myUid && p.status === 'live');
      if (isLiveNow) {
        void stopLiveStudySession();
      } else {
        openGoLiveModal();
      }
      return;
    }

    if (target.id === 'btn-add-squad-note') {
      e.preventDefault();
      openSquadNoteModal();
      return;
    }

    if (target.id === 'btn-edit-next-session') {
      e.preventDefault();
      openGroupSessionModal();
      return;
    }

    if (target.id === 'btn-toggle-session-attending') {
      e.preventDefault();
      const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0];
      if (!activeSquad) return;
      const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
      const myName = sanitizeTextInput(profile.name || 'Student', 100);
      const currentSession = activeSquad.nextSession || {
        title: 'Group Study Session',
        when: 'TBD',
        attendees: [],
        attendeeUids: [],
      };
      const uids = Array.isArray(currentSession.attendeeUids)
        ? [...currentSession.attendeeUids]
        : [];
      const names = Array.isArray(currentSession.attendees) ? [...currentSession.attendees] : [];
      const isAttending = uids.includes(myUid) || names.includes(myName);

      let nextUids;
      let nextNames;
      if (isAttending) {
        nextUids = uids.filter((u) => u !== myUid);
        nextNames = names.filter((n) => n !== myName);
      } else {
        nextUids = Array.from(new Set([...uids, myUid]));
        nextNames = Array.from(new Set([...names, myName]));
      }
      const nextSession = {
        title: currentSession.title || currentSession.location || 'Group Study Session',
        when: currentSession.when || currentSession.dateTimeText || '',
        attendeeUids: nextUids,
        attendees: nextNames,
      };
      squads = squads.map((s) => (s.id === activeSquad.id ? { ...s, nextSession } : s));
      void updateSquadNextSession(activeSquad.id, nextSession);
      populateSquadsPage();
      setStatus(isAttending ? 'Left group session' : 'Marked as attending group session');
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

    const openCourseInfoName = target.getAttribute('data-open-course-info');
    if (openCourseInfoName) {
      e.preventDefault();
      openCourseInfoModal(openCourseInfoName);
      return;
    }

    if (target.id === 'btn-course-info-edit') {
      e.preventDefault();
      const targetId = target.getAttribute('data-course-info-id') || '';
      const targetName = target.getAttribute('data-course-info-name') || '';
      document.getElementById('modal-course-info')?.close();
      const found = targetId
        ? courses.find((c) => c.id === targetId) || null
        : findCourseForName(courses, targetName);
      openCourseModal(found, found ? '' : targetName);
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
      const removedIdx = studyLogs.findIndex((l) => l.id === deleteLogId);
      const removedItem = removedIdx >= 0 ? studyLogs[removedIdx] : null;
      if (!removedItem) return;
      studyLogs = studyLogs.filter((l) => l.id !== deleteLogId);
      const currentStreak = calculateCurrentStreak(studyLogs, profile);
      const weekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
      profile = {
        ...profile,
        currentStreak,
        minutesStudiedThisWeek: weekMinutes,
      };
      showUndoBanner(`Deleted "${removedItem.courseName}" session log.`, () => {
        const next = [...studyLogs];
        next.splice(Math.min(removedIdx, next.length), 0, removedItem);
        studyLogs = next;
        profile = {
          ...profile,
          currentStreak: calculateCurrentStreak(studyLogs, profile),
          minutesStudiedThisWeek: getWeekDaysSummary(studyLogs).weekTotalMinutes,
        };
        void pushWorkstationToCloud();
        void syncUserSquadTelemetry();
        populateCurrentPageData();
        setStatus('Restored session log');
      });
      void pushWorkstationToCloud();
      void syncUserSquadTelemetry();
      populateCurrentPageData();
      setStatus('Session log deleted');
      return;
    }

    const deleteResourceId = target.getAttribute('data-delete-resource');
    if (deleteResourceId) {
      e.preventDefault();
      const removedIdx = resourceLinks.findIndex((r) => r.id === deleteResourceId);
      const removedItem = removedIdx >= 0 ? resourceLinks[removedIdx] : null;
      if (!removedItem) return;
      resourceLinks = resourceLinks.filter((r) => r.id !== deleteResourceId);
      showUndoBanner(`Deleted resource "${removedItem.title}".`, () => {
        const next = [...resourceLinks];
        next.splice(Math.min(removedIdx, next.length), 0, removedItem);
        resourceLinks = next;
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus('Restored resource');
      });
      void pushWorkstationToCloud();
      populateCurrentPageData();
      setStatus('Resource deleted');
      return;
    }

    const toggleGoalId = target.getAttribute('data-toggle-goal');
    if (toggleGoalId) {
      checklist = toggleGoalCompletion(checklist, toggleGoalId);
      void pushWorkstationToCloud();
      populateCurrentPageData();
      setStatus('Goal updated');
      return;
    }

    const openGoalId = target.getAttribute('data-open-goal');
    if (openGoalId) {
      e.preventDefault();
      const list = normalizeGoalsList(checklist);
      const found = list.find((g) => g.id === openGoalId);
      if (found) openGoalModal(found);
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
        if (nextStatus === 'completed') {
          return {
            ...a,
            status: nextStatus,
            completedAt: Date.now(),
          };
        }
        const { completedAt: _removed, ...rest } = a;
        return {
          ...rest,
          status: nextStatus,
        };
      });
      void pushWorkstationToCloud();
      void syncUserSquadTelemetry();
      populateCurrentPageData();
      setStatus('Updated status');
      return;
    }

    const deleteAssignmentId = target.getAttribute('data-delete-assignment');
    if (deleteAssignmentId) {
      e.preventDefault();
      expandedAssignmentIds.delete(deleteAssignmentId);
      assignments = assignments.filter((a) => a.id !== deleteAssignmentId);
      void pushWorkstationToCloud();
      void syncUserSquadTelemetry();
      populateCurrentPageData();
      setStatus('Deleted item');
      return;
    }

    const toggleRowId = target.getAttribute('data-toggle-assignment-row');
    if (toggleRowId) {
      if (
        window.innerWidth <= 720 &&
        !rawTarget?.closest?.('a, button, input, select, textarea')
      ) {
        toggleAssignmentDetailRow(toggleRowId);
      }
      return;
    }

    const selectSquadId = target.getAttribute('data-select-squad');
    if (selectSquadId) {
      e.preventDefault();
      activeSquadId = selectSquadId;
      profile = { ...profile, activeSquadId: selectSquadId };
      void pushWorkstationToCloud();
      subscribeToSquadMembers(selectSquadId);
      void syncUserSquadTelemetry(selectSquadId);
      populateSquadsPage();
      document.getElementById('modal-squad-create-join')?.close();
      return;
    }

    const leaveSquadId = target.getAttribute('data-leave-squad');
    if (leaveSquadId) {
      e.preventDefault();
      void performLeaveSquad(leaveSquadId);
      return;
    }

    const friendCalUid = target.getAttribute('data-open-friend-calendar');
    if (friendCalUid) {
      e.preventDefault();
      openFriendCalendarModal(friendCalUid);
      return;
    }

    const dismissNoticeMode = target.getAttribute('data-dismiss-friend-notice');
    if (dismissNoticeMode !== null) {
      e.preventDefault();
      friendActionNotice = null;
      if (dismissNoticeMode.startsWith('incoming:')) {
        dismissedIncomingNoticeKey = dismissNoticeMode.slice('incoming:'.length);
      }
      populateSquadsPage();
      return;
    }

    if (target.hasAttribute('data-stop-live')) {
      e.preventDefault();
      void stopLiveStudySession();
      return;
    }

    const openNoteId = target.getAttribute('data-open-squad-note');
    if (openNoteId) {
      e.preventDefault();
      const note = squadActivities.find((a) => a.id === openNoteId);
      if (!note) return;
      if (note.url && /^https?:\/\//i.test(note.url)) {
        window.open(note.url, '_blank', 'noopener,noreferrer');
      } else {
        const subjectPart = note.courseName ? ` (${note.courseName})` : '';
        alert(`${note.displayName || 'Squadmate'}: ${note.text || note.title || ''}${subjectPart}`);
      }
      return;
    }

    const deleteNoteId = target.getAttribute('data-delete-squad-note');
    if (deleteNoteId) {
      e.preventDefault();
      const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0];
      if (!activeSquad) return;
      squadActivities = squadActivities.filter((a) => a.id !== deleteNoteId);
      void deleteSquadFeedNote(activeSquad.id, deleteNoteId);
      populateSquadsPage();
      setStatus('Deleted squad note');
      return;
    }

    const removeMemberUid = target.getAttribute('data-admin-remove-member');
    if (removeMemberUid) {
      e.preventDefault();
      const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0];
      if (!activeSquad || !isCurrentUserSquadCreator(activeSquad)) return;
      const removeMemberName =
        sanitizeTextInput(target.getAttribute('data-admin-remove-name') || '', 100) || '';
      const normRemoveUid = String(removeMemberUid).trim().toLowerCase();
      const normRemoveName = removeMemberName.toLowerCase();
      removedSquadMemberKeys.add(`${activeSquad.id}:${normRemoveUid}`);
      const nowIso = new Date().toISOString();
      squadActivities = [
        {
          id: `removed_${normRemoveUid}`,
          uid: removeMemberUid,
          displayName: removeMemberName || 'Removed Member',
          type: 'member_removed',
          status: 'removed',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ...squadActivities.filter(
          (a) => !(a?.type === 'member_removed' && String(a?.uid || '').trim().toLowerCase() === normRemoveUid)
        ),
      ];
      squadMembers = squadMembers.filter((m) => {
        const mUid = String(m?.uid || '').trim().toLowerCase();
        const mName = String(m?.displayName || '').trim().toLowerCase();
        return mUid !== normRemoveUid && (!normRemoveName || mName !== normRemoveName);
      });
      squadPresence = squadPresence.filter(
        (p) => String(p?.uid || '').trim().toLowerCase() !== normRemoveUid
      );
      squads = squads.map((s) =>
        s.id === activeSquad.id
          ? {
              ...s,
              memberUids: Array.isArray(s.memberUids)
                ? s.memberUids.filter((u) => String(u).trim().toLowerCase() !== normRemoveUid)
                : [],
            }
          : s
      );
      void removeMemberFromSquad(activeSquad.id, removeMemberUid, removeMemberName);
      populateSquadsPage();
      setStatus(`Removed ${removeMemberName || 'member'} from squad`);
      return;
    }

    if (target.id === 'btn-back-to-squad-view') {
      e.preventDefault();
      void selectFriendForStatsView(null);
      return;
    }

    if (target.id === 'btn-remove-friend') {
      e.preventDefault();
      const friendshipId = target.getAttribute('data-friendship-id');
      const friendName = target.getAttribute('data-friend-name') || 'Friend';
      if (!friendshipId) return;
      const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
      friendships = friendships.filter((f) => f.id !== friendshipId);
      void selectFriendForStatsView(null);
      void declineOrRemoveFriendship(friendshipId, myUid);
      friendActionNotice = { type: 'success', text: `Removed ${friendName} from friends.` };
      populateSquadsPage();
      setStatus(`Removed ${friendName}`);
      return;
    }

    const selectFriendUidAttr = target.getAttribute('data-select-friend');
    if (selectFriendUidAttr) {
      e.preventDefault();
      void selectFriendForStatsView(selectFriendUidAttr);
      return;
    }

    const sendFriendTarget = target.getAttribute('data-send-friend-request');
    if (sendFriendTarget) {
      e.preventDefault();
      const friendName = target.getAttribute('data-friend-name') || '';
      void handleSendFriendRequest(sendFriendTarget, friendName);
      return;
    }

    const acceptFriendshipId = target.getAttribute('data-accept-friend-request');
    if (acceptFriendshipId) {
      e.preventDefault();
      const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
      const myName = sanitizeTextInput(profile.name || '', 100);
      friendships = friendships.map((f) =>
        f.id === acceptFriendshipId
          ? {
              ...f,
              ...(myUid && myUid !== 'local_student'
                ? { recipientUid: myUid, recipientEmail: myUid }
                : {}),
              ...(myName ? { recipientName: myName } : {}),
              status: 'accepted',
              updatedAt: new Date().toISOString(),
            }
          : f
      );
      void acceptFriendRequest(acceptFriendshipId, myUid, myName);
      friendActionNotice = { type: 'success', text: 'Friend request accepted!' };
      populateSquadsPage();
      setStatus('Friend request accepted');
      return;
    }

    const declineFriendshipId = target.getAttribute('data-decline-friend-request');
    if (declineFriendshipId) {
      e.preventDefault();
      const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
      friendships = friendships.filter((f) => f.id !== declineFriendshipId);
      void declineOrRemoveFriendship(declineFriendshipId, myUid);
      friendActionNotice = null;
      populateSquadsPage();
      setStatus('Friend request removed');
      return;
    }
  });

  // --- Modal Form Submissions ---
  function bindDialogFormEvents() {
    const createSquadForm = document.getElementById('form-create-squad');
    if (createSquadForm && !boundElements.has(createSquadForm)) {
      boundElements.add(createSquadForm);
      createSquadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('squad-new-name');
        const descInput = document.getElementById('squad-new-description');
        const name = sanitizeTextInput(nameInput?.value, 80);
        const description = sanitizeTextInput(descInput?.value || '', 240);
        if (!name) return;

        const code = generateSquadCode();
        const squadId = `squad-${Date.now()}`;
        const uid = getEmailDocId(sessionEmail || profile.email || 'local_student');
        const newSquad = {
          id: squadId,
          name,
          description,
          weeklyGoalHours: 60,
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
          const weekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
          const streak = calculateCurrentStreak(studyLogs, profile);
          const tasksThisWeek = countCompletedTasksThisWeek(assignments);
          const dailyMinutes = getWeeklyDailyMinutesMap(studyLogs);
          const subjectMinutes = getWeeklySubjectMinutesMap(studyLogs);
          const now = new Date().toISOString();
          const member = {
            uid,
            displayName: sanitizeTextInput(profile.name || 'Student', 100),
            color: '#3B77BC',
            elo: calculateElo(weekMinutes, tasksThisWeek, streak),
            minutesThisWeek: Math.min(10080, Math.max(0, weekMinutes)),
            tasksThisWeek: Math.min(10000, Math.max(0, tasksThisWeek)),
            currentStreak: Math.min(10000, Math.max(0, streak)),
            dailyMinutes,
            subjectMinutes,
            status: 'online',
            joinedAt: now,
            updatedAt: now,
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
        if (descInput) descInput.value = '';
        document.getElementById('modal-squad-create-join')?.close();
        void pushWorkstationToCloud();
        subscribeToSquadMembers(squadId);
        populateSquadsPage();
        setStatus(`Created Squad: ${name}`);
      });
    }

    const joinSquadForm = document.getElementById('form-join-squad');
    if (joinSquadForm && !boundElements.has(joinSquadForm)) {
      boundElements.add(joinSquadForm);
      joinSquadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('squad-join-code');
        const code = sanitizeTextInput(codeInput?.value, 20)
          .replace(/[^A-Z0-9-]/gi, '')
          .toUpperCase();
        if (!code || !db) return;

        try {
          const q = query(collection(db, 'squads'), where('code', '==', code));
          const snap = await getDocs(q);
          if (snap.empty) {
            alert(`No squad found with code "${code}".`);
            return;
          }
          const foundSquad = { id: snap.docs[0].id, ...snap.docs[0].data() };
          const uid = getEmailDocId(sessionEmail || profile.email || 'local_student');
          const weekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
          const streak = calculateCurrentStreak(studyLogs, profile);
          const tasksThisWeek = countCompletedTasksThisWeek(assignments);
          const dailyMinutes = getWeeklyDailyMinutesMap(studyLogs);
          const subjectMinutes = getWeeklySubjectMinutesMap(studyLogs);
          const now = new Date().toISOString();
          const member = {
            uid,
            displayName: sanitizeTextInput(profile.name || 'Student', 100),
            color: '#3B77BC',
            elo: calculateElo(weekMinutes, tasksThisWeek, streak),
            minutesThisWeek: Math.min(10080, Math.max(0, weekMinutes)),
            tasksThisWeek: Math.min(10000, Math.max(0, tasksThisWeek)),
            currentStreak: Math.min(10000, Math.max(0, streak)),
            dailyMinutes,
            subjectMinutes,
            status: 'online',
            joinedAt: now,
            updatedAt: now,
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
          document.getElementById('modal-squad-create-join')?.close();
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

    const adminSquadForm = document.getElementById('form-squad-admin');
    if (adminSquadForm && !boundElements.has(adminSquadForm)) {
      boundElements.add(adminSquadForm);
      adminSquadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0];
        if (!activeSquad || !isCurrentUserSquadCreator(activeSquad)) return;

        const name = sanitizeTextInput(document.getElementById('admin-squad-name')?.value, 80);
        const description = sanitizeTextInput(
          document.getElementById('admin-squad-description')?.value || '',
          500
        );
        const weeklyGoalHours = Math.min(
          1000,
          Math.max(1, Number(document.getElementById('admin-squad-goal')?.value) || 60)
        );
        if (!name) return;

        squads = squads.map((s) =>
          s.id === activeSquad.id ? { ...s, name, description, weeklyGoalHours } : s
        );
        await updateSquadAdminDetails(activeSquad.id, { name, description, weeklyGoalHours });
        document.getElementById('modal-squad-admin')?.close();
        populateSquadsPage();
        setStatus(`Updated squad: ${name}`);
      });

      document.getElementById('btn-delete-squad-confirm')?.addEventListener('click', async () => {
        const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0];
        const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
        if (!activeSquad || !isCurrentUserSquadCreator(activeSquad)) return;
        if (!window.confirm(`Delete squad "${activeSquad.name}" permanently?`)) return;

        const targetId = activeSquad.id;
        squads = squads.filter((s) => s.id !== targetId);
        const nextActive = squads[0]?.id || null;
        activeSquadId = nextActive;
        profile = {
          ...profile,
          activeSquadId: nextActive || null,
          squadIds: (profile.squadIds || []).filter((id) => id !== targetId),
        };
        await deleteSquadCompletely(
          targetId,
          sessionEmail || profile.email,
          myUid,
          nextActive
        );
        document.getElementById('modal-squad-admin')?.close();
        void pushWorkstationToCloud();
        if (nextActive) {
          subscribeToSquadMembers(nextActive);
        } else {
          cleanupSquadListeners();
          squadMembers = [];
          squadPresence = [];
          squadActivities = [];
        }
        populateSquadsPage();
        setStatus('Squad deleted');
      });
    }

    const goLiveForm = document.getElementById('form-go-live');
    if (goLiveForm && !boundElements.has(goLiveForm)) {
      boundElements.add(goLiveForm);
      goLiveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = sanitizeTextInput(
          document.getElementById('live-study-subject')?.value,
          120
        );
        if (!subject) return;
        document.getElementById('modal-go-live')?.close();
        await startLiveStudySession(subject);
      });
    }

    const squadNoteForm = document.getElementById('form-squad-note');
    if (squadNoteForm && !boundElements.has(squadNoteForm)) {
      boundElements.add(squadNoteForm);
      squadNoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0];
        if (!activeSquad) return;

        const text = sanitizeTextInput(document.getElementById('squad-note-text')?.value, 240);
        const courseName = sanitizeTextInput(
          document.getElementById('squad-note-course')?.value || '',
          120
        );
        const rawUrl = (document.getElementById('squad-note-url')?.value || '').trim();
        const safeUrl = rawUrl ? sanitizeResourceUrl(rawUrl) || '' : '';
        if (!text) return;

        const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
        const myName = sanitizeTextInput(profile.name || 'Student', 100);
        const note = await addSquadFeedNote(activeSquad.id, {
          uid: myUid,
          displayName: myName,
          text,
          courseName,
          url: safeUrl,
        });
        if (note && !squadActivities.some((a) => a.id === note.id)) {
          squadActivities = [note, ...squadActivities];
        }
        document.getElementById('modal-squad-note')?.close();
        populateSquadsPage();
        setStatus('Added note to Squad Feed');
      });
    }

    const groupSessionForm = document.getElementById('form-group-session');
    if (groupSessionForm && !boundElements.has(groupSessionForm)) {
      boundElements.add(groupSessionForm);
      groupSessionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const activeSquad = squads.find((s) => s.id === activeSquadId) || squads[0];
        if (!activeSquad) return;

        const location = sanitizeTextInput(
          document.getElementById('group-session-location')?.value,
          120
        );
        const dateTimeText = sanitizeTextInput(
          document.getElementById('group-session-datetime')?.value,
          120
        );
        if (!location || !dateTimeText) return;

        const prevSession = activeSquad.nextSession || {};
        const nextSession = {
          title: location,
          when: dateTimeText,
          attendees: Array.isArray(prevSession.attendees) ? prevSession.attendees : [],
          attendeeUids: Array.isArray(prevSession.attendeeUids) ? prevSession.attendeeUids : [],
        };
        squads = squads.map((s) => (s.id === activeSquad.id ? { ...s, nextSession } : s));
        await updateSquadNextSession(activeSquad.id, nextSession);
        document.getElementById('modal-group-session')?.close();
        populateSquadsPage();
        setStatus('Updated next group session');
      });
    }

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
        const durationMinutes = parseInt(document.getElementById('log-minutes')?.value, 10) || 0;
        if (!rawSubject || !date) return;

        if (durationMinutes < 5) {
          const preview = document.getElementById('log-duration-preview');
          if (preview) {
            preview.textContent = 'Minimum duration is 5 minutes';
            preview.style.color = '#aa0000';
          }
          return;
        }

        const matchedCourse = courses.find(
          (c) => c.title.toLowerCase() === rawSubject.toLowerCase()
        );
        const newLog = sanitizeStudyLogItem({
          id: `log-${Date.now()}`,
          courseId: matchedCourse?.id,
          courseName: matchedCourse ? matchedCourse.title : rawSubject,
          durationMinutes,
          date,
          notes: document.getElementById('log-notes').value,
          rating: 5,
          tag: document.getElementById('log-tag').value,
          timestamp: Date.now(),
        });

        if (!newLog) return;

        studyLogs = [newLog, ...studyLogs];

        const xpGained = Math.max(20, Math.round(newLog.durationMinutes * 2));
        const currentStreak = calculateCurrentStreak(studyLogs, profile);
        const weekMinutes = getWeekDaysSummary(studyLogs).weekTotalMinutes;
        profile = {
          ...profile,
          xp: (profile.xp || 0) + xpGained,
          currentStreak,
          minutesStudiedThisWeek: weekMinutes,
          lastActiveDate: newLog.date || getLocalDateString(),
        };

        document.getElementById('modal-log')?.close();
        void pushWorkstationToCloud();
        void syncUserSquadTelemetry();
        populateCurrentPageData();
        setStatus(
          `Added session log: ${newLog.courseName} (${formatStudyDuration(newLog.durationMinutes)})`
        );
      });
    }

    const logModal = document.getElementById('modal-log');
    if (logModal && !boundElements.has(logModal)) {
      boundElements.add(logModal);

      logModal.addEventListener('click', (e) => {
        const tab = e.target.closest?.('.log-time-tab');
        if (tab) {
          e.preventDefault();
          const mode = tab.getAttribute('data-time-mode');
          if (mode) setLogTimeMode(mode);
        }
      });

      const minutesInput = document.getElementById('log-minutes-input');
      const handleMinutesChange = () => {
        const val = Math.min(720, Math.max(0, parseInt(minutesInput?.value, 10) || 0));
        updateLogDurationPreview(val);
      };
      minutesInput?.addEventListener('input', handleMinutesChange);
      minutesInput?.addEventListener('change', handleMinutesChange);

      const hoursInput = document.getElementById('log-hours');
      const subminutesInput = document.getElementById('log-subminutes');
      const handleHoursMinutesChange = () => {
        const total = calculateDurationFromHoursMinutes(hoursInput?.value, subminutesInput?.value);
        updateLogDurationPreview(total);
      };
      hoursInput?.addEventListener('input', handleHoursMinutesChange);
      hoursInput?.addEventListener('change', handleHoursMinutesChange);
      subminutesInput?.addEventListener('input', handleHoursMinutesChange);
      subminutesInput?.addEventListener('change', handleHoursMinutesChange);

      const startTimeInput = document.getElementById('log-start-time');
      const endTimeInput = document.getElementById('log-end-time');
      const handleRangeChange = () => {
        const start = startTimeInput?.value;
        const end = endTimeInput?.value;
        if (!start || !end) {
          updateLogDurationPreview(0);
          return;
        }
        const diff = calculateDurationFromRange(start, end);
        if (diff > 0) {
          updateLogDurationPreview(diff);
        } else {
          updateLogDurationPreview(0);
        }
      };
      startTimeInput?.addEventListener('input', handleRangeChange);
      startTimeInput?.addEventListener('change', handleRangeChange);
      endTimeInput?.addEventListener('input', handleRangeChange);
      endTimeInput?.addEventListener('change', handleRangeChange);
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

    const goalForm = document.getElementById('form-goal');
    if (goalForm && !boundElements.has(goalForm)) {
      boundElements.add(goalForm);

      document
        .getElementById('goal-type')
        ?.addEventListener('change', () => syncGoalModalFields());

      goalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = sanitizeTextInput(document.getElementById('goal-id')?.value, 80);
        const title = sanitizeTextInput(document.getElementById('goal-title')?.value, 150);
        const goalType = document.getElementById('goal-type')?.value || 'skill';
        const selectedCourse = sanitizeTextInput(
          document.getElementById('goal-course')?.value,
          60
        );
        const tag = goalType === 'course' && selectedCourse ? selectedCourse : 'Skill';
        const completed = Boolean(document.getElementById('goal-completed')?.checked);

        if (!title) return;

        checklist = upsertGoalItem(checklist, {
          id: id || `goal-${Date.now()}`,
          title,
          tag,
          completed,
        });

        document.getElementById('modal-goal')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus(id ? `Updated goal: ${title}` : `Added goal: ${title}`);
      });

      document.getElementById('btn-delete-goal')?.addEventListener('click', () => {
        const id = sanitizeTextInput(document.getElementById('goal-id')?.value, 80);
        if (!id) return;
        checklist = deleteGoalItem(checklist, id);
        document.getElementById('modal-goal')?.close();
        void pushWorkstationToCloud();
        populateCurrentPageData();
        setStatus('Goal deleted');
      });
    }

    const assignmentForm = document.getElementById('form-assignment');
    if (assignmentForm && !boundElements.has(assignmentForm)) {
      boundElements.add(assignmentForm);

      document
        .getElementById('assignment-type')
        ?.addEventListener('change', () => syncAssignmentModalFields());
      document
        .getElementById('assignment-grade')
        ?.addEventListener('input', () => syncAssignmentModalFields());
      document
        .getElementById('assignment-esonero1')
        ?.addEventListener('input', () => syncAssignmentModalFields());
      document
        .getElementById('assignment-esonero2')
        ?.addEventListener('input', () => syncAssignmentModalFields());

      assignmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        syncAssignmentModalFields();
        if (!assignmentForm.reportValidity()) return;

        const id = sanitizeTextInput(document.getElementById('assignment-id').value, 80);
        const existingItem = id ? assignments.find((a) => a.id === id) : null;
        const courseName = sanitizeTextInput(
          document.getElementById('assignment-course').value,
          120
        );
        const type = normalizeAssignmentType(document.getElementById('assignment-type').value);
        const dueDate = document.getElementById('assignment-due').value;
        const isCompleted = Boolean(document.getElementById('assignment-completed')?.checked);
        const status = isCompleted ? 'completed' : 'todo';
        const gradeRaw = document.getElementById('assignment-grade').value.trim();
        const es1Raw = document.getElementById('assignment-esonero1').value.trim();
        const es2Raw = document.getElementById('assignment-esonero2').value.trim();

        if (!courseName || !dueDate) return;

        let grade = undefined;
        let examParts = undefined;

        if (type === 'Midterm') {
          if (es1Raw !== '' || es2Raw !== '') {
            const g1 = clampExamGradeValue(es1Raw) ?? undefined;
            const g2 = clampExamGradeValue(es2Raw) ?? undefined;
            examParts = [
              { label: 'Esonero 1', grade: g1 },
              { label: 'Esonero 2', grade: g2 },
            ];
          }
        } else if (gradeRaw !== '') {
          grade = clampExamGradeValue(gradeRaw) ?? undefined;
        }

        const derivedTitle =
          sanitizeTextInput(existingItem?.title, 150) ||
          sanitizeTextInput(`${courseName} ${type}`, 150);

        const sanitizedAsg = sanitizeAssignmentItem({
          id: id || `asg-${Date.now()}`,
          title: derivedTitle,
          courseName,
          type,
          dueDate,
          status,
          grade,
          examParts,
          notes: existingItem?.notes || '',
          completedAt:
            status === 'completed' ? existingItem?.completedAt || Date.now() : undefined,
        });

        if (!sanitizedAsg) return;

        if (id) {
          assignments = assignments.map((a) => (a.id === id ? sanitizedAsg : a));
          setStatus(`Updated: ${sanitizedAsg.courseName}`);
        } else {
          assignments = [sanitizedAsg, ...assignments];
          setStatus(`Added: ${sanitizedAsg.courseName}`);
        }

        document.getElementById('modal-assignment')?.close();
        void pushWorkstationToCloud();
        void syncUserSquadTelemetry();
        populateCurrentPageData();
      });

      document.getElementById('btn-delete-assignment')?.addEventListener('click', () => {
        const id = sanitizeTextInput(document.getElementById('assignment-id').value, 80);
        if (!id) return;
        assignments = assignments.filter((a) => a.id !== id);
        document.getElementById('modal-assignment')?.close();
        void pushWorkstationToCloud();
        void syncUserSquadTelemetry();
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

  document.addEventListener('keydown', (e) => {
    const rawTarget = e.target;
    if (
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') &&
      rawTarget &&
      typeof rawTarget.closest === 'function'
    ) {
      const tab = rawTarget.closest('[role="tablist"] [role="tab"]');
      const tablist = tab?.closest('[role="tablist"]');
      if (tab && tablist) {
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]:not([disabled])'));
        const idx = tabs.indexOf(tab);
        if (idx !== -1 && tabs.length > 1) {
          e.preventDefault();
          let nextIdx = idx;
          if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
          else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
          else if (e.key === 'Home') nextIdx = 0;
          else if (e.key === 'End') nextIdx = tabs.length - 1;
          const nextTab = tabs[nextIdx];
          if (nextTab) {
            nextTab.focus();
            nextTab.click();
          }
          return;
        }
      }
    }

    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (window.innerWidth > 720) return;
    if (!rawTarget || typeof rawTarget.closest !== 'function') return;
    if (rawTarget.closest('a, button, input, select, textarea')) return;
    const row = rawTarget.closest('tr[data-toggle-assignment-row]');
    if (!row) return;
    const rowId = row.getAttribute('data-toggle-assignment-row');
    if (!rowId) return;
    if (e.key === ' ') e.preventDefault();
    toggleAssignmentDetailRow(rowId);
  });

  window.addEventListener('popstate', () => {
    const nextDashQuery = parseDashboardQueryParams(window.location.search);
    dashCourseStatusFilter = nextDashQuery.courseStatus;
    dashResourceNotesTab = nextDashQuery.panel;
    void loadAndRenderPage(getRouteFromLocation(), false);
  });

  let resizeRafId = null;
  window.addEventListener('resize', () => {
    if (resizeRafId !== null) return;
    resizeRafId = window.requestAnimationFrame(() => {
      resizeRafId = null;
      if (window.innerWidth > 720 && expandedAssignmentIds.size > 0) {
        expandedAssignmentIds.clear();
        if (document.getElementById('app-main')?.getAttribute('data-page') === 'assignments') {
          populateAssignmentsPage();
        }
      }
      updateScrollableTablesMaxHeight();
    });
  });

  const handleInstantWakeSync = () => {
    if (!isAuthenticated) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (hasPendingLocalSync()) {
      void pushWorkstationToCloud();
    } else {
      void pullWorkstationFromCloud();
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAssignmentsDailyRollover();
      handleInstantWakeSync();
    }
  });

  window.addEventListener('focus', () => {
    checkAssignmentsDailyRollover();
    handleInstantWakeSync();
  });

  if (!assignmentsDailyInterval) {
    assignmentsDailyInterval = window.setInterval(() => {
      checkAssignmentsDailyRollover();
    }, 60000);
  }

  window.addEventListener('offline', () => {
    renderSyncStatus();
  });

  window.addEventListener('online', () => {
    renderSyncStatus();
    setupRealtimeFirestoreSync(true);
    if (hasPendingLocalSync()) {
      void pushWorkstationToCloud();
    } else {
      void pullWorkstationFromCloud({ force: true });
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === FRIENDSHIPS_STORAGE_KEY || e.key === 'unisphere_workspace_friendships_v1') {
      const myUid = getEmailDocId(sessionEmail || profile.email || 'local_student');
      void subscribeToUserFriendships(myUid);
      return;
    }
    if (!e.key || !e.key.startsWith(STORAGE_KEY)) return;
    try {
      if (e.key === `${STORAGE_KEY}_logs` && e.newValue) {
        studyLogs = sanitizeStudyLogList(JSON.parse(e.newValue));
      } else if (e.key === `${STORAGE_KEY}_courses` && e.newValue) {
        courses = sanitizeCourseList(JSON.parse(e.newValue));
      } else if (e.key === `${STORAGE_KEY}_assignments` && e.newValue) {
        assignments = sanitizeAssignmentList(JSON.parse(e.newValue));
      } else if (e.key === `${STORAGE_KEY}_profile` && e.newValue) {
        profile = sanitizeUserProfile(JSON.parse(e.newValue), profile, sessionEmail);
      } else if (e.key === `${STORAGE_KEY}_quick_notes` && e.newValue !== null) {
        quickNotes = sanitizeTextInput(e.newValue, 5000, true);
      } else if (e.key === `${STORAGE_KEY}_checklist` && e.newValue !== null) {
        checklist = normalizeGoalsList(e.newValue);
      } else if (e.key === `${STORAGE_KEY}_resource_links` && e.newValue) {
        resourceLinks = sanitizeResourceLinksList(JSON.parse(e.newValue));
      }
      populateCurrentPageData();
    } catch {}
  });

  // Initial startup
  bindDialogFormEvents();
  setupRealtimeFirestoreSync();
  setStatus('Ready');
  void loadAndRenderPage(getRouteFromLocation(), false, { replaceHistory: !isAuthenticated });
}
