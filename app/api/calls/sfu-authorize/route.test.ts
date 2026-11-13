import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ verify: vi.fn(), authorize: vi.fn() }));
vi.mock("@/lib/server/livekit", () => ({ verifyCallJoinToken: mock.verify }));
vi.mock("@/lib/server/calls", () => ({ authorizeSfuIdentity: mock.authorize }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mock.verify.mockResolvedValue({ id: "call", identity: "opaque" }); });
it("accepts only verified RTC tokens whose participant is still authorized", async () => {
  const response = await GET(new NextRequest("https://example.com/api/calls/sfu-authorize", { headers: { "x-forwarded-uri": "/rtc?access_token=synthetic" } }));
  expect(response.status).toBe(200);
  expect(mock.verify).toHaveBeenCalledWith("synthetic");
  expect(mock.authorize).toHaveBeenCalledWith("call", "opaque");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rejects missing, forged and formerly authorized tokens without leaking them", async () => {
  expect((await GET(new NextRequest("https://example.com/api/calls/sfu-authorize"))).status).toBe(403);
  expect(mock.verify).not.toHaveBeenCalled();
  mock.verify.mockRejectedValueOnce(new Error("Invalid secret token"));
  const request = () => new NextRequest("https://example.com/api/calls/sfu-authorize", { headers: { authorization: "Bearer synthetic" } });
  expect(await (await GET(request())).text()).toBe("");
  expect(mock.authorize).not.toHaveBeenCalled();
  mock.authorize.mockRejectedValueOnce(new Error("Removed participant"));
  expect((await GET(request())).status).toBe(403);
});
