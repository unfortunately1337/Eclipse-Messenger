export type PinChatType = "direct" | "saved" | "eclipse" | "group" | "channel" | "secret";
export type PinScope = { chatType: PinChatType; chatId: string };
export type PinnedMessage = { id: string; createdAt: string; pinnedAt: string };
export type MessagePins = { pins: PinnedMessage[]; canManage: boolean };
export const PINS_UPDATED_EVENT = "eclipse:message-pins-updated";

export function pinScopeKey(scope: PinScope | null) {
  return scope ? `${scope.chatType}:${scope.chatId}` : "";
}

/** At most three vertical segments; the active segment follows a long list proportionally. */
export function pinIndicator(count: number, index: number) {
  const segments = Math.min(3, Math.max(0, count));
  return { segments, active: count <= 1 ? 0 : Math.min(segments - 1, Math.floor(index * segments / count)) };
}
