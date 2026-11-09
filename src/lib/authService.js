import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;

export function getEmailDocId(email) {
  return String(email || '').trim().toLowerCase().replace(/\//g, '_');
}

export function redactEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

function getCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  return null;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '').trim();
  if (clean.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function generateSaltHex(byteLength = SALT_BYTES) {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(byteLength);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
export function timingSafeEqualStr(a, b) {
  const strA = String(a ?? '');
  const strB = String(b ?? '');
  if (strA.length !== strB.length) return false;
  let diff = 0;
  for (let i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = '';

  const words = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [];
  const k = [];

  let primeCounter = 0;
  const isPrime = (n) => {
    for (let factor = 2, max = Math.sqrt(n); factor <= max; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = i >= 16 ? rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3) : 0;
      const s1 = i >= 16 ? rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10) : 0;
      const wi = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      w[i] = wi;

      const a = hash[0];
      const e = hash[4];
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & hash[5]) ^ (~e & hash[6]);
      const temp1 = (hash[7] + S1 + ch + k[i] + wi) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (S0 + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function sha256Hex(value) {
  const normalized = String(value || '').trim();
  const cryptoObj = getCrypto();
  if (cryptoObj && cryptoObj.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
      return bytesToHex(new Uint8Array(hashBuffer));
    } catch {
      // Fallback to pure JS SHA-256
    }
  }
  return sha256Sync(normalized);
}

/**
 * Computes a domain-separated, email-salted SHA-256 hash for a 6-digit OTP code
 * so rainbow tables of the 900,000 6-digit numbers cannot reverse `codeHash`.
 */
export async function computeSaltedOtpHash(email, code, customSalt = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const cleanCode = String(code || '').trim();
  const saltPart = customSalt ? `${customSalt}:` : '';
  return sha256Hex(`unisphere-otp-v2:${saltPart}${normalizedEmail}:${cleanCode}`);
}

async function derivePbkdf2Hex(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const normalized = String(password || '').trim();
  const cryptoObj = getCrypto();
  if (cryptoObj && cryptoObj.subtle) {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await cryptoObj.subtle.importKey(
        'raw',
        encoder.encode(normalized),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derivedBits = await cryptoObj.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: hexToBytes(saltHex),
          iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        PBKDF2_KEY_BITS
      );
      return bytesToHex(new Uint8Array(derivedBits));
    } catch {
      // Fallback if WebCrypto PBKDF2 is unavailable
    }
  }
  let state = `${saltHex}:${normalized}`;
  const fallbackRounds = Math.min(iterations, 5000);
  for (let i = 0; i < fallbackRounds; i++) {
    state = sha256Sync(`${saltHex}:${state}:${i}`);
  }
  return state;
}

/**
 * Hashes a password using salted PBKDF2-HMAC-SHA256 (100,000 iterations).
 * Format: pbkdf2$<iterations>$<saltHex>$<derivedHex>
 */
export async function hashPassword(password, customSaltHex = null) {
  const saltHex = customSaltHex || generateSaltHex(SALT_BYTES);
  const derivedHex = await derivePbkdf2Hex(password, saltHex, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${derivedHex}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash (or a legacy 64-char hex SHA-256 hash).
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const trimmedHash = storedHash.trim();

  if (trimmedHash.startsWith('pbkdf2$')) {
    const parts = trimmedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHex = parts[3];
    if (!iterations || !saltHex || !expectedHex) return false;

    const actualHex = await derivePbkdf2Hex(password, saltHex, iterations);
    return timingSafeEqualStr(actualHex, expectedHex);
  }

  // Legacy unsalted 64-character hex SHA-256 support for seamless account migration
  if (/^[a-f0-9]{64}$/i.test(trimmedHash)) {
    const legacyCandidate = await sha256Hex(password);
    return timingSafeEqualStr(legacyCandidate.toLowerCase(), trimmedHash.toLowerCase());
  }

  return false;
}

/**
 * Generates a 6-digit verification code using cryptographically secure random numbers (CSPRNG).
 */
export function generateVerificationCode() {
  const cryptoObj = getCrypto();
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    const maxUnbiased = 4294800000;
    let rand = maxUnbiased;
    while (rand >= maxUnbiased) {
      cryptoObj.getRandomValues(array);
      rand = array[0];
    }
    return String(100000 + (rand % 900000));
  }
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

/**
 * Creates a sliding-window rate limiter to protect auth, OTP, and API endpoints.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxAttempts = 5,
  nowFn = () => Date.now(),
} = {}) {
  const buckets = new Map();

  function pruneAndGet(key) {
    const normalizedKey = String(key || 'anonymous').trim().toLowerCase();
    const now = nowFn();
    const cutoff = now - windowMs;
    const existing = buckets.get(normalizedKey) || [];
    const active = existing.filter((ts) => ts > cutoff);
    if (active.length > 0) {
      buckets.set(normalizedKey, active);
    } else {
      buckets.delete(normalizedKey);
    }
    return { normalizedKey, now, active };
  }

  function check(key) {
    const { active, now } = pruneAndGet(key);
    if (active.length >= maxAttempts) {
      const oldest = active[0];
      const retryAfterMs = Math.max(1000, oldest + windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - active.length),
      retryAfterSeconds: 0,
    };
  }

  function consume(key) {
    const status = check(key);
    if (!status.allowed) return status;
    const { normalizedKey, now, active } = pruneAndGet(key);
    active.push(now);
    buckets.set(normalizedKey, active);
    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - active.length),
      retryAfterSeconds: 0,
    };
  }

  function reset(key) {
    const normalizedKey = String(key || 'anonymous').trim().toLowerCase();
    buckets.delete(normalizedKey);
  }

  return { check, consume, reset };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
});

export const otpDispatchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxAttempts: 1,
});

export const otpVerifyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
});

/**
 * Standard HTTP security headers for UniSphere (compatible with Firebase Auth, Google SSO, and Firestore).
 */
export function getSecurityHeaders() {
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.resend.com",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    'Content-Security-Policy': cspDirectives,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  };
}

/**
 * Escapes HTML special characters to prevent Cross-Site Scripting (XSS).
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes freeform user text input from forms or JSON imports by stripping
 * control characters, embedded <script>/<style>/<iframe> tags, and HTML markup,
 * then enforcing a maximum character length.
 */
export function sanitizeTextInput(value, maxLength = 200, allowMultiline = false) {
  let str = String(value ?? '');
  // Strip null bytes and ASCII control characters (except \n and \t when multiline is allowed)
  str = allowMultiline
    ? str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    : str.replace(/[\u0000-\u001F\u007F]/g, ' ');
  // Strip dangerous container elements completely along with their contents
  str = str.replace(/<(script|style|iframe|object|embed|applet)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Strip any remaining HTML/SVG tags
  str = str.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  if (!allowMultiline) {
    str = str.replace(/\s+/g, ' ');
  }
  return str.trim().slice(0, maxLength);
}

/**
 * Validates and normalizes an email address input, rejecting HTML/script payloads or invalid formats.
 */
export function sanitizeEmailInput(value) {
  const clean = String(value ?? '').trim().toLowerCase();
  if (!clean || clean.length > 254) return '';
  if (/[<>"'`\s\\]/.test(clean)) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return '';
  return clean;
}

/**
 * Sanitizes a Course item from form submission or JSON/Firestore restoration.
 */
export function sanitizeCourseItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = sanitizeTextInput(raw.title, 120);
  if (!title) return null;
  const allowedStatuses = ['active', 'completed', 'planned'];
  const status = allowedStatuses.includes(raw.status) ? raw.status : 'active';
  const rawCfu = Number(raw.cfu);
  const cfu = Number.isFinite(rawCfu) ? Math.min(60, Math.max(1, Math.round(rawCfu))) : 6;
  const rawYear = Number(raw.year);
  const year = Number.isFinite(rawYear) ? Math.min(6, Math.max(1, Math.round(rawYear))) : 1;
  const rawSem = Number(raw.semester);
  const semester = Number.isFinite(rawSem) ? Math.min(2, Math.max(1, Math.round(rawSem))) : 1;
  const email = sanitizeEmailInput(raw.email);
  const officeHours = sanitizeTextInput(raw.officeHours, 120);
  const notes = sanitizeTextInput(raw.notes, 2000, true);
  const id = sanitizeTextInput(raw.id || `course-${Date.now()}`, 80);
  const code = sanitizeTextInput(raw.code || title.slice(0, 6).toUpperCase(), 20);
  const shortTitle = sanitizeTextInput(raw.shortTitle || title, 60) || title;
  const color = /^#[0-9A-Fa-f]{6}$/.test(String(raw.color || '')) ? raw.color : '#3B77BC';
  const progress = status === 'completed' ? 100 : Math.min(100, Math.max(0, Number(raw.progress) || 0));

  return {
    id,
    code,
    title,
    shortTitle,
    email,
    officeHours,
    cfu,
    year,
    semester,
    status,
    progress,
    color,
    notes,
  };
}

/**
 * Sanitizes a StudyLog item from form submission or JSON/Firestore restoration.
 * Never includes properties with `undefined` values so Firestore `setDoc()` never throws.
 */
export function sanitizeStudyLogItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const courseName = sanitizeTextInput(raw.courseName, 120);
  if (!courseName) return null;
  const rawMins = Number(raw.durationMinutes);
  const durationMinutes = Number.isFinite(rawMins)
    ? Math.min(720, Math.max(1, Math.round(rawMins)))
    : 60;
  const rawDate = String(raw.date || '').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : new Date().toISOString().split('T')[0];
  const allowedTags = ['Deep Work', 'Exam Prep', 'Lecture Review', 'Exercises', 'Project'];
  const tag = allowedTags.includes(raw.tag) ? raw.tag : 'Deep Work';
  const notes = sanitizeTextInput(raw.notes, 1000, true);
  const id = sanitizeTextInput(raw.id || `log-${Date.now()}`, 80);
  const courseId = raw.courseId ? sanitizeTextInput(raw.courseId, 80) : '';
  const rating = Math.min(5, Math.max(1, Number(raw.rating) || 5));
  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
      ? raw.timestamp
      : Date.now();

  const cleaned = {
    id,
    courseName,
    durationMinutes,
    date,
    timeRange: date,
    notes,
    rating,
    tag,
    timestamp,
  };
  if (courseId) {
    cleaned.courseId = courseId;
  }
  return cleaned;
}

/**
 * Sanitizes an Assignment/Exam item from form submission or JSON/Firestore restoration.
 * Never includes properties with `undefined` values so Firestore `setDoc()` never throws.
 */
export function sanitizeAssignmentItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = sanitizeTextInput(raw.title, 150);
  const courseName = sanitizeTextInput(raw.courseName, 120);
  if (!title || !courseName) return null;
  const allowedTypes = ['Exam', 'Midterm', 'Project', 'Reading', 'Final', 'Oral', 'Assignment'];
  const type = allowedTypes.includes(raw.type) ? raw.type : 'Exam';
  const rawDue = String(raw.dueDate || '').trim();
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDue)
    ? rawDue
    : new Date().toISOString().split('T')[0];
  const allowedStatuses = ['todo', 'in-progress', 'completed'];
  const status = allowedStatuses.includes(raw.status) ? raw.status : 'todo';
  const notes = sanitizeTextInput(raw.notes, 1000, true);
  const id = sanitizeTextInput(raw.id || `asg-${Date.now()}`, 80);

  const cleaned = {
    id,
    title,
    courseName,
    type,
    dueDate,
    status,
    notes,
  };

  if (raw.grade !== undefined && raw.grade !== null && raw.grade !== '') {
    const numGrade = Number(raw.grade);
    if (Number.isFinite(numGrade)) {
      cleaned.grade = Math.min(30, Math.max(0, numGrade));
    }
  }

  if (Array.isArray(raw.examParts) && raw.examParts.length > 0) {
    cleaned.examParts = raw.examParts.slice(0, 2).map((part, idx) => {
      const pGrade =
        part && part.grade !== undefined && part.grade !== null && part.grade !== ''
          ? Math.min(30, Math.max(0, Number(part.grade)))
          : undefined;
      const cleanPart = {
        label: sanitizeTextInput(part?.label || `Esonero ${idx + 1}`, 40),
      };
      if (Number.isFinite(pGrade)) {
        cleanPart.grade = pGrade;
      }
      return cleanPart;
    });
  }

  if (typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt)) {
    cleaned.completedAt = raw.completedAt;
  }

  return cleaned;
}

/**
 * Recursively strips `undefined` property values from objects and arrays before Firestore writes.
 */
export function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => stripUndefinedDeep(item));
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out;
  }
  return value;
}

