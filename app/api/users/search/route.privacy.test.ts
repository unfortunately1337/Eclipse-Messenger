import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ users: vi.fn(), groups: vi.fn(), channels: vi.fn(), privacy: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: async () => ({ user: { id: "viewer" } }) }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findMany: fake.users }, group: { findMany: fake.groups }, channel: { findMany: fake.channels } } }));
vi.mock("@/lib/server/redis", () => ({ redis: { get: fake.get, set: fake.set } }));
vi.mock("@/lib/server/privacy-settings", () => ({ getPrivacySettingsBatch: fake.privacy, getPrivacyDisplayName: (_a: string, _b: string, name: string) => name }));
import { GET } from "./route";
const candidate = { id: "subject", link: "auditpeer", displayName: "Example name", isBot: false, avatarUrl: null };
beforeEach(() => {
  vi.resetAllMocks(); fake.get.mockResolvedValue(null); fake.set.mockResolvedValue("OK");
  fake.users.mockResolvedValue([candidate]); fake.groups.mockResolvedValue([]); fake.channels.mockResolvedValue([]);
});
const search = () => GET(new NextRequest("https://eclpse.ru/api/users/search?q=auditpeer"));
it("hides candidates if privacy storage fails instead of assuming public visibility", async () => {
  fake.privacy.mockRejectedValue(new Error("offline"));
  const res = await search(); expect(res.status).toBe(200);
  expect((await res.json()).data.users).toEqual([]);
  expect(fake.set).not.toHaveBeenCalled();
});
it("loads ranked candidate privacy in a single batch", async () => {
  fake.users.mockResolvedValue([candidate, { ...candidate, id: "subject2", link: "auditpeer2" }]);
  fake.privacy.mockResolvedValue(new Map([["subject", { showInGlobalSearch: true, allowUsernameSearch: true }]]));
  const res = await search();
  expect((await res.json()).data.users.map((u: { id: string }) => u.id)).toEqual(["subject"]);
  expect(fake.privacy).toHaveBeenCalledTimes(1);
  expect(fake.privacy).toHaveBeenCalledWith(["subject", "subject2"]);
});
it("rechecks privacy for cached results and hides a group that is now private", async () => {
  fake.get.mockResolvedValue(JSON.stringify({ users: [candidate], groups: [{ id: "private-group" }], channels: [], saved: [] }));
  fake.privacy.mockResolvedValue(new Map([["subject", { showInGlobalSearch: false }]]));
  const res = await search(); const data = (await res.json()).data;
  expect(data.users).toEqual([]); expect(data.groups).toEqual([]);
  expect(fake.groups).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["private-group"] }, isPublic: true } }));
});
it("finds the built-in Eclipse bot by @username without any conversation history", async () => {
  fake.users.mockResolvedValue([]);
  fake.privacy.mockResolvedValue(new Map());
  const res = await GET(new NextRequest("https://eclpse.ru/api/users/search?q=%40eclipse"));
  expect(res.status).toBe(200);
  expect((await res.json()).data.eclipse).toEqual([expect.objectContaining({ link: "eclipse", isSystem: true, isVerified: true })]);
});
