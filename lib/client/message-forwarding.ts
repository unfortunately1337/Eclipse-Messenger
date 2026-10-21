export const FORWARD_PREFIX = "__eclipse_forward__:";
export type ForwardAuthor = { id?: string; name: string; avatarUrl?: string | null; link?: string; kind?: "user" | "channel" };
export type ForwardedContent = { content: string; author: ForwardAuthor };
export function readForwardedContent(value: string): ForwardedContent | null {
  if (!value.startsWith(FORWARD_PREFIX)) return null;
  try {
    const data = JSON.parse(value.slice(FORWARD_PREFIX.length));
    if (!data || typeof data.content !== "string" || data.content.startsWith(FORWARD_PREFIX) || !data.author || typeof data.author.name !== "string" || !data.author.name.trim() || data.author.name.length > 200) return null;
    const avatar = data.author.avatarUrl;
    return { content: data.content, author: { name: data.author.name,
      ...(data.author.kind === "channel" ? {kind: "channel" as const} : {}),
      ...(typeof data.author.id === "string" ? { id: data.author.id.slice(0, 100) } : {}),
      ...(typeof data.author.link === "string" ? { link: data.author.link.slice(0, 100) } : {}),
      ...(typeof avatar === "string" && /^(\/(?!\/)|https:\/\/)/.test(avatar) ? { avatarUrl: avatar } : {}) } };
  } catch { return null; }
}
export function serializeForwardedContent(content: string, author: ForwardAuthor): string {
  const previous = readForwardedContent(content);
  return FORWARD_PREFIX + JSON.stringify(previous ?? { content, author });
}
export async function copyForwardMedia(content: string, copy: (url: string, kind: "image" | "video" | "voice" | "video_note" | "audio" | "file", name?: string, durationMs?: number) => Promise<string>): Promise<string> {
  const prefix = "__eclipse_media__:";
  if (!content.startsWith(prefix)) return content;
  const data = JSON.parse(content.slice(prefix.length));
  if (data.type === "story_reply") return data.text || "";
  const cache = new Map<string, Promise<string>>();
  const transfer = (url: string, kind: Parameters<typeof copy>[1], name?: string, duration?: number) => {
    if (!url.startsWith("/media/") && !url.startsWith("blob:")) return Promise.resolve(url);
    let result = cache.get(url);
    if (!result) { result = copy(url, kind, name, duration); cache.set(url, result); }
    return result;
  };
  const kind = data.type === "music" ? "audio" : data.type === "video" && data.mode !== "file" ? "video_note" : ["image", "video", "voice", "file"].includes(data.type) ? data.type : "file";
  for (const key of ["src", "url"]) if (typeof data[key] === "string") data[key] = await transfer(data[key], kind, data.name, data.durationMs);
  if (typeof data.coverUrl === "string") data.coverUrl = await transfer(data.coverUrl, "image");
  if (Array.isArray(data.items)) for (const item of data.items) if (typeof item.src === "string") item.src = await transfer(item.src, item.kind === "video" ? "video" : "image", undefined, item.durationMs);
  return prefix + JSON.stringify(data);
}
