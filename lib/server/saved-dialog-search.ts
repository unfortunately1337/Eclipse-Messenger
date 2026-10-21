export function matchesSavedDialogQuery(rawQuery: string) {
  const normalized = rawQuery.trim().replace(/\s+/gu, " ").toLowerCase();
  if (!normalized) return false;
  const compact = normalized.replace(/\s+/gu, "");
  return (
    "избранное".startsWith(compact) ||
    "saved".startsWith(compact) ||
    "favorites".startsWith(compact)
  );
}
