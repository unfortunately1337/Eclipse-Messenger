"use client";
import { reconcileAccountSummaries } from "@/lib/client/account-summaries";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type GroupModalData, type ChannelModalData, type ChatSearchUser, type ChatSearchGroup, type ChatSearchChannel, type ChatSearchSaved, type ChatSearchEclipse, type ConversationResponse, type ChatSummary, type DecryptedMessage, type ProfilePreview } from "../types";
import { ACTIVE_SECRET_CHAT_NOTICE, hasActiveSecretChatWithPeer } from "@/lib/secret-chat-state";
import { bindSecretDeviceKey, createSecretDeviceKey } from "@/lib/client/secret-device-keys";
import { apiRequest } from "@/lib/client/http";
import { showAppToast, appToast as toast } from "@/lib/client/app-toast";
import { setActiveE2EUserId } from "@/lib/client/e2e";
import { deduplicateChatSummaries } from "../chat-realtime-chatlist";
import { clearChatMemoryCaches } from "./chat-cache";
import { PERSISTENT_LAST_SELF_PROFILE_KEY } from "./config";

export interface SavePublicLinkChangeActionContext {
  linkEditorTarget: { kind: "group" | "channel"; currentLink: string; } | null;
  linkEditorValue: string;
  linkEditorSaving: boolean;
  linkEditorStatus: "idle" | "checking" | "available" | "taken" | "invalid";
  setLinkEditorTarget: React.Dispatch<React.SetStateAction<{ kind: "group" | "channel"; currentLink: string; } | null>>;
  setLinkEditorSaving: React.Dispatch<React.SetStateAction<boolean>>;
  openChannelModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
  selectedLink: string | null;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  openGroupModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function savePublicLinkChangeAction({ linkEditorTarget, linkEditorValue, linkEditorSaving, linkEditorStatus, setLinkEditorTarget, setLinkEditorSaving, openChannelModal, selectedLink, setSelectedLink, openGroupModal, setErrorText, t }: SavePublicLinkChangeActionContext): Promise<void> {
  if (!linkEditorTarget || !linkEditorValue.trim() || linkEditorSaving || linkEditorStatus !== "available") return;
  const newLink = linkEditorValue.trim().toLowerCase().replace(/^@+/u, "");
  const kind = linkEditorTarget.kind;
  const oldLink = linkEditorTarget.currentLink;
  if (newLink === oldLink) {
    setLinkEditorTarget(null);
    return;
  }
  setLinkEditorSaving(true);
  try {
    if (kind === "channel") {
      const res = await apiRequest<{ channel: { link: string } }>(`/api/channels/${encodeURIComponent(oldLink)}`, {
        method: "PATCH",
        body: JSON.stringify({ link: newLink }),
      });
      setLinkEditorTarget(null);
      void openChannelModal(res.channel.link, { forceRefresh: true });
      if (selectedLink === oldLink) {
        setSelectedLink(res.channel.link);
      }
    } else {
      const res = await apiRequest<{ group: { link: string } }>(`/api/groups/${encodeURIComponent(oldLink)}`, {
        method: "PATCH",
        body: JSON.stringify({ link: newLink }),
      });
      setLinkEditorTarget(null);
      void openGroupModal(res.group.link, { forceRefresh: true });
      if (selectedLink === oldLink) {
        setSelectedLink(res.group.link);
      }
    }
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Не удалось изменить ссылку"));
  } finally {
    setLinkEditorSaving(false);
  }
}

export interface LoadConnectedAccountsActionContext {
  accountsRequestPending: React.RefObject<boolean>;
  setConnectedAccounts: React.Dispatch<React.SetStateAction<{ id: string; displayName: string; link: string; avatarUrl: string | null; isActive: boolean; unreadCount?: number | undefined; }[]>>;
}

export async function loadConnectedAccountsAction({ accountsRequestPending, setConnectedAccounts }: LoadConnectedAccountsActionContext): Promise<void> {
  if (accountsRequestPending.current) return;
  accountsRequestPending.current = true;
  try {
    const data = await apiRequest<{
      accounts: Array<{
        id: string;
        displayName: string;
        link: string;
        avatarUrl: string | null;
        isActive: boolean;
        unreadCount?: number;
      }>;
      canAddAccount: boolean;
    }>("/api/auth/accounts");
    if (data && Array.isArray(data.accounts)) {
      setConnectedAccounts(previous => reconcileAccountSummaries(previous, data.accounts));
      try {
        window.localStorage.setItem("eclipse:connected-accounts", JSON.stringify(data.accounts));
      } catch { }
    }
  } catch {
    // Ignore
  } finally {
    accountsRequestPending.current = false;
  }
}

export interface HandleSwitchAccountActionContext {
  switchingAccountId: string | null;
  setSwitchingAccountId: React.Dispatch<React.SetStateAction<string | null>>;
  connectedAccounts: { id: string; displayName: string; link: string; avatarUrl: string | null; isActive: boolean; unreadCount?: number | undefined; }[];
  contactsForAddCacheRef: React.RefObject<{ savedAt: number; contacts: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]; } | null>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  sharedKeyServerCacheRef: React.RefObject<Map<string, { expiresAt: number; value: { version: number; keyBase64: string; createdAt: number; } | null; }>>;
  setChatSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setChatSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setChatSearchUsers: React.Dispatch<React.SetStateAction<ChatSearchUser[]>>;
  setChatSearchGroups: React.Dispatch<React.SetStateAction<ChatSearchGroup[]>>;
  setChatSearchChannels: React.Dispatch<React.SetStateAction<ChatSearchChannel[]>>;
  setChatSearchSaved: React.Dispatch<React.SetStateAction<ChatSearchSaved[]>>;
  setChatSearchEclipse: React.Dispatch<React.SetStateAction<ChatSearchEclipse[]>>;
  setContactsForAdd: React.Dispatch<React.SetStateAction<{ id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function handleSwitchAccountAction({ switchingAccountId, setSwitchingAccountId, connectedAccounts, contactsForAddCacheRef, groupModalCacheRef, channelModalCacheRef, sharedKeyServerCacheRef, setChatSearchOpen, setChatSearchQuery, setChatSearchUsers, setChatSearchGroups, setChatSearchChannels, setChatSearchSaved, setChatSearchEclipse, setContactsForAdd, t }: HandleSwitchAccountActionContext, targetUserId: string): Promise<void> {
  if (switchingAccountId) return;
  setSwitchingAccountId(targetUserId);
  try {
    await apiRequest("/api/auth/accounts/switch", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    });
    clearChatMemoryCaches();
    try {
      window.sessionStorage.clear();
      window.localStorage.setItem(PERSISTENT_LAST_SELF_PROFILE_KEY, targetUserId);
      window.localStorage.setItem("eclipse:active-user-id", targetUserId);
      document.cookie = `eclipse.active_user_id=${encodeURIComponent(targetUserId)}; path=/; max-age=2592000; SameSite=Lax`;
      const updatedCache = connectedAccounts
        .map((a) => ({ ...a, isActive: a.id === targetUserId }))
        .sort((a, b) => (a.isActive ? -1 : b.isActive ? 1 : 0));
      window.localStorage.setItem("eclipse:connected-accounts", JSON.stringify(updatedCache));
    } catch {
      // Ignore
    }
    setActiveE2EUserId(targetUserId);
    contactsForAddCacheRef.current = null;
    groupModalCacheRef.current.clear();
    channelModalCacheRef.current.clear();
    sharedKeyServerCacheRef.current.clear();
    setChatSearchOpen(false);
    setChatSearchQuery("");
    setChatSearchUsers([]);
    setChatSearchGroups([]);
    setChatSearchChannels([]);
    setChatSearchSaved([]);
    setChatSearchEclipse([]);
    setContactsForAdd([]);

    window.location.assign("/app");
  } catch (err) {
    setSwitchingAccountId(null);
    showAppToast({
      title: t("Ошибка"),
      description: err instanceof Error ? err.message : t("Не удалось переключить аккаунт"),
      type: "error",
    });
  }
}

export interface AcceptSecretChatActionContext {
  activeConversation: ConversationResponse | null;
  setAcceptingSecretChat: React.Dispatch<React.SetStateAction<boolean>>;
  selfId: string | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setSecretChatExpiresAt: React.Dispatch<React.SetStateAction<string | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  loadSecretChatsRef: React.RefObject<() => Promise<void>>;
}

export async function acceptSecretChatAction({ activeConversation, setAcceptingSecretChat, selfId, t, setActiveConversation, setSecretChatExpiresAt, setChats, loadSecretChatsRef }: AcceptSecretChatActionContext): Promise<void> {
  if (!activeConversation || !activeConversation.conversationId) return;
  const secretChatId = activeConversation.conversationId.startsWith("secret:")
    ? activeConversation.conversationId.substring("secret:".length)
    : activeConversation.conversationId;

  setAcceptingSecretChat(true);
  try {
    const secretInfo = activeConversation.secretCrypto;
    const deviceKey = secretInfo?.version === 2 ? await createSecretDeviceKey(selfId ?? "") : undefined;
    if (deviceKey) {
      await bindSecretDeviceKey(selfId ?? "", secretChatId, { version: 2, ownKeyId: deviceKey.deviceKeyId, ownPublicKey: deviceKey.devicePublicKey }, activeConversation.peer?.publicKey ?? null);
    }
    const res = await apiRequest<{
      success: boolean;
      chat?: {
        id: string;
        isApproved: boolean;
        expiresAt: string | null;
        lifetimeSeconds: number;
      };
      expiresAt?: string | null;
    }>("/api/chats/secret/accept", {
      method: "POST",
      body: JSON.stringify({ secretChatId, deviceKey, expectedCreatorPublicKey: deviceKey ? activeConversation.peer?.publicKey : undefined }),
    });

    if (res && (res.chat || res.expiresAt)) {
      const expiresAt = res.chat?.expiresAt || res.expiresAt || null;
      if (deviceKey) {
        await bindSecretDeviceKey(selfId ?? "", secretChatId, { version: 2, ownKeyId: deviceKey.deviceKeyId, ownPublicKey: deviceKey.devicePublicKey }, activeConversation.peer?.publicKey ?? null, expiresAt);
      }
      toast.success(t("Запрос на секретный чат принят!"));

      // Update UI states
      setActiveConversation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          isApproved: true,
          expiresAt: expiresAt || undefined,
          ...(deviceKey ? { secretCrypto: { version: 2, ownKeyId: deviceKey.deviceKeyId, ownPublicKey: deviceKey.devicePublicKey } } : {}),
        };
      });
      setSecretChatExpiresAt(expiresAt);

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.conversationId === `secret:${secretChatId}` || chat.link === `secret-${secretChatId}`) {
            return {
              ...chat,
              isApproved: true,
              expiresAt: expiresAt || undefined,
              lastMessage: t("Секретный чат"),
              unreadCount: 0,
            };
          }
          return chat;
        })
      );
      void loadSecretChatsRef.current();
    }
  } catch (err) {
    console.error("Failed to accept secret chat:", err);
    toast.error(t("Не удалось принять запрос"));
  } finally {
    setAcceptingSecretChat(false);
  }
}

