import { expect, it } from "vitest";
import { stepStoryPosition, type StoryPosition } from "./story-navigation";
it("continues from your last group to all other authors, then closes", () => {
  const feed = [{ stories: [1] }, { stories: [1, 2] }, { stories: [1] }];
  let position: StoryPosition = { groupIndex: 2, storyIndex: 0, startGroupIndex: 2 };
  for (const [groupIndex, storyIndex] of [[0, 0], [1, 0], [1, 1]]) {
    position = stepStoryPosition(feed, position, 1)!;
    expect(position).toMatchObject({ groupIndex, storyIndex });
  }
  expect(stepStoryPosition(feed, position, 1)).toBeNull();
});
it("goes back within the viewed sequence and skips empty groups", () => {
  const feed = [{ stories: [] }, { stories: [1, 2] }, { stories: [1] }];
  const start = { groupIndex: 2, storyIndex: 0, startGroupIndex: 2 };
  expect(stepStoryPosition(feed, start, -1)).toEqual(start);
  expect(stepStoryPosition(feed, stepStoryPosition(feed, start, 1)!, -1)).toEqual(start);
});