export function parseTimestampMs(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const asNum = Number(val);
    if (Number.isFinite(asNum)) return asNum;
    const parsed = Date.parse(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (val && typeof val.toMillis === 'function') {
    return val.toMillis();
  }
  return 0;
}

/**
 * Reconciles local study logs with remote Firestore study logs during hydration.
 * Preserves unsynced local logs (such as logs added on mobile while offline or before cloud push completed)
 * without resurrecting logs that were previously synced and subsequently deleted on another device.
 */
export function reconcileStudyLogs(
  localLogs = [],
  remoteLogs = [],
  remoteUpdatedAt = 0,
  hasPendingLocalSync = false,
  syncedLogIds = null
) {
  const cleanRemote = Array.isArray(remoteLogs)
    ? remoteLogs.map((item) => sanitizeStudyLogItem(item)).filter(Boolean)
    : [];
  const cleanLocal = Array.isArray(localLogs)
    ? localLogs.map((item) => sanitizeStudyLogItem(item)).filter(Boolean)
    : [];

  const remoteIds = new Set(cleanRemote.map((l) => l.id));
  const previouslySyncedSet = Array.isArray(syncedLogIds) ? new Set(syncedLogIds) : null;
  const remoteUpdatedMs = parseTimestampMs(remoteUpdatedAt);
  const maxRemoteLogTs = cleanRemote.reduce(
    (max, l) => Math.max(max, parseTimestampMs(l.timestamp)),
    0
  );

  const localIds = new Set(cleanLocal.map((l) => l.id));
  const isLocalSupersetOfRemote =
    cleanRemote.length > 0 && cleanRemote.every((r) => localIds.has(r.id));

  const unsyncedLocalLogs = cleanLocal.filter((l) => {
    if (!l || l.id === 'log-starter-1') return false;
    if (remoteIds.has(l.id)) return false;

    // If this device previously synced this log ID with Firestore and it is no longer in remoteLogs,
    // it was deleted on another device — do not resurrect it.
    if (previouslySyncedSet && previouslySyncedSet.has(l.id)) {
      return false;
    }

    if (hasPendingLocalSync) return true;

    // If syncedLogIds tracking exists and this log ID is not in it, it was created locally and never synced.
    if (previouslySyncedSet && !previouslySyncedSet.has(l.id)) {
      return true;
    }

    const logTs = parseTimestampMs(l.timestamp);
    if (remoteUpdatedMs > 0 && logTs > remoteUpdatedMs) return true;
    if (maxRemoteLogTs > 0 && logTs > maxRemoteLogTs && isLocalSupersetOfRemote) return true;
    if (cleanRemote.length === 0 && logTs > 0) return true;
    return false;
  });

  if (unsyncedLocalLogs.length === 0) {
    return {
      logs: cleanRemote,
      hasUnsyncedLocalAdditions: false,
    };
  }

  return {
    logs: [...unsyncedLocalLogs, ...cleanRemote],
    hasUnsyncedLocalAdditions: true,
  };
}

/**
 * Validates and normalizes user-submitted resource URLs to prevent javascript: or data: XSS payloads.
 */
export function sanitizeResourceUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) {
    return null;
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Neutralizes spreadsheet formula injection (CSV Injection / CWE-1236) in exported CSV cells.
 */
export function sanitizeCsvCell(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safeStr}"`;
}

