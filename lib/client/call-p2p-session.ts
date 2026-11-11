import type { CallConnection, P2PCallConnection } from "@/lib/calls";
import type { CallMediaState, CallSignalMessage, CallSignalPayload } from "@/lib/call-signaling";
import { CallMediaEvents, type CallMediaSession, type LocalCallParticipant, type CallParticipant, type CallPublication, type CallTrackSource, type CameraRestartOptions } from "./call-media-session";
import { NativeCallTrack, type NativeTrackHost } from "./call-p2p-track";
import { createP2PSignaling, type P2PSignaling } from "./call-p2p-signaling";
import { p2pEncoding, p2pQuality, type P2PQuality } from "./call-p2p-quality";

const sources = ["microphone", "camera", "screen_share", "screen_share_audio"] as const;
const mediaKey = { microphone: "microphone", camera: "camera", screen_share: "screen", screen_share_audio: "screenAudio" } as const;
const emptyMedia = (): CallMediaState => ({ microphone: false, camera: false, screen: false, screenAudio: false });
const audioConstraints: MediaTrackConstraints = { echoCancellation: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 };
type AudioOutput = { elements: Set<HTMLMediaElement>; source?: MediaStreamAudioSourceNode; gain?: GainNode; volume: number };

export class P2PCallSession extends CallMediaEvents implements CallMediaSession, NativeTrackHost {
  state = "connecting";
  ready = false;
  canPlaybackAudio = true;
  readonly remoteParticipants = new Map<string, CallParticipant>();
  readonly localParticipant: LocalCallParticipant;
  private config!: P2PCallConnection;
  private pc!: RTCPeerConnection;
  private signaling!: P2PSignaling;
  private closed = false;
  private self = emptyMedia(); private peer = emptyMedia();
  private localTracks = new Map<CallTrackSource, NativeCallTrack>();
  private remoteTracks = new Map<CallTrackSource, NativeCallTrack>();
  private transceivers = new Map<CallTrackSource, RTCRtpTransceiver>();
  private serial: Promise<unknown> = Promise.resolve();
  private remoteEpoch: string | null = null;
  private oldEpochs = new Set<string>();
  private localRound = ""; private remoteRound = "";
  private ignored = new Set<string>();
  private candidates = new Map<string, RTCIceCandidateInit[]>();
  private outgoingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private ufrags = new Map<string, string>();
  private candidateTimer?: ReturnType<typeof setTimeout>;
  private restartTimer?: ReturnType<typeof setTimeout>;
  private restartWatchdog?: ReturnType<typeof setTimeout>;
  private credentialTimer?: ReturnType<typeof setTimeout>;
  private statsTimer?: ReturnType<typeof setInterval>;
  private restarts = 0; private everConnected = false;
  private restarting: Promise<void> | null = null;
  private signalingFailures = 0;
  private quality: P2PQuality = "high";
  private qualityCandidate: P2PQuality = "high"; private qualitySamples = 0;
  private connectionQuality = "unknown";
  private lastPackets = { received: 0, lost: 0 };
  private audio?: AudioContext;
  private outputs = new Map<NativeCallTrack, AudioOutput>();
  private sample = { candidateType: "unknown", rtt: 0, loss: 0, availableBitrate: 0, bytesReceived: 0 };
  private online = () => { if (!this.closed && this.pc?.connectionState !== "connected") this.requestRestart(); };

