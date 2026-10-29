export type CallSignal = { bars: number; state: "unknown" | "good" | "poor" | "lost" | "reconnecting" };
const scores: Record<string, number> = { excellent: 4, good: 3, poor: 1, lost: 0 };

/** The worse of the two media links determines a personal call's signal. */
export function callConnectionSignal(state: string | undefined, qualities: readonly string[], ended = false): CallSignal {
  if (ended || !state || state === "connecting" || state === "disconnected") return { bars: 0, state: "unknown" };
  if (state === "reconnecting" || state === "signalReconnecting") return { bars: 0, state: "reconnecting" };
  const known = qualities.map(value => scores[value]).filter(value => value !== undefined);
  if (!known.length) return { bars: 0, state: "unknown" };
  const bars = Math.min(...known);
  return { bars, state: bars === 0 ? "lost" : bars === 1 ? "poor" : "good" };
}