/**
 * Strips sensitive authentication fields (`passwordHash`, `authUid`, prototype keys)
 * from profile objects before persisting to localStorage, exporting JSON backups, or importing.
 */
export function sanitizeUserProfile(rawProfile, fallbackProfile = {}, lockedEmail = null) {
  if (!rawProfile || typeof rawProfile !== 'object') {
    return { ...fallbackProfile };
  }
  const allowedFields = [
    'name',
    'studentId',
    'email',
    'degreeLevel',
    'degreeName',
    'degreeType',
    'status',
    'currentSession',
    'academicYear',
    'enrolledYear',
    'totalTargetCFU',
    'weeklyGoalHours',
    'avatarUrl',
    'logoUrl',
    'thesisPointsExpected',
    'institution',
    'xp',
    'currentStreak',
    'minutesStudiedThisWeek',
    'tasksCompletedThisWeek',
    'lastActiveDate',
    'activeSquadId',
    'squadIds',
  ];

  const stringFields = {
    name: 100,
    studentId: 40,
    degreeLevel: 80,
    degreeName: 120,
    degreeType: 80,
    status: 40,
    currentSession: 60,
    academicYear: 40,
    enrolledYear: 20,
    institution: 120,
    lastActiveDate: 20,
    activeSquadId: 80,
  };

  const clean = { ...fallbackProfile };
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(rawProfile, key) && rawProfile[key] !== undefined) {
      if (key in stringFields && typeof rawProfile[key] === 'string') {
        clean[key] = sanitizeTextInput(rawProfile[key], stringFields[key]);
      } else if (key === 'email' && typeof rawProfile[key] === 'string') {
        clean.email = sanitizeEmailInput(rawProfile[key]) || fallbackProfile.email || '';
      } else if ((key === 'avatarUrl' || key === 'logoUrl') && rawProfile[key]) {
        clean[key] = sanitizeResourceUrl(rawProfile[key]) || '';
      } else {
        clean[key] = rawProfile[key];
      }
    }
  }
  if (lockedEmail) {
    clean.email = sanitizeEmailInput(lockedEmail) || String(lockedEmail).trim().toLowerCase();
  }
  return clean;
}

