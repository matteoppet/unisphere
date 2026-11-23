import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSyncStatus } from './uiState.js';

describe('formatSyncStatus (#truthful-sync-status)', () => {
  it('returns Not Signed In when unauthenticated', () => {
    assert.deepEqual(
      formatSyncStatus({ isAuthenticated: false, email: 'a@uni.it', hasDb: true }),
      { text: 'Not Signed In', tone: 'neutral', showRetry: false }
    );
    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: false,
        email: '',
        actionMessage: 'Logged out',
      }),
      { text: 'Logged out — Not Signed In', tone: 'neutral', showRetry: false }
    );
  });

  it('reports local-only mode when Firestore db is unavailable', () => {
    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: true,
        email: 'demo@uni.it',
        hasDb: false,
        isOnline: true,
      }),
      { text: 'Local only (demo@uni.it)', tone: 'warn', showRetry: false }
    );
  });

  it('reports offline and offline-pending states truthfully', () => {
    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: true,
        email: 'demo@uni.it',
        hasDb: true,
        isOnline: false,
        hasPendingLocalSync: false,
      }),
      { text: 'Offline (demo@uni.it)', tone: 'warn', showRetry: false }
    );
    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: true,
        email: 'demo@uni.it',
        hasDb: true,
        isOnline: false,
        hasPendingLocalSync: true,
      }),
      {
        text: 'Offline — changes saved locally (demo@uni.it)',
        tone: 'warn',
        showRetry: false,
      }
    );
  });

  it('reports sync errors with retry trigger and syncing/pending/synced states', () => {
    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: true,
        email: 'demo@uni.it',
        hasDb: true,
        isOnline: true,
        syncState: 'error',
      }),
      {
        text: 'Sync failed — saved locally (demo@uni.it)',
        tone: 'error',
        showRetry: true,
      }
    );

    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: true,
        email: 'demo@uni.it',
        hasDb: true,
        isOnline: true,
        syncState: 'syncing',
        actionMessage: 'Notes saved',
      }),
      {
        text: 'Notes saved — Syncing… (demo@uni.it)',
        tone: 'neutral',
        showRetry: false,
      }
    );

    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: true,
        email: 'demo@uni.it',
        hasDb: true,
        isOnline: true,
        syncState: 'synced',
        hasPendingLocalSync: true,
      }),
      {
        text: 'Pending sync (demo@uni.it)',
        tone: 'warn',
        showRetry: true,
      }
    );

    assert.deepEqual(
      formatSyncStatus({
        isAuthenticated: true,
        email: 'demo@uni.it',
        hasDb: true,
        isOnline: true,
        syncState: 'synced',
        hasPendingLocalSync: false,
      }),
      {
        text: 'Synced (demo@uni.it)',
        tone: 'ok',
        showRetry: false,
      }
    );
  });
});
