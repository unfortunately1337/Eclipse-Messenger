import { describe, expect, it, vi } from "vitest";
import { finishMediaRecording } from "./media-recording";

function recorder(stop: (recorder: EventTarget) => void) {
  const target = new EventTarget();
  return Object.assign(target, { state: "recording", mimeType: "audio/webm", stop: () => stop(target) }) as unknown as MediaRecorder;
}

describe("finishMediaRecording", () => {
  it("waits for the final chunk before building the container", async () => {
    const chunks = [new Blob(["header"])];
    const source = recorder(target => {
      setTimeout(() => { chunks.push(new Blob(["final"])); target.dispatchEvent(new Event("stop")); }, 10);
    });
    const blob = await finishMediaRecording(source, chunks);
    expect(await blob.text()).toBe("headerfinal");
    expect(blob.type).toBe("audio/webm");
  });

  it("rejects a stalled recorder rather than sending its incomplete chunks", async () => {
    vi.useFakeTimers();
    try {
      const result = finishMediaRecording(recorder(() => {}), [new Blob(["partial"])], 500);
      const assertion = expect(result).rejects.toThrow("did not finalize the recording");
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    } finally { vi.useRealTimers(); }
  });

  it("rejects empty output and recorder errors", async () => {
    await expect(finishMediaRecording(recorder(target => target.dispatchEvent(new Event("stop"))), [])).rejects.toThrow("recording is empty");
    await expect(finishMediaRecording(recorder(target => target.dispatchEvent(new Event("error"))), [new Blob(["partial"])])).rejects.toThrow("Could not finalize");
  });
});
