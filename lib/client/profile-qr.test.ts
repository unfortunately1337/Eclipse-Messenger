import { describe, expect, it } from "vitest";
import { parseProfileQrUrl, profileQrUrl } from "./profile-qr";

describe("profile QR links", () => {
  const origin = "http://localhost:3000";
  it("preserves group/channel type so their codes don't open a user chat", () => {
    for (const kind of ["group", "channel"] as const) {
      const value = profileQrUrl("@example", kind, origin);
      expect(new URL(value).searchParams.get("chatType")).toBe(kind);
      expect(parseProfileQrUrl(value, origin)).toBe(value);
    }
    expect(profileQrUrl("@person", undefined, origin)).toBe(origin + "/app?chat=person");
    expect(parseProfileQrUrl("https://eclpse.ru/invite/abcdef123", origin)).toBe("https://eclpse.ru/invite/abcdef123");
  });
  it("rejects unrelated, executable and action URLs", () => {
    for (const raw of ["", "javascript:alert(1)", "https://evil.test/app?chat=name", "https://eclpse.ru.evil.test/app?chat=x", "https://eclpse.ru:444/app?chat=x", "https://user@eclpse.ru/app?chat=name", "/api/auth/logout", "/app?chat=x&chatType=secret", "//evil.test/app?chat=name", "/\\evil.test/app?chat=name", "/login"]) {
      expect(parseProfileQrUrl(raw, origin), raw).toBeNull();
    }
  });
});
