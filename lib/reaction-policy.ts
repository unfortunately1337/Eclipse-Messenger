export const AVAILABLE_REACTIONS = [
  "\u2764\uFE0F",
  "\u{1F44D}",
  "\u{1F44E}",
  "\u{1F525}",
  "\u{1F602}",
  "\u{1F970}",
  "\u{1F62D}",
  "\u{1F621}",
  "\u{1F44F}",
  "\u{1F389}",
  "\u{1F4A9}",
  "\u{1F64F}",
  "\u{1F631}",
  "\u{1F914}",
  "\u{1F60D}",
  "\u{1F929}",
  "\u{1F60E}",
  "\u{1F92F}",
  "\u{1F973}",
  "\u{1F601}",
  "\u{1F605}",
  "\u{1F923}",
  "\u{1F60A}",
  "\u{1F609}",
  "\u{1F618}",
  "\u{1F917}",
  "\u{1F92B}",
  "\u{1F610}",
  "\u{1F60F}",
  "\u{1F62C}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F634}",
  "\u{1F922}",
  "\u{1F975}",
  "\u{1F976}",
  "\u{1F4AF}",
  "\u{1F48B}",
  "\u{1F47B}",
];

export type ReactionMode = "all" | "some" | "none";
export type ReactionPolicy = { reactionMode?: string; allowedReactions?: string[] };
export const normalizeReaction = (emoji: string) => emoji.replace(/\uFE0F/g, "").trim();
const canonical = new Map(AVAILABLE_REACTIONS.map(emoji => [normalizeReaction(emoji), emoji]));
export function canonicalReaction(emoji: string) { return canonical.get(normalizeReaction(emoji)); }
export function normalizeAllowedReactions(emojis: string[]): string[] {
  return [...new Set(emojis.map(canonicalReaction).filter((emoji): emoji is string => Boolean(emoji)))];
}
export function isReactionAllowed(policy: ReactionPolicy | null | undefined, emoji: string): boolean {
  if (policy?.reactionMode === "none") return false;
  if (policy?.reactionMode !== "some") return true;
  return (policy.allowedReactions ?? []).some(allowed => normalizeReaction(allowed) === normalizeReaction(emoji));
}
export function availableReactions(policy?: ReactionPolicy | null): string[] {
  return AVAILABLE_REACTIONS.filter(emoji => isReactionAllowed(policy, emoji));
}
// A restricted chat must still surface reactions outside the usual quick set.
export function quickReactions(policy: ReactionPolicy | null | undefined, defaults: string[], limit = defaults.length): string[] {
  const allowed = availableReactions(policy);
  return policy?.reactionMode === "some" ? allowed.slice(0, limit) : defaults.filter(emoji => isReactionAllowed(policy, emoji));
}
