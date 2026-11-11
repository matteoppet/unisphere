# Topbar Link Horizontal & Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert topbar navigation links to a bullet-free horizontal flexbox layout on desktop and tablet while stacking them vertically on mobile screens (<= 720px).

**Architecture:** Update centralized navigation styles in `src/index.css` using CSS Flexbox with wrap and responsive media query `@media (max-width: 720px)` to control orientation without requiring HTML modifications across page files. Add automated unit regression tests in `src/utils/navigation.test.js` validating CSS rules and markup integrity.

**Tech Stack:** HTML5, CSS3 (Flexbox & Media Queries), Node.js test runner (`node --test`), Vite.

**Spec:** [`docs/superpowers/specs/2026-11-11-topbar-horizontal-links-design.md`](file:///C:/Users/matte/orca/workspaces/unisphere/feat-topbar-link-converted-from-vertical-to-hori/docs/superpowers/specs/2026-11-11-topbar-horizontal-links-design.md)

## Global Constraints

- Navigation bullet dots must be removed across all screen sizes (`list-style: none`, `padding: 0`).
- Desktop and tablet (`> 720px`) navigation links must display horizontally with `gap: 16px` and `flex-wrap: wrap`.
- Mobile screens (`<= 720px`) must stack navigation links vertically (`flex-direction: column`, `gap: 8px`).
- Centralized CSS architecture must be preserved: edits remain within `src/index.css`.
- All tests must pass with `npm test` and the production bundle must succeed with `npm run build`.

## Review Focus

- Bullet dots reappearing on mobile view: verified by asserting `list-style: none` is applied globally to `.nav-list` rather than only inside desktop media queries.
- Link wrapping causing horizontal overflows: verified by testing `flex-wrap: wrap` on desktop.
- Missing navigation classes across pages: verified by testing presence of `#nav-list.nav-list` across `index.html` and `pages/*.html`.
- Margin or padding artifacts from default browser user-agent `ul` styles: verified by asserting explicit reset of `padding: 0` and `.nav-list li` margin.
- Regression on existing mobile breakpoint rules: verified by verifying `@media (max-width: 720px)` incorporates `.nav-list` alongside existing grid collapses.

---

### Task 1: Navigation Layout Regression Test

**Files:**
- Create: `src/utils/navigation.test.js`
- Test: `src/utils/navigation.test.js`

**Interfaces:**
- Consumes: `src/index.css`, `index.html`, `pages/*.html`
- Produces: automated test suite executed by `node --test`

- [ ] **Step 1: Write the failing test**

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Topbar Navigation Layout and Responsiveness (#37)', () => {
  const cssPath = path.resolve('src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  test('verifies .nav-list removes dots and configures horizontal flex on desktop', () => {
    assert.match(cssContent, /\.nav-list\s*\{[^}]*list-style:\s*none;?[^}]*\}/s, 'should remove list bullets with list-style: none');
    assert.match(cssContent, /\.nav-list\s*\{[^}]*padding:\s*0;?[^}]*\}/s, 'should reset default padding to 0');
    assert.match(cssContent, /\.nav-list\s*\{[^}]*display:\s*flex;?[^}]*\}/s, 'should use display: flex');
    assert.match(cssContent, /\.nav-list\s*\{[^}]*flex-direction:\s*row;?[^}]*\}/s, 'should arrange links horizontally');
    assert.match(cssContent, /\.nav-list\s*\{[^}]*flex-wrap:\s*wrap;?[^}]*\}/s, 'should allow wrapping on smaller desktop viewports');
    assert.match(cssContent, /\.nav-list\s*\{[^}]*gap:\s*16px;?[^}]*\}/s, 'should space links with 16px gap');
  });

  test('verifies .nav-list switches to vertical column on mobile (<= 720px)', () => {
    const mobileQueryRegex = /@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([^@]*?)\}/g;
    let match;
    let foundNavInMobile = false;

    while ((match = mobileQueryRegex.exec(cssContent)) !== null) {
      const queryBody = match[1];
      if (/\.nav-list\s*\{[^}]*flex-direction:\s*column;?[^}]*\}/s.test(queryBody)) {
        foundNavInMobile = true;
        break;
      }
    }

    assert.ok(foundNavInMobile, 'should contain .nav-list with flex-direction: column inside max-width: 720px');
  });

  test('verifies all main navigation markup files use #nav-list with class nav-list', () => {
    const pages = ['index.html', 'pages/dashboard.html', 'pages/courses.html', 'pages/logs.html', 'pages/assignments.html', 'pages/squads.html', 'pages/settings.html'];
    for (const page of pages) {
      const content = fs.readFileSync(path.resolve(page), 'utf8');
      assert.ok(content.includes('id="nav-list"') && content.includes('class="nav-list"'), `${page} must contain #nav-list with class="nav-list"`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/utils/navigation.test.js`
Expected: FAIL due to missing flexbox and mobile query rules in `src/index.css`.

- [ ] **Step 3: Commit initial test**

```bash
git add src/utils/navigation.test.js
git commit -m "test: add regression tests for topbar horizontal and mobile layout (#37)"
```

---

### Task 2: Implement Responsive Navigation Styles in `src/index.css`

**Files:**
- Modify: `src/index.css`
- Test: `src/utils/navigation.test.js`

**Interfaces:**
- Consumes: `.nav-list` and `@media (max-width: 720px)` in `src/index.css`
- Produces: responsive navigation layout satisfying Issue #37

- [ ] **Step 1: Update `.nav-list` and `.nav-list li` in `src/index.css`**

Replace lines 55-62:
```css
.nav-list {
  margin: 0 0 14px 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.nav-list li {
  margin: 0;
}
```

- [ ] **Step 2: Add responsive vertical stacking to `@media (max-width: 720px)` in `src/index.css`**

Under the `@media (max-width: 720px)` section (around line 167):
```css
@media (max-width: 720px) {
  .nav-list {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .grid-3,
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Run regression tests to verify they pass**

Run: `node --test src/utils/navigation.test.js`
Expected: PASS (all 3 tests pass).

- [ ] **Step 4: Run full test suite and build verification**

Run: `npm test` and `npm run build`
Expected: All tests pass (91 tests passing), Vite production build completes cleanly.

- [ ] **Step 5: Commit changes**

```bash
git add src/index.css
git commit -m "feat: convert topbar links to horizontal flex on desktop and vertical stack on mobile (#37)"
```
