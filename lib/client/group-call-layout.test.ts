import { describe, expect, it } from "vitest";
import { groupCallOverflowWindow, orderedGroupCallIds, promoteHiddenGroupSpeakers } from "./group-call-layout";

describe("group call overflow layout", () => {
  it("retains promoted positions, drops departed people and appends new arrivals", () => {
    expect(orderedGroupCallIds(["a", "c", "d"], ["c", "b", "a"])).toEqual(["c", "a", "d"]);
  });
  it("brings a hidden speaker to the visible window without changing scroll position", () => {
    expect(promoteHiddenGroupSpeakers(["a", "b", "c", "d", "e", "f"], ["f"], 144, 144)).toEqual(["a", "b", "f", "c", "d", "e"]);
  });
  it("does not reorder speakers who are already visible", () => {
    const ids = ["a", "b", "c", "d"];
    expect(promoteHiddenGroupSpeakers(ids, ["b"], 72, 144)).toBe(ids);
    expect(promoteHiddenGroupSpeakers(ids, ["d"], 0, 0)).toBe(ids);
  });
  it("renders only a small viewport window even for a large room", () => {
    expect(groupCallOverflowWindow(1000, 720, 288)).toEqual({ start: 8, end: 16 });
  });
  it("uses the measured miniature card height for scrolling and speaker promotion", () => {
    expect(groupCallOverflowWindow(100, 300, 150, 50)).toEqual({ start: 4, end: 11 });
    expect(promoteHiddenGroupSpeakers(["a", "b", "c", "d", "e", "f"], ["f"], 100, 100, 50)).toEqual(["a", "b", "f", "c", "d", "e"]);
  });
});
