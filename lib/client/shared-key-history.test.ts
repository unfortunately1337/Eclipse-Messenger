import { expect, it, vi } from "vitest";
import { shareMissingHistoryKeys } from "./shared-key-history";

it("shares all historical versions with a new member, without overwriting existing recipients", async () => {
  const save = vi.fn();
  const resolveKey = vi.fn(async version => `key-${version}`);
  const result = await shareMissingHistoryKeys({ history: [{ version: 3, keyHolders: ["owner", "new"] }, { version: 2, keyHolders: ["owner"] }, { version: 1, keyHolders: ["owner"] }], members: [{ userId: "owner", publicKey: "owner-key" }, { userId: "new", publicKey: "new-key" }, { userId: "not-ready", publicKey: null }], resolveKey, wrapKey: async (key, recipient) => `${recipient}:${key}`, save });
  expect(resolveKey.mock.calls).toEqual([[2], [1]]);
  expect(save.mock.calls).toEqual([[2, [{ userId: "new", encryptedKey: "new-key:key-2" }]], [1, [{ userId: "new", encryptedKey: "new-key:key-1" }]]]);
  expect(result).toEqual({ added: 2, failedVersions: [] });
});
it("continues other versions if one key is unavailable and respects target recipients", async () => {
  const save = vi.fn();
  const result = await shareMissingHistoryKeys({ history: [{ version: 2, keyHolders: [] }, { version: 1, keyHolders: [] }], members: [{ userId: "new", publicKey: "pk" }, { userId: "other", publicKey: "pk" }], targetUserIds: ["new"], resolveKey: async version => version === 2 ? null : "key", wrapKey: async () => "wrapped", save });
  expect(save.mock.calls).toEqual([[1, [{ userId: "new", encryptedKey: "wrapped" }]]]);
  expect(result).toEqual({ added: 1, failedVersions: [2] });
});
