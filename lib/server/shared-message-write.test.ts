import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lock: vi.fn(), group: vi.fn(), channel: vi.fn(), subscriber: vi.fn(), write: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { $transaction: async (callback: (tx: unknown) => unknown) => callback({ $executeRaw: mocks.lock, groupMember: { findUnique: mocks.group }, channel: { findUnique: mocks.channel }, channelSubscriber: { findUnique: mocks.subscriber } }) } }));
import { withSharedMessageEdit } from "./shared-message-write";

describe("editing under the membership lock", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects an author removed between initial API validation and the write", async () => {
    mocks.group.mockResolvedValue(null);
    await expect(withSharedMessageEdit("group", "g", "removed", "removed", mocks.write)).rejects.toThrow("Нет права");
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.group.mock.invocationCallOrder[0]);
  });
  it("allows an authorized channel administrator to edit a departed author's post", async () => {
    mocks.channel.mockResolvedValue({ ownerId: "owner" });
    mocks.subscriber.mockResolvedValue({ role: "admin", canEditForeignMessages: true, canPostMessages: false });
    await withSharedMessageEdit("channel", "c", "admin", "departed", mocks.write);
    expect(mocks.write).toHaveBeenCalledOnce();
  });
  it("rejects revoked channel edit permission before the write", async () => {
    mocks.channel.mockResolvedValue({ ownerId: "owner" });
    mocks.subscriber.mockResolvedValue({ role: "member", canEditForeignMessages: true });
    await expect(withSharedMessageEdit("channel", "c", "demoted", "author", mocks.write)).rejects.toThrow("Нет права");
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
