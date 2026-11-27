import {
  THEME_STORAGE_KEY,
  normalizeThemePreference,
  resolveEffectiveTheme,
  getNextTheme,
  getThemeToggleDisplay,
} from './utils/uiState.js';
import { resolveLegalHeaderCta } from './utils/introRouting.js';

function getStoredTheme() {
  try {
    return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function getSystemPrefersDark() {
  try {
    return Boolean(
      typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch {
    return false;
  }
}

function applyIntroTheme(theme) {
  const effective = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', effective);
  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    const display = getThemeToggleDisplay(effective);
    toggleBtn.textContent = display.label;
    toggleBtn.setAttribute('aria-label', display.ariaLabel);
  }
}

function bindThemeToggle() {
  applyIntroTheme(resolveEffectiveTheme(getStoredTheme(), getSystemPrefersDark()));

  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = resolveEffectiveTheme(getStoredTheme(), getSystemPrefersDark());
      const next = getNextTheme(current);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      applyIntroTheme(next);
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyIntroTheme(resolveEffectiveTheme(getStoredTheme(), getSystemPrefersDark()));
    }
  });

  const mediaQuery =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', (e) => {
      if (getStoredTheme() === null) {
        applyIntroTheme(resolveEffectiveTheme(null, Boolean(e.matches)));
      }
    });
  }
}

function bindVideoFallback() {
  const video = document.getElementById('intro-video');
  const fallback = document.getElementById('intro-video-fallback');
  if (!video || !fallback) return;

  const showFallback = () => {
    video.hidden = true;
    fallback.hidden = false;
  };

  video.addEventListener('error', showFallback);
  video.querySelectorAll('source').forEach((sourceEl) => {
    sourceEl.addEventListener('error', showFallback);
  });
}

function hydrateLegalHeaderCta() {
  const ctaEl = document.querySelector('[data-legal-app-cta]');
  if (!ctaEl) return;

  let sessionEmail = '';
  try {
    sessionEmail = localStorage.getItem('unisphere_workspace_session_email') || '';
  } catch {}

  const cta = resolveLegalHeaderCta(sessionEmail);
  ctaEl.textContent = cta.label;
  ctaEl.setAttribute('href', cta.href);
}

export function initIntroPage() {
  if (typeof document === 'undefined') return;
  bindThemeToggle();
  bindVideoFallback();
  hydrateLegalHeaderCta();
}

initIntroPage();
