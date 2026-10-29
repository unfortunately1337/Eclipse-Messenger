export function messageSearchNeedle(query: string) {
  const value = query.trim().toLowerCase();
  return Array.from(value).length >= 3 ? value : "";
}

/** Literal, case-insensitive ranges; user input is never interpreted as a regex. */
export function messageSearchRanges(text: string, query: string) {
  const needle = messageSearchNeedle(query);
  if (!needle) return [];
  const haystack = text.toLowerCase(), ranges: Array<{ start: number; end: number }> = [];
  let offset = 0;
  while (offset < haystack.length && ranges.length < 500) {
    const start = haystack.indexOf(needle, offset);
    if (start < 0) break;
    ranges.push({ start, end: start + needle.length });
    offset = start + needle.length;
  }
  return ranges;
}
