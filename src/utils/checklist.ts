export interface ChecklistItem {
  originalIndex: number;
  text: string;
  isCompleted: boolean;
  raw: string;
}

/**
 * Parses a checklist string (line-by-line) into structured ChecklistItem objects.
 */
export function parseChecklist(checklistText: string): ChecklistItem[] {
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
    .filter((item): item is ChecklistItem => item !== null);
}

/**
 * Appends a new item to the checklist string with unchecked bullet format.
 */
export function addChecklistItem(checklistText: string, newItemText: string): string {
  const trimmed = newItemText.trim();
  if (!trimmed) return checklistText;
  const newLine = `• [ ] ${trimmed}`;
  return checklistText.trim() ? `${checklistText}\n${newLine}` : newLine;
}

/**
 * Toggles the completion state of an item in the checklist by original line index.
 */
export function toggleChecklistItemState(checklistText: string, lineIndex: number): string {
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

/**
 * Removes an item from the checklist by original line index.
 */
export function removeChecklistItem(checklistText: string, lineIndex: number): string {
  const lines = checklistText.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return checklistText;
  lines.splice(lineIndex, 1);
  return lines.join('\n');
}

/**
 * Removes all completed items from the checklist string.
 */
export function clearCompletedChecklistItems(checklistText: string): string {
  const lines = checklistText.split('\n');
  const remaining = lines.filter((line) => !/^(\s*[-*•]\s*\[x\]|\s*\[x\])/i.test(line.trim()));
  return remaining.join('\n');
}
