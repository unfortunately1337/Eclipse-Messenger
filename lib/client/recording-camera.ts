export type RecordingFacing = "user" | "environment";
export type RecordingCameraRequest = { facingMode: RecordingFacing; deviceId?: string | null; audio?: boolean; preferFacing?: boolean };
type Capture = { stream: MediaStream; setSource: (stream: MediaStream) => Promise<void> };

/** Mobile cameras are exclusive. Release only the picture, keeping recorded audio live. */
export async function replaceRecordingCamera(options: {
  currentStream: MediaStream;
  facingMode: RecordingFacing;
  deviceIds: string[];
  capture: Capture | null;
  requestStream: (request: RecordingCameraRequest) => Promise<MediaStream>;
  isCurrent: () => boolean;
}) {
  const { currentStream, capture, isCurrent, requestStream } = options;
  const settings = currentStream.getVideoTracks()[0]?.getSettings();
  const facing = settings?.facingMode === "environment" || settings?.facingMode === "user" ? settings.facingMode : options.facingMode;
  const nextFacing: RecordingFacing = facing === "user" ? "environment" : "user";
  const alternateId = options.deviceIds.find(id => id !== settings?.deviceId) ?? null;
  if (!isCurrent()) throw new DOMException("Recording ended", "AbortError");
  currentStream.getVideoTracks().forEach(track => track.stop());
  if (!capture) currentStream.getAudioTracks().forEach(track => track.stop());

  const install = async (source: MediaStream) => {
    if (!isCurrent()) { source.getTracks().forEach(track => track.stop()); throw new DOMException("Recording ended", "AbortError"); }
    const stream = capture ? new MediaStream([...source.getVideoTracks(), ...capture.stream.getAudioTracks()]) : source;
    try {
      if (capture) await capture.setSource(stream);
      if (!isCurrent()) throw new DOMException("Recording ended", "AbortError");
      return stream;
    } catch (error) { source.getTracks().forEach(track => track.stop()); throw error; }
  };

  let replacement: MediaStream | null = null;
  try {
    replacement = await requestStream({ facingMode: nextFacing, deviceId: alternateId, audio: !capture, preferFacing: true });
    const next = replacement.getVideoTracks()[0]?.getSettings();
    if (!next || (next.facingMode && next.facingMode !== nextFacing) || (!next.facingMode && next.deviceId && next.deviceId === settings?.deviceId)) throw new Error("Camera did not change");
    return { stream: await install(replacement), facingMode: nextFacing, switched: true };
  } catch (error) {
    replacement?.getTracks().forEach(track => track.stop());
    if (!isCurrent()) throw new DOMException("Recording ended", "AbortError");
    // A failed rear-camera request must not leave an otherwise valid recording black.
    try {
      const restored = await requestStream({ facingMode: facing, deviceId: settings?.deviceId, audio: !capture });
      return { stream: await install(restored), facingMode: facing, switched: false };
    } catch { throw error; }
  }
}
