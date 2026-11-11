"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type ChatSummary, type ConversationResponse, type GroupModalData, type ProfilePreview, type ChannelModalData, type DecryptedMessage } from "../types";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { splitContactAliasParts } from "../helpers";
import { appendAndSortMessages } from "../chat-message-state";
import { readProfileDetailsMemoryCache, loadProfilePersistentCache, writeProfileDetailsMemoryCache, saveProfilePersistentCache } from "./chat-cache";

export interface SaveContactActionContext {
  contactEditorTarget: { link: string; displayName: string; avatarUrl?: string | null | undefined; } | null;
  contactSaving: boolean;
  contactFirstName: string;
  contactLastName: string;
  setContactMessage: React.Dispatch<React.SetStateAction<string | null>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  chats: ChatSummary[];
  activeConversation: ConversationResponse | null;
  groupModalData: GroupModalData | null;
  selfId: string | null;
  profileData: ProfilePreview | null;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  channelModalData: ChannelModalData | null;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  setContactsForAdd: React.Dispatch<React.SetStateAction<{ id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]>>;
  contactsForAddCacheRef: React.RefObject<{ savedAt: number; contacts: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]; } | null>;
  setContactSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setContactExists: React.Dispatch<React.SetStateAction<boolean>>;
  setContactEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openGroupModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
}

export async function saveContactAction({ contactEditorTarget, contactSaving, contactFirstName, contactLastName, setContactMessage, t, chats, activeConversation, groupModalData, selfId, profileData, setChats, setActiveConversation, setGroupModalData, groupModalCacheRef, channelModalData, contactsForAdd, setContactsForAdd, contactsForAddCacheRef, setContactSaving, setContactExists, setContactEditorOpen, openGroupModal }: SaveContactActionContext): Promise<void> {
  if (!contactEditorTarget || contactSaving) {
    return;
  }
  const firstName = contactFirstName.trim();
  const lastName = contactLastName.trim();
  const alias = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (alias.length > 60) {
    setContactMessage(t("Имя контакта должно быть не длиннее 60 символов"));
    return;
  }

  const targetLink = contactEditorTarget.link;
  const prevChat = chats.find((chat) => chat.chatType === "direct" && chat.link === targetLink) ?? null;
  const prevActiveConversation = activeConversation;
  const prevGroupModal = groupModalData;
  const prevProfileCache = readProfileDetailsMemoryCache(selfId, targetLink) ??
    (selfId ? loadProfilePersistentCache(selfId, targetLink) : null);
  const displayName = alias || prevProfileCache?.profile.displayName ||
    (profileData?.link === targetLink ? profileData.displayName : contactEditorTarget.displayName);

  setChats((prev) =>
    prev.map((chat) =>
      chat.chatType === "direct" && chat.link === targetLink
        ? { ...chat, displayName, contactAlias: alias || null }
        : chat,
    ),
  );
  setActiveConversation((prev) =>
    prev?.chatType === "direct" && prev.peer?.link === targetLink
      ? { ...prev, peer: { ...prev.peer, displayName, contactAlias: alias || null } }
      : prev,
  );
  setGroupModalData((prev) => {
    if (!prev) return prev;
    const nextMembers = prev.members.map((member) =>
      member.link === targetLink
        ? {
          ...member,
          displayName,
          isContact: true,
          contactAlias: alias,
        }
        : member,
    );
    const next = { ...prev, members: nextMembers };
    groupModalCacheRef.current.set(prev.group.link, { savedAt: Date.now(), data: next });
    return next;
  });

  // Optimistically update contacts for create group / channel / add members
  const resolvedContactId =
    profileData?.id ||
    chats.find((c) => c.chatType === "direct" && c.link === targetLink)?.peerId ||
    groupModalData?.members.find((m) => m.link === targetLink)?.id ||
    channelModalData?.subscribers?.find((s) => s.link === targetLink)?.id ||
    contactsForAdd.find((c) => c.link === targetLink)?.id ||
    targetLink;

  const resolvedAvatar = contactEditorTarget.avatarUrl ?? profileData?.avatarUrl ?? null;
  const newContactEntry = {
    id: resolvedContactId,
    link: targetLink,
    alias,
    displayName,
    avatarUrl: resolvedAvatar,
  };

  setContactsForAdd((prev) => {
    const exists = prev.some((c) => c.link === targetLink || (resolvedContactId && c.id === resolvedContactId));
    if (exists) {
      return prev.map((c) =>
        c.link === targetLink || (resolvedContactId && c.id === resolvedContactId)
          ? { ...c, ...newContactEntry }
          : c,
      );
    }
    return [newContactEntry, ...prev];
  });

  if (contactsForAddCacheRef.current) {
    const curr = contactsForAddCacheRef.current.contacts;
    const exists = curr.some((c) => c.link === targetLink || (resolvedContactId && c.id === resolvedContactId));
    contactsForAddCacheRef.current = {
      savedAt: Date.now(),
      contacts: exists
        ? curr.map((c) =>
          c.link === targetLink || (resolvedContactId && c.id === resolvedContactId)
            ? { ...c, ...newContactEntry }
            : c,
        )
        : [newContactEntry, ...curr],
    };
  } else {
    contactsForAddCacheRef.current = {
      savedAt: Date.now(),
      contacts: [newContactEntry],
    };
  }

  if (prevProfileCache) {
    const savedProfileCache = {
      ...prevProfileCache,
      savedAt: Date.now(),
      contact: {
        exists: true,
        contact: {
          alias,
          updatedAt: new Date().toISOString(),
        },
      },
    };
    writeProfileDetailsMemoryCache(selfId, targetLink, savedProfileCache);
    if (selfId) saveProfilePersistentCache(selfId, targetLink, savedProfileCache);
  }

  setContactSaving(false);
  setContactExists(true);
  setContactMessage(t("Контакт сохранен"));
  setContactEditorOpen(false);
  showAppToast({ title: t("Контакт сохранен"), type: "success" });
  if (groupModalData?.group?.link) {
    void openGroupModal(groupModalData.group.link);
  }

  void (async () => {
    try {
      await apiRequest(`/api/contacts/${encodeURIComponent(targetLink)}`, {
        method: "POST",
        body: JSON.stringify({
          alias,
        }),
      });
    } catch (error) {
      if (prevChat) {
        setChats((prev) =>
          prev.map((chat) =>
            chat.chatType === "direct" && chat.link === targetLink
              ? { ...chat, displayName: prevChat.displayName, contactTag: prevChat.contactTag ?? null, contactTagVariant: prevChat.contactTagVariant ?? "outline" }
              : chat,
          ),
        );
      }
      if (prevActiveConversation) {
        setActiveConversation((prev) =>
          prev?.chatType === "direct" && prev.peer?.link === targetLink ? prevActiveConversation : prev,
        );
      }
      if (prevGroupModal) {
        setGroupModalData(prevGroupModal);
        groupModalCacheRef.current.set(prevGroupModal.group.link, { savedAt: Date.now(), data: prevGroupModal });
      }
      if (prevProfileCache) {
        writeProfileDetailsMemoryCache(selfId, targetLink, prevProfileCache);
        if (selfId) saveProfilePersistentCache(selfId, targetLink, prevProfileCache);
      }
      const msg = error instanceof Error ? error.message : t("Не удалось сохранить контакт");
      setContactMessage(msg);
      showAppToast({ title: msg, type: "error" });
    }
  })();
}

