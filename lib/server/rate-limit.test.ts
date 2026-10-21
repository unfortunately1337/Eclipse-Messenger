import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ incrementWithExpiry: vi.fn(), consumeRollingLimit: vi.fn(), ttl: vi.fn() }));
vi.mock("./redis", () => ({ redis: mocks }));
import { enforceRateLimit, enforceRollingRateLimit } from "./rate-limit";
describe("shared request limits", () => {
  beforeEach(() => vi.clearAllMocks());
  it("blocks a limit reached on another worker", async () => {
    mocks.incrementWithExpiry.mockResolvedValue(11); mocks.ttl.mockResolvedValue(20);
    await expect(enforceRateLimit({ key: "login", limit: 10, windowSeconds: 60 })).rejects.toMatchObject({ status: 429, details: { retryAfterSeconds: 20 } });
  });
  it("does not allow unlimited requests when Redis is unavailable", async () => {
    mocks.incrementWithExpiry.mockRejectedValue(new Error("offline"));
    await expect(enforceRateLimit({ key: "login", limit: 10, windowSeconds: 60 })).rejects.toMatchObject({ status: 503 });
  });
  it("keeps a rolling quota after deletion and reports when the oldest reservation expires", async () => {
    mocks.consumeRollingLimit.mockResolvedValueOnce(0).mockResolvedValueOnce(3600);
    await enforceRollingRateLimit({ key: "stories", limit: 6, windowSeconds: 172800 });
    await expect(enforceRollingRateLimit({ key: "stories", limit: 6, windowSeconds: 172800 })).rejects.toMatchObject({ status: 429, details: { retryAfterSeconds: 3600 } });
  });
  it("fails closed when the shared rolling quota is unavailable", async () => {
    mocks.consumeRollingLimit.mockRejectedValue(new Error("offline"));
    await expect(enforceRollingRateLimit({ key: "stories", limit: 6, windowSeconds: 172800 })).rejects.toMatchObject({ status: 503 });
  });
});
