export function formatAccountUnreadCount(value: number | undefined): string | null {
  if (!Number.isFinite(value) || !value || value < 1) return null;
  const count = Math.floor(value);
  return count > 9999 ? "9999+" : String(count);
}
