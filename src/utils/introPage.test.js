import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  shouldRedirectFromIntro,
  resolveLoginFocusTarget,
  resolveLegalHeaderCta,
  validateRegistrationTermsAccepted,
} from './introRouting.js';

const repoRoot = path.resolve(import.meta.dirname || '.', '../..');

describe('Intro & Login Routing Helpers (Milestone 1)', () => {
  it('shouldRedirectFromIntro redirects signed-in users unless ?intro=1 is present', () => {
    assert.equal(shouldRedirectFromIntro({ sessionEmail: 'student@uni.it', search: '' }), true);
    assert.equal(
      shouldRedirectFromIntro({ sessionEmail: 'student@uni.it', search: '?ref=onepagelove' }),
      true
    );
    assert.equal(shouldRedirectFromIntro({ sessionEmail: 'student@uni.it', search: '?intro=0' }), true);
    assert.equal(shouldRedirectFromIntro({ sessionEmail: 'student@uni.it', search: '?intro=1' }), false);
    assert.equal(
      shouldRedirectFromIntro({ sessionEmail: 'student@uni.it', search: '?ref=onepagelove&intro=1' }),
      false
    );
    assert.equal(shouldRedirectFromIntro({ sessionEmail: '', search: '' }), false);
    assert.equal(shouldRedirectFromIntro({ sessionEmail: '   ', search: '' }), false);
    assert.equal(shouldRedirectFromIntro({ sessionEmail: null, search: '' }), false);
  });

  it('resolveLoginFocusTarget normalizes #login and #register hashes and ignores others', () => {
    assert.equal(resolveLoginFocusTarget('#register'), 'register');
    assert.equal(resolveLoginFocusTarget('#REGISTER'), 'register');
    assert.equal(resolveLoginFocusTarget('#login'), 'login');
    assert.equal(resolveLoginFocusTarget('#Login'), 'login');
    assert.equal(resolveLoginFocusTarget(''), null);
    assert.equal(resolveLoginFocusTarget('#'), null);
    assert.equal(resolveLoginFocusTarget('#unknown'), null);
  });

  it('resolveLegalHeaderCta points signed-in users to dashboard and guests to login', () => {
    assert.deepEqual(resolveLegalHeaderCta('student@uni.it'), {
      label: 'Open App',
      href: '/pages/dashboard.html',
    });
    assert.deepEqual(resolveLegalHeaderCta(''), {
      label: 'Log in',
      href: '/pages/login.html#login',
    });
    assert.deepEqual(resolveLegalHeaderCta('   '), {
      label: 'Log in',
      href: '/pages/login.html#login',
    });
  });

  it('validateRegistrationTermsAccepted enforces explicit Terms & Age acceptance', () => {
    assert.deepEqual(validateRegistrationTermsAccepted(true), { valid: true, error: '' });
    assert.deepEqual(validateRegistrationTermsAccepted(false), {
      valid: false,
      error:
        'You must agree to the Terms & Conditions and confirm the minimum age requirement to register.',
    });
    assert.deepEqual(validateRegistrationTermsAccepted(undefined), {
      valid: false,
      error:
        'You must agree to the Terms & Conditions and confirm the minimum age requirement to register.',
    });
  });
});

describe('Intro Video Assets, Vite Config, CSP & Cache Headers', () => {
  it('ships self-hosted intro.mp4 and intro-poster.jpg under public/media', () => {
    const videoPath = path.join(repoRoot, 'public/media/intro.mp4');
    const posterPath = path.join(repoRoot, 'public/media/intro-poster.jpg');
    assert.equal(fs.existsSync(videoPath), true, 'public/media/intro.mp4 must exist');
    assert.equal(fs.existsSync(posterPath), true, 'public/media/intro-poster.jpg must exist');
    assert.ok(fs.statSync(videoPath).size > 100_000, 'intro.mp4 must be non-empty');
    assert.ok(fs.statSync(posterPath).size > 5_000, 'intro-poster.jpg must be non-empty');
  });

  it('registers privacy.html and terms.html in vite.config.ts multi-page inputs', () => {
    const viteCfg = fs.readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8');
    assert.ok(viteCfg.includes('pages/privacy.html'), 'vite.config.ts must include pages/privacy.html');
    assert.ok(viteCfg.includes('pages/terms.html'), 'vite.config.ts must include pages/terms.html');
  });

  it('allows media-src self in vercel.json and server.ts CSP and caches /media/ without immutable', () => {
    const vercelCfg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
    const globalHeaders = vercelCfg.headers.find((h) => h.source === '/(.*)')?.headers || [];
    const cspHeader = globalHeaders.find((h) => h.key === 'Content-Security-Policy')?.value || '';
    assert.ok(cspHeader.includes("media-src 'self'"), 'vercel.json CSP must allow media-src self');

    const mediaHeaders = vercelCfg.headers.find((h) => h.source === '/media/(.*)')?.headers || [];
    const mediaCache = mediaHeaders.find((h) => h.key === 'Cache-Control')?.value || '';
    assert.ok(mediaCache.includes('public, max-age=86400'), 'vercel.json must cache /media/(.*) for 86400s');
    assert.equal(mediaCache.includes('immutable'), false, 'vercel.json /media/(.*) must not be immutable');

    const serverTs = fs.readFileSync(path.join(repoRoot, 'server.ts'), 'utf8');
    assert.ok(serverTs.includes("media-src 'self'"), 'server.ts CSP must allow media-src self');
    assert.ok(serverTs.includes('/media/'), 'server.ts must configure cache control for /media/');
    assert.ok(serverTs.includes('public, max-age=86400'), 'server.ts must set max-age=86400 for /media/');
  });
});
