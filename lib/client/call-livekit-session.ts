import type { Room, Participant, Track, LocalVideoTrack, ScreenShareCaptureOptions } from "livekit-client";
import type { CallConnection } from "@/lib/calls";
import { CallMediaEvents, type CallMediaSession, type CallMediaTrack, type CallCameraTrack, type CallParticipant, type LocalCallParticipant, type CallPublication, type CallTrackSource, type CameraRestartOptions } from "./call-media-session";

/** SDK-specific objects stay behind this adapter while P2P is being verified. */
export async function createLiveKitSession(): Promise<CallMediaSession> {
  const { Room: LiveRoom, RoomEvent } = await import("livekit-client");
  const room = new LiveRoom({ adaptiveStream: true, dynacast: true,
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    videoCaptureDefaults: { facingMode: "user", resolution: { width: 1280, height: 720, frameRate: 30 } },
  });
  const tracks = new WeakMap<Track, CallMediaTrack>();
  const participants = new WeakMap<Participant, CallParticipant>();
  const trackView = (track: Track): CallMediaTrack => {
    const cached = tracks.get(track); if (cached) return cached;
    const result: CallCameraTrack = {
      get source() { return track.source as CallTrackSource; },
      get mediaStreamTrack() { return track.mediaStreamTrack; },
      attach: () => track.attach(), detach: element => track.detach(element), stop: () => track.stop(),
      setVolume: volume => { if ("setVolume" in track && typeof track.setVolume === "function") track.setVolume(volume); },
      restartTrack: async (options: CameraRestartOptions) => { await (track as LocalVideoTrack).restartTrack(options); },
    };
    tracks.set(track, result); return result;
  };
  const publicationView = (publication: ReturnType<Participant["getTrackPublication"]>): CallPublication | undefined => publication ? {
    trackSid: publication.trackSid, isMuted: publication.isMuted,
    track: publication.track ? trackView(publication.track) : undefined,
    videoTrack: publication.videoTrack ? trackView(publication.videoTrack) as CallCameraTrack : undefined,
  } : undefined;
  const personView = (person: Participant): CallParticipant => {
    const cached = participants.get(person); if (cached) return cached;
    const view: CallParticipant = {
      get identity() { return person.identity; },
      get isMicrophoneEnabled() { return person.isMicrophoneEnabled; },
      get isCameraEnabled() { return person.isCameraEnabled; },
      get isScreenShareEnabled() { return person.isScreenShareEnabled; },
      get isSpeaking() { return person.isSpeaking; }, get audioLevel() { return person.audioLevel; },
      get connectionQuality() { return person.connectionQuality; },
      get audioTrackPublications() { return new Map([...person.audioTrackPublications].map(([id, publication]) => [id, publicationView(publication)!])); },
      getTrackPublication: source => publicationView(person.getTrackPublication(source as Track.Source)),
    };
    participants.set(person, view); return view;
  };
  class LiveKitSession extends CallMediaEvents implements CallMediaSession {
    readonly localParticipant: LocalCallParticipant;
    constructor(private room: Room) {
      super();
      const person = personView(room.localParticipant);
      this.localParticipant = Object.create(person, {
        setMicrophoneEnabled: { value: (enabled: boolean) => room.localParticipant.setMicrophoneEnabled(enabled) },
        setCameraEnabled: { value: (enabled: boolean, options?: { facingMode?: CameraRestartOptions["facingMode"] }) => room.localParticipant.setCameraEnabled(enabled, options) },
        setScreenShareEnabled: { value: (enabled: boolean, options?: ScreenShareCaptureOptions) => room.localParticipant.setScreenShareEnabled(enabled, {
          ...options, resolution: { width: 1920, height: 1080, frameRate: 45 },
        }, { screenShareEncoding: { maxBitrate: 6_000_000, maxFramerate: 45 } }) },
      });
      for (const event of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted, RoomEvent.ConnectionQualityChanged, RoomEvent.ConnectionStateChanged,
        RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.ActiveSpeakersChanged]) room.on(event, () => this.emit("update"));
      room.on(RoomEvent.Reconnecting, () => this.emit("reconnecting"));
      room.on(RoomEvent.Reconnected, () => this.emit("reconnected"));
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => this.emit("audioPlayback"));
      room.on(RoomEvent.Disconnected, () => this.emit("disconnected"));
    }
    get state() { return this.room.state; }
    get ready() { return this.room.state === "connected"; }
    get canPlaybackAudio() { return this.room.canPlaybackAudio; }
    get remoteParticipants() { return new Map([...this.room.remoteParticipants].map(([id, person]) => [id, personView(person)])); }
    async connect(connection: CallConnection) {
      if (connection.transport === "p2p") throw new Error("Incorrect call transport");
      await this.room.connect(connection.url, connection.token);
    }
    async disconnect(stopTracks = true) { await this.room.disconnect(stopTracks); this.room.removeAllListeners(); }
    async startAudio() { await this.room.startAudio(); }
  }
  return new LiveKitSession(room);
}
