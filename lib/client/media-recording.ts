
import { translate as t } from "@/lib/i18n/translate";
/** Wait for the final dataavailable AND stop events; never send a partial container. */
export function finishMediaRecording(recorder: MediaRecorder, chunks: Blob[], timeoutMs = 15_000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      recorder.removeEventListener("stop", onStop);
      recorder.removeEventListener("error", onError);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) return reject(error);
      const blob = new Blob(chunks, { type: recorder.mimeType || chunks.find(chunk => chunk.type)?.type || "" });
      if (!blob.size) return reject(new Error(t("Запись пустая. Проверьте микрофон или камеру.")));
      resolve(blob);
    };
    const onStop = () => finish();
    const onError = () => finish(new Error(t("Не удалось завершить запись. Попробуйте ещё раз.")));
    const timer = setTimeout(() => finish(new Error(t("Устройство не завершило запись. Попробуйте ещё раз."))), timeoutMs);
    recorder.addEventListener("stop", onStop);
    recorder.addEventListener("error", onError);
    if (recorder.state === "inactive") { finish(); return; }
    try { recorder.stop(); } catch { onError(); }
  });
}

/** One continuous video/audio stream, including when the camera source changes. */
export async function createVideoNoteCapture(source: MediaStream) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 720;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context || typeof canvas.captureStream !== "function") throw new Error(t("Устройство не поддерживает запись видеокружков"));
  let stopped = false;
  let animation = 0;
  let currentSource = source;
  const audioTracks = source.getAudioTracks();
  const setSource = async (nextSource: MediaStream) => {
    if (stopped) throw new Error(t("Запись уже завершена"));
    currentSource = nextSource;
    video.srcObject = new MediaStream(nextSource.getVideoTracks());
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 10_000;
      let failed = false;
      void video.play().catch(() => { failed = true; });
      const check = () => {
        if (stopped) { reject(new Error(t("Запись отменена"))); return; }
        if (failed) { reject(new Error(t("Не удалось включить камеру"))); return; }
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) { resolve(); return; }
        if (Date.now() >= deadline) { reject(new Error(t("Камера не передаёт изображение"))); return; }
        setTimeout(check, 30);
      };
      check();
    });
  };
  const draw = () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const side = Math.min(video.videoWidth, video.videoHeight);
      context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 720, 720);
    }
    animation = requestAnimationFrame(draw);
  };
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(animation);
    video.pause();
    video.srcObject = null;
    currentSource.getTracks().forEach(track => track.stop());
    audioTracks.forEach(track => track.stop());
  };
  try { await setSource(source); } catch (error) { stop(); throw error; }
  draw(); // Capture a real first frame before MediaRecorder starts.
  const stream = canvas.captureStream(30);
  audioTracks.forEach(track => stream.addTrack(track));
  return { stream, setSource, stop: () => { stop(); stream.getTracks().forEach(track => track.stop()); } };
}
