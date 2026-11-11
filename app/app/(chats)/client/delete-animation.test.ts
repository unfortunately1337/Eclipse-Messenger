import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AnimateDeleteMessageActionContext } from "./recording-actions";
import type { ConversationChatType, DecryptedMessage } from "../types";
import type { MessageDeletionShift } from "./message-deletion-layout";
const fake = vi.hoisted(() => ({ start: vi.fn(() => 680), cancel: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/client/message-dissolve", () => ({ startMessageDissolve: fake.start, cancelMessageDissolve: fake.cancel, finishMessageDissolve: vi.fn() }));
vi.mock("@/lib/client/http", () => ({ apiRequest: fake.api }));
import { animateDeleteMessageAction, finalizePendingSelectionDeleteAction } from "./recording-actions";
import { deleteSelectedMessagesAction, type DeleteSelectedMessagesActionContext } from "./message-actions";

const messages: DecryptedMessage[] = Array.from({ length: 4 }, (_, index) => ({ id: `server-${index}`, senderId: "self", text: "text", createdAt: new Date(index * 1000).toISOString() }));
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup() {
  let visible = [...messages], removing = new Set<string>(), shift: MessageDeletionShift | null = null;
  const timers: Record<string, NodeJS.Timeout> = {};
  const context = {
    markMessageDeletedTombstone: vi.fn(), syncConversationCacheMessages: vi.fn(), selectedLinkRef: { current: "peer" }, activeConversationRef: { current: { chatType: "direct" } },
    messages, messageOffsets: { offsets: [0, 50, 120, 160], totalHeight: 220 }, messageSizes: [50, 70, 40, 60], messageHeightsRef: { current: {} },
    deleteAnimationTimersRef: { current: timers }, sanitizeMessages: (value: DecryptedMessage[]) => value, updateLastMessagePreviewAfterDelete: vi.fn(),
    setMessages: (value: React.SetStateAction<DecryptedMessage[]>) => { visible = typeof value === "function" ? value(visible) : value; },
    setRemovingMessageIds: (value: React.SetStateAction<Set<string>>) => { removing = typeof value === "function" ? value(removing) : value; },
    setDeletingShift: (value: React.SetStateAction<MessageDeletionShift | null>) => { shift = typeof value === "function" ? value(shift) : value; },
  } as unknown as AnimateDeleteMessageActionContext;
  return { context, timers, visible: () => visible, removing: () => removing, shift: () => shift };
}
it("animates selected rows together and removes them in one history update after the dust finishes", () => {
  const state = setup();
  animateDeleteMessageAction(state.context, ["server-0", "server-2"], "peer");
  expect(fake.start.mock.calls).toEqual([["server-0"], ["server-2"]]);
  expect(state.context.markMessageDeletedTombstone).toHaveBeenCalledOnce();
  expect(state.context.markMessageDeletedTombstone).toHaveBeenCalledWith(["server-0", "server-2"]);
  expect(state.visible()).toHaveLength(4);
  expect([...state.removing()]).toEqual(["server-0", "server-2"]);
  expect(state.shift()?.rows).toEqual([{ id: "server-0", index: 0, height: 50 }, { id: "server-2", index: 2, height: 40 }]);
  vi.advanceTimersByTime(679); expect(state.visible()).toHaveLength(4);
  vi.advanceTimersByTime(1); expect(state.visible().map(message => message.id)).toEqual(["server-1", "server-3"]);
  expect(state.context.updateLastMessagePreviewAfterDelete).toHaveBeenCalledOnce();
  expect(state.shift()).toBeNull(); expect(state.removing().size).toBe(0);
});
it("does not delete a restored failed row when other members of its batch finish animating", () => {
  const state = setup(); animateDeleteMessageAction(state.context, ["server-0", "server-2"], "peer");
  delete state.timers["server-0"]; // A rejected DELETE cancels only this row's membership.
  vi.advanceTimersByTime(680);
  expect(state.visible().map(message => message.id)).toEqual(["server-0", "server-1", "server-3"]);
});
it("starts the shared effect from Select → Delete → Confirm instead of filtering the bubbles immediately", async () => {
  const state = setup(), finalize = vi.fn().mockResolvedValue(undefined);
  const context = {
    activeChat: { link: "peer", chatType: "direct" }, selectedMessages: [messages[0], messages[2]], selectionDeleting: false,
    setMessageHelperId: vi.fn(), setSelectionDeleteDialogOpen: vi.fn(), pendingSelectionDeleteRef: { current: null }, finalizePendingSelectionDelete: finalize,
    messages, locallyHiddenMessageIds: new Set(), sanitizeMessages: state.context.sanitizeMessages, setMessages: state.context.setMessages,
    syncConversationCacheMessages: state.context.syncConversationCacheMessages, updateLastMessagePreviewAfterDelete: vi.fn(), clearSelectionMode: vi.fn(),
    animateDeleteMessages: (ids: string[], link: string, type: ConversationChatType) => animateDeleteMessageAction(state.context, ids, link, type),
  } as unknown as DeleteSelectedMessagesActionContext;
  await deleteSelectedMessagesAction(context);
  expect(fake.start).toHaveBeenCalledTimes(2); expect(state.visible()).toHaveLength(4); expect(finalize).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(680); expect(state.visible()).toHaveLength(2);
});
it("does not send local failed drafts to the server's bulk deletion path", async () => {
  const pending = { messageIds: ["local-uuid"], link: "peer", chatType: "direct" as const, previousMessages: [{ ...messages[0], id: "local-uuid", sendFailure: { kind: "rate_limit" as const, retryAt: 0 } }], previousHiddenMessageIds: [], mode: "everyone" as const };
  await finalizePendingSelectionDeleteAction({ pendingSelectionDeleteRef: { current: pending }, setSelectionDeleting: vi.fn(), rollbackPendingSelectionDelete: vi.fn(), setErrorText: vi.fn(), t: text => text });
  expect(fake.api).not.toHaveBeenCalled();
});
