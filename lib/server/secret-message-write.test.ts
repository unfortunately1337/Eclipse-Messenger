import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  lock: vi.fn(), chat: vi.fn(), message: vi.fn(), create: vi.fn(),
}));
vi.mock("./prisma", () => ({ prisma: { $transaction: async (work: (tx: unknown) => unknown) => work({
  $queryRaw: mocks.lock, secretChat: { findUnique: mocks.chat },
  secretChatMessage: { findUnique: mocks.message, create: mocks.create },
}) } }));
import { writeSecretMessage } from "./secret-message-write";
const input = { chatId: "chat", userId: "alice", sessionId: "accepted", messageId: "message", textEnc: "ciphertext" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.chat.mockResolvedValue({ id: "chat", cryptoVersion: 2, isApproved: true, expiresAt: new Date(Date.now() + 60_000), participants: [
    { userId: "alice", acceptedSessionId: "accepted", deviceKeyId: "alice-key", devicePublicKey: "alice-public" },
    { userId: "bob", acceptedSessionId: "bob-session", deviceKeyId: "bob-key", devicePublicKey: "bob-public" },
  ] });
  mocks.message.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "message" });
});
describe("secret message transaction", () => {
  it("rechecks expiration after acquiring the chat lock", async () => {
    mocks.chat.mockResolvedValue({ expiresAt: new Date(0), participants: [], isApproved: true });
    await expect(writeSecretMessage(input)).rejects.toMatchObject({ status: 404 });
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("denies a session revoked before the transaction", async () => {
    await expect(writeSecretMessage({ ...input, sessionId: "different" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns an identical retry without adding another message", async () => {
    const existing = { id: input.messageId, secretChatId: input.chatId, senderId: input.userId, textEnc: input.textEnc };
    mocks.message.mockResolvedValue(existing);
    const result = await writeSecretMessage(input);
    expect(result.message).toEqual(existing);
    expect(result.isNew).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects another chat's ID and changed ciphertext without returning that message", async () => {
    for (const changes of [{ secretChatId: "another-chat" }, { senderId: "bob" }, { textEnc: "changed" }]) {
      mocks.message.mockResolvedValue({ secretChatId: input.chatId, senderId: input.userId, textEnc: input.textEnc, ...changes });
      await expect(writeSecretMessage(input)).rejects.toMatchObject({ status: 409 });
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("maps a concurrent cross-chat unique-ID collision to a conflict", async () => {
    mocks.create.mockRejectedValue({ code: "P2002" });
    await expect(writeSecretMessage(input)).rejects.toMatchObject({ status: 409 });
  });
});
