import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatSyncStatus,
  sliceRecentLogsForDashboard,
  parseDashboardQueryParams,
  buildDashboardUrl,
  THEME_STORAGE_KEY,
  normalizeThemePreference,
  resolveEffectiveTheme,
  getNextTheme,
  getThemeToggleDisplay,
} from './uiState.js';

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
    for (const htmlFile of ['pages/dashboard.html']) {
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

describe('Dashboard URL query parameter sync (#dashboard-url-state)', () => {
  it('parses valid status & panel params and falls back safely for invalid values', () => {
    assert.deepEqual(parseDashboardQueryParams(''), {
      courseStatus: 'active',
      panel: 'resources',
    });
    assert.deepEqual(parseDashboardQueryParams('?status=completed&panel=notes'), {
      courseStatus: 'completed',
      panel: 'notes',
    });
    assert.deepEqual(parseDashboardQueryParams('?status=hacked&panel=unknown'), {
      courseStatus: 'active',
      panel: 'resources',
    });
  });

  it('builds clean URLs omitting default active/resources params while preserving unrelated params', () => {
    assert.equal(
      buildDashboardUrl('/pages/dashboard.html', '?foo=1&status=all&panel=notes', {
        courseStatus: 'active',
        panel: 'resources',
      }),
      '/pages/dashboard.html?foo=1'
    );
    assert.equal(
      buildDashboardUrl('/', '', {
        courseStatus: 'planned',
        panel: 'notes',
      }),
      '/?status=planned&panel=notes'
    );
  });
});

describe('Theme color-scheme & dark mode palette (#theme-dark-mode)', () => {
  it('resolves, toggles, and labels light/dark themes accurately', () => {
    assert.equal(THEME_STORAGE_KEY, 'unisphere_theme');
    assert.equal(normalizeThemePreference('dark'), 'dark');
    assert.equal(normalizeThemePreference('light'), 'light');
    assert.equal(normalizeThemePreference('sepia'), null);

    assert.equal(resolveEffectiveTheme(null, false), 'light');
    assert.equal(resolveEffectiveTheme(null, true), 'dark');
    assert.equal(resolveEffectiveTheme('light', true), 'light');
    assert.equal(resolveEffectiveTheme('dark', false), 'dark');

    assert.equal(getNextTheme('light'), 'dark');
    assert.equal(getNextTheme('dark'), 'light');

    assert.deepEqual(getThemeToggleDisplay('light'), {
      label: 'Dark Theme',
      ariaLabel: 'Switch to dark theme',
    });
    assert.deepEqual(getThemeToggleDisplay('dark'), {
      label: 'Light Theme',
      ariaLabel: 'Switch to light theme',
    });
  });

  it('declares color-scheme light dark, data-theme selectors, and prefers-color-scheme fallback in src/index.css', () => {
    const css = fs.readFileSync(path.resolve('src/index.css'), 'utf8');
    assert.match(css, /color-scheme:\s*light dark/);
    assert.match(css, /html\[data-theme="dark"\]/);
    assert.match(css, /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
  });

  it('wires #btn-theme-toggle and boot theme script across all HTML pages', () => {
    for (const htmlFile of [
      'index.html',
      'pages/dashboard.html',
      'pages/login.html',
      'pages/courses.html',
      'pages/logs.html',
      'pages/assignments.html',
      'pages/squads.html',
      'pages/settings.html',
      'pages/privacy.html',
      'pages/terms.html',
    ]) {
      const html = fs.readFileSync(path.resolve(htmlFile), 'utf8');
      assert.ok(html.includes('id="btn-theme-toggle"'), `${htmlFile} must include #btn-theme-toggle`);
      assert.ok(html.includes('unisphere_theme'), `${htmlFile} must include pre-paint theme script`);
    }
  });

  it('provides dark-theme overrides for Squads summary, progress, status, and modal text/borders', () => {
    const css = fs.readFileSync(path.resolve('src/index.css'), 'utf8');
    const darkSection = css.slice(css.indexOf('html[data-theme="dark"]'));
    for (const selector of [
      '.squad-summary-value-bold',
      '.squad-summary-sub',
      '.squad-progress-track',
      '.squad-progress-fill',
      '.squad-progress-meta',
      '.squad-sort-label',
      '.squad-unified-summary',
      '.squad-bottom-section',
      '.subsection-title',
      '.card-subtitle',
      '.next-session-attendees',
      '.status-live',
      '.status-online',
      '.status-offline',
      '.live-library-meta',
      '.live-library-submeta',
      '.course-info-label',
      '.course-info-value',
    ]) {
      assert.ok(
        darkSection.includes(selector),
        `Dark theme CSS must override ${selector}`
      );
    }
  });

  it('styles passed course status in green across light and dark themes and wires it in app.js', () => {
    const css = fs.readFileSync(path.resolve('src/index.css'), 'utf8');
    const darkSection = css.slice(css.indexOf('html[data-theme="dark"]'));
    const appJs = fs.readFileSync(path.resolve('src/app.js'), 'utf8');

    assert.match(css, /\.course-status-passed\s*\{[\s\S]*?color:\s*#008000[\s\S]*?font-weight:\s*bold/);
    assert.ok(darkSection.includes('.course-status-passed'), 'Dark theme CSS must override .course-status-passed');
    assert.match(appJs, /function renderCourseStatusHtml/);
    assert.match(appJs, /course-status-passed/);
  });
});
