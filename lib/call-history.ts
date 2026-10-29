import type { CallMode } from "./calls";

export type CallOutcome = "completed" | "cancelled" | "declined" | "missed";
export type CallMessageData = {
  id: string;
  callerId: string;
  calleeId: string;
  mode: CallMode;
  status: "ringing" | "active" | "ended";
  outcome: CallOutcome | null;
  startedAt: number | null;
  endedAt: number | null;
  durationSeconds: number;
};

export function readCallMessage(payload: unknown): CallMessageData | null {
  if (!payload || typeof payload !== "object" || !("eventType" in payload) || payload.eventType !== "call") return null;
  const call = (payload as { metadata?: { call?: CallMessageData } }).metadata?.call;
  if (!call || typeof call.id !== "string" || typeof call.callerId !== "string" || typeof call.calleeId !== "string" ||
      !["audio", "video"].includes(call.mode) || !["ringing", "active", "ended"].includes(call.status) ||
      ![null, "completed", "cancelled", "declined", "missed"].includes(call.outcome) ||
      !Number.isFinite(call.durationSeconds) || call.durationSeconds < 0) return null;
  return call;
}

/** Return translation keys; direction is always relative to the viewer. */
export function callMessageTitle(call: CallMessageData, selfId: string) {
  if (call.status !== "ended" || call.outcome === "completed") return call.callerId === selfId ? "Исходящий звонок" : "Входящий вызов";
  if (call.outcome === "cancelled") return "Отменённый звонок";
  if (call.outcome === "declined") return "Отклонённый звонок";
  return call.callerId === selfId ? "Нет ответа" : "Пропущенный звонок";
}

export function formatCallDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  return hours ? `${hours}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
    : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
