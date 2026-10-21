import { expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { HttpError } from "@/lib/server/http";
const mock = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mock.auth }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { $queryRaw: mock.query } }));
import { POST } from "./route";
const request = (body: unknown) => new NextRequest("http://localhost/api/verification", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mock.auth.mockResolvedValue({ user: { id: "viewer" } }); });
it("normalizes and batches flags; absent or inaccessible entities are unverified", async () => {
  mock.query.mockResolvedValue([{ kind: "user", link: "bot", isVerified: true }]);
  const res = await POST(request({ entities: [{ kind: "user", link: "@BOT" }, { kind: "user", link: "bot" }, { kind: "group", link: "private" }] }));
  expect((await res.json()).data.entities).toEqual([{ kind: "user", link: "bot", isVerified: true, emojiStatusId: null }, { kind: "group", link: "private", isVerified: false, emojiStatusId: null }]);
  expect(mock.query).toHaveBeenCalledOnce();
  expect(res.headers.get("Cache-Control")).toBe("private, no-store");
});
it("does not allow a supplied verification flag to grant a badge", async () => {
  mock.query.mockResolvedValue([]);
  const res = await POST(request({ entities: [{ kind: "user", link: "me", isVerified: true }] }));
  expect((await res.json()).data.entities[0].isVerified).toBe(false);
});
it("returns stored user statuses independently of verification and ignores supplied statuses", async () => {
  mock.query.mockResolvedValue([{ kind: "user", link: "peer", isVerified: false, emojiStatusId: "tg-stored" }]);
  const res = await POST(request({ entities: [{ kind: "user", link: "@PEER", emojiStatusId: "tg-forged" }, { kind: "user", link: "absent", emojiStatusId: "tg-forged" }] }));
  expect((await res.json()).data.entities).toEqual([
    { kind: "user", link: "peer", isVerified: false, emojiStatusId: "tg-stored" },
    { kind: "user", link: "absent", isVerified: false, emojiStatusId: null },
  ]);
});
it("rejects secret chat targets and unauthenticated lookups", async () => {
  expect((await POST(request({ entities: [{ kind: "secret", link: "one" }] }))).status).toBe(400);
  mock.auth.mockRejectedValue(new HttpError(401, "Требуется авторизация"));
  expect((await POST(request({ entities: [{ kind: "user", link: "one" }] }))).status).toBe(401);
  expect(mock.query).not.toHaveBeenCalled();
});
