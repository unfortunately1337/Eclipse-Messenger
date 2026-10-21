import { generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";
import { isValidBase64Canonical, isValidKeyPairBase64, isValidPublicKeyBase64, isWrappedPrivateKeyBackupPayloadBase64 } from "@/lib/server/e2e-crypto-validate";

function makeRsaPair() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  return {
    publicKeyBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    privateKeyBase64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  };
}

describe("server e2e crypto validate", () => {
  it("rejects weak RSA keys", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    expect(isValidPublicKeyBase64(publicKey.export({ format: "der", type: "spki" }).toString("base64"))).toBe(false);
  });

  it("validates the complete encrypted backup envelope, not just its prefix", () => {
    const encode = (value: string) => Buffer.from(value).toString("base64");
    const iv = Buffer.alloc(12).toString("base64");
    const cipher = Buffer.alloc(100).toString("base64");
    expect(isWrappedPrivateKeyBackupPayloadBase64(encode(`pwv1:${iv}.${cipher}`))).toBe(true);
    expect(isWrappedPrivateKeyBackupPayloadBase64(encode(`zkv1:${iv}.${cipher}`))).toBe(true);
    expect(isWrappedPrivateKeyBackupPayloadBase64(encode("pwv1:plaintext"))).toBe(false);
    expect(isWrappedPrivateKeyBackupPayloadBase64(encode(`pwv1:${iv}.${cipher}.extra`))).toBe(false);
    expect(isWrappedPrivateKeyBackupPayloadBase64(encode(`pwv1:${Buffer.alloc(16).toString("base64")}.${cipher}`))).toBe(false);
    expect(isWrappedPrivateKeyBackupPayloadBase64(makeRsaPair().privateKeyBase64)).toBe(false);
  });
  it("validates canonical base64", () => {
    expect(isValidBase64Canonical("YWJjZA==")).toBe(true);
    expect(isValidBase64Canonical("YWJjZA")).toBe(false);
    expect(isValidBase64Canonical("not_base64")).toBe(false);
  });

  it("validates RSA public key payload", () => {
    const pair = makeRsaPair();
    expect(isValidPublicKeyBase64(pair.publicKeyBase64)).toBe(true);
    expect(isValidPublicKeyBase64("YWJjZA==")).toBe(false);
  });

  it("validates matching key pair and rejects mismatched", () => {
    const pair1 = makeRsaPair();
    const pair2 = makeRsaPair();
    expect(isValidKeyPairBase64(pair1)).toBe(true);
    expect(
      isValidKeyPairBase64({
        publicKeyBase64: pair1.publicKeyBase64,
        privateKeyBase64: pair2.privateKeyBase64,
      }),
    ).toBe(false);
  });
});
