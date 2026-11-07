import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  createRateLimiter,
  getSecurityHeaders,
  sanitizeResourceUrl,
  formatGoogleAuthError,
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
    // SHA-256 of 'legacyPass'
    const legacyHash = '70f96d6b05c701164a47f869021831d526bf4291322481d800bf35c0a8b1a7a5';
    // Let's also compute real sha256 via WebCrypto to test exact legacy match
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

describe('CSPRNG Verification Code Generation', () => {
  it('generates a 6-digit numeric string', () => {
    for (let i = 0; i < 25; i++) {
      const code = generateVerificationCode();
      assert.match(code, /^\d{6}$/);
      const num = Number(code);
      assert.ok(num >= 100000 && num <= 999999);
    }
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

    // Advance time past window
    now += 61_000;
    assert.equal(limiter.consume('ip-1').allowed, true);

    // Exhaust again and test explicit reset
    limiter.consume('ip-1');
    assert.equal(limiter.consume('ip-1').allowed, false);
    limiter.reset('ip-1');
    assert.equal(limiter.consume('ip-1').allowed, true);
  });
});

describe('Security Headers & URL Sanitization', () => {
  it('returns standard security headers including CSP, HSTS, X-Frame-Options, and nosniff', () => {
    const headers = getSecurityHeaders();
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.ok(headers['Strict-Transport-Security'].includes('max-age='));
    assert.ok(headers['Content-Security-Policy'].includes("default-src 'self'"));
    assert.ok(headers['Content-Security-Policy'].includes('https://apis.google.com'));
  });

  it('rejects javascript: and data: URLs while allowing http: and https:', () => {
    assert.equal(sanitizeResourceUrl('javascript:alert(1)'), null);
    assert.equal(sanitizeResourceUrl('data:text/html,<script>alert(1)</script>'), null);
    assert.equal(sanitizeResourceUrl('https://gomp.uniroma3.it/'), 'https://gomp.uniroma3.it/');
    assert.equal(sanitizeResourceUrl('gomp.uniroma3.it'), 'https://gomp.uniroma3.it/');
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
