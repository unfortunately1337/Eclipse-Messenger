import type { LocalVideoTrack, VideoCaptureOptions } from "livekit-client";

export type CallCameraFacing = "user" | "environment";
type CameraTrack = Pick<LocalVideoTrack, "mediaStreamTrack" | "restartTrack" | "stop">;
const resolution = { width: 1280, height: 720, frameRate: 24 };

/** Restart the published picture in place; never replace the room or microphone. */
export async function switchCallCamera({ track, facing, deviceIds, isCurrent }: {
  track: CameraTrack; facing: CallCameraFacing; deviceIds: string[]; isCurrent: () => boolean;
}): Promise<{ facing: CallCameraFacing; switched: boolean } | null> {
  if (!isCurrent()) return null;
  const previous = track.mediaStreamTrack.getSettings();
  const current = previous.facingMode === "user" || previous.facingMode === "environment" ? previous.facingMode : facing;
  const target = current === "user" ? "environment" : "user";
  const devices = [...new Set(deviceIds.filter(Boolean))];
  const index = devices.indexOf(previous.deviceId ?? "");
  const alternate = devices.length > 1 ? devices[(index + 1) % devices.length] : undefined;
  // Desktops with one webcam cannot flip. Avoid interrupting its working picture.
  if (!previous.facingMode && !alternate && devices.length === 1) return { facing: current, switched: false };
  const restart = async (options: VideoCaptureOptions) => {
    await track.restartTrack({ ...options, resolution });
    if (!isCurrent()) { track.stop(); return false; }
    return true;
  };
  try {
    // Clear the old device constraint when selecting the opposite phone camera.
    if (!await restart(!previous.facingMode && alternate ? { deviceId: { exact: alternate } } : { facingMode: target })) return null;
    let next = track.mediaStreamTrack.getSettings();
    const changed = () => next.facingMode ? next.facingMode === target : Boolean(next.deviceId && next.deviceId !== previous.deviceId);
    if (!changed() && alternate) {
      if (!await restart({ deviceId: { exact: alternate } })) return null;
      next = track.mediaStreamTrack.getSettings();
    }
    if (!changed()) throw new Error("Requested camera is unavailable");
    return { facing: next.facingMode === "environment" ? "environment" : next.facingMode === "user" ? "user" : target, switched: true };
  } catch (error) {
    if (!isCurrent()) { track.stop(); return null; }
    // SDK releases the original camera before acquiring the replacement on iOS.
    // Restore it if the other lens is unavailable or its permission was denied.
    if (!await restart(previous.deviceId ? { deviceId: { exact: previous.deviceId } } : { facingMode: current })) return null;
    throw error;
  }
}
