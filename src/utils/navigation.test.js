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
    const mobileQueryRegex = /@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([^@]*)\}/g;
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
    const pages = ['index.html', 'pages/dashboard.html', 'pages/courses.html', 'pages/logs.html', 'pages/assignments.html', 'pages/squads.html', 'pages/settings.html', 'pages/login.html'];
    for (const page of pages) {
      const content = fs.readFileSync(path.resolve(page), 'utf8');
      assert.ok(content.includes('id="nav-list"') && content.includes('class="nav-list"'), `${page} must contain #nav-list with class="nav-list"`);
    }
  });
});
