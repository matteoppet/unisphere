export function parseChecklist(checklistText) {
  if (!checklistText || !checklistText.trim()) return [];
  const lines = checklistText.split('\n');
  return lines
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const isCompleted = /^(\s*[-*•]\s*\[x\]|\s*\[x\])/i.test(trimmed);
      const isTodo = /^(\s*[-*•]\s*\[\s\]|\s*\[\s\])/i.test(trimmed);
      const isBullet = /^(\s*[-*•]\s*)/.test(trimmed) && !isTodo && !isCompleted;

      let cleanText = trimmed;
      if (isCompleted) {
        cleanText = trimmed.replace(/^(\s*[-*•]\s*\[x\]|\s*\[x\])\s*/i, '');
      } else if (isTodo) {
        cleanText = trimmed.replace(/^(\s*[-*•]\s*\[\s\]|\s*\[\s\])\s*/i, '');
      } else if (isBullet) {
        cleanText = trimmed.replace(/^(\s*[-*•]\s*)\s*/, '');
      }

      return {
        originalIndex: index,
        text: cleanText,
        isCompleted,
        raw: trimmed,
      };
    })
    .filter((item) => item !== null);
}

export function addChecklistItem(checklistText, newItemText) {
  const trimmed = String(newItemText || '').trim();
  if (!trimmed) return checklistText;
  const newLine = `• [ ] ${trimmed}`;
  return checklistText.trim() ? `${checklistText}\n${newLine}` : newLine;
}

export function toggleChecklistItemState(checklistText, lineIndex) {
  const lines = checklistText.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return checklistText;
  const targetLine = lines[lineIndex];
  const isCompleted = /^(\s*[-*•]\s*\[x\]|\s*\[x\])/i.test(targetLine);

  if (isCompleted) {
    lines[lineIndex] = targetLine.replace(/\[x\]/i, '[ ]');
  } else if (/^(\s*[-*•]\s*\[\s\]|\s*\[\s\])/i.test(targetLine)) {
    lines[lineIndex] = targetLine.replace(/\[\s\]/i, '[x]');
  } else if (/^(\s*[-*•]\s*)/.test(targetLine)) {
    lines[lineIndex] = targetLine.replace(/^(\s*[-*•]\s*)/, '• [x] ');
  } else {
    lines[lineIndex] = `• [x] ${targetLine}`;
  }

  return lines.join('\n');
}

export function removeChecklistItem(checklistText, lineIndex) {
  const lines = checklistText.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return checklistText;
  lines.splice(lineIndex, 1);
  return lines.join('\n');
}

export function clearCompletedChecklistItems(checklistText) {
  const lines = checklistText.split('\n');
  const remaining = lines.filter((line) => !/^(\s*[-*•]\s*\[x\]|\s*\[x\])/i.test(line.trim()));
  return remaining.join('\n');
}

const MAX_GOALS_COUNT = 500;

function cleanGoalText(value, maxLength = 150) {
  let str = String(value ?? '');
  str = str.replace(/[\u0000-\u001F\u007F]/g, ' ');
  str = str.replace(/<(script|style|iframe|object|embed|applet)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  str = str.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  str = str.replace(/\s+/g, ' ');
  return str.trim().slice(0, maxLength);
}

/**
 * Sanitizes a single Goal item object.
 * Never sets `completedAt: undefined` so Firestore `setDoc()` never throws.
 */
export function sanitizeGoalItem(raw, fallbackIndex = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const title = cleanGoalText(raw.title ?? raw.text, 150);
  if (!title) return null;

  const tag = cleanGoalText(raw.tag ?? raw.courseName ?? raw.category, 60) || 'Skill';
  const completed = Boolean(raw.completed ?? raw.isCompleted);
  const id = cleanGoalText(raw.id, 80) || `goal-${Date.now()}-${fallbackIndex}`;
  const createdAt =
    typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : Date.now();

  const item = {
    id,
    title,
    tag,
    completed,
    createdAt,
  };

  if (completed) {
    const completedAt =
      typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt)
        ? raw.completedAt
        : createdAt;
    item.completedAt = completedAt;
  }

  return item;
}

/**
 * Normalizes a goals list from an Array, JSON string, or legacy multiline checklist string.
 * Caps the returned list at 500 items to comply with `firestore.rules`.
 */
export function normalizeGoalsList(rawChecklist) {
  if (!rawChecklist) return [];

  if (Array.isArray(rawChecklist)) {
    return rawChecklist
      .map((item, idx) => sanitizeGoalItem(item, idx))
      .filter(Boolean)
      .slice(0, MAX_GOALS_COUNT);
  }

  if (typeof rawChecklist === 'string') {
    const trimmed = rawChecklist.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item, idx) => sanitizeGoalItem(item, idx))
            .filter(Boolean)
            .slice(0, MAX_GOALS_COUNT);
        }
      } catch {
        // Fall through to legacy multiline checklist parser
      }
    }

    const legacyItems = parseChecklist(trimmed);
    const now = Date.now();
    return legacyItems
      .map((entry, idx) =>
        sanitizeGoalItem(
          {
            id: `goal-legacy-${idx + 1}`,
            title: entry.text,
            tag: 'Skill',
            completed: entry.isCompleted,
            createdAt: now + idx,
          },
          idx
        )
      )
      .filter(Boolean)
      .slice(0, MAX_GOALS_COUNT);
  }

  return [];
}

/**
 * Returns a new array of goals sorted with active (uncompleted) goals first
 * and completed goals below, preserving relative order within each group.
 */
export function sortGoalsForDisplay(goals) {
  const list = normalizeGoalsList(goals);
  const active = [];
  const completed = [];
  for (const goal of list) {
    if (goal.completed) {
      completed.push(goal);
    } else {
      active.push(goal);
    }
  }
  return [...active, ...completed];
}

/**
 * Inserts a new goal or updates an existing goal by `id`.
 */
export function upsertGoalItem(goals, draft) {
  const list = normalizeGoalsList(goals);
  const existing = draft?.id ? list.find((g) => g.id === draft.id) : null;
  const sanitized = sanitizeGoalItem({
    ...existing,
    ...draft,
    id: existing?.id || cleanGoalText(draft?.id, 80) || `goal-${Date.now()}`,
    createdAt: existing?.createdAt ?? draft?.createdAt ?? Date.now(),
  });
  if (!sanitized) return list;

  if (existing) {
    return list.map((g) => (g.id === existing.id ? sanitized : g)).slice(0, MAX_GOALS_COUNT);
  }
  return [sanitized, ...list].slice(0, MAX_GOALS_COUNT);
}

/**
 * Toggles the `completed` status of a goal by `id`, omitting `completedAt` when unchecked.
 */
export function toggleGoalCompletion(goals, goalId, nowMs = Date.now()) {
  const list = normalizeGoalsList(goals);
  if (!goalId) return list;
  return list.map((goal, idx) => {
    if (goal.id !== goalId) return goal;
    const nextCompleted = !goal.completed;
    return sanitizeGoalItem(
      {
        ...goal,
        completed: nextCompleted,
        completedAt: nextCompleted ? nowMs : undefined,
      },
      idx
    );
  });
}

/**
 * Removes a goal by `id`.
 */
export function deleteGoalItem(goals, goalId) {
  const list = normalizeGoalsList(goals);
  if (!goalId) return list;
  return list.filter((goal) => goal.id !== goalId);
}
