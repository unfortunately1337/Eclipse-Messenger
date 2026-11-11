import { afterEach, expect, it, vi } from "vitest";
import { createGestureAudio } from "./gesture-audio";

afterEach(() => { vi.unstubAllGlobals(); });
function setup(initial: AudioContextState = "suspended") {
  const target = new EventTarget();
  const audio = Object.assign(new EventTarget(), {
    state: initial,
    resume: vi.fn(async () => { audio.state = "running"; audio.dispatchEvent(new Event("statechange")); }),
    close: vi.fn(async () => { audio.state = "closed"; }),
  });
  const create = vi.fn(function () { return audio; });
  vi.stubGlobal("window", target);
  vi.stubGlobal("AudioContext", create);
  const ready = vi.fn(), dispose = createGestureAudio(ready);
  return { target, audio, create, ready, dispose };
}
it("creates audio on a gesture, then stops processing repeated keyboard and pointer events", async () => {
  const state = setup();
  expect(state.create).not.toHaveBeenCalled();
  state.target.dispatchEvent(new Event("pointerdown"));
  await Promise.resolve();
  for (let i = 0; i < 100; i++) state.target.dispatchEvent(new Event("keydown"));
  expect(state.create).toHaveBeenCalledOnce();
  expect(state.audio.resume).toHaveBeenCalledOnce();
  expect(state.ready).toHaveBeenCalledOnce();
  state.dispose();
});
it("re-arms audio after a browser interruption and resumes on the next gesture", async () => {
  const state = setup("running");
  state.target.dispatchEvent(new Event("keydown"));
  state.audio.state = "suspended";
  state.audio.dispatchEvent(new Event("statechange"));
  state.target.dispatchEvent(new Event("pointerdown"));
  await Promise.resolve();
  expect(state.audio.resume).toHaveBeenCalledOnce();
  expect(state.ready).toHaveBeenCalledTimes(2);
  state.dispose();
});
it("does not unlock or notify again after cleanup, including a pending resume", async () => {
  const state = setup();
  let finish!: () => void;
  state.audio.resume.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  state.target.dispatchEvent(new Event("keydown"));
  state.dispose();
  finish();
  await Promise.resolve(); await Promise.resolve();
  state.target.dispatchEvent(new Event("pointerdown"));
  expect(state.ready).not.toHaveBeenCalled();
  expect(state.audio.close).toHaveBeenCalledOnce();
  expect(state.create).toHaveBeenCalledOnce();
});
it("retries a refused unlock on a later gesture", async () => {
  const state = setup();
  state.audio.resume.mockRejectedValueOnce(new Error("gesture unavailable"));
  state.target.dispatchEvent(new Event("keydown"));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  state.target.dispatchEvent(new Event("pointerdown"));
  await Promise.resolve();
  expect(state.ready).toHaveBeenCalledOnce();
  state.dispose();
});
