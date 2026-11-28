import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  shouldRedirectFromIntro,
  resolveLoginFocusTarget,
  resolveActiveAuthMode,
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

  it('resolveActiveAuthMode prioritizes validation notice scope over hash and defaults to login', () => {
    assert.equal(resolveActiveAuthMode({ hash: '', noticeScope: '' }), 'login');
    assert.equal(resolveActiveAuthMode({ hash: '#login', noticeScope: '' }), 'login');
    assert.equal(resolveActiveAuthMode({ hash: '#register', noticeScope: '' }), 'register');
    assert.equal(resolveActiveAuthMode({ hash: '#REGISTER', noticeScope: '' }), 'register');
    assert.equal(resolveActiveAuthMode({ hash: '#login', noticeScope: 'register' }), 'register');
    assert.equal(resolveActiveAuthMode({ hash: '#register', noticeScope: 'login' }), 'login');
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

describe('One-Page Introduction Markup, Theme & Assets (index.html)', () => {
  it('loads only standalone intro assets without Firebase or app.js', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    assert.ok(html.includes('/src/intro.css'), 'index.html must link /src/intro.css');
    assert.ok(html.includes('/src/intro.js'), 'index.html must load /src/intro.js');
    assert.equal(html.includes('/src/main.js'), false, 'index.html must not load /src/main.js');
    assert.equal(html.includes('/src/app.js'), false, 'index.html must not load /src/app.js');
    assert.equal(/firebase/i.test(html), false, 'index.html must not reference Firebase');
  });

  it('includes pre-paint theme script and signed-in redirect with ?intro=1 bypass', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    assert.ok(html.includes('try{'), 'index.html pre-paint scripts must wrap localStorage in try/catch');
    assert.ok(html.includes('unisphere_theme'), 'index.html must hydrate unisphere_theme pre-paint');
    assert.ok(
      html.includes('unisphere_workspace_session_email'),
      'index.html must check unisphere_workspace_session_email'
    );
    assert.ok(
      html.includes("window.location.replace('/pages/dashboard.html')"),
      'index.html must redirect signed-in users to /pages/dashboard.html'
    );
    assert.ok(
      html.includes("get('intro')!=='1'") || html.includes("get('intro') !== '1'"),
      'index.html must support ?intro=1 bypass'
    );
  });

  it('presents student-built, free, open-source, distraction-free hero, video stage, 3 pillars, FAQ, and skip-to-login links', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    assert.ok(html.includes('id="btn-theme-toggle"'), 'index.html must include #btn-theme-toggle');
    assert.match(html, /Built by students, for students/i);
    assert.match(html, /Free/i);
    assert.match(html, /Open Source/i);
    assert.ok(html.includes('https://github.com/matteoppet/unisphere'));
    assert.match(html, /distraction-free/i);
    assert.ok(html.includes('Start Your New Life'));
    assert.ok(html.includes('href="/pages/login.html#register"'));
    assert.ok(html.includes('href="/pages/login.html#login"'));

    assert.match(html, /<video[^>]*id="intro-video"/);
    assert.match(html, /<video[^>]*controls/);
    assert.match(html, /<video[^>]*playsinline/);
    assert.match(html, /<video[^>]*preload="metadata"/);
    assert.match(html, /<video[^>]*poster="\/media\/intro-poster\.jpg"/);
    assert.ok(html.includes('<source src="/media/intro.mp4" type="video/mp4"'));
    assert.ok(html.includes('id="intro-video-fallback"'));

    assert.match(html, /Courses/i);
    assert.match(html, /Session Logs/i);
    assert.match(html, /Friends/i);
    assert.match(html, /Squads/i);
    assert.match(html, /solo/i);

    const detailsCount = (html.match(/<details\b/g) || []).length;
    assert.ok(detailsCount >= 4, `Expected at least 4 FAQ <details> items, found ${detailsCount}`);

    assert.ok(html.includes('href="/pages/privacy.html"'));
    assert.ok(html.includes('href="/pages/terms.html"'));
  });

  it('uses monochrome light/dark palette in src/intro.css without external fonts or gradients', () => {
    const css = fs.readFileSync(path.join(repoRoot, 'src/intro.css'), 'utf8');
    assert.match(css, /color-scheme:\s*light dark/);
    assert.match(css, /html\[data-theme="dark"\]/);
    assert.match(css, /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
    assert.ok(css.includes('.legal-article'), 'src/intro.css must define .legal-article');
    assert.equal(css.includes('fonts.googleapis.com'), false, 'src/intro.css must not load Google Fonts');
    assert.equal(/@import\b/i.test(css), false, 'src/intro.css must not use external @import');
    assert.equal(
      /(?:linear|radial)-gradient/i.test(css),
      false,
      'src/intro.css must not use gradients'
    );
  });
});

