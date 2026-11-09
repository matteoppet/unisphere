import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  computeSaltedOtpHash,
  redactEmail,
  createRateLimiter,
  getSecurityHeaders,
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
} from '../lib/authService.js';

describe('Password Hashing & Verification (PBKDF2 + Legacy Compatibility)', () => {
  it('generates a salted PBKDF2 hash with distinct salts for identical passwords', async () => {
    const hash1 = await hashPassword('CorrectHorseBatteryStaple!');
    const hash2 = await hashPassword('CorrectHorseBatteryStaple!');

    assert.ok(hash1.startsWith('pbkdf2$'), `Expected pbkdf2$ prefix, got: ${hash1}`);
    assert.ok(hash2.startsWith('pbkdf2$'), `Expected pbkdf2$ prefix, got: ${hash2}`);
    assert.notEqual(hash1, hash2, 'Salted hashes for the same password must differ');
  });

  it('verifies a valid PBKDF2 password and rejects an invalid one', async () => {
    const hash = await hashPassword('MySecurePass123');
    const isValid = await verifyPassword('MySecurePass123', hash);
    const isInvalid = await verifyPassword('WrongPass123', hash);

    assert.equal(isValid, true);
    assert.equal(isInvalid, false);
  });

  it('supports verifying legacy unsalted 64-char hex SHA-256 hashes for existing users', async () => {
    const legacyHash = '70f96d6b05c701164a47f869021831d526bf4291322481d800bf35c0a8b1a7a5';
    const enc = new TextEncoder().encode('secret123');
    const buf = await globalThis.crypto.subtle.digest('SHA-256', enc);
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    assert.equal(await verifyPassword('secret123', hex), true);
    assert.equal(await verifyPassword('wrong', hex), false);
    assert.equal(await verifyPassword('anything', legacyHash), false);
  });
});

describe('CSPRNG Verification Code & Salted OTP Hashing (#30)', () => {
  it('generates a 6-digit numeric string', () => {
    for (let i = 0; i < 25; i++) {
      const code = generateVerificationCode();
      assert.match(code, /^\d{6}$/);
      const num = Number(code);
      assert.ok(num >= 100000 && num <= 999999);
    }
  });

  it('produces domain-separated, email-salted OTP hashes that differ across emails and salts', async () => {
    const h1 = await computeSaltedOtpHash('alice@uni.edu', '123456', 'saltA');
    const h2 = await computeSaltedOtpHash('bob@uni.edu', '123456', 'saltA');
    const h3 = await computeSaltedOtpHash('alice@uni.edu', '123456', 'saltB');
    const h1Repeat = await computeSaltedOtpHash('ALICE@uni.edu ', ' 123456 ', 'saltA');

    assert.equal(h1.length, 64);
    assert.notEqual(h1, h2);
    assert.notEqual(h1, h3);
    assert.equal(h1, h1Repeat);
  });

  it('redacts email addresses to prevent PII exposure in logs', () => {
    assert.equal(redactEmail('student@uniroma3.it'), 's***@uniroma3.it');
    assert.equal(redactEmail('invalid'), '***');
  });
});

describe('Sliding-Window Rate Limiter', () => {
  it('allows requests within the limit and blocks once maxAttempts is reached', () => {
    let now = 1000000;
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxAttempts: 3,
      nowFn: () => now,
    });

    assert.equal(limiter.check('user@uni.edu').allowed, true);
    assert.equal(limiter.consume('user@uni.edu').allowed, true);
    assert.equal(limiter.consume('user@uni.edu').allowed, true);
    assert.equal(limiter.consume('user@uni.edu').allowed, true);

    const fourth = limiter.consume('user@uni.edu');
    assert.equal(fourth.allowed, false);
    assert.ok(fourth.retryAfterSeconds > 0);
  });

  it('resets allowance after windowMs expires or when reset() is called', () => {
    let now = 1000000;
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxAttempts: 2,
      nowFn: () => now,
    });

    limiter.consume('ip-1');
    limiter.consume('ip-1');
    assert.equal(limiter.consume('ip-1').allowed, false);

    now += 61_000;
    assert.equal(limiter.consume('ip-1').allowed, true);

    limiter.consume('ip-1');
    assert.equal(limiter.consume('ip-1').allowed, false);
    limiter.reset('ip-1');
    assert.equal(limiter.consume('ip-1').allowed, true);
  });
});

