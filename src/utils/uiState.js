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
