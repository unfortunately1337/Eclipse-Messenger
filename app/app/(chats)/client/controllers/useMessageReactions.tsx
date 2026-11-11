"use client";

import { useRealtimeHandlerRefs } from "../state/conversation-state";

import { availableReactions, quickReactions } from "@/lib/reaction-policy";

import { useCallback, useEffect, useMemo } from "react";

import { reactionAnimationAsset } from "@/lib/client/reaction-animation";

import { type ReactionSummary } from "../../types";
import { REACTION_EMOJIS, QUICK_HOVER_REACTIONS } from "../../constants";

import { decryptedPayloadTextCache, decryptedPayloadFailureCache } from "../chat-cache";

import { normalizeExternalUrl } from "../message-links";

import { toggleReactionAction, renderLinkifiedTextView, renderInlineReactionsView } from "../message-renderers";

import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ConversationActionsModel } from "./useConversationActions";
import type { MessageHistoryModel } from "./useMessageHistory";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { MessageEncryptionModel } from "./useMessageEncryption";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface MessageReactionsSources {
  page: Pick<ChatPageStateModel, "requestedCreateKind" | "handledCreateParamRef" | "searchParams" | "router" | "setErrorText" | "t" | "activeCustomTheme"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "setMessages">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "selectedLink">;
    account: Pick<ChatPageStateModel["account"], "selfProfile" | "selfId">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "setExternalLinkPrompt">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "liveBackgroundPreset" | "messageThemeEnabled">;
    identity: Pick<ChatPageStateModel["identity"], "privateKeyRef" | "privateKey">;

  };
  callbacks: Pick<ChatPageCallbacks, "openCreateChat">;
  elements: {
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "reactionPulseTimersRef" | "reactionInFlightRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "setReactionPulseVersions" | "reactionPulseVersions">;

  };
  active: Pick<ActiveConversationModel, "activeChat" | "handleSecretChatExpired">;
  messageActions: Pick<ConversationActionsModel, "syncConversationCacheMessages" | "clearSelectionMode" | "animateDeleteMessage">;
  history: Pick<MessageHistoryModel, "messageSearch" | "decryptMessageWithRecovery" | "ensureOwnE2EReady">;
  bootstrap: Pick<ChatBootstrapModel, "ensureProfilesBatch" | "readProfileFromCache">;
  encryption: Pick<MessageEncryptionModel, "ensureSharedKeyForMembers" | "rotateSharedKey">;
}

