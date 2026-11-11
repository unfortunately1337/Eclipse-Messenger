import type { ConversationMessagesProps } from "./ConversationMessages";

export type MessageRowProps = {
  row: ConversationMessagesProps["renderedMessages"][number];
  shared: ConversationMessagesProps;
};

/** Virtual windows allocate new row objects. Compare their layout and content,
 * not the window's identity; event/render functions still participate normally. */
export function areMessageRowPropsEqual(previous: MessageRowProps, next: MessageRowProps, keys: readonly (keyof ConversationMessagesProps)[]) {
  const a = previous.row, b = next.row;
  const system = a.message.systemPayload && a.message.systemPayload.botRole !== "user";
  if (a.message !== b.message || a.index !== b.index || (system && a.top !== b.top) ||
      a.chainWithPrevious !== b.chainWithPrevious || a.chainWithNext !== b.chainWithNext ||
      a.showDateSeparator !== b.showDateSeparator || a.rowSpacingClassName !== b.rowSpacingClassName) return false;
  return keys.every(key => {
    if (key === "deletingShift") return true;
    if (key === "removingMessageIds") return previous.shared.removingMessageIds.has(a.message.id) === next.shared.removingMessageIds.has(b.message.id);
    return Object.is(previous.shared[key], next.shared[key]);
  });
}
