import { afterEach, expect, it, vi } from "vitest";
import { clearImportedEmojiCatalog, EMOJI_STATUS_CATALOG, getEmojiStatus, registerImportedEmojis, subscribeEmojiCatalog, subscribeEmojiEntry, type EmojiStatus } from "./emoji-status";

const subscriptions: Array<() => void> = [];
afterEach(() => { subscriptions.splice(0).forEach(stop => stop()); clearImportedEmojiCatalog(); });
const entry = (suffix: string): EmojiStatus => ({ ...EMOJI_STATUS_CATALOG[0], id: `tg-${suffix.repeat(24)}`, packId: "pack", thumbnail: "/emoji.webp" });

it("notifies only consumers of the changed emoji instead of every visible message and profile", () => {
  const wanted = entry("a"), another = entry("b"), changed = vi.fn(), untouched = vi.fn(), unicode = vi.fn();
  subscriptions.push(subscribeEmojiEntry(wanted.id, changed), subscribeEmojiEntry(another.id, untouched), subscribeEmojiEntry(undefined, unicode));
  registerImportedEmojis([wanted]);
  expect(changed).toHaveBeenCalledOnce(); expect(untouched).not.toHaveBeenCalled(); expect(unicode).not.toHaveBeenCalled();
  const snapshot = getEmojiStatus(wanted.id);
  registerImportedEmojis([{ ...wanted }]);
  expect(getEmojiStatus(wanted.id)).toBe(snapshot); expect(changed).toHaveBeenCalledOnce();
});
it("batches repeated updates for one item and keeps the catalog subscriber live", () => {
  const wanted = entry("c"), changed = vi.fn(), catalog = vi.fn();
  subscriptions.push(subscribeEmojiEntry(wanted.id, changed), subscribeEmojiCatalog(catalog));
  registerImportedEmojis([wanted, { ...wanted, thumbnail: "/changed.webp" }]);
  expect(changed).toHaveBeenCalledOnce(); expect(catalog).toHaveBeenCalledOnce();
  expect(getEmojiStatus(wanted.id)?.thumbnail).toBe("/changed.webp");
});
it("updates removed entries on account cleanup and releases unmounted subscribers", () => {
  const wanted = entry("d"), changed = vi.fn(), removed = vi.fn(), builtin = vi.fn();
  subscriptions.push(subscribeEmojiEntry(wanted.id, changed), subscribeEmojiEntry(EMOJI_STATUS_CATALOG[0].id, builtin));
  const stop = subscribeEmojiEntry(wanted.id, removed); stop();
  registerImportedEmojis([wanted]); clearImportedEmojiCatalog();
  expect(changed).toHaveBeenCalledTimes(2); expect(getEmojiStatus(wanted.id)).toBeNull();
  expect(removed).not.toHaveBeenCalled(); expect(builtin).not.toHaveBeenCalled();
});
