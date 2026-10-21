import { expect, it, vi } from "vitest";
import { generateSecurePassword } from "./secure-password";

it("generates distinct passwords meeting all required character classes without Math.random", () => {
  const insecure = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("insecure RNG"); });
  try {
    const passwords = new Set(Array.from({ length: 1000 }, generateSecurePassword));
    expect(passwords.size).toBe(1000);
    for (const password of passwords) {
      expect(password).toMatch(/^[a-zA-Z0-9]{15}$/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
    }
  } finally { insecure.mockRestore(); }
});
