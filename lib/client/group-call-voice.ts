export type GroupVoiceSample = { id: string; local: boolean; level: number };
export const GROUP_VOICE_COLORS = ["#60a5fa", "#6ee7b7", "#f9a8d4", "#c4b5fd"] as const;
export function groupVoiceChannel(callId: string, id: string, local: boolean) {
  if (local) return 0;
  let value = 2166136261;
  for (const char of callId + ":" + id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return 1 + (value >>> 0) % 3;
}
// A fixed four-layer renderer stays inexpensive as the participant count grows.
export function groupVoiceLevels(callId: string, samples: GroupVoiceSample[]) {
  const levels = [0, 0, 0, 0];
  for (const sample of samples) {
    if (!Number.isFinite(sample.level)) continue;
    const channel = groupVoiceChannel(callId, sample.id, sample.local);
    levels[channel] = Math.max(levels[channel], Math.min(1, Math.max(0, sample.level)));
  }
  return levels;
}