describe('Security Headers, URL Sanitization, CSV Injection & Profile Stripping (#30)', () => {
  it('returns standard security headers including CSP, HSTS, X-Frame-Options, and nosniff', () => {
    const headers = getSecurityHeaders();
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.ok(headers['Strict-Transport-Security'].includes('max-age='));
    assert.ok(headers['Content-Security-Policy'].includes("default-src 'self'"));
    assert.ok(headers['Content-Security-Policy'].includes('https://apis.google.com'));
  });

  it('rejects javascript:, data:, vbscript:, file:, and blob: URLs while allowing http: and https:', () => {
    assert.equal(sanitizeResourceUrl('javascript:alert(1)'), null);
    assert.equal(sanitizeResourceUrl('data:text/html,<script>alert(1)</script>'), null);
    assert.equal(sanitizeResourceUrl('blob:https://evil.example/123'), null);
    assert.equal(sanitizeResourceUrl('https://gomp.uniroma3.it/'), 'https://gomp.uniroma3.it/');
    assert.equal(sanitizeResourceUrl('gomp.uniroma3.it'), 'https://gomp.uniroma3.it/');
  });

  it('filters malicious URLs from imported or synced resourceLinks arrays', () => {
    const cleaned = sanitizeResourceLinksList([
      { id: '1', title: 'XSS', url: 'javascript:alert(document.cookie)' },
      { id: '2', title: 'Safe Portal', url: 'https://gomp.uniroma3.it/' },
    ]);
    assert.equal(cleaned.length, 1);
    assert.equal(cleaned[0].url, 'https://gomp.uniroma3.it/');
  });

  it('neutralizes CSV formula injection payloads in exported log cells', () => {
    assert.equal(sanitizeCsvCell("=cmd|' /C calc'!A0"), `"'=cmd|' /C calc'!A0"`);
    assert.equal(sanitizeCsvCell('+SUM(A1:A2)'), `"'+SUM(A1:A2)"`);
    assert.equal(sanitizeCsvCell('-1+1'), `"'-1+1"`);
    assert.equal(sanitizeCsvCell('@IMPORTXML()'), `"'@IMPORTXML()"`);
    assert.equal(sanitizeCsvCell('Normal notes "quoted"'), `"Normal notes ""quoted"""`);
  });

  it('strips passwordHash, authUid, and unexpected fields when sanitizing user profiles', () => {
    const dirtyProfile = {
      name: 'Mario Rossi',
      email: 'spoofed@evil.com',
      studentId: '123456',
      passwordHash: 'pbkdf2$100000$deadbeef$secret',
      authUid: 'internal-uid-999',
      isAdmin: true,
    };
    const sanitized = sanitizeUserProfile(
      dirtyProfile,
      { degreeType: 'Laurea Triennale' },
      'mario@uni.edu'
    );

    assert.equal(sanitized.name, 'Mario Rossi');
    assert.equal(sanitized.email, 'mario@uni.edu');
    assert.equal('passwordHash' in sanitized, false);
    assert.equal('authUid' in sanitized, false);
    assert.equal('isAdmin' in sanitized, false);
  });
});

