import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChecklist,
  addChecklistItem,
  toggleChecklistItemState,
  removeChecklistItem,
  clearCompletedChecklistItems,
} from './checklist.js';

describe('Checklist and Quick Notes separation (#19)', () => {
  it('parses empty checklist string into empty array', () => {
    assert.deepEqual(parseChecklist(''), []);
    assert.deepEqual(parseChecklist('   \n  '), []);
  });

  it('correctly parses todo and completed items from checklist text', () => {
    const raw = '• [ ] Buy textbook\n• [x] Submit assignment\n- [ ] Review lecture notes';
    const items = parseChecklist(raw);
    assert.equal(items.length, 3);
    assert.equal(items[0].text, 'Buy textbook');
    assert.equal(items[0].isCompleted, false);
    assert.equal(items[1].text, 'Submit assignment');
    assert.equal(items[1].isCompleted, true);
    assert.equal(items[2].text, 'Review lecture notes');
    assert.equal(items[2].isCompleted, false);
  });

  it('adds items without modifying or mixing with quick note freeform text', () => {
    let checklist = '';
    checklist = addChecklistItem(checklist, 'First task');
    assert.equal(checklist, '• [ ] First task');
    checklist = addChecklistItem(checklist, 'Second task');
    assert.equal(checklist, '• [ ] First task\n• [ ] Second task');
  });

  it('toggles completion status of a checklist item', () => {
    const initial = '• [ ] Task A\n• [ ] Task B';
    const toggled = toggleChecklistItemState(initial, 0);
    assert.equal(toggled, '• [x] Task A\n• [ ] Task B');
    const untoggled = toggleChecklistItemState(toggled, 0);
    assert.equal(untoggled, '• [ ] Task A\n• [ ] Task B');
  });

  it('removes an item by index', () => {
    const initial = '• [ ] Task A\n• [x] Task B\n• [ ] Task C';
    const afterRemove = removeChecklistItem(initial, 1);
    assert.equal(afterRemove, '• [ ] Task A\n• [ ] Task C');
  });

  it('clears only completed items from checklist text', () => {
    const initial = '• [ ] Keep me\n• [x] Done 1\n• [ ] Keep me too\n• [x] Done 2';
    const cleared = clearCompletedChecklistItems(initial);
    assert.equal(cleared, '• [ ] Keep me\n• [ ] Keep me too');
  });
});
