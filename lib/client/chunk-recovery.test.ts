import { afterEach, expect, it, vi } from "vitest";
import { recoverStaleChunk } from "./chunk-recovery";

afterEach(() => vi.unstubAllGlobals());
function browser(online = true) {
  const data = new Map<string, string>(), reload = vi.fn();
  vi.stubGlobal("navigator", { onLine: online });
  vi.stubGlobal("window", { sessionStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) }, location: { reload } });
  return reload;
}
const missingChunk = () => new Error("Failed to load chunk /_next/static/chunks/removed.js");
it("reloads a missing build chunk once across page transitions", () => {
  const reload = browser();
  expect(recoverStaleChunk(missingChunk())).toBe(true);
  expect(recoverStaleChunk(missingChunk())).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
});
it("does not reload ordinary application errors or offline clients", () => {
  const reload = browser();
  expect(recoverStaleChunk(new Error("Failed to fetch"))).toBe(false);
  expect(reload).not.toHaveBeenCalled();
  const offlineReload = browser(false);
  expect(recoverStaleChunk(missingChunk())).toBe(false);
  expect(offlineReload).not.toHaveBeenCalled();
});
it("does not loop when session storage is blocked", () => {
  const reload = browser();
  Object.defineProperty(window, "sessionStorage", { get: () => { throw new Error("blocked"); } });
  expect(recoverStaleChunk(missingChunk())).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});
