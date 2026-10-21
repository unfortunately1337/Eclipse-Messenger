import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const fake = vi.hoisted(() => ({ verify: vi.fn(), find: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock("./password-check", () => ({ getVerifiedPasswordHash: fake.verify }));
vi.mock("./prisma", () => ({ prisma: { user: { findUnique: fake.find } } }));
vi.mock("./redis", () => ({ redis: { get: fake.get, set: fake.set } }));
import { confirmSessionPassword, requireConfirmedSessionPassword } from "./password-confirmation";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
beforeEach(() => vi.resetAllMocks());
it("creates a five-minute grant only after a correct password and binds it to user and session", async () => {
  fake.verify.mockResolvedValueOnce(null).mockResolvedValueOnce("verified-hash"); fake.set.mockResolvedValue("OK");
  expect(await confirmSessionPassword("alice", "first", "wrong")).toBe(false); expect(fake.set).not.toHaveBeenCalled();
  expect(await confirmSessionPassword("alice", "first", "correct")).toBe(true);
  expect(fake.set).toHaveBeenCalledWith("security:password-confirmed:alice:first", hash("verified-hash"), "EX", 300);
});
it("rejects expired or cross-device confirmation and fails closed for a deleted user", async () => {
  fake.find.mockResolvedValue({ passwordHash: "verified-hash" }); fake.get.mockResolvedValue(null);
  await expect(requireConfirmedSessionPassword("alice", "other")).rejects.toMatchObject({ status: 403 });
  expect(fake.get).toHaveBeenCalledWith("security:password-confirmed:alice:other");
  fake.get.mockResolvedValue(hash("verified-hash")); fake.find.mockResolvedValue(null);
  await expect(requireConfirmedSessionPassword("alice", "first")).rejects.toMatchObject({ status: 403 });
});
it("invalidates a grant immediately when the stored password changes on any worker", async () => {
  fake.get.mockResolvedValue(hash("old")); fake.find.mockResolvedValueOnce({ passwordHash: "old" }).mockResolvedValueOnce({ passwordHash: "new" });
  await expect(requireConfirmedSessionPassword("alice", "device")).resolves.toBe("old");
  await expect(requireConfirmedSessionPassword("alice", "device")).rejects.toMatchObject({ status: 403 });
});