describe('Firebase Config Fallback, Login Binding & Firestore Rules Hardening (#30, #31)', () => {
  const repoRoot = path.resolve(import.meta.dirname || '.', '../..');

  it('ensures src/lib/firebase.js reads from VITE_FIREBASE_* env vars and never hardcodes exposed AIzaSy API keys (#31)', () => {
    const firebaseSrc = fs.readFileSync(path.join(repoRoot, 'src/lib/firebase.js'), 'utf8');
    assert.ok(
      firebaseSrc.includes('VITE_FIREBASE_API_KEY'),
      'firebase.js must support VITE_FIREBASE_* environment variables'
    );
    assert.ok(
      !firebaseSrc.includes('AIzaSy'),
      'firebase.js must not contain hardcoded AIzaSy API keys'
    );
    assert.equal(
      fs.existsSync(path.join(repoRoot, 'firebase-applet-config.json')),
      false,
      'firebase-applet-config.json with exposed keys must not be present in the repository'
    );
  });

  it('ensures src/app.js uses WeakSet (boundElements) instead of dataset.bound so cached login HTML retains working listeners', () => {
    const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
    assert.ok(
      appSrc.includes('const boundElements = new WeakSet()'),
      'app.js must track bound DOM elements in a WeakSet so pageHtmlCache never serializes data-bound="true"'
    );
    assert.ok(
      !appSrc.includes('dataset.bound'),
      'app.js must not use dataset.bound which breaks event binding after pageHtmlCache restore'
    );
  });

  it('verifies firestore.rules prevents user enumeration, enforces schema validation, and forbids plaintext OTP codes', () => {
    const rulesContent = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

    assert.ok(
      rulesContent.includes('allow list: if false;'),
      'users list rule must be false to prevent collection-wide user enumeration'
    );
    assert.ok(
      rulesContent.includes('allow get: if isUserDocOwner(userId) || isValidDocId(userId);'),
      'users get rule must support authenticated owner and hybrid PBKDF2 login lookup'
    );
    assert.ok(
      rulesContent.includes("(!('code' in data) || data.code == null)"),
      'emailVerifications must forbid storing non-null plaintext code'
    );
  });
});

