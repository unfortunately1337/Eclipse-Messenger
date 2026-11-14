import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ room: null as unknown }));
vi.mock("livekit-client", () => {
  const events = Object.fromEntries(["ParticipantConnected", "ParticipantDisconnected", "TrackSubscribed", "TrackUnsubscribed", "LocalTrackPublished", "LocalTrackUnpublished", "TrackMuted", "TrackUnmuted", "ConnectionQualityChanged", "ConnectionStateChanged", "TrackPublished", "TrackUnpublished", "ActiveSpeakersChanged", "Reconnecting", "Reconnected", "AudioPlaybackStatusChanged", "Disconnected"].map(key => [key, key]));
  class Room {
    state = "connecting";
    localParticipant = { identity: "self" };
    remoteParticipants = new Map();
    listeners = new Map<string, (() => void)[]>();
    constructor() { mock.room = this; }
    on(event: string, fn: () => void) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]); }
    emit(event: string) { this.listeners.get(event)?.forEach(fn => fn()); }
    async connect() { this.state = "connected"; this.emit("ParticipantConnected"); }
    async disconnect() { this.emit("ParticipantDisconnected"); this.state = "disconnected"; this.emit("Disconnected"); }
    removeAllListeners() { this.listeners.clear(); }
  }
  return { Room, RoomEvent: events };
});
import { createLiveKitSession } from "./call-livekit-session";
it("announces real arrivals/departures, without announcing initial synchronization, reconnects or own hangup", async () => {
  const session = await createLiveKitSession(), joined = vi.fn(), left = vi.fn();
  const room = mock.room as { state: string; emit: (event: string) => void };
  session.on("participantJoined", joined).on("participantLeft", left);
  await session.connect({ url: "ws://localhost:7880", token: "fixture", identity: "self" });
  expect(joined).not.toHaveBeenCalled();
  room.emit("ParticipantConnected"); room.emit("ParticipantDisconnected");
  expect(joined).toHaveBeenCalledOnce(); expect(left).toHaveBeenCalledOnce();
  room.state = "reconnecting"; room.emit("Reconnecting"); room.emit("ParticipantConnected"); room.emit("ParticipantDisconnected");
  expect(joined).toHaveBeenCalledOnce(); expect(left).toHaveBeenCalledOnce();
  room.state = "connected"; room.emit("Reconnected"); room.emit("ParticipantConnected");
  expect(joined).toHaveBeenCalledTimes(2);
  await session.disconnect(); expect(left).toHaveBeenCalledOnce();
});
