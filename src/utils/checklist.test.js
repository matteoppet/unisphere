import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseChecklist,
  addChecklistItem,
  toggleChecklistItemState,
  removeChecklistItem,
  clearCompletedChecklistItems,
  sanitizeGoalItem,
  normalizeGoalsList,
  sortGoalsForDisplay,
  upsertGoalItem,
  toggleGoalCompletion,
  deleteGoalItem,
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

describe('Dashboard Goals data model and sanitization', () => {
  it('sanitizes goal items, strips XSS tags, and defaults empty tag to Skill', () => {
    const item = sanitizeGoalItem({
      id: 'goal-1',
      title: '<script>evil()</script>Learn derivatives',
      tag: '   ',
      completed: false,
      createdAt: 1700000000000,
    });
    assert.deepEqual(item, {
      id: 'goal-1',
      title: 'Learn derivatives',
      tag: 'Skill',
      completed: false,
      createdAt: 1700000000000,
    });
    assert.equal('completedAt' in item, false);
    assert.equal(sanitizeGoalItem({ title: '<script>alert(1)</script>' }), null);
  });

  it('migrates legacy multiline checklist strings and JSON strings into structured goals', () => {
    const migrated = normalizeGoalsList('• [ ] Learn CAD\n• [x] Master limit proofs');
    assert.equal(migrated.length, 2);
    assert.equal(migrated[0].title, 'Learn CAD');
    assert.equal(migrated[0].completed, false);
    assert.equal(migrated[0].tag, 'Skill');
    assert.equal(migrated[1].title, 'Master limit proofs');
    assert.equal(migrated[1].completed, true);

    const fromJson = normalizeGoalsList(
      JSON.stringify([{ id: 'g-json', title: 'Learn derivatives', tag: 'Analisi 1', completed: false, createdAt: 123 }])
    );
    assert.equal(fromJson.length, 1);
    assert.equal(fromJson[0].id, 'g-json');
    assert.equal(fromJson[0].tag, 'Analisi 1');
  });

  it('sorts active goals before completed goals while preserving relative order', () => {
    const sorted = sortGoalsForDisplay([
      { id: 'g1', title: 'Master limit proofs', tag: 'Analisi 1', completed: true, createdAt: 1 },
      { id: 'g2', title: 'Learn derivatives', tag: 'Analisi 1', completed: false, createdAt: 2 },
      { id: 'g3', title: 'Learn CAD', tag: 'Skill', completed: false, createdAt: 3 },
    ]);
    assert.deepEqual(
      sorted.map((g) => g.id),
      ['g2', 'g3', 'g1']
    );
  });

  it('upserts, toggles completion without undefined fields, deletes, and caps at 500 items', () => {
    let list = upsertGoalItem([], {
      id: 'g1',
      title: 'Create this game',
      tag: 'Project',
      completed: false,
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].tag, 'Project');

    list = toggleGoalCompletion(list, 'g1', 1700000005000);
    assert.equal(list[0].completed, true);
    assert.equal(list[0].completedAt, 1700000005000);

    list = toggleGoalCompletion(list, 'g1', 1700000009000);
    assert.equal(list[0].completed, false);
    assert.equal('completedAt' in list[0], false);

    list = upsertGoalItem(list, {
      id: 'g1',
      title: 'Create 3D game',
      tag: 'Skill',
      completed: true,
    });
    assert.equal(list[0].title, 'Create 3D game');
    assert.equal(list[0].tag, 'Skill');
    assert.equal(list[0].completed, true);

    list = deleteGoalItem(list, 'g1');
    assert.equal(list.length, 0);

    const oversized = Array.from({ length: 520 }, (_, i) => ({
      id: `g-${i}`,
      title: `Goal ${i}`,
      tag: 'Skill',
    }));
    assert.equal(normalizeGoalsList(oversized).length, 500);
  });

  it('wires the Dashboard Goals card and Add/Edit/Delete Goal modal across HTML, CSS, and app.js', () => {
    for (const htmlFile of ['index.html', 'pages/dashboard.html']) {
      const content = fs.readFileSync(path.resolve(htmlFile), 'utf8');
      assert.ok(content.includes('id="dash-goals-card"'), `${htmlFile} must include #dash-goals-card`);
      assert.ok(content.includes('id="btn-dash-add-goal"'), `${htmlFile} must include #btn-dash-add-goal`);
      assert.ok(content.includes('id="dash-goals-list"'), `${htmlFile} must include #dash-goals-list`);
      assert.ok(content.includes('id="modal-goal"'), `${htmlFile} must include #modal-goal`);
      assert.ok(content.includes('id="form-goal"'), `${htmlFile} must include #form-goal`);
      assert.ok(content.includes('id="goal-title"'), `${htmlFile} must include #goal-title`);
      assert.match(content, /<select[^>]*id="goal-type"/, `${htmlFile} must include <select id="goal-type"> to choose Personal Skill or Course`);
      assert.ok(content.includes('id="goal-course-row"'), `${htmlFile} must include #goal-course-row`);
      assert.match(content, /<select[^>]*id="goal-course"/, `${htmlFile} must include a separate <select id="goal-course"> menu for courses`);
      assert.ok(content.includes('id="goal-completed"'), `${htmlFile} must include #goal-completed`);
      assert.ok(content.includes('id="btn-delete-goal"'), `${htmlFile} must include #btn-delete-goal`);
    }

    const cssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf8');
    assert.match(cssContent, /\.goals-list\s*\{/);
    assert.match(cssContent, /\.goal-item\s*\{/);
    assert.match(cssContent, /\.goal-item\.goal-completed\s+\.goal-title\s*\{[^}]*text-decoration:\s*line-through/s);
    assert.match(cssContent, /\.goal-tag-badge\s*\{/);

    const appContent = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
    assert.ok(appContent.includes('dash-goals-list'), 'app.js must populate #dash-goals-list');
    assert.ok(appContent.includes('openGoalModal'), 'app.js must define openGoalModal');
    assert.ok(appContent.includes('syncGoalModalFields'), 'app.js must define syncGoalModalFields to toggle course dropdown visibility');
    assert.ok(appContent.includes('data-open-goal'), 'app.js must handle data-open-goal');
    assert.ok(appContent.includes('data-toggle-goal'), 'app.js must handle data-toggle-goal');
  });

  it('guards #btn-dash-add-goal against duplicate listener binding, checks !dialog.open before showModal, and separates Personal Skill from the Course dropdown menu', () => {
    const appContent = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
    assert.ok(
      appContent.includes("getElementById('goal-type')"),
      'app.js must read #goal-type selector'
    );
    assert.ok(
      appContent.includes("getElementById('goal-course')"),
      'app.js must read #goal-course selector'
    );
    assert.ok(
      appContent.includes("getElementById('goal-course-row')"),
      'app.js must toggle #goal-course-row visibility'
    );
    assert.match(
      appContent,
      /function openGoalModal[\s\S]*?if\s*\(\s*!dialog\.open\s*\)\s*\{\s*dialog\.showModal\(\);\s*\}/,
      'openGoalModal must guard dialog.showModal() with if (!dialog.open)'
    );
    assert.match(
      appContent,
      /const addGoalBtn = document\.getElementById\('btn-dash-add-goal'\);\s*if\s*\(\s*addGoalBtn\s*&&\s*!boundElements\.has\(addGoalBtn\)\s*\)/,
      'bindDynamicViewEvents must guard #btn-dash-add-goal with boundElements'
    );
  });
});
