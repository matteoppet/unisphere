import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatSyncStatus, sliceRecentLogsForDashboard } from './uiState.js';

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

describe('Duplicate listener & modal guards (#dashboard-guards)', () => {
  it('guards all dialog.showModal() calls with !dialog.open and binds dashboard controls once', () => {
    const appSrc = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
    const lines = appSrc.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('.showModal()')) {
        const context = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        assert.match(
          context,
          /!dialog\.open/,
          `showModal() at src/app.js:${i + 1} must be guarded by !dialog.open`
        );
      }
    }

    for (const id of [
      'dash-course-status',
      'tab-dash-resources',
      'tab-dash-notes',
      'btn-dash-add-course',
      'btn-dash-add-log',
      'btn-dash-add-resource',
      'btn-dash-save-notes',
    ]) {
      assert.ok(
        appSrc.includes(`bindOnce(document.getElementById('${id}')`),
        `Dashboard control #${id} must use bindOnce`
      );
    }
  });
});

describe('Dashboard semantic row action buttons & undo (#dashboard-row-actions)', () => {
  it('wires #dash-undo-banner in Dashboard HTML and uses <button> elements for Dashboard row actions', () => {
    for (const htmlFile of ['index.html', 'pages/dashboard.html']) {
      const html = fs.readFileSync(path.resolve(htmlFile), 'utf8');
      assert.ok(html.includes('id="dash-undo-banner"'), `${htmlFile} must include #dash-undo-banner`);
    }
    const appSrc = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
    assert.match(appSrc, /<button[^>]*data-open-course=/);
    assert.match(appSrc, /<button[^>]*data-delete-log=/);
    assert.match(appSrc, /<button[^>]*data-delete-resource=/);
    assert.ok(appSrc.includes('showUndoBanner'), 'app.js must provide undo restore for deleted dashboard logs/resources');
  });
});

describe('sliceRecentLogsForDashboard (#dashboard-logs-cap)', () => {
  it('sorts newest-first and caps rendered rows while reporting total and hidden counts', () => {
    const sample = Array.from({ length: 20 }, (_, i) => ({
      id: `log-${i + 1}`,
      courseName: 'Analisi 1',
      durationMinutes: 60,
      date: `2026-11-${String((i % 20) + 1).padStart(2, '0')}`,
      timestamp: i + 1,
    }));

    const res = sliceRecentLogsForDashboard(sample, 15);
    assert.equal(res.totalCount, 20);
    assert.equal(res.hiddenCount, 5);
    assert.equal(res.logs.length, 15);
    assert.equal(res.logs[0].date, '2026-11-20');
    assert.equal(res.logs[14].date, '2026-11-06');

    assert.deepEqual(sliceRecentLogsForDashboard([], 15), {
      logs: [],
      totalCount: 0,
      hiddenCount: 0,
    });
  });
});
