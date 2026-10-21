import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { secretDeviceEnvelope, secretDeviceKeySchema } from "./secret-device-keys";

describe("secret device key registration", () => {
  it("rejects malformed and weak keys", () => {
    expect(secretDeviceKeySchema.safeParse({ deviceKeyId: "not-an-id", devicePublicKey: "bad" }).success).toBe(false);
    const key = generateKeyPairSync("rsa", { modulusLength: 1024 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
    expect(secretDeviceKeySchema.safeParse({ deviceKeyId: "6eaa6499-901d-4d18-808f-e04fe5e4e3b5", devicePublicKey: key }).success).toBe(false);
  });
  it("keeps legacy ciphertext readable and never downgrades an incomplete v2 envelope", () => {
    expect(secretDeviceEnvelope(1, null, "wrapped")).toBe("wrapped");
    expect(secretDeviceEnvelope(2, "device", "wrapped")).toBe("secret:v2:device:wrapped");
    expect(() => secretDeviceEnvelope(2, null, "wrapped")).toThrow();
  });
});
