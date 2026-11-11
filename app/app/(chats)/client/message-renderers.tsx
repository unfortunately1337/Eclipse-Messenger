"use client";

import { type DecryptedMessage, type ChatSummary, type ConversationResponse, type SelfProfile, type ConversationChatType, type ReactionSummary } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type CustomChatTheme, customThemeReactionSurface } from "@/lib/client/custom-chat-theme";
import { isReactionAllowed, type ReactionPolicy } from "@/lib/reaction-policy";
import { CSSProperties, ReactNode } from "react";
import { useMessageSearch } from "../hooks/useMessageSearch";
import { SearchHighlightedText } from "../components/common/SearchHighlightedText";
import { AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/client/http";
import { cn } from "@/lib/utils";
import { CodeBlock, parseCodeBlocks, parseInlineMarkdown } from "../components/common/CodeBlock";
import { type LiveBackgroundNeatPreset } from "@/lib/client/live-background";
import { renderEmojiText } from "@/components/EmojiText";
import { splitMessageTextSegments, isTrustedLinkHost } from "./message-links";
import { ReactionBadgeItem } from "./message-presentation";

export interface ToggleReactionActionContext {
  messagesRef: React.RefObject<DecryptedMessage[]>;
  reactionPolicy: (ReactionPolicy & { id: string; link: string; name: string; avatarUrl?: string | null | undefined; ownerId?: string | undefined; myRole?: string | undefined; myCanChangeReactions?: boolean | undefined; myCanPinMessages?: boolean | undefined; createdAt?: string | undefined; myJoinedAt?: string | undefined; }) | (ReactionPolicy & { id: string; link: string; name: string; avatarUrl?: string | null | undefined; ownerId: string; isOwner?: boolean | undefined; isSubscribed: boolean; myRole?: string | undefined; myRoleLabel?: string | null | undefined; myCanChangeAvatar?: boolean | undefined; myCanChangeName?: boolean | undefined; myCanChangeReactions?: boolean | undefined; myCanPinMessages?: boolean | undefined; myCanPostMessages?: boolean | undefined; myCanEditForeignMessages?: boolean | undefined; myCanDeleteForeignMessages?: boolean | undefined; myCanAddMembers?: boolean | undefined; myCanGenerateInviteLink?: boolean | undefined; myCanManageAdmins?: boolean | undefined; subscribersCount: string; createdAt?: string | undefined; myJoinedAt?: string | null | undefined; }) | undefined;
  activeChat: ChatSummary | null;
  activeConversation: ConversationResponse | null;
  reactionInFlightRef: React.RefObject<Set<string>>;
  selectedLinkRef: React.RefObject<string | null>;
  triggerReactionPulse: (messageId: string, emoji: string) => void;
  selfProfile: SelfProfile | null;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  syncConversationCacheMessages: (link: string, chatType: ConversationChatType, updater: (messages: DecryptedMessage[]) => DecryptedMessage[]) => void;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function toggleReactionAction({ messagesRef, reactionPolicy, activeChat, activeConversation, reactionInFlightRef, selectedLinkRef, triggerReactionPulse, selfProfile, setMessages, syncConversationCacheMessages, setErrorText, t }: ToggleReactionActionContext, messageId: string, emoji: string): Promise<void> {
  if (!messageId || !emoji) return;
  const removing = messagesRef.current.find(message => message.id === messageId)?.reactions?.some(reaction => reaction.reacted && reaction.emoji.replace(/\uFE0F/g, "") === emoji.replace(/\uFE0F/g, ""));
  if (!removing && !isReactionAllowed(reactionPolicy, emoji)) return;
  if (messageId.startsWith("optimistic:") || messageId.startsWith("msg:")) {
    return;
  }
  if (
    activeChat?.link?.startsWith("secret-") ||
    activeConversation?.conversationId?.startsWith("secret:") ||
    activeChat?.conversationId?.startsWith("secret:")
  ) {
    return;
  }

  const rawChatType = activeConversation?.chatType ?? activeChat?.chatType ?? "direct";
  const requestKey = `${rawChatType}:${messageId}:${emoji}`;
  if (reactionInFlightRef.current.has(requestKey)) {
    return;
  }
  reactionInFlightRef.current.add(requestKey);

  let rollbackReactions: ReactionSummary[] | null = null;
  const currentLink = activeChat?.link ?? selectedLinkRef.current ?? null;
  const currentChatType = (
    rawChatType === "saved"
      ? "saved"
      : rawChatType === "group"
        ? "group"
        : rawChatType === "channel"
          ? "channel"
          : rawChatType === "eclipse"
            ? "eclipse"
            : "direct"
  ) as ConversationChatType;
  const existingReaction = messagesRef.current.find(message => message.id === messageId)?.reactions?.find(item => item.emoji.replace(/\uFE0F/g, "") === emoji.replace(/\uFE0F/g, ""));
  if (!existingReaction?.reacted) triggerReactionPulse(messageId, emoji);
  const optimisticUpdate = (items: DecryptedMessage[]) =>
    items.map((message) => {
      if (message.id !== messageId) return message;
      const current = message.reactions ?? [];
      rollbackReactions = current;
      const normEmoji = emoji.replace(/\uFE0F/g, "").trim();
      const isSameEmoji = (e: string) => e.replace(/\uFE0F/g, "").trim() === normEmoji;
      const isSavedChat = rawChatType === "saved";
      const sameReactionWasMine = current.some((item) => isSameEmoji(item.emoji) && (item.reacted || isSavedChat));
      const next = current
        .map((item) => {
          const isTargetEmoji = isSameEmoji(item.emoji);
          if (sameReactionWasMine && isTargetEmoji) {
            const nextCount = Math.max(0, item.count - 1);
            return nextCount > 0 ? { ...item, reacted: false, count: nextCount } : null;
          }
          if (!item.reacted) return item;
          const nextCount = Math.max(0, item.count - 1);
          return nextCount > 0 ? { ...item, reacted: false, count: nextCount } : null;
        })
        .filter((item): item is ReactionSummary => Boolean(item));

      if (!sameReactionWasMine) {
        const existingIndex = next.findIndex((item) => isSameEmoji(item.emoji));
        if (existingIndex === -1) {
          next.push({ emoji, count: 1, reacted: true, avatarUrl: selfProfile?.avatarUrl ?? null });
        } else {
          const target = next[existingIndex];
          next[existingIndex] = { ...target, reacted: true, count: target.count + 1 };
        }
      }
      return { ...message, reactions: next };
    });

  setMessages((prev) => optimisticUpdate(prev));
  if (currentLink) {
    syncConversationCacheMessages(currentLink, currentChatType, optimisticUpdate);
  }

  try {
    const reactionChatType = currentChatType;
    const data = await apiRequest<{ messageId: string; reactions: ReactionSummary[] }>("/api/reactions", {
      method: "POST",
      body: JSON.stringify({
        chatType: reactionChatType,
        messageId,
        emoji,
      }),
    });
    const serverUpdate = (items: DecryptedMessage[]) =>
      items.map((message) =>
        message.id === data.messageId ? { ...message, reactions: data.reactions } : message,
      );
    setMessages((prev) => serverUpdate(prev));
    if (currentLink) {
      syncConversationCacheMessages(currentLink, currentChatType, serverUpdate);
    }
  } catch (error) {
    console.warn("Reaction failed:", error);
    if (rollbackReactions) {
      const rollbackUpdate = (items: DecryptedMessage[]) =>
        items.map((message) =>
          message.id === messageId ? { ...message, reactions: rollbackReactions ?? [] } : message,
        );
      setMessages((prev) => rollbackUpdate(prev));
      if (currentLink) {
        syncConversationCacheMessages(currentLink, currentChatType, rollbackUpdate);
      }
    }
    setErrorText(
      error instanceof Error && error.message
        ? error.message
        : t("Не удалось поставить реакцию. Повторите еще раз.")
    );
  } finally {
    reactionInFlightRef.current.delete(requestKey);
  }
}

export interface RenderLinkifiedTextViewContext {
  messageTextRenderCache: { nodes: Map<string, React.ReactNode>; characters: number; };
  messageSearch: ReturnType<typeof useMessageSearch>;
  openExternalLinkPrompt: (url: string) => void;
}

export function renderLinkifiedTextView({ messageTextRenderCache, messageSearch, openExternalLinkPrompt }: RenderLinkifiedTextViewContext, value: string): React.ReactNode {
  const cached = messageTextRenderCache.nodes.get(value);
  if (cached !== undefined) return cached;
  const blocks = parseCodeBlocks(value);
  const nodes = blocks.map((block, blockIndex) => {
    if (block.type === "code-block") {
      return (
        <CodeBlock
          key={`code-block-${blockIndex}`}
          code={block.code || ""}
          language={block.language}
          searchQuery={messageSearch.query}
        />
      );
    }

    return splitMessageTextSegments(block.text).map((segment, index) => {
      const keyPrefix = `block-${blockIndex}-segment-${index}`;
      if (segment.kind === "text") {
        return (
          <span key={`${keyPrefix}-text`}>
            {parseInlineMarkdown(segment.text, keyPrefix, value => <SearchHighlightedText text={value} query={messageSearch.query} emojis />, messageSearch.query)}
          </span>
        );
      }
      if (segment.kind === "url") {
        return (
          <a
            key={`${keyPrefix}-link`}
            href={segment.url}
            onClick={(event) => {
              event.preventDefault();
              try {
                const parsed = new URL(segment.url);
                if (isTrustedLinkHost(parsed.hostname)) {
                  window.open(parsed.toString(), "_blank", "noopener,noreferrer");
                  return;
                }
              } catch {
                // fall through to warning modal
              }
              openExternalLinkPrompt(segment.url);
            }}
            className="cursor-pointer underline underline-offset-2 decoration-current/70 hover:opacity-80"
            rel="noreferrer noopener"
          >
            <SearchHighlightedText text={segment.text} query={messageSearch.query} emojis />
          </a>
        );
      }
      return null;
    });
  });
  // Keep plaintext only within this chat, with a strict memory bound.
  if (value.length <= 100_000) {
    while (messageTextRenderCache.nodes.size >= 200 || messageTextRenderCache.characters + value.length > 100_000) {
      const oldest = messageTextRenderCache.nodes.keys().next().value;
      if (oldest === undefined) break;
      messageTextRenderCache.characters -= oldest.length;
      messageTextRenderCache.nodes.delete(oldest);
    }
    messageTextRenderCache.nodes.set(value, nodes);
    messageTextRenderCache.characters += value.length;
  }
  return nodes;
}

export interface RenderInlineReactionsViewContext {
  liveBackgroundPreset: LiveBackgroundNeatPreset;
  activeCustomTheme: CustomChatTheme | null | undefined;
  messageThemeEnabled: boolean;
  reactionPulseVersions: Record<string, number>;
  reactionPolicy: (ReactionPolicy & { id: string; link: string; name: string; avatarUrl?: string | null | undefined; ownerId?: string | undefined; myRole?: string | undefined; myCanChangeReactions?: boolean | undefined; myCanPinMessages?: boolean | undefined; createdAt?: string | undefined; myJoinedAt?: string | undefined; }) | (ReactionPolicy & { id: string; link: string; name: string; avatarUrl?: string | null | undefined; ownerId: string; isOwner?: boolean | undefined; isSubscribed: boolean; myRole?: string | undefined; myRoleLabel?: string | null | undefined; myCanChangeAvatar?: boolean | undefined; myCanChangeName?: boolean | undefined; myCanChangeReactions?: boolean | undefined; myCanPinMessages?: boolean | undefined; myCanPostMessages?: boolean | undefined; myCanEditForeignMessages?: boolean | undefined; myCanDeleteForeignMessages?: boolean | undefined; myCanAddMembers?: boolean | undefined; myCanGenerateInviteLink?: boolean | undefined; myCanManageAdmins?: boolean | undefined; subscribersCount: string; createdAt?: string | undefined; myJoinedAt?: string | null | undefined; }) | undefined;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
}

export function renderInlineReactionsView({ liveBackgroundPreset, activeCustomTheme, messageThemeEnabled, reactionPulseVersions, reactionPolicy, toggleReaction }: RenderInlineReactionsViewContext, messageId: string, reactions: ReactionSummary[], isMine: boolean, options?: { rtl?: boolean; noTopMargin?: boolean; align?: "auto" | "start" | "end"; overlay?: boolean }): React.JSX.Element | null {
  if (!reactions?.length) return null;
  const orderedReactions = [...reactions].sort((left, right) => {
    if (left.reacted !== right.reacted) {
      return left.reacted ? -1 : 1;
    }
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.emoji.localeCompare(right.emoji, "ru");
  });

  const alignClass =
    options?.align === "start"
      ? "justify-start"
      : options?.align === "end"
        ? "justify-end"
        : options?.rtl
          ? "justify-end"
          : isMine
            ? "justify-start"
            : "justify-end";
  const wrapperClassName = cn(
    options?.noTopMargin ? "" : "mt-1",
    "flex min-h-[24px] max-w-full flex-wrap gap-1",
    options?.rtl ? "flex-row-reverse" : "flex-row",
    alignClass,
  );

  const isOverlay = Boolean(options?.overlay);
  const isWhiteBubble = isMine && liveBackgroundPreset === "none" && !isOverlay;

  const reactionPillStyle = (reacted: boolean): CSSProperties => {
    if (activeCustomTheme) {
      return customThemeReactionSurface(activeCustomTheme, isMine, reacted, messageThemeEnabled);
    }
    if (isOverlay) {
      return {
        backgroundColor: reacted ? "rgba(24, 24, 24, 0.78)" : "rgba(24, 24, 24, 0.65)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.055)",
        backdropFilter: "blur(16px) saturate(1.05)",
        WebkitBackdropFilter: "blur(16px) saturate(1.05)",
      };
    }
    if (isWhiteBubble) {
      return {
        backgroundColor: reacted ? "rgba(24, 24, 24, 0.16)" : "rgba(24, 24, 24, 0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      };
    }
    return {
      backgroundColor: reacted ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.12)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    };
  };

  return (
    <div className={wrapperClassName}>
      <AnimatePresence initial={false}>
        {orderedReactions.map((reaction) => {
          const pulseKey = `${messageId}:${reaction.emoji}`;
          const pulseVersion = reactionPulseVersions[pulseKey] ?? 0;
          const isPulsing = pulseVersion > 0;
          return (
            <ReactionBadgeItem
              key={`${messageId}-${reaction.emoji}`}
              messageId={messageId}
              reaction={reaction}
              isWhiteBubble={isWhiteBubble}
              isPulsing={isPulsing}
              pulseVersion={pulseVersion}
              pillStyle={reactionPillStyle(reaction.reacted)}
              disabled={!reaction.reacted && !isReactionAllowed(reactionPolicy, reaction.emoji)}
              onToggle={() => void toggleReaction(messageId, reaction.emoji)}
              renderTextWithEmojis={renderEmojiText}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
