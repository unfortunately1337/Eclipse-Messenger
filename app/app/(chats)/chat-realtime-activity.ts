export type LinkActivityState = Record<string, Record<string, string>>;

export function applyRealtimeLinkActivityUpdate(
  prev: LinkActivityState,
  link: string,
  userId: string,
  label: string,
  isActive: boolean,
) {
  const linkState = { ...(prev[link] ?? {}) };
  if (isActive) {
    linkState[userId] = label;
  } else {
    delete linkState[userId];
  }

  if (Object.keys(linkState).length === 0) {
    const next = { ...prev };
    delete next[link];
    return next;
  }

  return { ...prev, [link]: linkState };
}
