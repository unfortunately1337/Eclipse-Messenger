import { describe, expect, it } from "vitest";
import { createReactionSummarySnapshot } from "./reaction-summary";
describe("reaction realtime snapshot", () => {
  it("personalizes each recipient without sharing their reacted state", () => {
    const summary = createReactionSummarySnapshot([
      { emoji: "🔥", userId: "a", user: { avatarUrl: "/a" } },
      { emoji: "🔥", userId: "b", user: { avatarUrl: "/b" } },
      { emoji: "❤️", userId: "c", user: { avatarUrl: "/c" } },
    ], true);
    expect(summary("a")).toEqual([{ emoji: "🔥", count: 2, reacted: true, avatarUrl: null }, { emoji: "❤️", count: 1, reacted: false, avatarUrl: "/c" }]);
    expect(summary("c")[1].reacted).toBe(true);
    expect(summary("stranger").every(reaction => !reaction.reacted)).toBe(true);
  });
  it("does not attach personal avatars to channel reaction summaries", () => {
    expect(createReactionSummarySnapshot([{ emoji: "🔥", userId: "a", user: { avatarUrl: "/a" } }], false)("a")[0]).not.toHaveProperty("avatarUrl");
  });
});
