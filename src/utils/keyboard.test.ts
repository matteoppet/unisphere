import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isTypingInInput,
  getNextView,
  calculateActiveSearchIndex,
  WORKSTATION_SHORTCUTS,
  MAIN_NAV_ORDER,
} from './keyboard';

describe('Keyboard navigation utilities', () => {
  it('identifies when an element is an input, textarea, or contentEditable', () => {
    // Null or undefined
    assert.strictEqual(isTypingInInput(null), false);

    // Mock HTMLInputElement
    const mockInput = {
      tagName: 'INPUT',
      isContentEditable: false,
    } as unknown as HTMLElement;
    assert.strictEqual(isTypingInInput(mockInput), true);

    // Mock HTMLTextAreaElement
    const mockTextarea = {
      tagName: 'TEXTAREA',
      isContentEditable: false,
    } as unknown as HTMLElement;
    assert.strictEqual(isTypingInInput(mockTextarea), true);

    // Mock HTMLSelectElement
    const mockSelect = {
      tagName: 'SELECT',
      isContentEditable: false,
    } as unknown as HTMLElement;
    assert.strictEqual(isTypingInInput(mockSelect), true);

    // Mock contentEditable div
    const mockEditable = {
      tagName: 'DIV',
      isContentEditable: true,
    } as unknown as HTMLElement;
    assert.strictEqual(isTypingInInput(mockEditable), true);

    // Regular button or div
    const mockButton = {
      tagName: 'BUTTON',
      isContentEditable: false,
    } as unknown as HTMLElement;
    assert.strictEqual(isTypingInInput(mockButton), false);
  });

  it('cycles navigation views forward and backward accurately', () => {
    assert.strictEqual(getNextView('dashboard', 'next'), 'courses-and-curriculum');
    assert.strictEqual(getNextView('courses-and-curriculum', 'next'), 'assignments-and-exams');
    assert.strictEqual(getNextView('assignments-and-exams', 'next'), 'squads');
    assert.strictEqual(getNextView('squads', 'next'), 'settings');
    // Wrap around to start
    assert.strictEqual(getNextView('settings', 'next'), 'dashboard');

    // Backward cycling
    assert.strictEqual(getNextView('dashboard', 'prev'), 'settings');
    assert.strictEqual(getNextView('settings', 'prev'), 'squads');
    assert.strictEqual(getNextView('squads', 'prev'), 'assignments-and-exams');
    assert.strictEqual(getNextView('assignments-and-exams', 'prev'), 'courses-and-curriculum');
    assert.strictEqual(getNextView('courses-and-curriculum', 'prev'), 'dashboard');

    // Unknown view fallback
    assert.strictEqual(getNextView('study-session-tracker', 'next'), 'dashboard');
  });

  it('calculates wrapped active index for search result navigation', () => {
    const total = 5;

    // Moving down from unselected (-1) starts at 0
    assert.strictEqual(calculateActiveSearchIndex(-1, 1, total), 0);

    // Moving up from unselected (-1) starts at last item (4)
    assert.strictEqual(calculateActiveSearchIndex(-1, -1, total), 4);

    // Stepping down
    assert.strictEqual(calculateActiveSearchIndex(0, 1, total), 1);
    assert.strictEqual(calculateActiveSearchIndex(3, 1, total), 4);
    // Wrap around from end to start
    assert.strictEqual(calculateActiveSearchIndex(4, 1, total), 0);

    // Stepping up
    assert.strictEqual(calculateActiveSearchIndex(2, -1, total), 1);
    // Wrap around from start to end
    assert.strictEqual(calculateActiveSearchIndex(0, -1, total), 4);

    // Empty list returns -1
    assert.strictEqual(calculateActiveSearchIndex(0, 1, 0), -1);
  });

  it('contains properly formatted workstation shortcuts', () => {
    assert.ok(WORKSTATION_SHORTCUTS.length >= 10);
    const categories = new Set(WORKSTATION_SHORTCUTS.map((s) => s.category));
    assert.ok(categories.has('navigation'));
    assert.ok(categories.has('actions'));
    assert.ok(categories.has('search'));
    assert.ok(categories.has('system'));

    // Check key requirements
    const searchShortcut = WORKSTATION_SHORTCUTS.find((s) => s.id === 'search-focus');
    assert.ok(searchShortcut);
    assert.ok(searchShortcut.keys.includes('/'));

    const shortcutsModal = WORKSTATION_SHORTCUTS.find((s) => s.id === 'system-shortcuts-modal');
    assert.ok(shortcutsModal);
    assert.ok(shortcutsModal.keys.includes('?'));

    // Check quick action shortcuts corresponding to Quick Actions menu (#24)
    const courseShortcut = WORKSTATION_SHORTCUTS.find((s) => s.id === 'action-new-course');
    assert.ok(courseShortcut, 'Must have new course shortcut');
    assert.ok(courseShortcut.keys.includes('C'));

    const sessionShortcut = WORKSTATION_SHORTCUTS.find((s) => s.id === 'action-quick-study');
    assert.ok(sessionShortcut, 'Must have quick study session shortcut');
    assert.ok(sessionShortcut.keys.includes('S'));

    const assignmentShortcut = WORKSTATION_SHORTCUTS.find((s) => s.id === 'action-new-assignment');
    assert.ok(assignmentShortcut, 'Must have new assignment/exam shortcut');
    assert.ok(assignmentShortcut.keys.includes('A'));

    // Validate that every shortcut has non-empty ID, keys, and description
    for (const item of WORKSTATION_SHORTCUTS) {
      assert.ok(item.id.length > 0, `Item ID must not be empty: ${JSON.stringify(item)}`);
      assert.ok(item.keys.length > 0, `Keys must not be empty for item ${item.id}`);
      assert.ok(item.description.length > 0, `Description must not be empty for item ${item.id}`);
      assert.ok(
        ['navigation', 'actions', 'search', 'system'].includes(item.category),
        `Invalid category for item ${item.id}`
      );
    }
  });

  it('handles custom delta values and boundary edge cases in search index', () => {
    const total = 3;
    // Moving multiple steps forward
    assert.strictEqual(calculateActiveSearchIndex(0, 2, total), 2);
    // Moving multiple steps forward with wrap
    assert.strictEqual(calculateActiveSearchIndex(1, 3, total), 1);
    // Moving negative steps with wrap
    assert.strictEqual(calculateActiveSearchIndex(1, -2, total), 2);
    // Single element list always wraps to 0
    assert.strictEqual(calculateActiveSearchIndex(0, 1, 1), 0);
    assert.strictEqual(calculateActiveSearchIndex(0, -1, 1), 0);
    assert.strictEqual(calculateActiveSearchIndex(-1, 1, 1), 0);
  });
});
