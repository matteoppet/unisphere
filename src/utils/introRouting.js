/**
 * Determines whether a visitor landing on `/` should be redirected immediately
 * to the authenticated Dashboard (`/pages/dashboard.html`).
 * Passing `?intro=1` bypasses the redirect so signed-in students can revisit `/`
 * or share the intro page.
 */
export function shouldRedirectFromIntro({ sessionEmail = '', search = '' } = {}) {
  const cleanEmail = typeof sessionEmail === 'string' ? sessionEmail.trim() : '';
  if (!cleanEmail) return false;
  try {
    const params = new URLSearchParams(typeof search === 'string' ? search : '');
    if (params.get('intro') === '1') return false;
  } catch {}
  return true;
}

/**
 * Resolves which card on `/pages/login.html` should receive initial focus/highlight
 * based on the URL hash (`#login` or `#register`).
 */
export function resolveLoginFocusTarget(hash = '') {
  const normalized = String(hash || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();
  if (normalized === 'login' || normalized === 'register') {
    return normalized;
  }
  return null;
}

/**
 * Computes the header CTA link/label shown on public legal pages
 * (`pages/privacy.html` and `pages/terms.html`) based on local session state.
 */
export function resolveLegalHeaderCta(sessionEmail = '') {
  const cleanEmail = typeof sessionEmail === 'string' ? sessionEmail.trim() : '';
  if (cleanEmail) {
    return { label: 'Open App', href: '/pages/dashboard.html' };
  }
  return { label: 'Log in', href: '/pages/login.html#login' };
}

/**
 * Validates that the registering student explicitly accepted the Terms & Conditions
 * and minimum-age requirement.
 */
export function validateRegistrationTermsAccepted(isAccepted) {
  if (isAccepted === true) {
    return { valid: true, error: '' };
  }
  return {
    valid: false,
    error:
      'You must agree to the Terms & Conditions and confirm the minimum age requirement to register.',
  };
}