  constructor(private injectedSignaling?: P2PSignaling) {
    super();
    const person = this.person(true);
    this.localParticipant = Object.assign(person, {
      setMicrophoneEnabled: (enabled: boolean, options?: { noiseSuppression?: boolean }) => this.microphone(enabled, options?.noiseSuppression),
      setNoiseSuppression: (enabled: boolean) => this.setNoiseSuppression(enabled),
      setCameraEnabled: (enabled: boolean, options?: { facingMode?: CameraRestartOptions["facingMode"] }) => this.camera(enabled, options?.facingMode),
      setScreenShareEnabled: (enabled: boolean) => this.screen(enabled),
    });
  }
  private person(local: boolean): CallParticipant {
    // Getter receivers are participant views, not the session.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const owner = this;
    return {
      get identity() { return local ? owner.config?.identity ?? "" : owner.config?.peerIdentity ?? ""; },
      get isMicrophoneEnabled() { return (local ? owner.self : owner.peer).microphone; },
      get isCameraEnabled() { return (local ? owner.self : owner.peer).camera; },
      get isScreenShareEnabled() { return (local ? owner.self : owner.peer).screen; },
      get audioLevel() { return 0; }, get isSpeaking() { return false; },
      get connectionQuality() { return owner.connectionQuality; },
      get audioTrackPublications() {
        const tracks = local ? owner.localTracks : owner.remoteTracks;
        return new Map([...tracks].filter(([source]) => source === "microphone" || source === "screen_share_audio")
          .map(([source]) => [source, owner.publication(source, local)!]));
      },
      getTrackPublication: source => owner.publication(source, local),
    };
  }
  private publication(source: CallTrackSource, local: boolean): CallPublication | undefined {
    const track = (local ? this.localTracks : this.remoteTracks).get(source);
    if (!track) return undefined;
    return { trackSid: source, isMuted: !(local ? this.self : this.peer)[mediaKey[source]], track,
      ...(source === "camera" || source === "screen_share" ? { videoTrack: track } : {}) };
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.serial.then(operation); this.serial = next.catch(() => {}); return next;
  }
  async connect(connection: CallConnection) {
    if (connection.transport !== "p2p" || this.closed) throw new Error("Incorrect call transport");
    this.config = connection;
    this.signaling = this.injectedSignaling ?? createP2PSignaling(connection);
    this.createPeer(); this.ready = true;
    this.signaling.start(message => { this.signalingFailures = 0; return this.receive(message); }, () => this.requestRestart(), () => {
      // Renew a lease lost while the tab was asleep even if media kept flowing.
      if (++this.signalingFailures >= 2) this.requestRestart();
    }, () => this.state === "connected");
    void this.signaling.send({ type: "ready" }).catch(() => this.requestRestart());
    // ICE may remain "new"/"checking" forever when the first SDP is lost;
    // those states do not trigger connectionstatechange=failed by themselves.
    this.restartWatchdog = setTimeout(() => { if (this.state !== "connected") this.requestRestart(); }, 12_000);
    this.statsTimer = setInterval(() => void this.readStats(), 2000);
    window.addEventListener("online", this.online);
    this.scheduleCredentials(); this.emit("update");
  }
  private createPeer() {
    if (this.pc) { this.pc.onconnectionstatechange = null; this.pc.oniceconnectionstatechange = null; this.pc.close(); }
    const pc = new RTCPeerConnection({ iceServers: this.config.iceServers, iceTransportPolicy: this.config.iceTransportPolicy, bundlePolicy: "max-bundle" });
    this.pc = pc; this.transceivers.clear(); this.remoteRound = ""; this.localRound = "";
    this.candidates.clear(); this.outgoingCandidates.clear(); this.ufrags.clear();
    // Only the initial offerer creates m-lines. Pre-creating them on the
    // answerer would duplicate transceivers when applying the first offer.
    for (const source of this.config.polite ? [] : sources) {
      const kind = source === "microphone" || source === "screen_share_audio" ? "audio" : "video";
      const transceiver = pc.addTransceiver(kind, { direction: "sendrecv" });
      const capabilities = RTCRtpSender.getCapabilities?.(kind)?.codecs;
      if (kind === "audio" && capabilities && transceiver.setCodecPreferences) {
        transceiver.setCodecPreferences([...capabilities.filter(codec => codec.mimeType.toLowerCase() === "audio/opus"), ...capabilities.filter(codec => codec.mimeType.toLowerCase() !== "audio/opus")]);
      }
      this.transceivers.set(source, transceiver);
      const existing = this.localTracks.get(source);
      if (existing && this.self[mediaKey[source]]) void transceiver.sender.replaceTrack(existing.mediaStreamTrack).catch(() => {});
    }
    pc.onnegotiationneeded = () => { void this.enqueue(() => this.offer()).catch(() => this.requestRestart()); };
    pc.onicecandidate = event => {
      if (this.closed || pc !== this.pc || !this.localRound) return;
      const round = event.candidate?.usernameFragment ? this.ufrags.get(event.candidate.usernameFragment) ?? this.localRound : this.localRound;
      const candidates = this.outgoingCandidates.get(round) ?? [];
      candidates.push(event.candidate?.toJSON() ?? { candidate: "" }); this.outgoingCandidates.set(round, candidates);
      if (!this.candidateTimer) this.candidateTimer = setTimeout(() => void this.flushCandidates(), 80);
    };
    pc.ontrack = event => {
      if (this.closed || pc !== this.pc) return;
      const source = sources[pc.getTransceivers().indexOf(event.transceiver)]; if (!source) return;
      const existing = this.remoteTracks.get(source);
      if (existing) existing.replace(event.track);
      else this.remoteTracks.set(source, new NativeCallTrack(source, event.track, this, false));
      this.remoteParticipants.set(this.config.peerIdentity, this.person(false));
      event.track.onmute = () => this.emit("update"); event.track.onunmute = () => this.emit("update");
      this.emit("update");
    };
    pc.onconnectionstatechange = () => {
      if (this.closed || pc !== this.pc) return;
      if (pc.connectionState === "connected") {
        this.markConnected();
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") this.requestRestart(pc.connectionState === "failed" ? 0 : 1800);
    };
    pc.oniceconnectionstatechange = () => {
      if (this.closed || pc !== this.pc) return;
      if (pc.iceConnectionState === "failed") this.requestRestart();
      else if (pc.connectionState === "connected" && ["connected", "completed"].includes(pc.iceConnectionState)) this.markConnected();
    };
  }
  private markConnected() {
    if (this.closed || this.state === "connected") return;
    const reconnecting = this.everConnected; this.everConnected = true; this.restarts = 0;
    clearTimeout(this.restartTimer); clearTimeout(this.restartWatchdog);
    this.state = "connected"; this.emit(reconnecting ? "reconnected" : "update");
    void this.applyQuality();
  }
  private rememberUfrags() {
    for (const match of this.pc.localDescription?.sdp.matchAll(/^a=ice-ufrag:(.+)$/gm) ?? []) this.ufrags.set(match[1].trim(), this.localRound);
    if (this.ufrags.size > 24) this.ufrags.delete(this.ufrags.keys().next().value!);
  }
  private async offer() {
    const pc = this.pc;
    if (this.closed || pc.signalingState !== "stable" || (this.config.polite && !pc.remoteDescription)) return;
    this.localRound = crypto.randomUUID();
    await pc.setLocalDescription();
    if (this.closed || pc !== this.pc) return;
    this.rememberUfrags();
    const description = pc.localDescription!;
    await this.signaling.send({ type: "description", negotiationId: this.localRound, description: { type: "offer", sdp: description.sdp } });
  }
  private async flushCandidates() {
    this.candidateTimer = undefined;
    if (this.closed) return;
    const batches = [...this.outgoingCandidates]; this.outgoingCandidates.clear();
    for (const [negotiationId, candidates] of batches) for (let index = 0; index < candidates.length; index += 16) {
      await this.signaling.send({ type: "candidates", negotiationId, candidates: candidates.slice(index, index + 16) }).catch(() => this.requestRestart());
    }
  }
  private async receive(message: CallSignalMessage) {
    if (this.closed || message.fromUserId !== this.config.peerId || this.oldEpochs.has(message.epoch)) return;
    const payload = message.payload;
    if (this.remoteEpoch && this.remoteEpoch !== message.epoch) {
      if (payload.type !== "ready") return;
      this.oldEpochs.add(this.remoteEpoch);
      if (this.oldEpochs.size > 32) this.oldEpochs.delete(this.oldEpochs.values().next().value!);
      this.remoteTracks.forEach(track => track.stop()); this.remoteTracks.clear(); this.remoteParticipants.clear();
      this.createPeer(); this.state = this.everConnected ? "reconnecting" : "connecting"; this.emit("reconnecting");
    }
    this.remoteEpoch = message.epoch;
    if (payload.type === "ready") {
      await this.sendMedia();
      if (!this.config.polite) await this.enqueue(async () => {
        if (this.pc.signalingState === "have-local-offer" && this.pc.localDescription) {
          await this.signaling.send({ type: "description", negotiationId: this.localRound, description: { type: "offer", sdp: this.pc.localDescription.sdp } });
        } else if (!this.pc.remoteDescription) await this.offer();
      });
    } else if (payload.type === "media") { this.peer = payload.state; this.emit("update"); }
    else if (payload.type === "bye") { this.state = "reconnecting"; this.emit("reconnecting"); window.dispatchEvent(new Event("eclipse:calls-changed")); }
    else await this.enqueue(() => this.negotiate(payload)).catch(() => this.requestRestart());
  }
  private async negotiate(payload: Extract<CallSignalPayload, { type: "description" | "candidates" }>) {
    if (this.closed) return;
    const pc = this.pc;
    if (payload.type === "description") {
      const collision = payload.description.type === "offer" && pc.signalingState !== "stable";
      if (collision && !this.config.polite) {
        this.ignored.add(payload.negotiationId);
        if (this.ignored.size > 32) this.ignored.delete(this.ignored.values().next().value!);
        return;
      }
      if (payload.description.type === "answer" && (pc.signalingState !== "have-local-offer" || payload.negotiationId !== this.localRound)) return;
      if (collision) await pc.setLocalDescription({ type: "rollback" });
      await pc.setRemoteDescription(payload.description);
      if (this.closed || pc !== this.pc) return;
      this.remoteRound = payload.negotiationId;
      if (payload.description.type === "offer") {
        const received = pc.getTransceivers();
        for (let index = 0; index < sources.length; index++) {
          const transceiver = received[index]; if (!transceiver) continue;
          const source = sources[index]; this.transceivers.set(source, transceiver);
          transceiver.direction = "sendrecv";
          const local = this.localTracks.get(source);
          if (local && this.self[mediaKey[source]]) await transceiver.sender.replaceTrack(local.mediaStreamTrack);
        }
        this.localRound = payload.negotiationId; await pc.setLocalDescription(); this.rememberUfrags();
        await this.signaling.send({ type: "description", negotiationId: payload.negotiationId, description: { type: "answer", sdp: pc.localDescription!.sdp } });
      }
      const waiting = this.candidates.get(payload.negotiationId) ?? []; this.candidates.delete(payload.negotiationId);
      for (const candidate of waiting) await pc.addIceCandidate(candidate).catch(() => {});
    } else {
      if (this.ignored.has(payload.negotiationId)) return;
      if (pc.remoteDescription && this.remoteRound === payload.negotiationId) {
        for (const candidate of payload.candidates) await pc.addIceCandidate(candidate).catch(() => {});
      } else if (this.candidates.size < 4) this.candidates.set(payload.negotiationId, [...(this.candidates.get(payload.negotiationId) ?? []), ...payload.candidates].slice(-256));
    }
  }
  private sendMedia() { return this.signaling.send({ type: "media", state: { ...this.self } }); }
  private requestRestart(delay = 0) {
    if (this.closed || this.restartTimer) return;
    if (this.everConnected) { this.state = "reconnecting"; this.emit("reconnecting"); }
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined;
      void this.restart().catch(() => {});
    }, delay);
  }
  private async restart() {
    if (this.restarting) return this.restarting;
    this.restarting = this.restartConnection().finally(() => { this.restarting = null; });
    return this.restarting;
  }
  private async restartConnection() {
    if (this.closed) return;
    if (++this.restarts > 4) { await this.disconnect(); return; }
    try {
      const config = await this.signaling.refresh(); if (this.closed) return;
      this.config = config;
      this.pc.setConfiguration({ ...this.pc.getConfiguration(), iceServers: config.iceServers, iceTransportPolicy: config.iceTransportPolicy });
      this.pc.restartIce();
      if (!this.config.polite || this.pc.remoteDescription) await this.enqueue(() => this.offer());
      await this.signaling.send({ type: "ready" }); this.scheduleCredentials();
    } finally {
      clearTimeout(this.restartWatchdog);
      if (!this.closed) this.restartWatchdog = setTimeout(() => { if (this.pc.connectionState !== "connected") this.requestRestart(); }, 6000 + this.restarts * 1500);
    }
  }
  private scheduleCredentials() {
    clearTimeout(this.credentialTimer);
    this.credentialTimer = setTimeout(() => { void this.restart().catch(() => {}); }, Math.max(30_000, this.config.turnExpiresAt - Date.now() - 120_000));
  }
  diagnostics() { return { transport: "p2p", state: this.state, quality: this.quality, ...this.sample }; }

  // Media capture, output and stats are implemented below, independent of UI.
  private async replace(source: CallTrackSource, native: MediaStreamTrack, enabled = true) {
    if (this.closed) { native.stop(); throw new DOMException("Call ended", "AbortError"); }
    native.enabled = enabled;
    try { await this.transceivers.get(source)?.sender.replaceTrack(native); }
    catch (error) { native.stop(); throw error; }
    if (this.closed) { native.stop(); throw new DOMException("Call ended", "AbortError"); }
    const current = this.localTracks.get(source);
    if (current) current.replace(native); else this.localTracks.set(source, new NativeCallTrack(source, native, this, true));
    native.onended = () => {
      if (this.closed || this.localTracks.get(source)?.mediaStreamTrack !== native) return;
      this.self[mediaKey[source]] = false;
      void this.transceivers.get(source)?.sender.replaceTrack(null).catch(() => {});
      this.emit("update"); void this.sendMedia().catch(() => {});
    };
    this.self[mediaKey[source]] = enabled;
    this.emit("update"); await this.sendMedia().catch(() => {}); await this.applyQuality();
  }
  private async microphone(enabled: boolean, noiseSuppression = true) {
    const current = this.localTracks.get("microphone");
    if (enabled && (!current || current.mediaStreamTrack.readyState === "ended")) {
      const audio = { ...audioConstraints, noiseSuppression };
      if (!noiseSuppression) audio.advanced = [{ echoCancellation: true, autoGainControl: true, noiseSuppression: false }];
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      await this.replace("microphone", stream.getAudioTracks()[0]);
    } else {
      if (current) current.mediaStreamTrack.enabled = enabled;
      const sender = this.transceivers.get("microphone")?.sender;
      if (enabled && current && sender && sender.track !== current.mediaStreamTrack) await sender.replaceTrack(current.mediaStreamTrack);
      this.self.microphone = enabled; this.emit("update"); await this.sendMedia().catch(() => {});
    }
  }
  private async setNoiseSuppression(enabled: boolean) {
    const current = this.localTracks.get("microphone")?.mediaStreamTrack;
    if (this.closed || !current || current.readyState !== "live") throw new DOMException("Microphone unavailable", "AbortError");
    const { echoCancellation, autoGainControl } = current.getSettings();
    const constraints = {
      ...current.getConstraints(),
      ...(echoCancellation !== undefined && { echoCancellation: { exact: echoCancellation } }),
      ...(autoGainControl !== undefined && { autoGainControl: { exact: autoGainControl } }),
      noiseSuppression: { exact: enabled },
    };
    await current.applyConstraints(constraints).catch(() => {});
    if (this.closed) throw new DOMException("Call ended", "AbortError");
    if (current.readyState === "live" && current.getSettings().noiseSuppression === enabled) return;

    // Some browsers can only change microphone processing on a fresh capture.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    const track = stream.getAudioTracks()[0];
    if (track.getSettings().noiseSuppression !== enabled) {
      track.stop();
      throw new Error("Noise suppression was not applied");
    }
    await this.replace("microphone", track, this.self.microphone);
  }
  private async camera(enabled: boolean, facingMode: CameraRestartOptions["facingMode"] = "user") {
    if (!enabled) { await this.transceivers.get("camera")?.sender.replaceTrack(null); this.localTracks.get("camera")?.stop(); this.self.camera = false; this.emit("update"); await this.sendMedia().catch(() => {}); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 30, max: 30 }, facingMode } });
    const track = stream.getVideoTracks()[0]; track.contentHint = "motion"; await this.replace("camera", track);
  }
  async restartCamera(options: CameraRestartOptions) {
    this.localTracks.get("camera")?.mediaStreamTrack.stop();
    const resolution = options.resolution ?? { width: 1280, height: 720, frameRate: 30 };
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: resolution.width }, height: { ideal: resolution.height }, frameRate: { ideal: resolution.frameRate, max: 30 }, facingMode: options.facingMode, deviceId: options.deviceId } });
    await this.replace("camera", stream.getVideoTracks()[0]);
  }
  private async screen(enabled: boolean) {
    if (!enabled) {
      for (const source of ["screen_share", "screen_share_audio"] as const) { await this.transceivers.get(source)?.sender.replaceTrack(null); this.localTracks.get(source)?.stop(); this.self[mediaKey[source]] = false; }
      this.emit("update"); await this.sendMedia().catch(() => {}); return;
    }
    const capture = { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 45, max: 45 } }, audio: true, selfBrowserSurface: "exclude", surfaceSwitching: "include" };
    const stream = await navigator.mediaDevices.getDisplayMedia(capture);
    if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
    const video = stream.getVideoTracks()[0]; video.contentHint = "detail";
    try {
      await this.replace("screen_share", video);
      const audio = stream.getAudioTracks()[0]; if (audio) await this.replace("screen_share_audio", audio);
      video.onended = () => { if (!this.closed) void this.screen(false); };
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      await this.screen(false).catch(() => {});
      throw error;
    }
  }
  attachAudio(track: NativeCallTrack, element: HTMLMediaElement) {
    let output = this.outputs.get(track);
    if (!output) { output = { elements: new Set(), volume: 1 }; this.outputs.set(track, output); }
    output.elements.add(element);
    const context = this.audioContext();
    if (context && !output.source) {
      output.source = context.createMediaStreamSource(new MediaStream([track.mediaStreamTrack])); output.gain = context.createGain();
      output.gain.gain.value = output.volume; output.source.connect(output.gain); output.gain.connect(context.destination);
    }
    element.muted = Boolean(output.gain); element.volume = output.gain ? 0 : output.volume;
    void this.startAudio().catch(() => {});
  }
  detachAudio(track: NativeCallTrack, element: HTMLMediaElement) {
    const output = this.outputs.get(track); if (!output) return;
    output.elements.delete(element);
    if (!output.elements.size) { output.source?.disconnect(); output.gain?.disconnect(); this.outputs.delete(track); }
    if (!this.outputs.size) this.setAudioPlayback(true);
  }
  volume(track: NativeCallTrack, volume: number) {
    const output = this.outputs.get(track); if (!output) return;
    output.volume = Math.max(0, Math.min(1, volume));
    if (output.gain && this.audio) output.gain.gain.setTargetAtTime(output.volume, this.audio.currentTime, .025);
    for (const element of output.elements) { element.muted = Boolean(output.gain); element.volume = output.gain ? 0 : output.volume; }
  }
  private audioContext() {
    if (this.closed || typeof AudioContext === "undefined") return undefined;
    try { return this.audio ??= new AudioContext(); } catch { return undefined; }
  }
  private setAudioPlayback(allowed: boolean) {
    if (this.closed || this.canPlaybackAudio === allowed) return;
    this.canPlaybackAudio = allowed;
    this.emit("audioPlayback");
  }
  async startAudio() {
    if (this.closed) return;
    const context = this.audioContext();
    const playback: Promise<void>[] = [];
    for (const output of this.outputs.values()) for (const element of output.elements) {
      const play = element.play().catch(error => {
        // A muted element is only an attachment when the gain node plays the audio.
        if (!output.gain && output.elements.has(element) && error?.name === "NotAllowedError") throw error;
      });
      if (!output.gain) playback.push(play);
    }
    if (context && context.state !== "running") {
      if (this.outputs.size) this.setAudioPlayback(false);
      playback.push(context.resume());
    }
    try {
      await Promise.all(playback);
      if (!context || context.state === "running") this.setAudioPlayback(true);
    } catch (error) {
      if (this.outputs.size && error instanceof DOMException && error.name === "NotAllowedError") this.setAudioPlayback(false);
      throw error;
    }
  }
  private async applyQuality() {
    if (this.closed) return;
    for (const [source, transceiver] of this.transceivers) {
      if (!transceiver.sender.track) continue;
      const parameters = transceiver.sender.getParameters(); if (!parameters.encodings?.length) continue;
      if (source === "microphone" || source === "screen_share_audio") parameters.encodings[0].maxBitrate = source === "microphone" ? 96_000 : 128_000;
      else { Object.assign(parameters.encodings[0], p2pEncoding(this.quality, source === "screen_share", this.self.screen)); parameters.degradationPreference = source === "screen_share" ? "maintain-resolution" : "maintain-framerate"; }
      await transceiver.sender.setParameters(parameters).catch(() => {});
    }
  }
  private async readStats() {
    if (this.closed || this.pc.connectionState !== "connected") return;
    // Some browsers keep connectionState=connected across an ICE restart,
    // so no second connectionstatechange event arrives to clear reconnecting.
    if (this.state === "reconnecting" && !this.restarting && this.pc.signalingState === "stable" && ["connected", "completed"].includes(this.pc.iceConnectionState)) this.markConnected();
    try {
      const report = await this.pc.getStats();
      let received = 0, lost = 0, rtt = 0, bitrate: number | undefined, candidateType = "unknown", bytesReceived = 0;
      let selectedPair: RTCStats | undefined;
      report.forEach(stat => { if (stat.type === "transport" && stat.selectedCandidatePairId) selectedPair = report.get(stat.selectedCandidatePairId); });
      report.forEach(stat => {
        if (stat.type === "candidate-pair" && (selectedPair ? stat.id === selectedPair.id : stat.state === "succeeded" && (stat.nominated || stat.selected))) {
          rtt = stat.currentRoundTripTime ?? 0; bitrate = stat.availableOutgoingBitrate;
          candidateType = report.get(stat.localCandidateId)?.candidateType ?? "unknown";
        }
        if (stat.type === "inbound-rtp") { received += stat.packetsReceived ?? 0; lost += Math.max(0, stat.packetsLost ?? 0); bytesReceived += stat.bytesReceived ?? 0; }
      });
      const receivedDelta = Math.max(0, received - this.lastPackets.received), lostDelta = Math.max(0, lost - this.lastPackets.lost);
      const loss = receivedDelta + lostDelta > 0 ? lostDelta / (receivedDelta + lostDelta) : 0;
      this.lastPackets = { received, lost }; this.sample = { candidateType, rtt, loss, availableBitrate: bitrate ?? 0, bytesReceived };
      const video = this.self.camera || this.self.screen || this.peer.camera || this.peer.screen;
      const next = p2pQuality({ rtt, loss, availableBitrate: video ? bitrate : undefined });
      if (next !== this.qualityCandidate) { this.qualityCandidate = next; this.qualitySamples = 0; }
      if (++this.qualitySamples >= (next === "high" ? 3 : 2) && next !== this.quality) { this.quality = next; await this.applyQuality(); }
      const quality = next === "high" ? "excellent" : next === "medium" ? "good" : "poor";
      if (quality !== this.connectionQuality) { this.connectionQuality = quality; this.emit("update"); }
    } catch { /* A camera switch or ICE restart may invalidate one stats sample. */ }
  }
  async disconnect() {
    if (this.closed) return;
    // The server's call state is authoritative; a peer "bye" only requests a refresh.
    void this.signaling?.send({ type: "bye" }).catch(() => {});
    this.closed = true; this.ready = false;
    clearTimeout(this.restartTimer); clearTimeout(this.restartWatchdog); clearTimeout(this.candidateTimer); clearTimeout(this.credentialTimer); clearInterval(this.statsTimer);
    window.removeEventListener("online", this.online);
    this.signaling?.close(); this.pc?.close();
    this.localTracks.forEach(track => track.stop()); this.remoteTracks.forEach(track => track.stop());
    this.localTracks.clear(); this.remoteTracks.clear(); this.remoteParticipants.clear();
    this.outputs.forEach(output => { output.source?.disconnect(); output.gain?.disconnect(); }); this.outputs.clear();
    if (this.audio) void this.audio.close().catch(() => {});
    this.state = "disconnected"; this.emit("disconnected");
  }
}
