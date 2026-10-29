import { expect, it, vi } from "vitest";
vi.mock("./prisma", () => ({ prisma: {} }));
vi.mock("./redis", () => ({ redis: {} }));
import { canUserCall, DEFAULT_PRIVACY_SETTINGS, type PrivacySettings } from "./privacy-settings";
const settings = (patch: Partial<PrivacySettings> = {}): PrivacySettings => ({ ...DEFAULT_PRIVACY_SETTINGS, contactUserIds: [], ...patch });
it("enforces every call audience using the recipient's contacts", () => {
  expect(canUserCall("alice", "bob", settings())).toBe(true);
  expect(canUserCall("alice", "bob", settings({ callPolicy: "none" }))).toBe(false);
  expect(canUserCall("alice", "bob", settings({ callPolicy: "contacts" }))).toBe(false);
  expect(canUserCall("alice", "bob", settings({ callPolicy: "contacts", contactUserIds: ["alice"] }))).toBe(true);
});
it("exceptions override policy, denial wins conflicts, and self calls are forbidden", () => {
  expect(canUserCall("alice", "bob", settings({ callPolicy: "none", callAllowUserIds: ["alice"] }))).toBe(true);
  expect(canUserCall("alice", "bob", settings({ callDenyUserIds: ["alice"] }))).toBe(false);
  expect(canUserCall("alice", "bob", settings({ callAllowUserIds: ["alice"], callDenyUserIds: ["alice"] }))).toBe(false);
  expect(canUserCall("alice", "bob", settings({ callPolicy: "contacts", callAllowUserIds: ["alice"] }))).toBe(false);
  expect(canUserCall("bob", "bob", settings({ callAllowUserIds: ["bob"] }))).toBe(false);
});
