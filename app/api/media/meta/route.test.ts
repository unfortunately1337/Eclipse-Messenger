import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), uploadedAt: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mocks.auth }));
vi.mock("@/lib/server/media-access", () => ({ requireMediaAccess: mocks.access }));
vi.mock("@/lib/server/media-meta", () => ({ getMediaUploadedAt: mocks.uploadedAt }));
import { GET } from "./route";

describe("media upload time privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "viewer" } });
    mocks.access.mockResolvedValue({ ownerId: "owner" });
    mocks.uploadedAt.mockResolvedValue(new Date("2026-10-03T10:00:00Z"));
  });
  it("withholds foreign upload times even when the artwork itself is accessible", async () => {
    const res = await GET(new NextRequest("http://localhost/api/media/meta?url=/media/avatar"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { uploadedAt: null } });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.uploadedAt).not.toHaveBeenCalled();
  });
  it("returns the actual date to the owner after checking file access", async () => {
    mocks.access.mockResolvedValue({ ownerId: "viewer" });
    const res = await GET(new NextRequest("http://localhost/api/media/meta?url=/media/avatar"));
    expect(await res.json()).toEqual({ ok: true, data: { uploadedAt: "2026-10-03T10:00:00.000Z" } });
    expect(mocks.access).toHaveBeenCalledWith(expect.anything(), "avatar");
    expect(mocks.access.mock.invocationCallOrder[0]).toBeLessThan(mocks.uploadedAt.mock.invocationCallOrder[0]);
  });
});
