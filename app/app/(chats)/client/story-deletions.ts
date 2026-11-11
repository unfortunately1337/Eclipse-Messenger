import type { StoryFeedGroup } from "../types";

const deletedByAccount = new Map<string, Map<string, number>>();
const storageKey = (userId: string) => `eclipse:deleted-stories:${userId}`;

function entries(userId: string) {
  let deleted = deletedByAccount.get(userId);
  if (!deleted) {
    deleted = new Map();
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
      if (Array.isArray(stored)) for (const entry of stored) {
        if (Array.isArray(entry) && typeof entry[0] === "string" && Number.isFinite(entry[1])) deleted.set(entry[0], entry[1]);
      }
    } catch { /* Storage is optional; in-memory deletion still works. */ }
    deletedByAccount.set(userId, deleted);
  }
  for (const [id, expiresAt] of deleted) if (expiresAt <= Date.now()) deleted.delete(id);
  return deleted;
}

export function rememberDeletedStory(userId: string, id: string, expiresAt: string) {
  const deleted = entries(userId);
  deleted.set(id, Math.max(Date.now() + 60_000, Date.parse(expiresAt) || Date.now() + 48 * 3600_000));
  persist(userId, deleted);
}

export function forgetDeletedStory(userId: string, id: string) {
  const deleted = entries(userId);
  deleted.delete(id);
  persist(userId, deleted);
}

function persist(userId: string, deleted: Map<string, number>) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify([...deleted])); } catch { /* Optional. */ }
}

export function filterDeletedStories(userId: string, feed: StoryFeedGroup[]): StoryFeedGroup[] {
  const deleted = entries(userId);
  if (!deleted.size) return feed;
  return feed.flatMap(group => {
    const stories = group.stories.filter(story => !deleted.has(story.id));
    return stories.length ? [stories.length === group.stories.length ? group : { ...group, stories }] : [];
  });
}
