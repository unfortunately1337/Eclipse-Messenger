import { describe, expect, it } from "vitest";
import { publicEncryptedMessageText } from "./e2e-shared-member";

describe("publicEncryptedMessageText", () => {
  it("returns null when ciphertext is present", () => {
    expect(publicEncryptedMessageText("secret", "cipher")).toBeNull();
    expect(publicEncryptedMessageText("secret", "")).toBe("secret");
  });

  it("returns text when message is not encrypted", () => {
    expect(publicEncryptedMessageText("hello", null)).toBe("hello");
    expect(publicEncryptedMessageText(null, null)).toBeNull();
  });
});
