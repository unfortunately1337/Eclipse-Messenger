import { describe, expect, it } from "vitest";
import type { StoryFeedGroup, StoryFeedItem } from "../types";
import { filterDeletedStories, forgetDeletedStory, rememberDeletedStory } from "./story-deletions";

const story = (id: string): StoryFeedItem => ({ id, mediaUrl: "/media/test.jpg", mediaType: "image", caption: null,
  createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  viewed: false, isMine: true, viewsCount: 0, viewersPreview: [], likedByMe: false, likesCount: 0 });
const group = (id: string, ...ids: string[]): StoryFeedGroup => ({ author: { id, link: id, displayName: id }, hasUnviewed: false, stories: ids.map(story) });

describe("deleted stories", () => {
  it("rejects a delayed server response and removes empty groups", () => {
    const feed = [group("other", "other-story"), group("self", "deleted")];
    rememberDeletedStory("account", "deleted", feed[1]!.stories[0]!.expiresAt);
    expect(filterDeletedStories("account", feed)).toEqual([feed[0]]);
    expect(filterDeletedStories("account", structuredClone(feed))).toEqual([feed[0]]);
    expect(filterDeletedStories("different-account", feed)).toBe(feed);
    forgetDeletedStory("account", "deleted");
    expect(filterDeletedStories("account", feed)).toBe(feed);
  });

  it("removes only the deleted item, independent of pending-story group indexes", () => {
    const feed = [group("self", "new-upload", "deleted", "keep"), group("other", "other-story")];
    rememberDeletedStory("another-account", "deleted", feed[0]!.stories[1]!.expiresAt);
    const filtered = filterDeletedStories("another-account", feed);
    expect(filtered[0]!.stories.map(item => item.id)).toEqual(["new-upload", "keep"]);
    expect(filtered[1]).toBe(feed[1]);
    expect(feed[0]!.stories).toHaveLength(3);
    forgetDeletedStory("another-account", "deleted");
  });
});