/**
 * Sanitizes an array of resource links, filtering out any invalid or malicious URLs (e.g., javascript:).
 */
export function sanitizeResourceLinksList(links) {
  if (!Array.isArray(links)) return [];
  const out = [];
  for (const item of links) {
    if (!item || typeof item !== 'object') continue;
    const safeUrl = sanitizeResourceUrl(item.url);
    if (!safeUrl) continue;
    out.push({
      id: sanitizeTextInput(item.id || `res-${Date.now()}-${out.length}`, 80),
      title: sanitizeTextInput(item.title || 'Resource', 200) || 'Resource',
      url: safeUrl,
      category: sanitizeTextInput(item.category || 'Portal', 64) || 'Portal',
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    });
  }
  return out;
}

/**
 * Classifies Firebase Google Sign-In errors to determine whether to fall back to signInWithRedirect
 * or display an actionable message.
 */
export function formatGoogleAuthError(err) {
  const code = String(err?.code || '');
  const rawMessage = String(err?.message || '');

  if (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    (rawMessage.toLowerCase().includes('popup') && rawMessage.toLowerCase().includes('blocked'))
  ) {
    return {
      code,
      shouldFallbackToRedirect: true,
      message: 'Popup was blocked by the browser. Redirecting to Google Sign-In...',
    };
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      shouldFallbackToRedirect: false,
      message: 'Google Sign-In window was closed before completing sign-in.',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return {
      code,
      shouldFallbackToRedirect: false,
      message: `Domain "${host}" is not authorized in Firebase Console -> Authentication -> Settings -> Authorized Domains.`,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      shouldFallbackToRedirect: false,
      message: 'Google Sign-In provider is not enabled in Firebase Authentication settings.',
    };
  }

  return {
    code,
    shouldFallbackToRedirect: false,
    message: rawMessage || 'Google Sign-In failed. Please try again or sign in with email.',
  };
}

