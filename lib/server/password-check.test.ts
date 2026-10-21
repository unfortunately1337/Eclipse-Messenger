import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ find: vi.fn(), verify: vi.fn(), rate: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { user: { findUnique: mock.find } } }));
vi.mock("argon2", () => ({ default: { verify: mock.verify } }));
vi.mock("./rate-limit", () => ({ enforceRateLimit: mock.rate }));
import { verifyCurrentPassword } from "./password-check";
beforeEach(() => vi.resetAllMocks());
it("uses the current stored password on every attempt, including across workers", async () => {
  mock.find.mockResolvedValueOnce({ passwordHash: "old" }).mockResolvedValueOnce({ passwordHash: "new" });
  mock.verify.mockResolvedValue(true);
  await verifyCurrentPassword("user", "password"); await verifyCurrentPassword("user", "password");
  expect(mock.verify.mock.calls.map(args => args[0])).toEqual(["old", "new"]);
});
it("blocks excessive attempts before database work or expensive hashing", async () => {
  mock.rate.mockRejectedValue({ status: 429 });
  await expect(verifyCurrentPassword("user", "password")).rejects.toMatchObject({ status: 429 });
  expect(mock.find).not.toHaveBeenCalled(); expect(mock.verify).not.toHaveBeenCalled();
});
it("rejects deleted accounts or a corrupt stored hash", async () => {
  mock.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ passwordHash: "invalid" });
  mock.verify.mockRejectedValue(new Error("invalid hash"));
  expect(await verifyCurrentPassword("user", "password")).toBe(false);
  expect(await verifyCurrentPassword("user", "password")).toBe(false);
});
