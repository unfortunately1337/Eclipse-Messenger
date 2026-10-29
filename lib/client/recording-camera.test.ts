import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceRecordingCamera } from "./recording-camera";

function track(kind: string, deviceId: string, facingMode?: string) {
  const value = { kind, readyState: "live", getSettings: () => ({ deviceId, facingMode }), stop: vi.fn(() => { value.readyState = "ended"; }) };
  return value as unknown as MediaStreamTrack;
}
class Stream {
  constructor(private tracks: MediaStreamTrack[]) {}
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(track => track.kind === "video"); }
  getAudioTracks() { return this.tracks.filter(track => track.kind === "audio"); }
}
const stream = (...tracks: MediaStreamTrack[]) => new Stream(tracks) as unknown as MediaStream;
afterEach(() => vi.unstubAllGlobals());

describe("recording camera replacement", () => {
  it("releases an exclusive phone camera first and preserves the original recorded microphone", async () => {
    vi.stubGlobal("MediaStream", Stream);
    const front = track("video", "front", "user"), mic = track("audio", "mic"), rear = track("video", "rear", "environment");
    const capture = { stream: stream(mic), setSource: vi.fn().mockResolvedValue(undefined) };
    const request = vi.fn(async () => {
      expect(front.readyState).toBe("ended"); expect(mic.readyState).toBe("live");
      return stream(rear);
    });
    const result = await replaceRecordingCamera({ currentStream: stream(front, mic), facingMode: "user", deviceIds: ["front", "rear"], capture, requestStream: request, isCurrent: () => true });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ audio: false, preferFacing: true, facingMode: "environment" }));
    expect(result.switched).toBe(true);
    expect(result.stream.getAudioTracks()).toEqual([mic]);
    expect(capture.setSource).toHaveBeenCalledWith(result.stream);
    expect(mic.stop).not.toHaveBeenCalled();
  });
  it("restores a working camera if the browser silently returns the same lens", async () => {
    vi.stubGlobal("MediaStream", Stream);
    const front = track("video", "front", "user"), wrong = track("video", "front", "user"), restored = track("video", "front", "user");
    const request = vi.fn().mockResolvedValueOnce(stream(wrong)).mockResolvedValueOnce(stream(restored));
    const result = await replaceRecordingCamera({ currentStream: stream(front), facingMode: "user", deviceIds: ["front", "rear"], capture: null, requestStream: request, isCurrent: () => true });
    expect(result).toMatchObject({ switched: false, facingMode: "user" });
    expect(wrong.stop).toHaveBeenCalled();
    expect(result.stream.getVideoTracks()).toEqual([restored]);
  });
  it("does not resurrect a cancelled recording when device acquisition finishes late", async () => {
    vi.stubGlobal("MediaStream", Stream);
    const rear = track("video", "rear", "environment"); let current = true;
    const request = vi.fn(async () => { current = false; return stream(rear); });
    await expect(replaceRecordingCamera({ currentStream: stream(track("video", "front", "user")), facingMode: "user", deviceIds: [], capture: null, requestStream: request, isCurrent: () => current })).rejects.toMatchObject({ name: "AbortError" });
    expect(rear.stop).toHaveBeenCalled(); expect(request).toHaveBeenCalledTimes(1);
  });
});
