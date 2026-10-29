import { describe, expect, it } from "vitest";
import { screenShareError, selectCallVideo, visibleCallTrack } from "./call-screen-share";
import type { Participant, Track } from "livekit-client";

describe("call screen sharing", () => {
  it("keeps own screen above the peer camera and preserves that camera as a preview", () => {
    expect(selectCallVideo(undefined, "screen", "camera")).toEqual({ main: "screen", screen: true, local: true, secondary: "camera", localPreview: undefined });
  });
  it("shows the peer screen first when both share, retaining the own screen preview", () => {
    expect(selectCallVideo("peer screen", "own screen", "camera")).toMatchObject({ main: "peer screen", local: false, secondary: "camera", localPreview: "own screen" });
  });
  it("returns to the camera after screen sharing stops", () => {
    expect(selectCallVideo(undefined, undefined, "camera")).toMatchObject({ main: "camera", screen: false, secondary: undefined });
  });
  it("does not leave a muted screen as the main video", () => {
    const person = { getTrackPublication: () => ({ isMuted: true, track: {} }) } as unknown as Participant;
    expect(visibleCallTrack(person, "screen_share" as Track.Source)).toBeUndefined();
  });
  it("treats picker cancellation quietly and explains capture failures", () => {
    expect(screenShareError({ name: "NotAllowedError" })).toBeNull();
    expect(screenShareError({ name: "AbortError" })).toBeNull();
    expect(screenShareError({ name: "NotReadableError" })).toContain("настройках системы");
    expect(screenShareError(new Error())).toContain("другое окно");
  });
});
