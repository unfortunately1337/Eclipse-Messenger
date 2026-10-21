import { expect, it } from "vitest";
import { extractLoginQrToken, extractLoginQrSecret } from "./login-qr-token";
const token = "00000000-0000-4000-8000-000000000001";
it("accepts the login QR payload and trusted login URLs", () => {
  for (const value of [token, `eclipse://login?token=${token}`, `https://eclpse.ru/login?qrToken=${token}`]) {
    expect(extractLoginQrToken(value, "https://eclpse.ru")).toBe(token);
  }
});
it("reads device-transfer secrets only from the fragment of a trusted login QR", () => {
  const secret = "a".repeat(43);
  expect(extractLoginQrSecret(`eclipse://login?token=${token}#key=${secret}`, "https://eclpse.ru")).toBe(secret);
  expect(extractLoginQrSecret(`https://foreign.test/login?token=${token}#key=${secret}`, "https://eclpse.ru")).toBeNull();
  expect(extractLoginQrSecret(`eclipse://login?token=${token}&key=${secret}`, "https://eclpse.ru")).toBeNull();
  expect(extractLoginQrSecret(`eclipse://login?token=${token}#key=invalid`, "https://eclpse.ru")).toBeNull();
});
it("does not approve an unrelated QR that happens to contain a UUID", () => {
  for (const value of [`https://foreign.test/login?token=${token}`, `https://eclpse.ru/profile/${token}`, `hello ${token}`, "not a token"])
    expect(extractLoginQrToken(value, "https://eclpse.ru")).toBeNull();
});
