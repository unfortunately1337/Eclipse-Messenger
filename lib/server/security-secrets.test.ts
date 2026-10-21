import { afterEach, expect, it, vi } from "vitest";
import { hashOtpCode } from "./otp";
import { encryptTotpSecret, decryptTotpSecret } from "./totp";

afterEach(() => vi.unstubAllEnvs());
function productionWithoutKeys() {
  vi.stubEnv("NODE_ENV", "production");
  for (const key of ["EMAIL_CODE_SECRET", "TOTP_ENCRYPTION_KEY", "E2E_DB_ENCRYPTION_KEY", "SESSION_SECRET"]) vi.stubEnv(key, "");
}
it("refuses public fallback secrets in production", () => {
  productionWithoutKeys();
  expect(() => hashOtpCode("123456")).toThrow(/must be configured/);
  expect(() => encryptTotpSecret("secret")).toThrow(/must be configured/);
});
it("preserves existing configured TOTP encryption and rejects tampering", () => {
  productionWithoutKeys();
  vi.stubEnv("TOTP_ENCRYPTION_KEY", "audit-test-secret-key");
  const payload = encryptTotpSecret("example-secret");
  expect(decryptTotpSecret(payload)).toBe("example-secret");
  const parts = payload.split("."); parts[1] = Buffer.alloc(16).toString("base64");
  expect(() => decryptTotpSecret(parts.join("."))).toThrow();
});
