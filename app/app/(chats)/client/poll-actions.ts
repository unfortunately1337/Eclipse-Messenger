"use client";

import { apiRequest } from "@/lib/client/http";

export interface HandlePollVoteActionContext {
  setPollResults: React.Dispatch<React.SetStateAction<Record<string, { totalVotes: number; optionCounts: Record<number, number>; userVotedOptionIdx: number | null; }>>>;
}

export async function handlePollVoteAction({ setPollResults }: HandlePollVoteActionContext, messageId: string, optionIdx: number): Promise<void> {
  try {
    // Optimistic update
    setPollResults((prev) => {
      const current = prev[messageId] || { totalVotes: 0, optionCounts: {}, userVotedOptionIdx: null };
      const isRetract = current.userVotedOptionIdx === optionIdx;
      const newVotedIdx = isRetract ? null : optionIdx;
      const newCounts = { ...current.optionCounts };

      if (current.userVotedOptionIdx !== null) {
        const prevIdx = current.userVotedOptionIdx;
        newCounts[prevIdx] = Math.max(0, (newCounts[prevIdx] || 1) - 1);
      }

      if (newVotedIdx !== null) {
        newCounts[newVotedIdx] = (newCounts[newVotedIdx] || 0) + 1;
      }

      const newTotal = Object.values(newCounts).reduce((a, b) => a + b, 0);
      return {
        ...prev,
        [messageId]: {
          totalVotes: newTotal,
          optionCounts: newCounts,
          userVotedOptionIdx: newVotedIdx,
        }
      };
    });

    const res = await apiRequest<{ totalVotes: number; optionCounts: Record<number, number>; userVotedOptionIdx: number | null }>(
      "/api/polls",
      {
        method: "POST",
        body: JSON.stringify({ messageId, optionIdx }),
      }
    );

    setPollResults((prev) => ({
      ...prev,
      [messageId]: res,
    }));
  } catch (err) {
    console.error("Failed to vote in poll:", err);
    try {
      const res = await apiRequest<{ totalVotes: number; optionCounts: Record<number, number>; userVotedOptionIdx: number | null }>(
        `/api/polls?messageId=${encodeURIComponent(messageId)}`,
        { method: "GET" }
      );
      setPollResults((prev) => ({
        ...prev,
        [messageId]: res,
      }));
    } catch { }
  }
}