export interface DeclineSecretChatActionContext {
  activeConversation: ConversationResponse | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  loadSecretChatsRef: React.RefObject<() => Promise<void>>;
}

export async function declineSecretChatAction({ activeConversation, t, setSelectedLink, setActiveConversation, setMessages, setChats, loadSecretChatsRef }: DeclineSecretChatActionContext): Promise<void> {
  if (!activeConversation || !activeConversation.conversationId) return;
  const secretChatId = activeConversation.conversationId.startsWith("secret:")
    ? activeConversation.conversationId.substring("secret:".length)
    : activeConversation.conversationId;

  try {
    await apiRequest("/api/chats/secret-" + secretChatId, {
      method: "DELETE",
    });

    toast.success(t("Секретный чат отклонен"));

    // Reset active conversation
    setSelectedLink(null);
    setActiveConversation(null);
    setMessages([]);
    setChats((prev) =>
      prev.filter((c) => c.conversationId !== `secret:${secretChatId}` && c.link !== `secret-${secretChatId}`)
    );
    void loadSecretChatsRef.current();
  } catch (err) {
    console.error("Failed to decline secret chat:", err);
    toast.error(t("Не удалось отклонить секретный чат"));
  }
}

export interface OpenSecretChatFromProfileActionContext {
  setProfileMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  profileData: ProfilePreview | null;
  profileIsBot: boolean;
  profileIsSaved: boolean;
  secretChatCheckPendingRef: React.RefObject<boolean>;
  chats: ChatSummary[];
  profileDataRef: React.RefObject<ProfilePreview | null>;
  setSecretChatSelectedUserIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSecretChatTitle: React.Dispatch<React.SetStateAction<string>>;
  contactDraftDisplayName: string;
  setSecretChatLifetimePreset: React.Dispatch<React.SetStateAction<"custom" | "1h" | "1d" | "1w" | "1m">>;
  setSecretChatLifetimeDays: React.Dispatch<React.SetStateAction<number>>;
  setSecretChatLifetimeHours: React.Dispatch<React.SetStateAction<number>>;
  setSecretChatLifetimeMinutes: React.Dispatch<React.SetStateAction<number>>;
  setSecretChatCodeword: React.Dispatch<React.SetStateAction<string>>;
  setProfileSubView: React.Dispatch<React.SetStateAction<"qrcode" | "contact_editor" | "secret_chat" | null>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function openSecretChatFromProfileAction({ setProfileMoreOpen, profileData, profileIsBot, profileIsSaved, secretChatCheckPendingRef, chats, profileDataRef, setSecretChatSelectedUserIds, setSecretChatTitle, contactDraftDisplayName, setSecretChatLifetimePreset, setSecretChatLifetimeDays, setSecretChatLifetimeHours, setSecretChatLifetimeMinutes, setSecretChatCodeword, setProfileSubView, t }: OpenSecretChatFromProfileActionContext): Promise<void> {
  setProfileMoreOpen(false);
  const profile = profileData;
  if (!profile?.id || profileIsBot || profileIsSaved || secretChatCheckPendingRef.current) return;
  if (hasActiveSecretChatWithPeer(chats, profile.id)) {
    toast.info(ACTIVE_SECRET_CHAT_NOTICE);
    return;
  }
  secretChatCheckPendingRef.current = true;
  try {
    const result = await apiRequest<{ exists: boolean }>(`/api/chats/secret?peerId=${encodeURIComponent(profile.id)}`);
    if (result.exists) { toast.info(ACTIVE_SECRET_CHAT_NOTICE); return; }
    if (profileDataRef.current?.id !== profile.id) return;
    setSecretChatSelectedUserIds(new Set([profile.id]));
    setSecretChatTitle(contactDraftDisplayName || profile.displayName);
    setSecretChatLifetimePreset("1h");
    setSecretChatLifetimeDays(0);
    setSecretChatLifetimeHours(1);
    setSecretChatLifetimeMinutes(0);
    setSecretChatCodeword("");
    setProfileSubView("secret_chat");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t("Не удалось проверить секретный чат"));
  } finally { secretChatCheckPendingRef.current = false; }
}

