"use client";

import { shareMissingHistoryKeys, type SharedKeyHistory } from "@/lib/client/shared-key-history";

import { useCallback, useEffect, useRef } from "react";

import { pinScopeKey } from "@/lib/message-pins";

import { apiRequest } from "@/lib/client/http";

import { type ConversationResponse } from "../../types";

import { encryptSharedKeyForUser } from "@/lib/client/e2e";

import { parseMessageContentCached } from "../message-content";

import { getReplyPreviewText } from "../message-presentation";

import { rotateSharedKeyAction, reconcileSharedChatKeys } from "../message-crypto";

import type { MessageHistoryModel } from "./useMessageHistory";
import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatDirectoryModel } from "./useChatDirectory";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatInteractionModel } from "./useChatInteraction";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { MessageReactionsModel } from "./useMessageReactions";

export interface MessageEncryptionSources {
  history: Pick<MessageHistoryModel, "pinScope" | "messagePins" | "decryptHistoryPage" | "setPinPreview" | "pinNavigatingKey" | "setPinNavigatingKey" | "handlePinError" | "pinPreview" | "ensureOwnE2EReady" | "buildSharedChatKeyId" | "loadSharedKeyByVersion" | "ensureSharedKeyFromServer">;
  presentation: Pick<ConversationPresentationModel, "replyMessageById" | "isSecretChat">;
  elements: Pick<ChatElementStateModel, "isMessageMarkedDeleted"> & {
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "hasMoreMessagesBefore" | "loadingOlderMessages">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "loadOlderMessagesRef">;

  };
  directory: Pick<ChatDirectoryModel, "scrollToMessageById">;
  page: Pick<ChatPageStateModel, "t"> & {
    selection: Pick<ChatPageStateModel["selection"], "selectedLink">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "messages" | "chats">;
    appearance: Pick<ChatPageStateModel["appearance"], "setMessageHelperId">;
    account: Pick<ChatPageStateModel["account"], "selfId">;
    identity: Pick<ChatPageStateModel["identity"], "e2eIdentityReady" | "e2eBootstrapCompleted">;

  };
  interaction: Pick<ChatInteractionModel, "interruptMessageAutoScroll">;
  bootstrap: Pick<ChatBootstrapModel, "prewarmSharedKeysForChatPreviews"> & {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "currentUserIdRef">;

  };
}