export interface MessageReactionsModel {
  allowedReactionEmojis: string[];
  helperReactionEmojis: string[];
  hoverReactionEmojis: string[];
  hasAllowedReactions: boolean;
  defaultQuickReaction: string;
  hasMoreReactions: boolean;
  reactionHelperWidth: number;
  reactionGridColumns: number;
  reactionGridWidth: number;
  triggerReactionPulse: (messageId: string, emoji: string) => void;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  openExternalLinkPrompt: (url: string) => void;
  renderLinkifiedText: (value: string) => React.ReactNode;
  renderInlineReactions: (messageId: string, reactions: import("@/app/app/(chats)/types").ReactionSummary[], isMine: boolean, options?: {
    rtl?: boolean | undefined;
    noTopMargin?: boolean | undefined;
    align?: "auto" | "end" | "start" | undefined;
    overlay?: boolean | undefined;

  } | undefined) => React.JSX.Element | null;
  realtimeHandler: ReturnType<typeof useRealtimeHandlerRefs>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useMessageReactions(sources: MessageReactionsSources): MessageReactionsModel {
  const { requestedCreateKind, handledCreateParamRef, searchParams, router, setErrorText, t, activeCustomTheme } = sources.page;
  const { activeConversation, setMessages } = sources.page.conversation;
  const { selectedLinkRef, selectedLink } = sources.page.selection;
  const { selfProfile, selfId } = sources.page.account;
  const { setExternalLinkPrompt } = sources.page.messageInteraction;
  const { liveBackgroundPreset, messageThemeEnabled } = sources.page.notificationAndContacts;
  const { privateKeyRef, privateKey } = sources.page.identity;
  const { openCreateChat } = sources.callbacks;
  const { reactionPulseTimersRef, reactionInFlightRef } = sources.elements.messageDelivery;
  const { setReactionPulseVersions, reactionPulseVersions } = sources.elements.conversationRequest;
  const { activeChat, handleSecretChatExpired } = sources.active;
  const { syncConversationCacheMessages, clearSelectionMode, animateDeleteMessage } = sources.messageActions;
  const { messageSearch, decryptMessageWithRecovery, ensureOwnE2EReady } = sources.history;
  const { ensureProfilesBatch, readProfileFromCache } = sources.bootstrap;
  const { ensureSharedKeyForMembers, rotateSharedKey } = sources.encryption;

  useEffect(() => {
    if (!requestedCreateKind) {
      handledCreateParamRef.current = null;
      return;
    }
    if (handledCreateParamRef.current === requestedCreateKind) return;

    handledCreateParamRef.current = requestedCreateKind;
    openCreateChat(requestedCreateKind);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("create");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/app?${nextQuery}` : "/app", { scroll: false });
  }, [requestedCreateKind, router, searchParams]);

  const reactionPolicy = activeConversation?.chatType === "group" ? activeConversation.group : activeConversation?.chatType === "channel" ? activeConversation.channel : undefined;

  const allowedReactionEmojis = useMemo(() => availableReactions(reactionPolicy), [reactionPolicy]);

  const helperReactionEmojis = useMemo(() => quickReactions(reactionPolicy, REACTION_EMOJIS), [reactionPolicy]);

  const hoverReactionEmojis = useMemo(() => quickReactions(reactionPolicy, QUICK_HOVER_REACTIONS), [reactionPolicy]);

  const hasAllowedReactions = allowedReactionEmojis.length > 0;

  const defaultQuickReaction = allowedReactionEmojis[0];

  const hasMoreReactions = allowedReactionEmojis.length > helperReactionEmojis.length;

  const reactionHelperCells = helperReactionEmojis.length + (hasMoreReactions ? 1 : 0);

  const reactionHelperWidth = 14 + reactionHelperCells * 30 + Math.max(0, reactionHelperCells - 1) * 4;

  const reactionGridColumns = Math.max(1, Math.min(7, allowedReactionEmojis.length));

  const reactionGridWidth = 18 + reactionGridColumns * 32 + (reactionGridColumns - 1) * 4;

  const triggerReactionPulse = useCallback((messageId: string, emoji: string) => {
    const key = `${messageId}:${emoji}`;
    const currentTimer = reactionPulseTimersRef.current[key];
    if (currentTimer) {
      clearTimeout(currentTimer);
    }
    setReactionPulseVersions((prev) => ({
      ...prev,
      [key]: (prev[key] ?? 0) + 1,
    }));
    reactionPulseTimersRef.current[key] = setTimeout(() => {
      setReactionPulseVersions((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      delete reactionPulseTimersRef.current[key];
    }, (reactionAnimationAsset(emoji)?.durationMs ?? 400) + 350);
  }, []);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      return toggleReactionAction({ messagesRef, reactionPolicy, activeChat, activeConversation, reactionInFlightRef, selectedLinkRef, triggerReactionPulse, selfProfile, setMessages, syncConversationCacheMessages, setErrorText, t }, messageId, emoji);
    },
    [activeChat?.conversationId, activeChat?.chatType, activeChat?.link, activeConversation, reactionPolicy, selfProfile?.avatarUrl, setErrorText, syncConversationCacheMessages, triggerReactionPulse, t],
  );

  const openExternalLinkPrompt = useCallback((url: string) => {
    try {
      const normalized = normalizeExternalUrl(url);
      const parsed = new URL(normalized);
      setExternalLinkPrompt({ url: parsed.toString(), host: parsed.hostname });
    } catch {
      // ignore malformed urls in message text
    }
  }, []);

  const messageTextRenderCache = useMemo(() => ({
    nodes: new Map<string, React.ReactNode>(),
    characters: 0,
  }), [openExternalLinkPrompt, selectedLink, selfId, messageSearch.query]);

  const renderLinkifiedText = useCallback(
    (value: string) => {
      return renderLinkifiedTextView({ messageTextRenderCache, messageSearch, openExternalLinkPrompt }, value);
    },
    [openExternalLinkPrompt, messageTextRenderCache, messageSearch.query],
  );

  const renderInlineReactions = useCallback((
    messageId: string,
    reactions: ReactionSummary[],
    isMine: boolean,
    options?: {
      rtl?: boolean;
      noTopMargin?: boolean;
      align?: "auto" | "start" | "end";
      overlay?: boolean

    },
  ) => {
    return renderInlineReactionsView({ liveBackgroundPreset, activeCustomTheme, messageThemeEnabled, reactionPulseVersions, reactionPolicy, toggleReaction }, messageId, reactions, isMine, options);
  }, [liveBackgroundPreset, activeCustomTheme, messageThemeEnabled, reactionPulseVersions, reactionPolicy, toggleReaction]);

  useEffect(() => {
    clearSelectionMode();
  }, [activeChat?.link, clearSelectionMode]);

  useEffect(() => {
    privateKeyRef.current = privateKey;
    decryptedPayloadTextCache.clear();
    decryptedPayloadFailureCache.clear();
  }, [privateKey]);

  const realtimeHandlerStateModel = useRealtimeHandlerRefs(decryptMessageWithRecovery, ensureOwnE2EReady, ensureProfilesBatch, ensureSharedKeyForMembers, rotateSharedKey, readProfileFromCache, animateDeleteMessage, handleSecretChatExpired);
  const {
    decryptMessageWithRecoveryRef, ensureOwnE2EReadyRef, ensureProfilesBatchRef, ensureSharedKeyForMembersRef, rotateSharedKeyRef,
    readProfileFromCacheRef, messagesRef, animateDeleteMessageRef, handleSecretChatExpiredRef
  } = realtimeHandlerStateModel;

  useEffect(() => {
    decryptMessageWithRecoveryRef.current = decryptMessageWithRecovery;
  }, [decryptMessageWithRecovery]);

  useEffect(() => {
    ensureOwnE2EReadyRef.current = ensureOwnE2EReady;
  }, [ensureOwnE2EReady]);

  useEffect(() => {
    ensureProfilesBatchRef.current = ensureProfilesBatch;
  }, [ensureProfilesBatch]);

  return {
    allowedReactionEmojis,
    helperReactionEmojis,
    hoverReactionEmojis,
    hasAllowedReactions,
    defaultQuickReaction,
    hasMoreReactions,
    reactionHelperWidth,
    reactionGridColumns,
    reactionGridWidth,
    triggerReactionPulse,
    toggleReaction,
    openExternalLinkPrompt,
    renderLinkifiedText,
    renderInlineReactions,
    realtimeHandler: realtimeHandlerStateModel
  };
}