export interface SubmitCreateSecretChatActionContext {
  secretChatCreating: boolean;
  secretChatSelectedUserIds: Set<string>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  chats: ChatSummary[];
  secretChatLifetimeDays: number;
  secretChatLifetimeHours: number;
  secretChatLifetimeMinutes: number;
  setSecretChatCreating: React.Dispatch<React.SetStateAction<boolean>>;
  selfId: string | null;
  secretChatTitle: string;
  secretChatCodeword: string;
  setSecretChatCodeword: React.Dispatch<React.SetStateAction<string>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setSecretChatExpiresAt: React.Dispatch<React.SetStateAction<string | null>>;
  setSecretChatCreateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileSubView: React.Dispatch<React.SetStateAction<"qrcode" | "contact_editor" | "secret_chat" | null>>;
  setProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDesktopDetailsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
}

export async function submitCreateSecretChatAction({ secretChatCreating, secretChatSelectedUserIds, setErrorText, t, chats, secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, setSecretChatCreating, selfId, secretChatTitle, secretChatCodeword, setSecretChatCodeword, setChats, setSecretChatExpiresAt, setSecretChatCreateOpen, setProfileSubView, setProfileModalOpen, setDesktopDetailsPanelOpen, setSelectedLink, setActiveConversation, setMessages }: SubmitCreateSecretChatActionContext): Promise<void> {
  if (secretChatCreating) return;
  if (secretChatSelectedUserIds.size === 0) {
    setErrorText(t("Выберите хотя бы одного участника."));
    return;
  }

  const selectedUserId = Array.from(secretChatSelectedUserIds)[0];
  if (selectedUserId) {
    if (hasActiveSecretChatWithPeer(chats, selectedUserId)) {
      toast.info(ACTIVE_SECRET_CHAT_NOTICE);
      return;
    }
  }

  const lifetimeSeconds =
    (secretChatLifetimeDays * 86400) +
    (secretChatLifetimeHours * 3600) +
    (secretChatLifetimeMinutes * 60);

  if (lifetimeSeconds <= 0) {
    setErrorText(t("Время жизни чата должно быть больше нуля."));
    return;
  }

  setSecretChatCreating(true);
  try {
    const deviceKey = await createSecretDeviceKey(selfId ?? "");
    const data = await apiRequest<{
      success: boolean;
      chat: {
        id: string;
        title: string;
        expiresAt: string;
        lifetimeSeconds: number;
        participants: Array<{ id: string; displayName: string; avatarUrl?: string | null; link: string }>;
      };
    }>("/api/chats/secret", {
      method: "POST",
      body: JSON.stringify({
        title: secretChatTitle.trim() || undefined,
        participantUserIds: Array.from(secretChatSelectedUserIds),
        ...deviceKey,
        lifetimeSeconds,
        codeword: secretChatCodeword.trim() || undefined,
      }),
    });

    if (data.success && data.chat) {
      const secretCrypto = { version: 2, ownKeyId: deviceKey.deviceKeyId, ownPublicKey: deviceKey.devicePublicKey };
      await bindSecretDeviceKey(selfId ?? "", data.chat.id, secretCrypto, null);
      if (secretChatCodeword.trim()) {
        try {
          localStorage.setItem(`secret_codeword_${data.chat.id}`, secretChatCodeword.trim().toLowerCase());
        } catch { }
      }
      setSecretChatCodeword("");
      const peer = data.chat.participants.find((p) => p.id !== selfId) || data.chat.participants[0];
      const peerDisplayName = peer ? (peer.displayName || peer.link) : t("Секретный чат");

      const nextChat: ChatSummary = {
        chatType: "direct",
        conversationId: `secret:${data.chat.id}`,
        peerId: peer?.id || data.chat.id,
        link: `secret-${data.chat.id}`,
        displayName: peerDisplayName,
        avatarUrl: peer?.avatarUrl || null,
        membersCount: String(data.chat.participants.length),
        lastMessage: t("Ждем одобрения от {0}", { 0: peerDisplayName }),
        lastMessageAt: new Date().toISOString(),
        lastMessageMine: true,
        unreadCount: 0,
        contactTag: "SECRET",
        contactTagVariant: "outline",
        lastMessageCipherText: null,
        lastMessageIv: null,
        lastMessageEncryptedKey: null,
        lastMessageKeyVersion: null,
        lastMessageSenderId: null,
        lastMessageSenderAlias: null,
        isCreator: true,
        isApproved: false,
        creatorId: selfId,
        expiresAt: data.chat.expiresAt,
      };

      setChats((prev) => deduplicateChatSummaries([nextChat, ...prev]));
      setSecretChatExpiresAt(data.chat.expiresAt); // exact server-side ISO timestamp
      setSecretChatCreateOpen(false);
      setProfileSubView(null);
      setProfileModalOpen(false);
      setDesktopDetailsPanelOpen(false);
      // Navigate into the new chat so activeChat becomes non-null
      setSelectedLink(`secret-${data.chat.id}`);
      setActiveConversation({
        chatType: "direct",
        conversationId: `secret:${data.chat.id}`,
        expiresAt: data.chat.expiresAt || null,
        secretCrypto,
        isApproved: false,
        isCreator: true,
        creatorId: selfId,
        peer: peer ? {
          id: peer.id,
          link: peer.link,
          displayName: peer.displayName || peer.link,
          avatarUrl: peer.avatarUrl ?? null,
          publicKey: (peer as any).publicKey || null,
        } : null,
        hasMoreBefore: false,
        messages: [],
      } as any);
      setMessages([]);
    }
  } catch (err: any) {
    console.error("Failed to create secret chat:", err);
    if (err.message === ACTIVE_SECRET_CHAT_NOTICE) toast.info(ACTIVE_SECRET_CHAT_NOTICE);
    else setErrorText(err.message || t("Не удалось создать секретный чат"));
  } finally {
    setSecretChatCreating(false);
  }
}

