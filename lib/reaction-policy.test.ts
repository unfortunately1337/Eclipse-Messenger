import { describe, expect, it } from "vitest";
import { AVAILABLE_REACTIONS, availableReactions, canonicalReaction, isReactionAllowed, normalizeAllowedReactions, quickReactions } from "./reaction-policy";

describe("community reaction policy", () => {
  it("keeps existing communities unrestricted and disables every addition in none mode", () => {
    expect(availableReactions()).toEqual(AVAILABLE_REACTIONS);
    expect(availableReactions({ reactionMode: "none", allowedReactions: ["❤️"] })).toEqual([]);
    expect(isReactionAllowed({ reactionMode: "none" }, "🔥")).toBe(false);
  });
  it("compares variation selectors consistently and only allows the selected emoji", () => {
    const policy = { reactionMode: "some", allowedReactions: ["❤️"] };
    expect(isReactionAllowed(policy, "❤")).toBe(true);
    expect(isReactionAllowed(policy, "👍")).toBe(false);
    expect(availableReactions(policy)).toEqual(["❤️"]);
    expect(availableReactions({ reactionMode: "some" })).toEqual([]);
  });
  it("surfaces allowed reactions outside the normal quick set", () => {
    expect(quickReactions({ reactionMode: "some", allowedReactions: ["👻"] }, ["❤️", "👍"])).toEqual(["👻"]);
    expect(quickReactions({ reactionMode: "none" }, ["❤️"])).toEqual([]);
    expect(quickReactions(undefined, ["❤️", "👍"])).toEqual(["❤️", "👍"]);
  });
  it("canonicalizes and deduplicates the supported selection", () => {
    expect(normalizeAllowedReactions(["❤", "❤️", "👍", "invalid"])).toEqual(["❤️", "👍"]);
    expect(canonicalReaction("invalid")).toBeUndefined();
  });
});
