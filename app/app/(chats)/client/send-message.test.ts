import { beforeEach, expect, it, vi } from "vitest";
import type { DecryptedMessage } from "../types";
import type { SendPreparedMessageActionContext } from "./send-message";
import { ApiRequestError } from "@/lib/client/api-error";
import { clearMessageCooldowns } from "@/lib/client/message-send-limit";
const fake = vi.hoisted(() => ({ api: vi.fn(), save: vi.fn(), remove: vi.fn(), outgoing: new Map<string, DecryptedMessage>() }));
vi.mock("@/lib/client/http", () => ({ apiRequest: fake.api }));
vi.mock("@/lib/client/failed-message-store", () => ({
  peekOutgoingMessage: (id: string) => fake.outgoing.get(id),
  rememberOutgoingMessage: (message: DecryptedMessage) => fake.outgoing.set(message.id, message),
  forgetOutgoingMessage: (id: string) => fake.outgoing.delete(id),
  removeFailedMessage: fake.remove,
  saveFailedMessage: fake.save,
}));
import { sendPreparedMessageAction } from "./send-message";
const payload = "__eclipse_media__:sticker:uploaded-file";
const draft: DecryptedMessage = { id: "optimistic:one", localId: "optimistic:one", senderId: "alice", text: payload, createdAt: "2026-11-11T09:41:00Z", pending: true };
function setup() {
  let messages = [draft];
  const errors = vi.fn();
  const context = {
    activeChat: { link: "importbot", chatType: "direct" }, activeConversation: { chatType: "direct", peer: { isBot: true } },
    selfId: "alice", currentUserIdRef: { current: "alice" }, selectedLinkRef: { current: "importbot" },
    t: (text: string) => text, replyToMessageId: null, beginMessageSend: vi.fn(), endMessageSend: vi.fn(),
    setMessages: (update: React.SetStateAction<DecryptedMessage[]>) => { messages = typeof update === "function" ? update(messages) : update; },
    setErrorText: errors, sanitizeMessages: (value: DecryptedMessage[]) => value,
    setMessageText: vi.fn(), setReplyToMessageId: vi.fn(), setStoryReplyTarget: vi.fn(),
    setPendingImage: vi.fn(), setPendingVideo: vi.fn(), setPendingAudio: vi.fn(), setPendingFile: vi.fn(), setPendingMediaBatch: vi.fn(),
    isMessageMarkedDeleted: () => false, openConversationRef: { current: vi.fn() },
  } as unknown as SendPreparedMessageActionContext;
  fake.outgoing.set(draft.id, draft);
  return { context, messages: () => messages, errors };
}
beforeEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); fake.outgoing.clear(); clearMessageCooldowns(); fake.save.mockResolvedValue(undefined); fake.remove.mockResolvedValue(undefined); vi.spyOn(Date, "now").mockReturnValue(60_000); });
const limited = () => new ApiRequestError("wait", 429, { code: "MESSAGE_RATE_LIMIT", retryAfterSeconds: 5, scope: "chat" });
it("keeps the original bubble and shows a rate failure immediately even when persistence is stalled", async () => {
  const state = setup(); fake.api.mockRejectedValue(limited()); fake.save.mockReturnValue(new Promise(() => {}));
  await expect(sendPreparedMessageAction(state.context, payload, { optimisticMessageId: draft.id, throwOnError: true })).resolves.toBeUndefined();
  expect(state.messages()).toHaveLength(1);
  expect(state.messages()[0]).toMatchObject({ id: draft.id, localId: draft.localId, createdAt: draft.createdAt, text: payload, pending: false, sendFailure: { kind: "rate_limit", retryAt: 65_000 } });
  expect(state.errors.mock.calls).toEqual([[null]]);
  expect(state.context.endMessageSend).toHaveBeenCalledOnce();
});
it("blocks another send locally during the cooldown and preserves the manual retry id on confirmation", async () => {
  const state = setup(); fake.api.mockRejectedValueOnce(limited());
  await sendPreparedMessageAction(state.context, payload, { optimisticMessageId: draft.id });
  await sendPreparedMessageAction(state.context, payload, { optimisticMessageId: draft.id });
  expect(fake.api).toHaveBeenCalledOnce();
  vi.spyOn(Date, "now").mockReturnValue(65_000);
  fake.api.mockResolvedValueOnce({ message: { id: "server-one", senderId: "alice", createdAt: "2026-11-11T09:42:00Z" } });
  await sendPreparedMessageAction(state.context, payload, { optimisticMessageId: draft.id, resetComposer: false });
  expect(JSON.parse(fake.api.mock.calls[1][1].body).requestId).toBe(draft.id);
  expect(state.messages()).toHaveLength(1);
  expect(state.messages()[0]).toMatchObject({ id: "server-one", localId: draft.id, pending: false, sendFailure: undefined, createdAt: draft.createdAt });
  expect(fake.remove).toHaveBeenCalledWith(draft.id);
});
it("keeps an unsuccessful manual retry available when the network fails", async () => {
  const state = setup(); fake.api.mockRejectedValueOnce(limited());
  await sendPreparedMessageAction(state.context, payload, { optimisticMessageId: draft.id });
  vi.spyOn(Date, "now").mockReturnValue(65_000); fake.api.mockRejectedValueOnce(new Error("offline"));
  await sendPreparedMessageAction(state.context, payload, { optimisticMessageId: draft.id });
  expect(state.messages()).toHaveLength(1);
  expect(state.messages()[0].sendFailure?.kind).toBe("rate_limit");
  expect(state.messages()[0].pending).toBe(false);
});
it("does not add an old account's failed message to the newly selected account", async () => {
  const state = setup();
  fake.api.mockImplementationOnce(async () => { state.context.currentUserIdRef.current = "bob"; throw limited(); });
  await sendPreparedMessageAction(state.context, payload, { optimisticMessageId: draft.id });
  expect(fake.save).not.toHaveBeenCalled();
  expect(state.messages()[0].sendFailure).toBeUndefined();
});
