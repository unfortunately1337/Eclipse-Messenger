export function matchesEclipseDialogQuery(rawQuery: string) {
  const normalized = rawQuery.trim().replace(/^@+/u, "").replace(/\s+/gu, " ").toLowerCase();
  if (!normalized) return false;
  const compact = normalized.replace(/\s+/gu, "");
  return (
    "eclipse".startsWith(compact) ||
    "эклипс".startsWith(compact) ||
    "еклипс".startsWith(compact) ||
    "служб".startsWith(compact) ||
    "поддерж".startsWith(compact) ||
    "уведом".startsWith(compact)
  );
}