describe('Form Input Sanitization & XSS Protection (#31)', () => {
  it('escapes HTML entities in untrusted strings via escapeHtml', () => {
    assert.equal(
      escapeHtml('<img src=x onerror="alert(1)">\'&'),
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;'
    );
  });

  it('sanitizes text inputs by stripping control characters, script/HTML tags, and enforcing length limits', () => {
    assert.equal(
      sanitizeTextInput('  <script>alert("xss")</script>Analisi\u0000 1  ', 50),
      'Analisi 1'
    );
    assert.equal(
      sanitizeTextInput('<b>Prof.</b> <img src=x onerror=alert(1)>Rossi', 100),
      'Prof. Rossi'
    );
    assert.equal(sanitizeTextInput('A'.repeat(500), 20).length, 20);
  });

  it('validates and normalizes email inputs via sanitizeEmailInput', () => {
    assert.equal(sanitizeEmailInput('  Student@UniRoma3.IT '), 'student@uniroma3.it');
    assert.equal(sanitizeEmailInput('not-an-email'), '');
    assert.equal(sanitizeEmailInput('evil<script>@uni.it'), '');
  });

  it('sanitizes course, study log, and assignment form/import payloads against XSS and invalid ranges', () => {
    const cleanCourse = sanitizeCourseItem({
      id: 'course-1',
      title: '<script>evil()</script>Fisica 1',
      status: 'invalid-status',
      cfu: 999,
      year: -2,
      semester: 5,
      email: 'javascript:alert(1)',
      officeHours: '<b>Mon 10-12</b>',
      notes: '<svg onload=alert(1)>Mechanics',
    });
    assert.equal(cleanCourse.title, 'Fisica 1');
    assert.equal(cleanCourse.status, 'active');
    assert.equal(cleanCourse.cfu, 60);
    assert.equal(cleanCourse.year, 1);
    assert.equal(cleanCourse.semester, 2);
    assert.equal(cleanCourse.email, '');
    assert.equal(cleanCourse.officeHours, 'Mon 10-12');
    assert.equal(cleanCourse.notes, 'Mechanics');

    const cleanLog = sanitizeStudyLogItem({
      id: 'log-1',
      courseName: '<img src=x onerror=alert(1)>Analisi 1',
      durationMinutes: 9999,
      date: '2026-11-07',
      tag: '<script>hack</script>',
      notes: 'Derivatives <iframe>bad</iframe>',
    });
    assert.equal(cleanLog.courseName, 'Analisi 1');
    assert.equal(cleanLog.durationMinutes, 720);
    assert.equal(cleanLog.tag, 'Deep Work');
    assert.equal(cleanLog.notes, 'Derivatives');

    const cleanAsg = sanitizeAssignmentItem({
      id: 'asg-1',
      title: '<b>Midterm 1</b>',
      courseName: '<script>x</script>Analisi 1',
      type: 'UnknownType',
      dueDate: '2026-11-20',
      status: 'hacked',
      grade: 45,
      notes: '<a href="javascript:alert(1)">Room A</a>',
    });
    assert.equal(cleanAsg.title, 'Midterm 1');
    assert.equal(cleanAsg.courseName, 'Analisi 1');
    assert.equal(cleanAsg.type, 'Exam');
    assert.equal(cleanAsg.status, 'todo');
    assert.equal(cleanAsg.grade, 30);
    assert.equal(cleanAsg.notes, 'Room A');
  });

  it('never produces undefined property values in sanitizeStudyLogItem or sanitizeAssignmentItem so Firestore setDoc never rejects payloads', () => {
    const logWithoutCourseId = sanitizeStudyLogItem({
      id: 'log-mobile-1',
      courseName: 'Analisi 1',
      durationMinutes: 90,
      date: '2026-11-09',
    });
    assert.equal('courseId' in logWithoutCourseId, false);
    for (const [, val] of Object.entries(logWithoutCourseId)) {
      assert.notEqual(val, undefined);
    }

    const ungradedAsg = sanitizeAssignmentItem({
      id: 'asg-ungraded',
      title: 'Exam 1',
      courseName: 'Analisi 1',
      dueDate: '2026-11-25',
    });
    assert.equal('grade' in ungradedAsg, false);
    assert.equal('examParts' in ungradedAsg, false);
    assert.equal('completedAt' in ungradedAsg, false);
    for (const [, val] of Object.entries(ungradedAsg)) {
      assert.notEqual(val, undefined);
    }

    const stripped = stripUndefinedDeep({
      a: 1,
      b: undefined,
      nested: [{ x: 'ok', y: undefined }],
    });
    assert.deepEqual(stripped, { a: 1, nested: [{ x: 'ok' }] });
  });
});

describe('Instant Multi-Device Cloud Sync & Mobile-to-PC Log Reconciliation', () => {
  const repoRoot = path.resolve(import.meta.dirname || '.', '../..');

  it('initializes Firebase and Firestore with fallback config when env vars are unset', async () => {
    const fb = await import('../lib/firebase.js');
    assert.equal(fb.isFirebaseConfigured, true);
    assert.ok(fb.db, 'Firestore db instance must be initialized for cloud sync');
    assert.ok(fb.auth, 'Firebase auth instance must be initialized');
    assert.equal(fb.firebaseConfig.projectId, 'straight-correlate-dh7nb');
    assert.equal(
      fb.firebaseConfig.firestoreDatabaseId,
      'ai-studio-almaacademiclife-7bdc7a09-4da4-40fb-90da-adfb41a72019'
    );
  });

  it('preserves unsynced mobile study logs during initial cloud hydration and flags them for immediate push', () => {
    const remoteLogs = [
      {
        id: 'log-1000',
        courseName: 'Analisi 1',
        durationMinutes: 60,
        date: '2026-11-07',
        timestamp: 1000,
      },
    ];
    const localMobileLogs = [
      {
        id: 'log-2000',
        courseName: 'Fisica 1',
        durationMinutes: 90,
        date: '2026-11-09',
        timestamp: 2000,
      },
      ...remoteLogs,
    ];

    const result = reconcileStudyLogs(localMobileLogs, remoteLogs, 1500, false, null);
    assert.equal(result.hasUnsyncedLocalAdditions, true);
    assert.equal(result.logs.length, 2);
    assert.equal(result.logs[0].id, 'log-2000');
    assert.equal(result.logs[1].id, 'log-1000');
  });

  it('does not resurrect logs that were previously synced and then deleted on another device', () => {
    const remoteLogsAfterDelete = [
      {
        id: 'log-1000',
        courseName: 'Analisi 1',
        durationMinutes: 60,
        date: '2026-11-07',
        timestamp: 1000,
      },
    ];
    const staleLocalLogs = [
      {
        id: 'log-1500',
        courseName: 'Fisica 1',
        durationMinutes: 45,
        date: '2026-11-08',
        timestamp: 1500,
      },
      ...remoteLogsAfterDelete,
    ];

    const result = reconcileStudyLogs(
      staleLocalLogs,
      remoteLogsAfterDelete,
      3000,
      false,
      ['log-1500', 'log-1000']
    );
    assert.equal(result.hasUnsyncedLocalAdditions, false);
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].id, 'log-1000');
  });

  it('wires instant server sync on visibilitychange, focus, online, and storage events in src/app.js', () => {
    const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
    assert.ok(appSrc.includes('getDocFromServer'), 'app.js must use getDocFromServer for instant cloud pull');
    assert.ok(appSrc.includes('visibilitychange'), 'app.js must sync on visibilitychange');
    assert.ok(appSrc.includes("addEventListener('focus'"), 'app.js must sync on window focus');
    assert.ok(appSrc.includes("addEventListener('online'"), 'app.js must sync on network online');
    assert.ok(appSrc.includes('reconcileStudyLogs'), 'app.js must reconcile unsynced study logs');
  });
});

