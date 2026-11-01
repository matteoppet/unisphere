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
