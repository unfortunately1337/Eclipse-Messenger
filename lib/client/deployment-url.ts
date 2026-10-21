/** Use the origin the user actually opened, including localhost's port. */
export function deploymentUrl(path: string, origin?: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error("Expected an application path");
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "https://eclpse.ru");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid application origin");
  const target = new URL(path, url.origin);
  if (target.origin !== url.origin) throw new Error("Expected a same-origin application path");
  return target.href;
}

export function communityUrl(link: string, kind: "group" | "channel", origin?: string) {
  const query = new URLSearchParams({ chat: link.trim().replace(/^@+/u, ""), chatType: kind });
  return deploymentUrl("/app?" + query, origin);
}

export function profileChatUrl(link: string, origin?: string) {
  return deploymentUrl("/app?chat=" + encodeURIComponent(link.trim().replace(/^@+/u, "")), origin);
}

export function invitationUrl(token: string, origin?: string) {
  return deploymentUrl("/invite/" + encodeURIComponent(token), origin);
}
