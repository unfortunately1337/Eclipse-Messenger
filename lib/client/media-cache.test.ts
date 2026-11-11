import { afterEach, describe, expect, it } from "vitest";
import { cacheMediaPreviewDetails, clearMediaBlobCache, getDecodedMediaPreview, getLocalMediaAspectRatio } from "./media-cache";

afterEach(clearMediaBlobCache);

describe("attachment preview dimensions", () => {
  it("enriches an existing poster with the decoded portrait dimensions", () => {
    cacheMediaPreviewDetails("/old-photo", { preview: "poster" });
    cacheMediaPreviewDetails("/old-photo", { aspectRatio: 9 / 16 });
    expect(getDecodedMediaPreview("/old-photo")).toBe("poster");
    expect(getLocalMediaAspectRatio("/old-photo")).toBe(9 / 16);
  });

  it("retains dimensions while a video frame is added later", () => {
    cacheMediaPreviewDetails("/video", { aspectRatio: 16 / 9 });
    cacheMediaPreviewDetails("/video", { preview: "first frame" });
    cacheMediaPreviewDetails("/video", { aspectRatio: Number.NaN });
    expect(getLocalMediaAspectRatio("/video")).toBe(16 / 9);
    expect(getDecodedMediaPreview("/video")).toBe("first frame");
  });

  it("replaces stale dimensions when the actual image has been decoded", () => {
    cacheMediaPreviewDetails("/photo", { aspectRatio: 4 / 3 });
    cacheMediaPreviewDetails("/photo", { aspectRatio: 0.54 });
    expect(getLocalMediaAspectRatio("/photo")).toBe(0.54);
  });
});
