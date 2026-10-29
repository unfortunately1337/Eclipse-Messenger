export type CallKind = "direct" | "group";
export type CallMode = "audio" | "video";
export type CallStatus = "ringing" | "active" | "ended";

export type CallView = {
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

export type CallsSnapshot = { enabled: boolean; current: CallView | null; groupCall: CallView | null; ended?: { id: string; outcome: NonNullable<CallView["endOutcome"]> } | null };
export type CallConnection = { url: string; token: string; identity: string };
export const CALL_GROUP_LIMIT = 24;
