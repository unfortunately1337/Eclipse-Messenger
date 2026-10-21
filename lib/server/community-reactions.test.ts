import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ entity: vi.fn(), member: vi.fn(), update: vi.fn(), recipients: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { $transaction: (run: (tx: unknown) => unknown) => run({
  group: { findUnique: mocks.entity, update: mocks.update }, channel: { findUnique: mocks.entity, update: mocks.update },
  groupMember: { findUnique: mocks.member, findMany: mocks.recipients }, channelSubscriber: { findUnique: mocks.member, findMany: mocks.recipients },
}) } }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/server/media-artwork", () => ({ grantCommunityArtwork: vi.fn() }));
vi.mock("@/lib/server/chat-list", () => ({ invalidateChatListPayloadCache: vi.fn() }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeChannels: vi.fn(), userPrivateChannel: (id: string) => id }));
import { communitySettingsSchema, updateCommunitySettings } from "./community-settings";

describe.each(["group", "channel"] as const)("%s reaction management", kind => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.entity.mockResolvedValue({ id: "community", ownerId: "owner", link: "private-id", isPublic: false, reactionMode: "all", allowedReactions: [] });
    mocks.member.mockResolvedValue({ role: "member", canChangeName: false });
    mocks.update.mockImplementation(({ data }) => Promise.resolve({ ...data, ownerId: "owner", link: "private-id" }));
  });
  it("permits only the owner or an admin with the dedicated reactions permission", async () => {
    const payload = { reactionMode: "some" as const, allowedReactions: ["❤️"] };
    await expect(updateCommunitySettings(kind, "reader", "private-id", payload)).rejects.toThrow("изменение реакций");
    expect(mocks.update).not.toHaveBeenCalled();
    await expect(updateCommunitySettings(kind, "owner", "private-id", payload)).resolves.toMatchObject(payload);
    mocks.member.mockResolvedValue({ role: "admin", canChangeName: true, canChangeReactions: false });
    await expect(updateCommunitySettings(kind, "admin", "private-id", payload)).rejects.toThrow("изменение реакций");
    mocks.member.mockResolvedValue({ role: "admin", canChangeName: false, canChangeReactions: true });
    await expect(updateCommunitySettings(kind, "admin", "private-id", payload)).resolves.toMatchObject(payload);
  });
  it("does not let a reactions admin change community information or an ordinary member edit reactions", async () => {
    mocks.member.mockResolvedValue({ role: "admin", canChangeName: false, canChangeReactions: true });
    await expect(updateCommunitySettings(kind, "admin", "private-id", { name: "Changed", reactionMode: "none" })).rejects.toThrow("названия");
    mocks.member.mockResolvedValue({ role: "member", canChangeReactions: true });
    await expect(updateCommunitySettings(kind, "reader", "private-id", { allowedReactions: ["❤️"] })).rejects.toThrow("изменение реакций");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects an empty some selection and unsupported emoji", async () => {
    await expect(updateCommunitySettings(kind, "owner", "private-id", { reactionMode: "some", allowedReactions: [] })).rejects.toThrow("хотя бы одну");
    expect(communitySettingsSchema.safeParse({ reactionMode: "some", allowedReactions: ["invalid"] }).success).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("normalizes duplicate variation selectors before persisting", async () => {
    const payload = communitySettingsSchema.parse({ reactionMode: "some", allowedReactions: ["❤", "❤️"] });
    await updateCommunitySettings(kind, "owner", "private-id", payload);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { reactionMode: "some", allowedReactions: ["❤️"] } }));
  });
});
