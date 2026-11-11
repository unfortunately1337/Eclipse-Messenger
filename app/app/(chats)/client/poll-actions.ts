"use client";

import { apiRequest } from "@/lib/client/http";

export type PollResult = { totalVotes: number; optionCounts: Record<number, number>; userVotedOptionIdx: number | null };
export interface HandlePollVoteActionContext {
  current: PollResult | undefined;
  setPollResults: React.Dispatch<React.SetStateAction<Record<string, PollResult>>>;
  mutationQueue?: Map<string, Promise<void>>;
}

export async function handlePollVoteAction({ current, setPollResults, mutationQueue }: HandlePollVoteActionContext, messageId: string, optionIdx: number | null): Promise<void> {
  const previous = current ?? { totalVotes: 0, optionCounts: {}, userVotedOptionIdx: null };
  if (previous.userVotedOptionIdx === optionIdx) return;
  const counts = { ...previous.optionCounts };
  if (previous.userVotedOptionIdx !== null) {
    const index = previous.userVotedOptionIdx;
    counts[index] = Math.max(0, (counts[index] ?? 0) - 1);
  }
  if (optionIdx !== null) counts[optionIdx] = (counts[optionIdx] ?? 0) + 1;
  const optimistic = { totalVotes: Object.values(counts).reduce((sum, count) => sum + count, 0), optionCounts: counts, userVotedOptionIdx: optionIdx };
  setPollResults(prev => ({ ...prev, [messageId]: optimistic }));
  const send = () => apiRequest<PollResult>("/api/polls", { method: "POST", body: JSON.stringify({ messageId, optionIdx }) });
  const previousRequest = mutationQueue?.get(messageId);
  const request = previousRequest ? previousRequest.then(send, send) : send();
  const settled = request.then(() => {}, () => {});
  mutationQueue?.set(messageId, settled);
  try {
    const result = await request;
    setPollResults(prev => prev[messageId] === optimistic ? { ...prev, [messageId]: result } : prev);
  } catch (error) {
    // Restore immediately even when the server cannot be reached for a refresh.
    setPollResults(prev => prev[messageId] === optimistic ? { ...prev, [messageId]: previous } : prev);
    throw error;
  } finally {
    if (mutationQueue?.get(messageId) === settled) mutationQueue.delete(messageId);
  }
}