describe('Standalone Legal Pages (privacy.html & terms.html)', () => {
  it('shares intro assets without Firebase/app.js and never auto-redirects signed-in users', () => {
    for (const legalPage of ['pages/privacy.html', 'pages/terms.html']) {
      const html = fs.readFileSync(path.join(repoRoot, legalPage), 'utf8');
      assert.ok(html.includes('/src/intro.css'), `${legalPage} must link /src/intro.css`);
      assert.ok(html.includes('/src/intro.js'), `${legalPage} must load /src/intro.js`);
      assert.equal(html.includes('/src/main.js'), false, `${legalPage} must not load /src/main.js`);
      assert.equal(html.includes('/src/app.js'), false, `${legalPage} must not load /src/app.js`);
      assert.equal(
        html.includes('window.location.replace'),
        false,
        `${legalPage} must never auto-redirect signed-in users`
      );
      assert.ok(html.includes('data-legal-app-cta'), `${legalPage} must expose data-legal-app-cta`);
      assert.ok(html.includes('UniSphere Project Maintainer'), `${legalPage} must list Data Controller placeholder`);
      assert.ok(html.includes('privacy@unispherelife.me'), `${legalPage} must list contact email placeholder`);
      assert.ok(html.includes('27 November 2026'), `${legalPage} must show Last updated date`);
    }
  });

  it('privacy.html covers GDPR, Italian Privacy Code, sub-processors, localStorage, Garante, portability, and age', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'pages/privacy.html'), 'utf8');
    for (const term of [
      '2016/679',
      'Art. 6(1)(b)',
      'Art. 6(1)(f)',
      'Google',
      'Firebase',
      'Vercel',
      'Resend',
      'Cloudflare',
      'Data Privacy Framework',
      'localStorage',
      'zero tracking',
      'Garante per la protezione dei dati personali',
      'garanteprivacy.it',
      'JSON',
      'CSV',
      'Art. 2-quinquies',
      '16',
      '14',
      'Delete My Account',
      'Email/Password',
      'request.auth != null',
      'friendProfiles',
    ]) {
      assert.ok(html.includes(term), `pages/privacy.html must cover "${term}"`);
    }
    assert.equal(
      /Google Sign-In|PBKDF2|next milestone/i.test(html),
      false,
      'pages/privacy.html must remove outdated Google Sign-In, PBKDF2, and next-milestone deletion text'
    );
  });

  it('terms.html covers MIT License, user data ownership, age, DSA reporting, Italian Civil Code Art. 1229, and Squad creator continuity', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'pages/terms.html'), 'utf8');
    for (const term of [
      'MIT License',
      '16',
      '14',
      'Digital Services Act',
      'privacy@unispherelife.me',
      'Art. 1229',
      'dolo o colpa grave',
      'Delete My Account',
      'randomly reassigned',
    ]) {
      assert.ok(html.includes(term), `pages/terms.html must cover "${term}"`);
    }
    assert.equal(
      /Google Sign-In/i.test(html),
      false,
      'pages/terms.html must not reference Google Sign-In'
    );
  });
});

