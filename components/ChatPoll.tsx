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
  isRemoving?: boolean;
  replyPreviewBlock?: React.ReactNode;
  reactions?: any[];
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
  expiresAt,
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

  useEffect(() => {
    onFetchResults();
  }, [messageId]);

  const hasVoted = myVoteIndex !== null;
  const showResults = hasVoted || isClosed;
  const isDisableVoting = isClosed || (quizMode && hasVoted);

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

  const getExpiryText = () => {
    if (isClosed) return t("Опрос завершен");
    if (!expiresAt) return t("Активный опрос");
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return t("Опрос завершен");
    const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffHrs > 24) {
      return t("Осталось {0} дн.", { 0: Math.round(diffHrs / 24) });
    }
    return t("Осталось {0} ч.", { 0: diffHrs });
  };

  return (
    <div data-chat-poll
      className={`relative flex flex-col gap-1.5 transition-opacity duration-75 ${
        isRemoving ? `message-dissolve-target ${isMine ? "message-dissolve-target-mine" : "message-dissolve-target-incoming"}` : ""
      }`}
    >
      <div
        style={bubbleStyle}
        className={cn("relative z-10 flex min-h-[44px] w-[min(84vw,370px)] md:w-[350px] lg:w-[370px] flex-col gap-2.5 rounded-[22px] p-4 text-zinc-100 shadow-sm", bubbleClassName, stackedBubbleShapeClass, bubbleTailClass)}
      >
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

        <div className="-mx-1.5 flex flex-col gap-0.5">
          {options.map((option, idx) => <PollChoice key={idx} option={option} index={idx}
            percentage={getPercentage(idx)} selected={myVoteIndex === idx}
            correct={quizMode && showResults && correctOptionIndex === idx}
            wrong={quizMode && showResults && myVoteIndex === idx && correctOptionIndex !== null && correctOptionIndex !== idx}
            showResults={showResults} disabled={isDisableVoting || votingIdx !== null}
            pending={votingIdx === idx} isMine={isMine} onVote={() => void handleVote(idx)} />)}
        </div>

        <div className="flex flex-col gap-1.5 mt-1 select-none pb-0.5">
          {reactions && reactions.length > 0 ? (
            <>
              {/* Row 1: Votes and Expiry */}
              <div className="flex items-center text-[12px] font-normal opacity-65">
                <span>
                  {plural(totalVotes, ["голос", "голоса", "голосов"], "vote")}
                </span>
                <span className="mx-1 opacity-50">·</span>
                <span>{getExpiryText()}</span>
              </div>

              {/* Row 2: Reactions and Meta aligned */}
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <div className="flex-1 min-w-0">
                  {renderInlineReactions(isMine ? "end" : "start")}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {renderBubbleMeta({})}
                </div>
              </div>
            </>
          ) : (
            /* Single Row: Votes + Expiry on left, Meta on right */
            <div className="flex items-end justify-between text-[12px] font-normal opacity-65">
              <div className="flex items-center gap-1.5">
                <span>
                  {plural(totalVotes, ["голос", "голоса", "голосов"], "vote")}
                </span>
                <span className="opacity-50">·</span>
                <span>{getExpiryText()}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {renderBubbleMeta({})}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
