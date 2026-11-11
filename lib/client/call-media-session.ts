import type { CallConnection } from "@/lib/calls";

export type CallTrackSource = "microphone" | "camera" | "screen_share" | "screen_share_audio";
export type CameraRestartOptions = {
  deviceId?: ConstrainDOMString; facingMode?: "user" | "environment" | "left" | "right";
  resolution?: { width: number; height: number; frameRate: number };
};
export interface CallMediaTrack {
  readonly source: CallTrackSource;
  readonly mediaStreamTrack: MediaStreamTrack;
  attach(): HTMLMediaElement;
  detach(element: HTMLMediaElement): unknown;
  stop(): void;
  setVolume?(volume: number): void;
}
export interface CallCameraTrack extends CallMediaTrack { restartTrack(options: CameraRestartOptions): Promise<void>; }
export type CallPublication = { trackSid: string; isMuted: boolean; track?: CallMediaTrack; videoTrack?: CallCameraTrack };
export interface CallParticipant {
  identity: string;
  isMicrophoneEnabled: boolean; isCameraEnabled: boolean; isScreenShareEnabled: boolean;
  audioLevel: number; isSpeaking: boolean; connectionQuality: string;
  audioTrackPublications: Map<string, CallPublication>;
  getTrackPublication(source: CallTrackSource): CallPublication | undefined;
}
export interface LocalCallParticipant extends CallParticipant {
  setMicrophoneEnabled(enabled: boolean, options?: { noiseSuppression?: boolean }): Promise<unknown>;
  setNoiseSuppression?(enabled: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean, options?: { facingMode?: CameraRestartOptions["facingMode"] }): Promise<unknown>;
  setScreenShareEnabled(enabled: boolean, capture?: { audio?: boolean; contentHint?: string; selfBrowserSurface?: string; surfaceSwitching?: string }, publish?: { screenShareEncoding?: { maxBitrate: number; maxFramerate: number } }): Promise<unknown>;
}
export type CallMediaEvent = "update" | "reconnecting" | "reconnected" | "audioPlayback" | "disconnected";
export interface CallMediaSession {
  readonly state: string;
  readonly ready: boolean;
  readonly localParticipant: LocalCallParticipant;
  readonly remoteParticipants: Map<string, CallParticipant>;
  readonly canPlaybackAudio: boolean;
  on(event: CallMediaEvent, callback: () => void): this;
  removeAllListeners(): void;
  connect(connection: CallConnection): Promise<void>;
  disconnect(stopTracks?: boolean): Promise<void>;
  startAudio(): Promise<void>;
}

export class CallMediaEvents {
  private listeners = new Map<CallMediaEvent, Set<() => void>>();
  on(event: CallMediaEvent, callback: () => void) {
    let callbacks = this.listeners.get(event);
    if (!callbacks) this.listeners.set(event, callbacks = new Set());
    callbacks.add(callback);
    return this;
  }
  protected emit(event: CallMediaEvent) { this.listeners.get(event)?.forEach(callback => callback()); }
  removeAllListeners() { this.listeners.clear(); }
}
