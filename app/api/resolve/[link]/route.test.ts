import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ cache: vi.fn(), group: vi.fn(), channel: vi.fn(), session: vi.fn(), privacy: vi.fn() }));
vi.mock("@/lib/server/redis", () => ({ redis: { get: fake.cache } }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { group: { findFirst: fake.group }, channel: { findFirst: fake.channel } } }));
vi.mock("@/lib/server/session", () => ({ getSessionFromRequest: fake.session }));
vi.mock("@/lib/server/privacy-settings", () => ({ getPrivacySettings: fake.privacy, shouldHideUsername: (_a: string, _b: string, settings: { hideUsername: boolean }) => settings.hideUsername }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); fake.session.mockResolvedValue(null); });
const resolve = () => GET(new NextRequest("https://eclpse.ru/api/resolve/example"), { params: Promise.resolve({ link: "example" }) });
it.each(["group", "channel"])("does not expose a cached private %s to a stranger", async kind => {
  fake.cache.mockResolvedValue(JSON.stringify({ type: kind, [kind]: { id: "private", link: "example", name: "Hidden" } }));
  fake.group.mockResolvedValue(null); fake.channel.mockResolvedValue(null);
  expect((await resolve()).status).toBe(404);
});
it("allows a member to resolve a private group but checks current membership", async () => {
  fake.cache.mockResolvedValue(JSON.stringify({ type: "group", group: { id: "private", link: "example" } }));
  fake.session.mockResolvedValue({ data: { userId: "member" } }); fake.group.mockResolvedValue({ id: "private" });
  expect((await resolve()).status).toBe(200);
  expect(fake.group).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "private", OR: [{ isPublic: true }, { ownerId: "member" }, { members: { some: { userId: "member" } } }] } }));
  fake.group.mockResolvedValue(null);
  expect((await resolve()).status).toBe(404);
});
it("honors changed profile-link privacy and strips hidden usernames from cached profiles", async () => {
  fake.cache.mockResolvedValue(JSON.stringify({ type: "user", user: { id: "subject", link: "example", secondaryLinks: ["alias"] } }));
  fake.privacy.mockResolvedValue({ allowProfileLink: false });
  expect((await resolve()).status).toBe(404);
  fake.privacy.mockResolvedValue({ allowProfileLink: true, hideUsername: true });
  const data = (await (await resolve()).json()).data;
  expect(data.user.link).toBe(""); expect(data.user.secondaryLinks).toEqual([]);
});
