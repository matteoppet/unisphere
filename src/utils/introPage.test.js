import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldRedirectFromIntro,
  resolveLoginFocusTarget,
  resolveLegalHeaderCta,
  validateRegistrationTermsAccepted,
} from './introRouting.js';

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
