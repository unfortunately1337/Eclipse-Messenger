import type { CallCameraTrack, CallTrackSource, CameraRestartOptions } from "./call-media-session";

export type NativeTrackHost = {
  restartCamera(options: CameraRestartOptions): Promise<void>;
  attachAudio(track: NativeCallTrack, element: HTMLMediaElement): void;
  detachAudio(track: NativeCallTrack, element: HTMLMediaElement): void;
  volume(track: NativeCallTrack, volume: number): void;
};

export class NativeCallTrack implements CallCameraTrack {
  private elements = new Set<HTMLMediaElement>();
  constructor(readonly source: CallTrackSource, private native: MediaStreamTrack, private host: NativeTrackHost, readonly local: boolean) {}
  get mediaStreamTrack() { return this.native; }
  attach() {
    const element = document.createElement(this.native.kind === "audio" ? "audio" : "video");
    element.autoplay = true;
    if (element instanceof HTMLVideoElement) { element.playsInline = true; element.muted = true; }
    element.srcObject = new MediaStream([this.native]);
    this.elements.add(element);
    if (this.native.kind === "audio" && !this.local) this.host.attachAudio(this, element);
    return element;
  }
  detach(element: HTMLMediaElement) {
    this.host.detachAudio(this, element);
    this.elements.delete(element); element.pause(); element.srcObject = null;
  }
  replace(track: MediaStreamTrack) {
    const previous = this.native; this.native = track;
    for (const element of this.elements) { element.srcObject = new MediaStream([track]); void element.play().catch(() => {}); }
    if (previous !== track) previous.stop();
  }
  stop() { this.native.stop(); for (const element of [...this.elements]) this.detach(element); }
  setVolume(volume: number) { this.host.volume(this, volume); }
  async restartTrack(options: CameraRestartOptions) {
    if (!this.local || this.source !== "camera") throw new Error("Only the local camera can be restarted");
    await this.host.restartCamera(options);
  }
}
