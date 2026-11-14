export const GROUP_CALL_MAIN_LIMIT = 8;
export const GROUP_CALL_OVERFLOW_ROW = 72;

export function orderedGroupCallIds(ids: string[], previous: string[]) {
  const present = new Set(ids), retained = previous.filter(id => present.has(id));
  const known = new Set(retained);
  return [...retained, ...ids.filter(id => !known.has(id))];
}

/** Bring newly speaking, hidden participants into the current viewport without scrolling it. */
export function promoteHiddenGroupSpeakers(ids: string[], speakers: string[], top: number, height: number, rowHeight = GROUP_CALL_OVERFLOW_ROW) {
  if (height <= 0) return ids;
  const hidden = new Set(speakers.filter(id => {
    const index = ids.indexOf(id), y = index * rowHeight;
    return index >= 0 && (y + rowHeight - 8 <= top || y >= top + height);
  }));
  if (!hidden.size) return ids;
  const lifted = ids.filter(id => hidden.has(id)), others = ids.filter(id => !hidden.has(id));
  const target = Math.min(others.length, Math.max(0, Math.ceil(top / rowHeight)));
  return [...others.slice(0, target), ...lifted, ...others.slice(target)];
}

export function groupCallOverflowWindow(total: number, top: number, height: number, rowHeight = GROUP_CALL_OVERFLOW_ROW) {
  const start = Math.max(0, Math.floor(top / rowHeight) - 2);
  return { start, end: Math.min(total, Math.ceil((top + height) / rowHeight) + 2) };
}