export interface MessageEncryptionDeferred {
  readonly reactions: {
    realtimeHandler: Pick<MessageReactionsModel["realtimeHandler"], "messagesRef">;

  };
}
export interface MessageEncryptionModel {
  pinKey: string;
  jumpToPinnedMessage: () => Promise<void>;
  pinnedPreviewText: string;
  rotateSharedKey: (chatType: "group" | "channel", link: string, chatId: string) => Promise<{
    version: number;
    keyBase64: string;
    createdAt: number;

  }>;
  ensureSharedKeyForMembers: (chatType: "group" | "channel", link: string, chatId: string, targetUserIds?: string[] | undefined) => Promise<{
    version: number;
    added: number;
    failedVersions: number[];

  } | null>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useMessageEncryption(sources: MessageEncryptionSources, deferred: MessageEncryptionDeferred): MessageEncryptionModel {
  const { pinScope, messagePins, decryptHistoryPage, setPinPreview, pinNavigatingKey, setPinNavigatingKey, handlePinError, pinPreview, ensureOwnE2EReady, buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer } = sources.history;
  const { replyMessageById, isSecretChat } = sources.presentation;
  const { isMessageMarkedDeleted } = sources.elements;
  const { hasMoreMessagesBefore, loadingOlderMessages } = sources.elements.storyAndViewport;
  const { loadOlderMessagesRef } = sources.elements.conversationRequest;
  const { scrollToMessageById } = sources.directory;
  const { t } = sources.page;
  const { selectedLink } = sources.page.selection;
  const { activeConversation, messages, chats } = sources.page.conversation;
  const { setMessageHelperId } = sources.page.appearance;
  const { selfId } = sources.page.account;
  const { e2eIdentityReady, e2eBootstrapCompleted } = sources.page.identity;
  const { interruptMessageAutoScroll } = sources.interaction;
  const { prewarmSharedKeysForChatPreviews } = sources.bootstrap;
  const { currentUserIdRef } = sources.bootstrap.accountNavigation;

  const pinKey = pinScopeKey(pinScope);

  const activePinId = messagePins.active?.id;

  const localPinnedMessage = activePinId ? replyMessageById.get(activePinId) : undefined;

  const pinNavigationRef = useRef({ key: pinKey, hasMore: hasMoreMessagesBefore, loading: loadingOlderMessages, scroll: scrollToMessageById });

  useEffect(() => { pinNavigationRef.current = { key: pinKey, hasMore: hasMoreMessagesBefore, loading: loadingOlderMessages, scroll: scrollToMessageById }; }, [pinKey, hasMoreMessagesBefore, loadingOlderMessages, scrollToMessageById]);

  useEffect(() => {
    if (!activePinId || localPinnedMessage || !selectedLink || !activeConversation?.chatType || isSecretChat) return;
    let cancelled = false;
    const query = new URLSearchParams({ chatType: activeConversation.chatType, messageId: activePinId });
    void apiRequest<ConversationResponse>(`/api/chats/${encodeURIComponent(selectedLink)}?${query}`, { cache: "no-store" })
      .then(data => decryptHistoryPage(data, selectedLink))
      .then(decoded => {
        const message = decoded.find(item => item.id === activePinId);
        if (!cancelled && message) setPinPreview({ key: pinKey, id: activePinId, text: message.text });
      }).catch(() => { });
    return () => { cancelled = true; };
  }, [activePinId, localPinnedMessage, selectedLink, activeConversation?.chatType, isSecretChat, decryptHistoryPage, pinKey]);

  useEffect(() => {
    if (activePinId && isMessageMarkedDeleted(activePinId)) void messagePins.refresh().catch(() => { });
  }, [activePinId, messages, isMessageMarkedDeleted, messagePins.refresh]);

  const jumpToPinnedMessage = useCallback(async () => {
    if (!activePinId || !pinKey || pinNavigatingKey === pinKey) return;
    setMessageHelperId(null);
    interruptMessageAutoScroll();
    setPinNavigatingKey(pinKey);
    try {
      let unchangedPages = 0;
      // Fill history through the normal paginator, preserving a continuous timeline and its encryption checks.
      while (!deferred.reactions.realtimeHandler.messagesRef.current.some(message => message.id === activePinId)) {
        if (pinNavigationRef.current.key !== pinKey) return;
        if (!pinNavigationRef.current.hasMore) throw new Error(t("Закреплённое сообщение недоступно"));
        if (pinNavigationRef.current.loading) { await new Promise(resolve => setTimeout(resolve, 80)); continue; }
        const firstId = deferred.reactions.realtimeHandler.messagesRef.current[0]?.id;
        await loadOlderMessagesRef.current?.();
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (deferred.reactions.realtimeHandler.messagesRef.current[0]?.id === firstId) { if (++unchangedPages >= 3) throw new Error(t("Не удалось загрузить сообщение")); }
        else unchangedPages = 0;
      }
      if (pinNavigationRef.current.key !== pinKey) return;
      pinNavigationRef.current.scroll(activePinId, 1000);
      messagePins.advance();
    } catch (error) { if (pinNavigationRef.current.key === pinKey) handlePinError(error); }
    finally { setPinNavigatingKey(""); }
  }, [activePinId, pinKey, pinNavigatingKey, interruptMessageAutoScroll, messagePins.advance, handlePinError, t]);

  const pinnedText = localPinnedMessage?.text ?? (pinPreview?.key === pinKey && pinPreview.id === activePinId ? pinPreview.text : "");

  const pinnedParsed = parseMessageContentCached(pinnedText);

  const pinnedPreviewText = pinnedParsed.kind === "image" ? t("Фото") : pinnedText ? getReplyPreviewText(pinnedText) : t("Сообщение");

  const rotateSharedKey = useCallback(
    async (chatType: "group" | "channel", link: string, chatId: string) => {
      return rotateSharedKeyAction({ selfId, ensureOwnE2EReady, t, buildSharedChatKeyId }, chatType, link, chatId);
    },
    [buildSharedChatKeyId, ensureOwnE2EReady, selfId, t],
  );

  const ensureSharedKeyForMembers = useCallback(
    async (chatType: "group" | "channel", link: string, chatId: string, targetUserIds?: string[]) => {
      const endpoint = "/api/" + (chatType === "group" ? "groups/" : "channels/") + encodeURIComponent(link) + "/e2e-key";
      const data = await apiRequest<{
        keyVersion: number | null;
        members?: Array<{
          userId: string;
          publicKey: string | null

        }>;
        keyHolders?: string[];
        keyHistory?: SharedKeyHistory[]

      }>(endpoint + "?includeMembers=1", { method: "GET" });
      if (!data.keyVersion) { await rotateSharedKey(chatType, link, chatId); return null; }
      const chatKeyId = buildSharedChatKeyId(chatType, chatId);
      const result = await shareMissingHistoryKeys({
        history: data.keyHistory ?? [{ version: data.keyVersion, keyHolders: data.keyHolders ?? [] }],
        members: data.members ?? [], targetUserIds,
        resolveKey: async version => (loadSharedKeyByVersion(chatKeyId, version) ?? await ensureSharedKeyFromServer(chatType, link, chatId, version))?.keyBase64 ?? null,
        wrapKey: (sharedKeyBase64, recipientPublicKeyBase64) => encryptSharedKeyForUser({ sharedKeyBase64, recipientPublicKeyBase64 }),
        save: async (version, keys) => { await apiRequest(endpoint, { method: "POST", body: JSON.stringify({ version, keys }) }); },
      });
      return { version: data.keyVersion, added: result.added, failedVersions: result.failedVersions };
    },
    [buildSharedChatKeyId, ensureSharedKeyFromServer, loadSharedKeyByVersion, rotateSharedKey],
  );

  const sharedKeyReconcileAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return reconcileSharedChatKeys({ e2eIdentityReady, selfId, currentUserIdRef, chats, activeConversation, sharedKeyReconcileAtRef, ensureSharedKeyForMembers });
  }, [activeConversation, chats, e2eIdentityReady, ensureSharedKeyForMembers, selfId]);

  useEffect(() => {
    if (!e2eBootstrapCompleted || !e2eIdentityReady || chats.length === 0) return;
    void prewarmSharedKeysForChatPreviews(chats);
  }, [chats, e2eBootstrapCompleted, e2eIdentityReady, prewarmSharedKeysForChatPreviews]);

  return {
    pinKey,
    jumpToPinnedMessage,
    pinnedPreviewText,
    rotateSharedKey,
    ensureSharedKeyForMembers
  };
}
