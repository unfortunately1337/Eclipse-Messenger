import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ rows: vi.fn(), mget: vi.fn(), set: vi.fn(), privacy: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: async () => ({ user: { id: "viewer" } }) }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { user: { findMany: mock.rows } } }));
vi.mock("@/lib/server/redis", () => ({ redis: { mget: mock.mget, set: mock.set } }));
vi.mock("@/lib/server/privacy-settings", async original => ({ ...await original<typeof import("@/lib/server/privacy-settings")>(), getPrivacySettingsBatch: mock.privacy }));
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/server/privacy-settings";
import { POST } from "./route";
const ids = Array.from({ length: 200 }, (_, i) => `peer-${i}`);
const rows = ids.map(id => ({ id, link: id, link2: `alias-${id}`, displayName: id, avatarUrl: null, createdAt: new Date(), presenceVisibility: "all" }));
const request = () => new NextRequest("http://localhost/api/profiles", { method: "POST", body: JSON.stringify({ userIds: ids }) });
beforeEach(() => {
  vi.resetAllMocks(); mock.set.mockResolvedValue("OK"); mock.rows.mockResolvedValue(rows);
  mock.mget.mockResolvedValue(ids.map(() => null));
  mock.privacy.mockResolvedValue(new Map(ids.map(id => [id, { ...DEFAULT_PRIVACY_SETTINGS, contactUserIds: [], onlineVisibility: "none", hideUsername: true }])));
});
it("loads 200 previews with one profile query, one cache read and one privacy batch", async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  const profiles = (await response.json()).data.profiles;
  expect(profiles).toHaveLength(200); expect(mock.rows).toHaveBeenCalledOnce(); expect(mock.mget).toHaveBeenCalledOnce(); expect(mock.privacy).toHaveBeenCalledOnce();
  expect(profiles.every((p: { presenceVisibility: string; secondaryLinks: string[]; usernameHidden: boolean }) => p.presenceVisibility === "none" && p.usernameHidden && !p.secondaryLinks.length)).toBe(true);
});
it("rechecks privacy for cached previews and rejects a profile cached under another ID", async () => {
  mock.mget.mockResolvedValue(rows.map((row, i) => JSON.stringify({ ...row, id: i === 0 ? "foreign-id" : row.id, secondaryLinks: [row.link2], createdAt: row.createdAt.toISOString() })));
  mock.rows.mockResolvedValue([rows[0]]);
  const response = await POST(request()); const profiles = (await response.json()).data.profiles;
  expect(mock.rows.mock.calls[0][0].where.id.in).toEqual([ids[0]]); expect(mock.privacy).toHaveBeenCalledOnce();
  expect(profiles.some((p: { id: string }) => p.id === "foreign-id")).toBe(false);
  expect(profiles.every((p: { presenceVisibility: string }) => p.presenceVisibility === "none")).toBe(true);
});
it("returns an error rather than cached private data when privacy storage fails", async () => {
  mock.privacy.mockRejectedValue(new Error("privacy offline"));
  expect((await POST(request())).status).toBe(500);
});