describe('Login & Registration Legal Wiring and Hash Targeting', () => {
  it('links brand back to intro without data-nav, exposes card IDs, and includes unchecked required Terms checkbox and Privacy notice', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'pages/login.html'), 'utf8');
    assert.ok(
      html.includes('<a href="/?intro=1" class="site-brand">UniSphere</a>'),
      'pages/login.html header brand must link back to /?intro=1 without data-nav'
    );
    assert.ok(html.includes('id="auth-card-login"'), 'pages/login.html must include #auth-card-login');
    assert.ok(
      html.includes('id="auth-card-register"'),
      'pages/login.html must include #auth-card-register'
    );

    const termsInputMatch = html.match(/<input[^>]*id="auth-reg-terms"[^>]*>/);
    assert.ok(termsInputMatch, 'pages/login.html must include #auth-reg-terms checkbox');
    assert.ok(
      /type="checkbox"/.test(termsInputMatch[0]) && /\brequired\b/.test(termsInputMatch[0]),
      '#auth-reg-terms must be a required checkbox'
    );
    assert.equal(
      /\bchecked\b/.test(termsInputMatch[0]),
      false,
      '#auth-reg-terms must never be pre-checked'
    );

    assert.ok(html.includes('href="/pages/terms.html"'));
    assert.ok(html.includes('href="/pages/privacy.html"'));
    assert.ok(html.includes('https://github.com/matteoppet/unisphere'));
    assert.equal(html.includes('btn-google-sso'), false, 'pages/login.html must remove #btn-google-sso');
    assert.equal(
      /Signing in with Google|Continue with Google|Previously used Google Sign-In/i.test(html),
      false,
      'pages/login.html must remove Google Sign-In UI and governance copy'
    );
    assert.ok(html.includes('Read our'), 'pages/login.html must show concise legal link note');
    assert.match(html, /Forgot password\?/i);
  });

  it('wires resolveLoginFocusTarget and validateRegistrationTermsAccepted in src/app.js and styles auth legal UI in src/index.css', () => {
    const appJs = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
    assert.ok(appJs.includes('resolveLoginFocusTarget'), 'src/app.js must use resolveLoginFocusTarget');
    assert.ok(
      appJs.includes('validateRegistrationTermsAccepted'),
      'src/app.js must use validateRegistrationTermsAccepted'
    );

    const regSubmitIdx = appJs.indexOf("regForm.addEventListener('submit'");
    assert.notEqual(regSubmitIdx, -1, 'register submit handler must exist');
    const termsCheckIdx = appJs.indexOf('validateRegistrationTermsAccepted', regSubmitIdx);
    const firebaseRegIdx = appJs.indexOf('createUserWithEmailAndPassword', regSubmitIdx);
    assert.ok(
      termsCheckIdx !== -1 && (firebaseRegIdx === -1 || termsCheckIdx < firebaseRegIdx),
      'Terms validation must execute before Firebase registration'
    );

    const css = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
    const darkSection = css.slice(css.indexOf('html[data-theme="dark"]'));
    for (const selector of ['.auth-card-targeted', '.auth-legal-note', '.auth-footer']) {
      assert.ok(css.includes(selector), `src/index.css must style ${selector}`);
      assert.ok(darkSection.includes(selector), `src/index.css dark theme must style ${selector}`);
    }
  });

  it('centers and separates Sign In and Register tabs to match the Overview aesthetic', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'pages/login.html'), 'utf8');
    assert.ok(html.includes('class="auth-shell"'), 'pages/login.html must wrap login in .auth-shell');
    assert.ok(html.includes('role="tablist"'), 'pages/login.html must include auth mode tablist');
    assert.match(
      html,
      /<button[^>]*id="tab-auth-login"[^>]*role="tab"[^>]*aria-controls="auth-card-login"/
    );
    assert.match(
      html,
      /<button[^>]*id="tab-auth-register"[^>]*role="tab"[^>]*aria-controls="auth-card-register"/
    );
    assert.match(html, /<section[^>]*id="auth-card-register"[^>]*\bhidden\b/);
    assert.ok(html.includes('data-auth-switch="register"'));
    assert.ok(html.includes('data-auth-switch="login"'));

    const appJs = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
    assert.ok(appJs.includes('resolveActiveAuthMode'), 'src/app.js must use resolveActiveAuthMode');
    assert.ok(appJs.includes('loginCard.hidden ='), 'src/app.js must toggle loginCard.hidden');
    assert.ok(appJs.includes('regCard.hidden ='), 'src/app.js must toggle regCard.hidden');
    assert.ok(appJs.includes('data-auth-switch'), 'src/app.js must handle [data-auth-switch]');
    assert.ok(appJs.includes('data-auth-mode'), 'src/app.js must handle [data-auth-mode]');

    const css = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
    const darkSection = css.slice(css.indexOf('html[data-theme="dark"]'));
    assert.match(css, /\.auth-shell\s*\{[^}]*margin:\s*[^;]*auto/s, '.auth-shell must be centered');
    for (const selector of [
      '.auth-mode-tabs',
      '.auth-mode-tab',
      '.auth-card',
      '.auth-btn-primary',
      '.auth-btn-secondary',
    ]) {
      assert.ok(css.includes(selector), `src/index.css must style ${selector}`);
      assert.ok(darkSection.includes(selector), `src/index.css dark theme must style ${selector}`);
    }
  });
});

