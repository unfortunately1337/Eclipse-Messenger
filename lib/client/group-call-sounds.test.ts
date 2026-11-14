import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ audio: { state: "running" }, tone: vi.fn(), stop: vi.fn(), dispose: vi.fn() }));
vi.mock("./gesture-audio", () => ({ createGestureAudio: (ready: (audio: unknown) => void) => { ready(mock.audio); return mock.dispose; } }));
vi.mock("./call-sounds", () => ({ playCallTone: (...args: unknown[]) => { mock.tone(...args); return mock.stop; } }));
import { createGroupCallSounds } from "./group-call-sounds";
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mock.audio.state = "running"; });
afterEach(() => { vi.useRealTimers(); });
it("stays silent on creation and coalesces a burst of joins into one quiet cue", () => {
  const sound = createGroupCallSounds(() => true);
  expect(mock.tone).not.toHaveBeenCalled();
  for (let i = 0; i < 12; i++) sound.play("join");
  vi.advanceTimersByTime(80);
  expect(mock.tone).toHaveBeenCalledExactlyOnceWith(mock.audio, "join");
  sound.dispose();
});
it("distinguishes departure and suppresses pending cues when the call disconnects", () => {
  let connected = true;
  const sound = createGroupCallSounds(() => connected);
  sound.play("leave"); vi.advanceTimersByTime(80);
  expect(mock.tone).toHaveBeenCalledWith(mock.audio, "leave");
  vi.advanceTimersByTime(500); sound.play("join"); connected = false; vi.advanceTimersByTime(80);
  expect(mock.tone).toHaveBeenCalledOnce(); sound.dispose();
});
it("does not replay missed events after browser audio unlocks or after disposal", () => {
  mock.audio.state = "suspended";
  const sound = createGroupCallSounds(() => true);
  sound.play("join"); mock.audio.state = "running"; vi.advanceTimersByTime(1000);
  expect(mock.tone).not.toHaveBeenCalled(); sound.play("leave"); sound.dispose(); vi.advanceTimersByTime(1000);
  expect(mock.tone).not.toHaveBeenCalled(); expect(mock.dispose).toHaveBeenCalledOnce();
});
