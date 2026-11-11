"use client";
import { plural } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import React, { useState, useEffect, useRef } from "react";
import { PollChoice } from "@/components/PollChoice";
import { cn } from "@/lib/utils";


interface ChatPollProps {
  messageId: string;
  question: string;
  options: string[];
  quizMode: boolean;
  correctOptionIndex: number | null;
  expiresAt: string | null;

  myVoteIndex: number | null;
  totalVotes: number;
  optionCounts: Record<number, number>;
  isClosed: boolean;
  onVote: (optionIndex: number) => Promise<void> | void;
  onFetchResults: () => void;

  bubbleClassName?: string;
  bubbleStyle?: React.CSSProperties;
  stackedBubbleShapeClass?: string;
  bubbleTailClass?: string;
  tailSlot?: React.ReactNode;
  isRemoving?: boolean;
  replyPreviewBlock?: React.ReactNode;
  reactions?: readonly unknown[];
  renderInlineReactions?: (align: "start" | "end") => React.ReactNode;
  renderBubbleMeta?: (props: { isReadDone?: boolean }) => React.ReactNode;
  isMine?: boolean;
}

export default function ChatPoll({
  messageId,
  question,
  options,
  quizMode,
  correctOptionIndex,
  myVoteIndex,
  totalVotes,
  optionCounts,
  isClosed,
  onVote,
  onFetchResults,
  bubbleClassName = "",
  bubbleStyle,
  stackedBubbleShapeClass = "",
  bubbleTailClass = "",
  tailSlot,
  isRemoving = false,
  replyPreviewBlock,
  reactions = [],
  renderInlineReactions = () => null,
  renderBubbleMeta = () => null,
  isMine = false,
}: ChatPollProps) {
  const t = useTranslation();
  const [votingIdx, setVotingIdx] = useState<number | null>(null);
  const voteInFlight = useRef(false);

  const fetchResultsRef = useRef(onFetchResults);
  useEffect(() => { fetchResultsRef.current = onFetchResults; }, [onFetchResults]);
  useEffect(() => { fetchResultsRef.current(); }, [messageId]);

  const hasVoted = myVoteIndex !== null;
  const showResults = hasVoted || isClosed;
  const isDisableVoting = isClosed || hasVoted;

  async function handleVote(optionIdx: number) {
    if (isDisableVoting || voteInFlight.current) return;
    voteInFlight.current = true;
    setVotingIdx(optionIdx);
    try {
      await onVote(optionIdx);
    } catch (err) {
      console.error("Failed to vote:", err);
    } finally {
      voteInFlight.current = false;
      setVotingIdx(null);
    }
  }

  const getPercentage = (idx: number) => {
    if (totalVotes === 0) return 0;
    const count = optionCounts[idx] ?? 0;
    return Math.max(0, Math.min(100, Math.round((count / totalVotes) * 100)));
  };

  return (
    <div data-chat-poll
      className={`relative flex max-w-full flex-col gap-1.5 transition-opacity duration-75 ${
        isRemoving ? `message-dissolve-target ${isMine ? "message-dissolve-target-mine" : "message-dissolve-target-incoming"}` : ""
      }`}
    >
      <div
        style={bubbleStyle}
        className={cn("relative z-10 flex min-h-[44px] max-w-full w-[min(84vw,370px)] md:w-[350px] lg:w-[370px] flex-col gap-2.5 rounded-[22px] p-4 text-zinc-100 shadow-sm", bubbleClassName, stackedBubbleShapeClass, bubbleTailClass)}
      >
        {tailSlot}
        {replyPreviewBlock}

        {/* Telegram-style Question & Subtitle Header */}
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[15px] sm:text-[15.5px] font-semibold leading-[1.3] tracking-tight text-current select-text break-words">
            {question}
          </h3>
          <p className="text-[12px] text-current/60 font-normal leading-tight mt-0.5 select-none">
            {quizMode ? t("Викторина") : t("Анонимный опрос")}
          </p>
        </div>

        <div className="-mx-1.5 flex flex-col gap-1">
          {options.map((option, idx) => <PollChoice key={idx} option={option} index={idx}
            percentage={getPercentage(idx)} selected={myVoteIndex === idx}
            correct={quizMode && showResults && correctOptionIndex === idx}
            wrong={quizMode && showResults && myVoteIndex === idx && correctOptionIndex !== null && correctOptionIndex !== idx}
            showResults={showResults} disabled={isDisableVoting || votingIdx !== null}
            pending={votingIdx === idx} isMine={isMine} onVote={() => void handleVote(idx)} />)}
        </div>

        <div className="mt-1 flex flex-col gap-2 select-none pb-0.5">
          {reactions.length > 0 && <div className="min-w-0">{renderInlineReactions(isMine ? "end" : "start")}</div>}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-1 text-[11px] font-medium leading-4 tabular-nums">
            <span />
            <span data-poll-vote-count className="text-center opacity-65">{plural(totalVotes, ["голос", "голоса", "голосов"], "vote")}</span>
            <div className="flex items-baseline justify-end gap-1">{renderBubbleMeta({})}</div>
          </div>
          <span className="sr-only" role="status">{hasVoted ? t("Голос засчитан") : ""}</span>
        </div>
      </div>
    </div>
  );
}
