import { expect, it } from "vitest";
import { isChunkLoadError } from "./chunk-load-error";

it("recognizes stale build assets from both bundlers", () => {
  expect(isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/1504ovvvu9csb.js from module 72238"))).toBe(true);
  expect(isChunkLoadError({ name: "ChunkLoadError", message: "missing asset" })).toBe(true);
  expect(isChunkLoadError(new Error("Loading chunk 253 failed. (missing: /_next/static/chunks/253.js)"))).toBe(true);
  expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: /settings.js"))).toBe(true);
});

it("does not classify API, authorization or ordinary application errors as stale assets", () => {
  for (const message of ["Failed to fetch", "Неверный пароль", "HTTP 403", "Settings are unavailable", "Cannot read properties of undefined"]) {
    expect(isChunkLoadError(new Error(message))).toBe(false);
  }
});
