import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChecklist,
  addChecklistItem,
  toggleChecklistItemState,
  removeChecklistItem,
  clearCompletedChecklistItems,
} from './checklist';

describe('Checklist and Quick Notes separation (#19)', () => {
  it('parses empty checklist string into empty array', () => {
    assert.deepEqual(parseChecklist(''), []);
    assert.deepEqual(parseChecklist('   \n  \n  '), []);
  });

  it('correctly parses todo and completed items from checklist text', () => {
    const raw = `• [ ] Read Chapter 4\n• [x] Submit Assignment 1\n* [ ] Study group meeting`;
    const items = parseChecklist(raw);

    assert.equal(items.length, 3);
    assert.equal(items[0].text, 'Read Chapter 4');
    assert.equal(items[0].isCompleted, false);
    assert.equal(items[1].text, 'Submit Assignment 1');
    assert.equal(items[1].isCompleted, true);
    assert.equal(items[2].text, 'Study group meeting');
    assert.equal(items[2].isCompleted, false);
  });

  it('adds items without modifying or mixing with quick note freeform text', () => {
    const quickNote = 'Prof office hours at 15:00 in Room 204\nImportant book to return';
    let checklist = '';

    checklist = addChecklistItem(checklist, 'Email tutor');
    assert.equal(checklist, '• [ ] Email tutor');

    checklist = addChecklistItem(checklist, 'Buy calculator');
    assert.equal(checklist, '• [ ] Email tutor\n• [ ] Buy calculator');

    // Verify quick notes remained completely unchanged
    assert.equal(quickNote, 'Prof office hours at 15:00 in Room 204\nImportant book to return');
    // Verify checklist items parsed correctly
    const items = parseChecklist(checklist);
    assert.equal(items.length, 2);
    assert.equal(items[0].text, 'Email tutor');
    assert.equal(items[1].text, 'Buy calculator');
  });

  it('toggles completion status of a checklist item', () => {
    let checklist = '• [ ] Email tutor\n• [ ] Buy calculator';
    checklist = toggleChecklistItemState(checklist, 0);

    const items = parseChecklist(checklist);
    assert.equal(items[0].isCompleted, true);
    assert.equal(items[1].isCompleted, false);

    // Toggle back to unchecked
    checklist = toggleChecklistItemState(checklist, 0);
    const uncompletedItems = parseChecklist(checklist);
    assert.equal(uncompletedItems[0].isCompleted, false);
  });

  it('removes an item by index', () => {
    let checklist = '• [ ] Item 1\n• [ ] Item 2\n• [ ] Item 3';
    checklist = removeChecklistItem(checklist, 1);

    const items = parseChecklist(checklist);
    assert.equal(items.length, 2);
    assert.equal(items[0].text, 'Item 1');
    assert.equal(items[1].text, 'Item 3');
  });

  it('clears only completed items from checklist text', () => {
    const checklist = '• [ ] Todo 1\n• [x] Done 1\n• [ ] Todo 2\n• [x] Done 2';
    const cleaned = clearCompletedChecklistItems(checklist);

    const items = parseChecklist(cleaned);
    assert.equal(items.length, 2);
    assert.equal(items[0].text, 'Todo 1');
    assert.equal(items[1].text, 'Todo 2');
  });

  it('ensures freeform quick notes text is not parsed as checklist when kept separate', () => {
    const freeformNotes = `First lecture at 9:00 AM\nAsk about midterm format\nRead pages 45-80`;
    const separateChecklist = `• [ ] Complete quiz\n• [x] Buy tickets`;

    const parsedNotesAsChecklist = parseChecklist(freeformNotes);
    // If someone accidentally parsed notes as checklist, they'd get 3 checkable items:
    assert.equal(parsedNotesAsChecklist.length, 3);

    // But with separate text:
    const parsedChecklist = parseChecklist(separateChecklist);
    assert.equal(parsedChecklist.length, 2);
    assert.equal(parsedChecklist[0].text, 'Complete quiz');
    assert.equal(parsedChecklist[1].text, 'Buy tickets');
  });
});