export async function dispatchVerificationCode(email, dbInstance) {
  try {
    const normalized = sanitizeEmailInput(email);
    if (!normalized) {
      return {
        success: false,
        expiresAt: 0,
        emailSent: false,
        error: 'Please enter a valid email address.',
      };
    }

    const rateStatus = otpDispatchRateLimiter.consume(normalized);
    if (!rateStatus.allowed) {
      return {
        success: false,
        expiresAt: 0,
        emailSent: false,
        error: `Please wait ${rateStatus.retryAfterSeconds}s before requesting another verification code.`,
      };
    }

    const docId = getEmailDocId(normalized);
    const code = generateVerificationCode();
    const codeSalt = generateSaltHex(8);
    const codeHash = await computeSaltedOtpHash(normalized, code, codeSalt);
    const expiresAt = Date.now() + 15 * 60 * 1000;

    // Store ONLY the salted hash in Firestore — NEVER store the plaintext OTP code!
    if (dbInstance) {
      const verRef = doc(dbInstance, 'emailVerifications', docId);
      await setDoc(verRef, {
        email: normalized,
        code: null,
        codeSalt,
        codeHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt,
        verified: false,
        createdAt: new Date().toISOString(),
      });

      try {
        await addDoc(collection(dbInstance, 'mail'), {
          to: [normalized],
          message: {
            subject: 'Your UniSphere Verification Code',
            text: `Your UniSphere verification code is: ${code}\nThis code will expire in 15 minutes.`,
            html: `<div style="font-family: sans-serif; padding: 20px;"><h2>UniSphere Verification Code</h2><p>Here is your 6-digit verification code to confirm your email (<strong>${escapeHtml(normalized)}</strong>):</p><div style="font-size: 28px; letter-spacing: 6px; font-weight: bold; padding: 12px; border: 1px solid #333; text-align: center; margin: 16px 0;">${escapeHtml(code)}</div><p>This code will expire in 15 minutes.</p></div>`,
          },
          createdAt: serverTimestamp(),
        });
      } catch (mailErr) {
        console.warn('Firestore mail collection trigger skipped:', mailErr);
      }
    }

    let emailSent = false;
    let providerNotice;

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, code }),
      });

      const resData = await response.json().catch(() => null);
      if (
        response.ok &&
        (resData?.id || resData?.data?.id || resData?.success || !resData?.error)
      ) {
        emailSent = true;
      } else if (resData?.configured === false) {
        providerNotice =
          resData.message || 'Email provider credentials not configured in environment.';
      } else if (resData?.error) {
        providerNotice =
          typeof resData.error === 'string' ? resData.error : resData.error.message;
      }
    } catch (netErr) {
      console.warn('Backend email dispatch request:', netErr);
    }

    return {
      success: true,
      expiresAt,
      emailSent,
      providerNotice,
    };
  } catch (err) {
    console.error('Error dispatching verification code:', err);
    return {
      success: false,
      expiresAt: 0,
      emailSent: false,
      error: err instanceof Error ? err.message : 'Failed to dispatch verification code.',
    };
  }
}