export interface RemoveContactActionContext {
  contactEditorTarget: { link: string; displayName: string; avatarUrl?: string | null | undefined; } | null;
  contactSaving: boolean;
  chats: ChatSummary[];
  activeConversation: ConversationResponse | null;
  groupModalData: GroupModalData | null;
  selfId: string | null;
  profileData: ProfilePreview | null;
  setContactExists: React.Dispatch<React.SetStateAction<boolean>>;
  setContactFirstName: React.Dispatch<React.SetStateAction<string>>;
  setContactLastName: React.Dispatch<React.SetStateAction<string>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  setContactsForAdd: React.Dispatch<React.SetStateAction<{ id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]>>;
  contactsForAddCacheRef: React.RefObject<{ savedAt: number; contacts: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]; } | null>;
  setContactSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setContactMessage: React.Dispatch<React.SetStateAction<string | null>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setContactEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openGroupModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
}

export async function removeContactAction({ contactEditorTarget, contactSaving, chats, activeConversation, groupModalData, selfId, profileData, setContactExists, setContactFirstName, setContactLastName, setChats, setActiveConversation, setGroupModalData, groupModalCacheRef, setContactsForAdd, contactsForAddCacheRef, setContactSaving, setContactMessage, t, setContactEditorOpen, openGroupModal }: RemoveContactActionContext): Promise<void> {
  if (!contactEditorTarget || contactSaving) {
    return;
  }
  const targetLink = contactEditorTarget.link;
  const prevChat = chats.find((chat) => chat.chatType === "direct" && chat.link === targetLink) ?? null;
  const prevActiveConversation = activeConversation;
  const prevGroupModal = groupModalData;
  const prevProfileCache = readProfileDetailsMemoryCache(selfId, targetLink);
  const fallbackDisplayName = prevProfileCache?.profile.displayName ?? profileData?.displayName ?? contactEditorTarget.displayName;

  setContactExists(false);
  setContactFirstName("");
  setContactLastName("");
  setChats((prev) =>
    prev.map((chat) =>
      chat.chatType === "direct" && chat.link === targetLink
        ? {
          ...chat,
          displayName: fallbackDisplayName,
          contactAlias: null,
          contactTag: null,
          contactTagVariant: "outline",
        }
        : chat,
    ),
  );
  setActiveConversation((prev) =>
    prev?.chatType === "direct" && prev.peer?.link === targetLink
      ? { ...prev, peer: { ...prev.peer, displayName: fallbackDisplayName, contactAlias: null } }
      : prev,
  );
  setGroupModalData((prev) => {
    if (!prev) return prev;
    const next = {
      ...prev,
      members: prev.members.map((member) =>
        member.link === targetLink
          ? {
            ...member,
            displayName: fallbackDisplayName,
            isContact: false,
            contactAlias: null,
            contactTag: null,
            contactTagVariant: "outline" as const,
          }
          : member,
      ),
    };
    groupModalCacheRef.current.set(prev.group.link, { savedAt: Date.now(), data: next });
    return next;
  });

  setContactsForAdd((prev) => prev.filter((c) => c.link !== targetLink));
  if (contactsForAddCacheRef.current) {
    contactsForAddCacheRef.current = {
      savedAt: Date.now(),
      contacts: contactsForAddCacheRef.current.contacts.filter((c) => c.link !== targetLink),
    };
  }

  if (prevProfileCache) {
    writeProfileDetailsMemoryCache(selfId, targetLink, {
      ...prevProfileCache,
      contact: {
        exists: false,
        contact: null,
      },
    });
  }

  setContactSaving(true);
  setContactMessage(null);
  try {
    await apiRequest(`/api/contacts/${encodeURIComponent(targetLink)}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    setContactMessage(t("Контакт удален"));
    setContactEditorOpen(false);
    if (groupModalData?.group?.link) {
      void openGroupModal(groupModalData.group.link);
    }
  } catch (error) {
    if (prevChat) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.chatType === "direct" && chat.link === targetLink
            ? { ...chat, displayName: prevChat.displayName, contactTag: prevChat.contactTag ?? null, contactTagVariant: prevChat.contactTagVariant ?? "outline" }
            : chat,
        ),
      );
    }
    if (prevActiveConversation) {
      setActiveConversation((prev) =>
        prev?.chatType === "direct" && prev.peer?.link === targetLink ? prevActiveConversation : prev,
      );
    }
    if (prevGroupModal) {
      setGroupModalData(prevGroupModal);
      groupModalCacheRef.current.set(prevGroupModal.group.link, { savedAt: Date.now(), data: prevGroupModal });
    }
    if (prevProfileCache) {
      writeProfileDetailsMemoryCache(selfId, targetLink, prevProfileCache);
      const contact = prevProfileCache.contact.contact;
      setContactExists(prevProfileCache.contact.exists);
      const aliasParts = splitContactAliasParts(contact?.alias ?? "");
      setContactFirstName(aliasParts.firstName);
      setContactLastName(aliasParts.lastName);
    }
    setContactMessage(error instanceof Error ? error.message : t("Не удалось удалить контакт"));
  } finally {
    setContactSaving(false);
  }
}

export interface HandleWallpaperUploadActionContext {
  wallpaperTargetRef: React.RefObject<string | null>;
  activeChat: ChatSummary | null;
  profileData: ProfilePreview | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  chats: ChatSummary[];
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setUploadingWallpaper: React.Dispatch<React.SetStateAction<boolean>>;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
}

export async function handleWallpaperUploadAction({ wallpaperTargetRef, activeChat, profileData, t, chats, setActiveConversation, setChats, setUploadingWallpaper, activeConversationRef, setMessages, sanitizeMessages }: HandleWallpaperUploadActionContext, file: File): Promise<void> {
  const currentLink = wallpaperTargetRef.current || activeChat?.link || profileData?.link;
  wallpaperTargetRef.current = null;
  if (!currentLink) {
    showAppToast({ type: "error", title: t("Выберите личный чат для установки обоев") });
    return;
  }

  const targetChat = chats.find(chat => chat.link === currentLink);
  const previousWallpaper = { wallpaperUrl: targetChat?.wallpaperUrl ?? null, wallpaperPosY: targetChat?.wallpaperPosY ?? null };
  const isTarget = (conversation: ConversationResponse | null) => Boolean(conversation?.peer && (conversation.peer.link === currentLink || conversation.peer.secondaryLinks?.includes(currentLink)));
  const localPreviewUrl = URL.createObjectURL(file);

  // Optimistically update active conversation and chat item
  setActiveConversation((prev) => (isTarget(prev) && prev ? { ...prev, wallpaperUrl: localPreviewUrl, wallpaperPosY: 50 } : prev));
  setChats((prev) =>
    prev.map((c) => (c.link === currentLink ? { ...c, wallpaperUrl: localPreviewUrl, wallpaperPosY: 50 } : c))
  );

  setUploadingWallpaper(true);
  try {
    const formData = new FormData();
    formData.append("kind", "image");
    formData.append("file", file);

    const mediaRes = await apiRequest<{ id: string; url: string }>("/api/media", {
      method: "POST",
      body: formData,
    });

    if (!mediaRes?.url) {
      throw new Error(t("Не удалось загрузить изображение"));
    }

    const wallpaperRes = await apiRequest<{
      success: boolean;
      wallpaperUrl: string;
      wallpaperPosY: number;
      message: any;
    }>(`/api/chats/${encodeURIComponent(currentLink)}/wallpaper`, {
      method: "POST",
      body: JSON.stringify({
        wallpaperUrl: mediaRes.url,
        wallpaperPosY: 50,
      }),
    });

    setActiveConversation((prev) => (isTarget(prev) && prev ? { ...prev, wallpaperUrl: mediaRes.url, wallpaperPosY: 50 } : prev));
    setChats((prev) =>
      prev.map((c) => (c.link === currentLink ? { ...c, wallpaperUrl: mediaRes.url, wallpaperPosY: 50 } : c))
    );

    if (wallpaperRes?.message && isTarget(activeConversationRef.current)) {
      const newMsg: DecryptedMessage = {
        id: wallpaperRes.message.id,
        senderId: wallpaperRes.message.senderId,
        text: "",
        createdAt: wallpaperRes.message.createdAt,
        reactions: [],
        systemPayload: wallpaperRes.message.systemPayload,
      };
      setMessages((prev) => appendAndSortMessages(sanitizeMessages(prev), newMsg));
    }

    showAppToast({ type: "success", title: t("Обои установлены") });
  } catch (err: unknown) {
    console.error("Failed to set wallpaper:", err);
    const msg = err instanceof Error ? err.message : t("Не удалось установить обои");
    showAppToast({ type: "error", title: msg });
    setActiveConversation((prev) => (isTarget(prev) && prev ? { ...prev, ...previousWallpaper } : prev));
    setChats(prev => prev.map(chat => chat.link === currentLink ? { ...chat, ...previousWallpaper } : chat));
  } finally {
    setUploadingWallpaper(false);
    URL.revokeObjectURL(localPreviewUrl);
  }
}

export interface HandleApplyPeerWallpaperActionContext {
  activeChat: ChatSummary | null;
  profileData: ProfilePreview | null;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setApplyingWallpaper: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function handleApplyPeerWallpaperAction({ activeChat, profileData, setActiveConversation, setChats, setApplyingWallpaper, t }: HandleApplyPeerWallpaperActionContext, url: string, posY?: number): Promise<void> {
  const currentLink = activeChat?.link || profileData?.link;
  if (!currentLink) return;

  setActiveConversation((prev) => (prev ? { ...prev, wallpaperUrl: url, wallpaperPosY: posY ?? 50 } : null));
  setChats((prev) =>
    prev.map((c) => (c.link === currentLink ? { ...c, wallpaperUrl: url, wallpaperPosY: posY ?? 50 } : c))
  );
  setApplyingWallpaper(true);

  try {
    await apiRequest(`/api/chats/${encodeURIComponent(currentLink)}/wallpaper`, {
      method: "POST",
      body: JSON.stringify({
        wallpaperUrl: url,
        wallpaperPosY: posY ?? 50,
        notifyPeer: false,
      }),
    });
    showAppToast({ type: "success", title: t("Обои применены") });
  } catch (err: unknown) {
    console.error("Failed to apply wallpaper:", err);
    const msg = err instanceof Error ? err.message : t("Не удалось применить обои");
    showAppToast({ type: "error", title: msg });
  } finally {
    setApplyingWallpaper(false);
  }
}
