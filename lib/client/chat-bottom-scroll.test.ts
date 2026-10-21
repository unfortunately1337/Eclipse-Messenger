import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatBottomScroll, createChatTargetScroll } from "./chat-bottom-scroll";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function scene() {
  let top = 0;
  let time = 0;
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
  const viewport = { scrollHeight: 600, clientHeight: 500, get scrollTop() { return top; }, set scrollTop(value: number) { top = Math.round(value); } };
  const step = () => {
    time += 16;
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(time));
    return top;
  };
  return { viewport, step, frames };
}

describe("chat bottom motion", () => {
  it("moves up to a pinned row and follows its measured position", () => {
    const { viewport, step, frames } = scene(); const finish = vi.fn();
    viewport.scrollHeight = 1800;
    viewport.scrollTop = 1200;
    let target = 200;
    createChatTargetScroll(viewport as HTMLElement, () => target, finish);
    expect(step()).toBeGreaterThan(target);
    expect(viewport.scrollTop).toBeLessThan(1200);
    for (let i = 0; i < 5; i++) step();
    target = 120;
    for (let i = 0; i < 120 && frames.size; i++) step();
    expect(viewport.scrollTop).toBe(120);
    expect(finish).toHaveBeenCalledOnce();
  });
  it("eases across frames and finishes despite integer scroll positions", () => {
    const { viewport, step, frames } = scene(); const finish = vi.fn();
    createChatBottomScroll(viewport as HTMLElement, finish);
    const positions = [0];
    for (let i = 0; i < 80 && frames.size; i++) positions.push(step());
    expect(finish).toHaveBeenCalledOnce(); expect(viewport.scrollTop).toBe(100);
    expect(positions.length).toBeGreaterThan(15);
    expect(Math.max(...positions.slice(1).map((value, i) => value - positions[i]))).toBeLessThan(12);
    expect(positions.every((value, i) => i === 0 || value >= positions[i - 1])).toBe(true);
  });
  it("follows a changing media height without jumping to the new destination", () => {
    const { viewport, step, frames } = scene(); const finish = vi.fn();
    createChatBottomScroll(viewport as HTMLElement, finish);
    for (let i = 0; i < 6; i++) step();
    const before = viewport.scrollTop; viewport.scrollHeight += 180;
    expect(step() - before).toBeLessThan(20);
    for (let i = 0; i < 100 && frames.size; i++) step();
    expect(viewport.scrollTop).toBe(280); expect(finish).toHaveBeenCalledOnce();
  });
  it("cancels pending frames when the reader scrolls away", () => {
    const { viewport, step, frames } = scene(); const finish = vi.fn();
    const animation = createChatBottomScroll(viewport as HTMLElement, finish);
    for (let i = 0; i < 4; i++) step();
    animation.cancel(); const top = viewport.scrollTop; viewport.scrollHeight += 100;
    for (let i = 0; i < 30; i++) step();
    expect(viewport.scrollTop).toBe(top); expect(frames.size).toBe(0); expect(finish).not.toHaveBeenCalled();
  });
});
