export type CallKind = "direct" | "group";
export type CallMode = "audio" | "video";
export type CallStatus = "ringing" | "active" | "ended";
export type CallTransport = "livekit" | "p2p";

export type CallView = {
  transport?: CallTransport;
  requesting?: boolean;
  id: string;
  kind: CallKind;
  mode: CallMode;
  status: CallStatus;
  link: string;
  title: string;
  peer?: { id: string; name: string; avatarUrl: string | null; backgroundUrl: string | null };
  callerId: string;
  createdAt: number;
  startedAt: number | null;
  expiresAt: number;
  participantCount: number;
  participants: { id: string; identity: string; name: string; avatarUrl: string | null }[];
  incoming: boolean;
  onThisSession: boolean;
  canEnd: boolean;
  endOutcome?: "completed" | "cancelled" | "declined" | "missed";
  audioPreferences?: Record<string, { volume: number; muted: boolean }>;
};

export type CallsSnapshot = { enabled: boolean; directTransport?: CallTransport; current: CallView | null; groupCall: CallView | null; ended?: { id: string; outcome: NonNullable<CallView["endOutcome"]> } | null };
export type LiveKitCallConnection = { transport?: "livekit"; url: string; token: string; identity: string };
export type P2PCallConnection = {
  transport: "p2p"; callId: string; clientId: string; selfId: string; peerId: string;
  identity: string; peerIdentity: string; polite: boolean;
  iceServers: RTCIceServer[]; iceTransportPolicy: RTCIceTransportPolicy;
  turnExpiresAt: number; relayConfigured: boolean;
};
export type CallConnection = LiveKitCallConnection | P2PCallConnection;
export const CALL_GROUP_LIMIT = 24;
