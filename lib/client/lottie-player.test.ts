import { afterEach, expect, it, vi } from "vitest";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("lottie-web", () => { load(); return { default: { loadAnimation: vi.fn() } }; });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); load.mockReset(); });

it("does not evaluate the player when Canvas is unavailable", async () => {
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
  const { loadLottiePlayer } = await import("./lottie-player");
  expect(await loadLottiePlayer()).toBeNull();
  expect(load).not.toHaveBeenCalled();
});

it("contains Canvas security errors without an unhandled rejection", async () => {
  vi.stubGlobal("document", { createElement: () => { throw new Error("blocked"); } });
  const { loadLottiePlayer } = await import("./lottie-player");
  expect(await loadLottiePlayer()).toBeNull();
  expect(load).not.toHaveBeenCalled();
});

it("shares player initialization across mounted animations", async () => {
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({}) }) });
  const { loadLottiePlayer } = await import("./lottie-player");
  const first = loadLottiePlayer(), second = loadLottiePlayer();
  expect(first).toBe(second);
  expect((await first)?.loadAnimation).toBeTypeOf("function");
  expect(load).toHaveBeenCalledTimes(1);
});

it("does not import browser rendering code on the server", async () => {
  const { loadLottiePlayer } = await import("./lottie-player");
  expect(await loadLottiePlayer()).toBeNull();
  expect(load).not.toHaveBeenCalled();
});
