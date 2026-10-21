import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ get: vi.fn(), cas: vi.fn(), del: vi.fn() }));
vi.mock("./redis", () => ({ redis: { get: mock.get, compareAndSet: mock.cas, del: mock.del } }));
import { consumePendingTotpSecret, consumeMfaChallenge, getPendingTotpSecret } from "./mfa";
import { NextRequest } from "next/server";
import { MFA_COOKIE_NAME } from "./constants";
beforeEach(() => vi.resetAllMocks());
it("does not consume a newly generated QR secret after validating the older one", async () => {
  mock.get.mockResolvedValue("new-secret");
  expect(await consumePendingTotpSecret("user", "old-secret")).toBeNull();
  expect(mock.cas).not.toHaveBeenCalled(); expect(mock.del).not.toHaveBeenCalled();
});
it("claims a valid pending secret once and detects a parallel change", async () => {
  mock.get.mockResolvedValue("secret"); mock.cas.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await consumePendingTotpSecret("user", "secret")).toBe("secret");
  expect(await consumePendingTotpSecret("user", "secret")).toBeNull();
});

it("allows only one simultaneous consumer of a login challenge", async () => {
  mock.get.mockResolvedValue("user-id");
  let claimed = false;
  mock.cas.mockImplementation(async () => { if (claimed) return false; claimed = true; return true; });
  const req = new NextRequest("https://eclpse.ru/api/auth/login/mfa", { headers: { cookie: `${MFA_COOKIE_NAME}=challenge` } });
  const results = await Promise.all(Array.from({ length: 10 }, () => consumeMfaChallenge(req)));
  expect(results.filter(Boolean)).toEqual([{ challengeId: "challenge", userId: "user-id" }]);
  expect(mock.del).not.toHaveBeenCalled();
});
it("keeps unfinished setup isolated between devices", async () => {
  mock.get.mockImplementation(async (key: string) => key === "mfa:setup:user:first" ? "first-secret" : null);
  expect(await getPendingTotpSecret("user", "first")).toBe("first-secret");
  expect(await getPendingTotpSecret("user", "second")).toBeNull();
  expect(await consumePendingTotpSecret("user", "first-secret", "second")).toBeNull();
  expect(mock.cas).not.toHaveBeenCalled();
});
