/**
 * Computes a truthful sync status message, visual tone, and retry visibility
 * from authentication, network, and Firestore sync state.
 */
export function formatSyncStatus({
  isAuthenticated = false,
  email = '',
  syncState = 'synced',
  isOnline = true,
  hasPendingLocalSync = false,
  hasDb = true,
  actionMessage = '',
} = {}) {
  const cleanEmail = String(email || '').trim();
  const cleanAction = String(actionMessage || '').trim();

  if (!isAuthenticated || !cleanEmail) {
    const text =
      cleanAction && cleanAction !== 'Ready'
        ? `${cleanAction} — Not Signed In`
        : 'Not Signed In';
    return { text, tone: 'neutral', showRetry: false };
  }

  let baseStatus = `Synced (${cleanEmail})`;
  let tone = 'ok';
  let showRetry = false;

  if (!hasDb) {
    baseStatus = `Local only (${cleanEmail})`;
    tone = 'warn';
    showRetry = false;
  } else if (isOnline === false) {
    baseStatus = hasPendingLocalSync
      ? `Offline — changes saved locally (${cleanEmail})`
      : `Offline (${cleanEmail})`;
    tone = 'warn';
    showRetry = false;
  } else if (syncState === 'error') {
    baseStatus = `Sync failed — saved locally (${cleanEmail})`;
    tone = 'error';
    showRetry = true;
  } else if (syncState === 'syncing') {
    baseStatus = `Syncing… (${cleanEmail})`;
    tone = 'neutral';
    showRetry = false;
  } else if (hasPendingLocalSync || syncState === 'pending') {
    baseStatus = `Pending sync (${cleanEmail})`;
    tone = 'warn';
    showRetry = true;
  }

  const text =
    cleanAction && cleanAction !== 'Ready' ? `${cleanAction} — ${baseStatus}` : baseStatus;

  return { text, tone, showRetry };
}

/**
 * Returns the newest `limit` study logs for the Dashboard widget along with total and hidden counts.
 */
export function sliceRecentLogsForDashboard(studyLogs = [], limit = 15) {
  if (!Array.isArray(studyLogs) || studyLogs.length === 0) {
    return { logs: [], totalCount: 0, hiddenCount: 0 };
  }
  const safeLimit = Math.max(1, Number(limit) || 15);
  const sorted = [...studyLogs].sort((a, b) => {
    const aDate = /^\d{4}-\d{2}-\d{2}$/.test(String(a?.date || '').trim())
      ? String(a.date).trim()
      : '';
    const bDate = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.date || '').trim())
      ? String(b.date).trim()
      : '';
    if (aDate !== bDate) {
      if (!aDate) return 1;
      if (!bDate) return -1;
      return bDate.localeCompare(aDate);
    }
    return (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0);
  });
  const logs = sorted.slice(0, safeLimit);
  return {
    logs,
    totalCount: sorted.length,
    hiddenCount: Math.max(0, sorted.length - logs.length),
  };
}

const VALID_DASH_COURSE_STATUSES = ['active', 'completed', 'planned', 'all'];
const VALID_DASH_PANELS = ['resources', 'notes'];

/**
 * Parses Dashboard filter & tab query parameters (?status=...&panel=...) with safe defaults.
 */
export function parseDashboardQueryParams(search = '') {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const rawStatus = params.get('status') || '';
  const rawPanel = params.get('panel') || '';
  return {
    courseStatus: VALID_DASH_COURSE_STATUSES.includes(rawStatus) ? rawStatus : 'active',
    panel: VALID_DASH_PANELS.includes(rawPanel) ? rawPanel : 'resources',
  };
}

/**
 * Builds a clean Dashboard URL preserving unrelated query params while omitting default values.
 */
export function buildDashboardUrl(pathname = '/', search = '', { courseStatus, panel } = {}) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  if (VALID_DASH_COURSE_STATUSES.includes(courseStatus) && courseStatus !== 'active') {
    params.set('status', courseStatus);
  } else {
    params.delete('status');
  }
  if (VALID_DASH_PANELS.includes(panel) && panel !== 'resources') {
    params.set('panel', panel);
  } else {
    params.delete('panel');
  }
  const qs = params.toString();
  return `${pathname || '/'}${qs ? `?${qs}` : ''}`;
}
