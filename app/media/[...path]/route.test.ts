import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ access: vi.fn(), stream: vi.fn(), session: vi.fn(), uploadedAt: vi.fn() }));
vi.mock("@/lib/server/media-access", () => ({ requireMediaAccess: mocks.access }));
vi.mock("@/lib/server/media-config", () => ({ getMediaStorageConfig: () => ({ bucket: "test" }) }));
vi.mock("@/lib/server/media-meta", () => ({ getMediaUploadedAt: mocks.uploadedAt }));
vi.mock("@/lib/server/session", () => ({ getSessionFromRequest: mocks.session }));
vi.mock("@/lib/server/media-storage", () => ({ getMediaObjectStream: mocks.stream, MediaRangeNotSatisfiableError: class extends Error {} }));
import { GET, HEAD } from "./route";

describe("media delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ ownerId: "owner" });
    mocks.session.mockResolvedValue(null);
    mocks.uploadedAt.mockResolvedValue(new Date("2026-10-03T10:00:00Z"));
    mocks.stream.mockResolvedValue({ body: "file", contentType: "image/svg+xml", contentLength: 4, etag: "etag", cacheControl: "public, max-age=31536000", acceptRanges: "bytes", statusCode: 200 });
  });
  it.each([GET, HEAD])("checks access before fetching or returning conditional responses", async (handler) => {
    mocks.access.mockRejectedValue(new Error("Unauthorized"));
    const req = new NextRequest("http://localhost/media/private", { headers: { "if-none-match": "etag" } });
    expect((await handler(req, { params: Promise.resolve({ path: ["private"] }) })).status).toBe(404);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it.each([GET, HEAD])("overrides upstream public caching and sandboxes active content", async (handler) => {
    const res = await handler(new NextRequest("http://localhost/media/private"), { params: Promise.resolve({ path: ["private"] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
  it.each([GET, HEAD])("does not expose another owner's upload time to authenticated or anonymous viewers", async (handler) => {
    for (const session of [null, { data: { userId: "stranger" } }]) {
      mocks.session.mockResolvedValue(session);
      const res = await handler(new NextRequest("http://localhost/media/avatar"), { params: Promise.resolve({ path: ["avatar"] }) });
      expect(res.status).toBe(200);
      expect(res.headers.get("last-modified")).toBeNull();
      expect(res.headers.get("x-uploaded-at")).toBeNull();
    }
    expect(mocks.uploadedAt).not.toHaveBeenCalled();
  });
  it.each([GET, HEAD])("retains the actual upload time for the file owner", async (handler) => {
    mocks.session.mockResolvedValue({ data: { userId: "owner" } });
    const res = await handler(new NextRequest("http://localhost/media/avatar"), { params: Promise.resolve({ path: ["avatar"] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-uploaded-at")).toBe("2026-10-03T10:00:00.000Z");
    expect(res.headers.get("last-modified")).toBe("Sat, 03 Oct 2026 10:00:00 GMT");
  });
  it.each([GET, HEAD])("keeps public artwork available without exposing dates if the session lookup fails", async (handler) => {
    mocks.session.mockRejectedValue(new Error("Session unavailable"));
    const res = await handler(new NextRequest("http://localhost/media/avatar"), { params: Promise.resolve({ path: ["avatar"] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-uploaded-at")).toBeNull();
    expect(mocks.uploadedAt).not.toHaveBeenCalled();
  });
});