describe('Google Sign-In Error Classification', () => {
  it('identifies popup-blocked and unauthorized-domain errors accurately', () => {
    const popupBlocked = formatGoogleAuthError({ code: 'auth/popup-blocked' });
    assert.equal(popupBlocked.shouldFallbackToRedirect, true);

    const unauthorized = formatGoogleAuthError({ code: 'auth/unauthorized-domain' });
    assert.ok(unauthorized.message.includes('Authorized Domains'));

    const closed = formatGoogleAuthError({ code: 'auth/popup-closed-by-user' });
    assert.equal(closed.shouldFallbackToRedirect, false);
    assert.ok(closed.message.includes('closed'));
  });
});

describe('Clean New User Registration Without Pre-Loaded Data (#35)', () => {
  const repoRoot = path.resolve(import.meta.dirname || '.', '../..');

  it('does not pre-load starter courses, study logs, or resources for new users in src/app.js', () => {
    const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');

    assert.ok(
      !appSrc.includes('DEFAULT_STARTER_COURSES'),
      'app.js must not define or use DEFAULT_STARTER_COURSES'
    );
    assert.ok(
      !appSrc.includes('DEFAULT_STARTER_LOGS'),
      'app.js must not define or use DEFAULT_STARTER_LOGS'
    );
    assert.ok(
      !appSrc.includes('DEFAULT_STARTER_RESOURCES'),
      'app.js must not define or use DEFAULT_STARTER_RESOURCES'
    );
    assert.ok(
      !appSrc.includes('Limits, continuity, and derivatives review.'),
      'app.js must not contain pre-loaded starter study log entries'
    );
  });

  it('initializes new accounts with empty courses, studyLogs, assignments, and resourceLinks on registration', () => {
    const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');

    const regIndex = appSrc.indexOf('const newRecord = {');
    assert.notEqual(regIndex, -1, 'newRecord declaration must exist in registration handler');
    const regBlock = appSrc.slice(regIndex, regIndex + 900);

    assert.ok(regBlock.includes('courses: []'), 'newRecord must initialize courses to []');
    assert.ok(regBlock.includes('studyLogs: []'), 'newRecord must initialize studyLogs to []');
    assert.ok(regBlock.includes('assignments: []'), 'newRecord must initialize assignments to []');
    assert.ok(
      regBlock.includes('resourceLinks: []'),
      'newRecord must initialize resourceLinks to []'
    );
  });
});

