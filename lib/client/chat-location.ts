/** Both current messenger URLs and legacy notification links identify chats by link. */
export function chatIdFromLocation(pathname: string, search = ""): string | null {
  if (pathname === "/app" || pathname === "/app/") {
    return new URLSearchParams(search).get("chat")?.trim().toLowerCase() || null;
  }
  const match = pathname.match(/^\/chat\/([^/]+)\/?$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]).trim().toLowerCase() || null; }
  catch { return null; }
}

export function withoutChatLocation(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete("chat");
  params.delete("chatType");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