export interface OpenMessageHelperActionContext {
  messageHelperId: string | null;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessageHelperAllReactionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMessageHelperAnchor: React.Dispatch<React.SetStateAction<{ top: number; bottom: number; left: number; right: number; width: number; height: number; isMine: boolean; } | null>>;
  setMessageHelperReadListOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function openMessageHelperAction({ messageHelperId, setMessageHelperId, setMessageHelperAllReactionsOpen, setMessageHelperAnchor, setMessageHelperReadListOpen }: OpenMessageHelperActionContext, msgId: string, event?: React.MouseEvent | React.TouchEvent | HTMLElement): void {
  if (messageHelperId === msgId) {
    setMessageHelperId(null); setMessageHelperAllReactionsOpen(false);
    setMessageHelperAnchor(null);
    return;
  }
  let rect: DOMRect | null = null;
  let isMine = false;

  if (event && 'currentTarget' in event && event.currentTarget instanceof HTMLElement) {
    const bubbleEl = (event.currentTarget.closest('[data-message-helper-anchor="true"]') || event.currentTarget) as HTMLElement;
    rect = bubbleEl.getBoundingClientRect();
    isMine = bubbleEl.getAttribute('data-message-mine') === 'true';
  } else if (event instanceof HTMLElement) {
    rect = event.getBoundingClientRect();
    isMine = event.getAttribute('data-message-mine') === 'true';
  } else {
    const el = document.querySelector(`[data-message-id="${msgId}"] [data-message-helper-anchor="true"]`) as HTMLElement;
    if (el) {
      rect = el.getBoundingClientRect();
      isMine = el.getAttribute('data-message-mine') === 'true';
    }
  }

  if (rect) {
    setMessageHelperAnchor({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      isMine,
    });
  }
  setMessageHelperReadListOpen(false);
  setMessageHelperId(msgId);
}
