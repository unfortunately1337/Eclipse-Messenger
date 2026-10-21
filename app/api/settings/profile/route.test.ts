import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn(), privacy: vi.fn(), savePrivacy: vi.fn(), after: vi.fn(), del: vi.fn(), invalidate: vi.fn() }));
const user = { id: "profile-owner", link: "profile_owner", displayName: "Before", description: "Before description", avatarUrl: "/legacy/custom.png", backgroundUrl: null, musicUrl: null, musicTitle: null, musicAuthor: null, musicCoverUrl: null, createdAt: new Date(), updatedAt: new Date() };
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: async () => ({ user }), invalidateUserCache: vi.fn() }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findUnique: mocks.read, update: mocks.update } } }));
vi.mock("@/lib/server/privacy-settings", () => ({ getPrivacySettings: mocks.privacy, savePrivacySettings: mocks.savePrivacy }));
vi.mock("@/lib/server/redis", () => ({ redis: { del: mocks.del } }));
vi.mock("@/lib/server/chat-list", () => ({ invalidateChatListPayloadCache: mocks.invalidate }));
import { PATCH } from "./route";
import { EMOJI_STATUS_CATALOG } from "@/lib/emoji-status";
const req = (data: unknown) => new NextRequest("http://localhost/api/settings/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
beforeEach(() => { vi.resetAllMocks(); mocks.privacy.mockResolvedValue({ hideUsername: true }); mocks.del.mockResolvedValue(1); mocks.invalidate.mockResolvedValue(undefined); });

it("preserves two simultaneous edits to different profile fields", async () => {
  let saved = { ...user };
  mocks.read.mockImplementation(async () => ({ ...saved }));
  mocks.update.mockImplementation(async ({ data }) => { await new Promise(resolve => setTimeout(resolve, 10)); saved = { ...saved, ...data }; return { ...saved }; });
  const responses = await Promise.all([PATCH(req({ displayName: "New name" })), PATCH(req({ description: "New description" }))]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  expect(saved).toMatchObject({ displayName: "New name", description: "New description" });
  expect((await responses[1].json()).data.usernameHidden).toBe(true);
  expect(mocks.after).toHaveBeenCalledTimes(2);
});

it("does not confirm a privacy setting before its storage write finishes", async () => {
  mocks.read.mockResolvedValue(user); mocks.update.mockResolvedValue(user);
  let finish!: () => void;
  mocks.savePrivacy.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  let completed = false;
  const saving = PATCH(req({ usernameHidden: false })).then(response => { completed = true; return response; });
  await vi.waitFor(() => expect(mocks.savePrivacy).toHaveBeenCalledOnce());
  expect(completed).toBe(false); finish();
  const response = await saving; expect(response.status).toBe(200);
  expect((await response.json()).data.usernameHidden).toBe(false);
});

it("returns an error if the privacy write fails", async () => {
  mocks.read.mockResolvedValue(user); mocks.update.mockResolvedValue(user);
  mocks.savePrivacy.mockRejectedValue(new Error("storage unavailable"));
  expect((await PATCH(req({ usernameHidden: false }))).status).toBe(500);
});

it("saves and clears a catalog status without overwriting the name", async () => {
  mocks.read.mockResolvedValue(user);
  mocks.update.mockImplementation(async ({ data }) => ({ ...user, ...data }));
  const id = EMOJI_STATUS_CATALOG[0].id;
  const saved = await PATCH(req({ emojiStatusId: id }));
  expect(saved.status).toBe(200);
  expect((await saved.json()).data.emojiStatusId).toBe(id);
  expect(mocks.update.mock.calls[0][0].data).toEqual({ emojiStatusId: id });
  const cleared = await PATCH(req({ emojiStatusId: null }));
  expect(cleared.status).toBe(200);
  expect((await cleared.json()).data.emojiStatusId).toBeNull();
});

it.each(["../../secret", "https://example.com/emoji.gif", "missing-emoji"])("rejects unknown status %s before writing", async id => {
  const response = await PATCH(req({ emojiStatusId: id }));
  expect(response.status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
