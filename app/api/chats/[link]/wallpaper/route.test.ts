import { NextRequest } from "next/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), peer: vi.fn(), existing: vi.fn(), create: vi.fn(), privacy: vi.fn(), allowed: vi.fn(), owned: vi.fn(), update: vi.fn(), message: vi.fn(), rate: vi.fn(), grant: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mock.auth }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findFirst: mock.peer }, conversationParticipant: { update: mock.update }, message: { create: mock.message }, mediaAssetAccess: { upsert: mock.grant } } }));
vi.mock("@/lib/server/chat", () => ({ findDirectConversation: mock.existing, getOrCreateDirectConversation: mock.create }));
vi.mock("@/lib/server/privacy-settings", () => ({ getPrivacySettings: mock.privacy, canUserStartConversation: mock.allowed }));
vi.mock("@/lib/server/owned-media", () => ({ requireOwnedPublicMedia: mock.owned }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: mock.rate }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeEvent: vi.fn(), userPrivateChannel: vi.fn() }));
import { POST } from "./route";
const send = (body = { wallpaperUrl: "/wallpapers/stock.png", wallpaperPosY: 50, notifyPeer: false }) => POST(new NextRequest("http://localhost/api/chats/peer/wallpaper", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ link: "peer" }) });
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); mock.auth.mockResolvedValue({ user: { id: "sender" } }); mock.peer.mockResolvedValue({ id: "peer" }); mock.allowed.mockReturnValue(false); mock.existing.mockResolvedValue(null); });
afterEach(() => vi.restoreAllMocks());
it("does not create a conversation or system message when new messages are forbidden", async () => {
  expect((await send()).status).toBe(403);
  expect(mock.privacy).toHaveBeenCalledWith("peer"); expect(mock.allowed).toHaveBeenCalledWith("sender", "peer", undefined);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled(); expect(mock.message).not.toHaveBeenCalled();
});
it("preserves wallpaper changes in an existing conversation", async () => {
  mock.existing.mockResolvedValue("conversation");
  expect((await send()).status).toBe(200);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.update).toHaveBeenCalled();
});
it("rejects a foreign attachment before creating a permitted new conversation", async () => {
  mock.allowed.mockReturnValue(true); mock.owned.mockRejectedValue({ status: 403, message: "Foreign file" });
  expect((await send({ wallpaperUrl: "/media/foreign", wallpaperPosY: 50, notifyPeer: false })).status).toBe(403);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
});
it("returns 404 for missing users and 400 for invalid wallpaper positions", async () => {
  mock.peer.mockResolvedValue(null); expect((await send()).status).toBe(404);
  expect((await send({ wallpaperUrl: null as unknown as string, wallpaperPosY: 101, notifyPeer: false })).status).toBe(400);
});