describe('Whole-Branch Review Fix Regressions (src/intro.js, src/intro.css, index.html)', () => {
  it('hydrates ALL [data-legal-app-cta] elements, toggles theme when localStorage throws, and triggers video fallback on immediate media error', async () => {
    const headerCta = { textContent: 'Log in', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const footerCta = { textContent: 'Log in', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };

    let themeClickHandler = null;
    const toggleBtn = {
      textContent: '',
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(type, fn) { if (type === 'click') themeClickHandler = fn; },
    };

    const videoEl = {
      hidden: false,
      error: { code: 4 },
      networkState: 3,
      addEventListener() {},
      querySelectorAll() { return []; },
    };
    const fallbackEl = { hidden: true };

    const docAttrs = { 'data-theme': 'light' };
    const prevGlobals = {
      document: globalThis.document,
      window: globalThis.window,
      localStorage: globalThis.localStorage,
      HTMLMediaElement: globalThis.HTMLMediaElement,
    };

    try {
      globalThis.HTMLMediaElement = { NETWORK_NO_SOURCE: 3 };
      globalThis.localStorage = {
        getItem(key) {
          if (key === 'unisphere_workspace_session_email') return 'student@uni.it';
          throw new Error('SecurityError: storage blocked');
        },
        setItem() {
          throw new Error('SecurityError: storage blocked');
        },
      };
      globalThis.window = {
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        addEventListener() {},
      };
      globalThis.document = {
        documentElement: {
          getAttribute(k) { return docAttrs[k] ?? null; },
          setAttribute(k, v) { docAttrs[k] = v; },
        },
        getElementById(id) {
          if (id === 'btn-theme-toggle') return toggleBtn;
          if (id === 'intro-video') return videoEl;
          if (id === 'intro-video-fallback') return fallbackEl;
          return null;
        },
        querySelector(sel) {
          if (sel === '[data-legal-app-cta]') return headerCta;
          return null;
        },
        querySelectorAll(sel) {
          if (sel === '[data-legal-app-cta]') return [headerCta, footerCta];
          return [];
        },
      };

      const { initIntroPage } = await import('../intro.js');
      initIntroPage();

      // 1. Both header and footer CTAs must update for signed-in users
      assert.equal(headerCta.textContent, 'Open App');
      assert.equal(headerCta.attrs.href, '/pages/dashboard.html');
      assert.equal(footerCta.textContent, 'Open App');
      assert.equal(footerCta.attrs.href, '/pages/dashboard.html');

      // 2. Theme toggle must flip light -> dark -> light even when localStorage throws
      assert.ok(typeof themeClickHandler === 'function', 'theme toggle click handler must be bound');
      themeClickHandler();
      assert.equal(docAttrs['data-theme'], 'dark');
      themeClickHandler();
      assert.equal(docAttrs['data-theme'], 'light');

      // 3. Immediate video error / NETWORK_NO_SOURCE must reveal fallback
      assert.equal(videoEl.hidden, true);
      assert.equal(fallbackEl.hidden, false);
    } finally {
      globalThis.document = prevGlobals.document;
      globalThis.window = prevGlobals.window;
      globalThis.localStorage = prevGlobals.localStorage;
      globalThis.HTMLMediaElement = prevGlobals.HTMLMediaElement;
    }
  });

  it('keeps [data-legal-app-cta] visible on mobile in src/intro.css and marks #intro-video-fallback with polite live region in index.html', () => {
    const css = fs.readFileSync(path.join(repoRoot, 'src/intro.css'), 'utf8');
    assert.ok(
      css.includes('.intro-nav .btn-primary-sm:not([data-legal-app-cta])'),
      'src/intro.css mobile rule must not hide [data-legal-app-cta] on legal pages'
    );

    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    assert.match(
      html,
      /<div[^>]*id="intro-video-fallback"[^>]*role="status"[^>]*aria-live="polite"/,
      'index.html #intro-video-fallback must announce status politely'
    );
  });
});
