export type StoryPosition = { groupIndex: number; storyIndex: number; startGroupIndex?: number };

/** Continue through every author once, including when opening your last group. */
export function stepStoryPosition(groups: Array<{ stories: unknown[] }>, position: StoryPosition, direction: 1 | -1): StoryPosition | null {
  const group = groups[position.groupIndex];
  if (!group) return null;
  const storyIndex = position.storyIndex + direction;
  if (storyIndex >= 0 && storyIndex < group.stories.length) return { ...position, storyIndex };
  const start = position.startGroupIndex ?? position.groupIndex;
  if (direction < 0 && position.groupIndex === start) return position;
  for (let offset = 1; offset <= groups.length; offset++) {
    const groupIndex = (position.groupIndex + direction * offset + groups.length) % groups.length;
    if (direction > 0 && groupIndex === start) return null;
    if (groups[groupIndex]?.stories.length) return { ...position, groupIndex, storyIndex: direction > 0 ? 0 : groups[groupIndex].stories.length - 1 };
  }
  return null;
}
