import { expect, it } from "vitest";
import { virtualViewport } from "./use-virtual-viewport";
it("keeps a scroll band stable while preserving resize measurements", () => {
  const view = (top: number, width = 350) => virtualViewport({ scrollTop: top, clientHeight: 240, clientWidth: width });
  for (let i = 0; i < 32; i++) expect(view(i)).toEqual(view(0));
  expect(view(32).top).toBe(32); expect(view(63).top).toBe(32);
  expect(view(64).top).toBe(64); expect(view(64, 390).width).toBe(390);
});
