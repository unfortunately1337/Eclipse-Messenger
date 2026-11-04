/** Signaling data is exchanged only through authenticated, per-call inboxes. */
export type CallMediaState = { microphone: boolean; camera: boolean; screen: boolean; screenAudio: boolean };
export type CallSignalPayload =
  | { type: "ready" }
  | { type: "description"; negotiationId: string; description: { type: "offer" | "answer"; sdp: string } }
  | { type: "candidates"; negotiationId: string; candidates: RTCIceCandidateInit[] }
  | { type: "media"; state: CallMediaState }
  | { type: "bye" };
export type CallSignalInput = { id: string; clientId: string; epoch: string; payload: CallSignalPayload };
export type CallSignalMessage = CallSignalInput & { sequence: number; sentAt: number; fromUserId: string };
export type CallSignalInbox = { messages: CallSignalMessage[]; cursor: number; reset: boolean };
export const CALL_SIGNAL_HINT_EVENT = "eclipse:call-signal";