export async function verifyEmailCode(email, inputCode, dbInstance) {
  try {
    const normalized = sanitizeEmailInput(email);
    const docId = getEmailDocId(normalized);
    const cleanCode = String(inputCode || '').trim();

    if (!normalized || !cleanCode || !/^\d{6}$/.test(cleanCode)) {
      return { success: false, error: 'Please enter a valid 6-digit verification code.' };
    }

    const rateCheck = otpVerifyRateLimiter.consume(normalized);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many verification attempts. Please wait ${rateCheck.retryAfterSeconds}s and try again.`,
      };
    }

    if (!dbInstance) {
      return {
        success: false,
        error: 'Cloud database is not configured in this environment.',
      };
    }

    const verRef = doc(dbInstance, 'emailVerifications', docId);
    const snap = await getDoc(verRef);

    if (!snap.exists()) {
      return {
        success: false,
        error: 'No active verification code found for this email. Please request a new code.',
      };
    }

    const data = snap.data();
    if (Date.now() > data.expiresAt) {
      return {
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      };
    }

    const attempts = typeof data.attempts === 'number' ? data.attempts : 0;
    const maxAttempts = typeof data.maxAttempts === 'number' ? data.maxAttempts : 5;
    if (attempts >= maxAttempts) {
      return {
        success: false,
        error: 'Maximum verification attempts exceeded. Please request a new code.',
      };
    }

    const saltedCandidateHash = await computeSaltedOtpHash(
      normalized,
      cleanCode,
      data.codeSalt || ''
    );
    const legacyUnsaltedHash = await sha256Hex(cleanCode);

    const matchesSalted =
      data.codeHash && timingSafeEqualStr(data.codeHash, saltedCandidateHash);
    const matchesLegacyHash =
      !data.codeSalt && data.codeHash && timingSafeEqualStr(data.codeHash, legacyUnsaltedHash);

    if (!matchesSalted && !matchesLegacyHash) {
      await setDoc(verRef, { attempts: attempts + 1 }, { merge: true }).catch(() => {});
      return {
        success: false,
        error: 'Incorrect verification code. Please check your email and try again.',
      };
    }

    otpVerifyRateLimiter.reset(normalized);
    await setDoc(
      verRef,
      { verified: true, verifiedAt: new Date().toISOString(), code: null },
      { merge: true }
    );

    try {
      const userRef = doc(dbInstance, 'users', docId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await setDoc(userRef, { emailVerified: true }, { merge: true });
      }
    } catch {}

    return { success: true };
  } catch (err) {
    console.error('Error validating verification code:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to verify code.',
    };
  }
}
