import { describe, expect, it, vi } from "vitest";
import { switchCallCamera } from "./call-camera";
import type { VideoCaptureOptions } from "livekit-client";

function camera(initial: MediaTrackSettings) {
  let settings = initial;
  const track = { mediaStreamTrack: { getSettings: () => settings }, restartTrack: vi.fn<(options: VideoCaptureOptions) => Promise<void>>().mockResolvedValue(undefined), stop: vi.fn() };
  return { track, set: (next: MediaTrackSettings) => { settings = next; } };
}

describe("published call camera switching", () => {
  it("switches phone facing without carrying the old device constraint", async () => {
    const c = camera({ deviceId: "front", facingMode: "user" });
    c.track.restartTrack.mockImplementation(async () => c.set({ deviceId: "back", facingMode: "environment" }));
    const result = await switchCallCamera({ track: c.track as never, facing: "user", deviceIds: ["front", "back"], isCurrent: () => true });
    expect(result).toEqual({ facing: "environment", switched: true });
    expect(c.track.restartTrack).toHaveBeenCalledWith(expect.objectContaining({ facingMode: "environment" }));
    expect(c.track.restartTrack.mock.calls[0][0]).not.toHaveProperty("deviceId");
    expect(c.track.stop).not.toHaveBeenCalled();
  });
  it("cycles physical desktop cameras when facingMode is not reported", async () => {
    const c = camera({ deviceId: "webcam-2" });
    c.track.restartTrack.mockImplementation(async () => c.set({ deviceId: "webcam-1" }));
    expect(await switchCallCamera({ track: c.track as never, facing: "user", deviceIds: ["webcam-1", "webcam-2"], isCurrent: () => true })).toMatchObject({ switched: true });
    expect(c.track.restartTrack).toHaveBeenCalledWith(expect.objectContaining({ deviceId: { exact: "webcam-1" } }));
  });
  it("uses a different device if the browser ignores facingMode", async () => {
    const c = camera({ deviceId: "front", facingMode: "user" });
    c.track.restartTrack.mockImplementationOnce(async () => {}).mockImplementationOnce(async () => c.set({ deviceId: "back", facingMode: "environment" }));
    expect(await switchCallCamera({ track: c.track as never, facing: "user", deviceIds: ["front", "back"], isCurrent: () => true })).toMatchObject({ switched: true });
    expect(c.track.restartTrack).toHaveBeenCalledTimes(2);
  });
  it("restores the working camera if the other lens fails", async () => {
    const c = camera({ deviceId: "front", facingMode: "user" });
    c.track.restartTrack.mockRejectedValueOnce(new DOMException("Camera busy", "NotReadableError"));
    await expect(switchCallCamera({ track: c.track as never, facing: "user", deviceIds: ["front", "back"], isCurrent: () => true })).rejects.toMatchObject({ name: "NotReadableError" });
    expect(c.track.restartTrack).toHaveBeenLastCalledWith(expect.objectContaining({ deviceId: { exact: "front" } }));
  });
  it("leaves a single desktop webcam uninterrupted", async () => {
    const c = camera({ deviceId: "single" });
    expect(await switchCallCamera({ track: c.track as never, facing: "user", deviceIds: ["single"], isCurrent: () => true })).toEqual({ facing: "user", switched: false });
    expect(c.track.restartTrack).not.toHaveBeenCalled();
  });
  it("stops a late camera acquisition after hangup", async () => {
    const c = camera({ deviceId: "front", facingMode: "user" });
    let active = true;
    c.track.restartTrack.mockImplementation(async () => { active = false; c.set({ deviceId: "back", facingMode: "environment" }); });
    expect(await switchCallCamera({ track: c.track as never, facing: "user", deviceIds: [], isCurrent: () => active })).toBeNull();
    expect(c.track.stop).toHaveBeenCalledOnce();
  });
});
