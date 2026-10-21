import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptAtRest, decryptAtRest } from "./db-crypto";
afterEach(() => vi.unstubAllEnvs());
describe("production encryption key configuration", () => {
  it("does not silently encrypt with a publicly known fallback key", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const name of ["E2E_DB_ENCRYPTION_KEY", "E2E_BACKUP_ENCRYPTION_KEY", "MEDIA_ENCRYPTION_KEY", "SESSION_SECRET"]) vi.stubEnv(name, "");
    expect(() => encryptAtRest("private")).toThrow("must be configured");
  });
  it("roundtrips with a configured key", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("E2E_DB_ENCRYPTION_KEY", "isolated-test-key-only");
    const stored = encryptAtRest("private");
    expect(stored).not.toContain("private");
    expect(decryptAtRest(stored)).toBe("private");
  });
});
