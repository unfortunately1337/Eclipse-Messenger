"use client";

import { type ConversationResponse, type ChatSummary, type ProfilePreview, type GroupModalData, type CreateChatKind, type SelfProfile, type CreateChatDraft, type CreateChatStep, type DecryptedMessage, type ConversationChatType, type ContactResponse } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { directChatProfileLink } from "@/lib/client/direct-chat-summary";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { ECLIPSE_DIALOG_LINK } from "@/lib/eclipse-system";
import { broadcastProfileUpdated } from "@/lib/client/local-updates";
import { splitContactAliasParts } from "../helpers";
import { readProfileDetailsMemoryCache, loadProfilePersistentCache, writeProfileDetailsMemoryCache, saveProfilePersistentCache } from "./chat-cache";
import { isLikelyPublicLink } from "./message-links";
import { GROUP_MODAL_CACHE_TTL_MS, CONTACTS_FOR_ADD_CACHE_TTL_MS } from "./config";

export interface OpenProfileModalActionContext {
  activeConversation: ConversationResponse | null;
  activeChat: ChatSummary | null;
  detailsTargetRef: React.RefObject<{ kind: "direct" | "group" | "channel"; link: string; } | null>;
  setProfileOpenedExternally: React.Dispatch<React.SetStateAction<boolean>>;
  showDetailsPanel: (kind: "direct" | "group" | "channel", link: string) => void;
  setContactEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setContactEditorTarget: React.Dispatch<React.SetStateAction<{ link: string; displayName: string; avatarUrl?: string | null | undefined; } | null>>;
  setProfileSubView: React.Dispatch<React.SetStateAction<"qrcode" | "contact_editor" | "secret_chat" | null>>;
  setProfileActiveTab: React.Dispatch<React.SetStateAction<"voice" | "music" | "members" | "media" | "files" | "links">>;
  setContactExists: React.Dispatch<React.SetStateAction<boolean>>;
  setContactFirstName: React.Dispatch<React.SetStateAction<string>>;
  setContactLastName: React.Dispatch<React.SetStateAction<string>>;
  setContactEditorInitial: React.Dispatch<React.SetStateAction<{ firstName: string; lastName: string; } | null>>;
  setProfileData: React.Dispatch<React.SetStateAction<ProfilePreview | null>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setProfileLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileError: React.Dispatch<React.SetStateAction<string | null>>;
  setProfileMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selfId: string | null;
  chats: ChatSummary[];
  setContactMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setInspectedDetailsEntity: React.Dispatch<React.SetStateAction<{ type: "direct" | "group" | "channel"; link: string; } | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setDesktopDetailsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export async function openProfileModalAction({ activeConversation, activeChat, detailsTargetRef, setProfileOpenedExternally, showDetailsPanel, setContactEditorOpen, setContactEditorTarget, setProfileSubView, setProfileActiveTab, setContactExists, setContactFirstName, setContactLastName, setContactEditorInitial, setProfileData, t, setProfileLoading, setProfileError, setProfileMoreOpen, selfId, chats, setContactMessage, setInspectedDetailsEntity, setChats, setDesktopDetailsPanelOpen, setProfileModalOpen }: OpenProfileModalActionContext, link: string, external = true): Promise<void> {
  if (!link) return;
  let targetLink = link.trim().replace(/^@+/, "");
  const lower = targetLink.toLowerCase();
  if (!targetLink) return;
  if (targetLink.startsWith("secret-")) {
    targetLink = (activeConversation?.peer?.link || (activeChat as any)?.peer?.link || "").replace(/^@+/, "");
    if (!targetLink) return;
  }
  detailsTargetRef.current = { kind: "direct", link: targetLink };
  const isCurrent = () => detailsTargetRef.current?.kind === "direct" && detailsTargetRef.current.link === targetLink;

  setProfileOpenedExternally(external);
  showDetailsPanel("direct", targetLink);
  setContactEditorOpen(false);
  setContactEditorTarget(null);
  setProfileSubView(null);
  setProfileActiveTab((prev) => (prev === "members" ? "media" : prev));

  // Reset contact state immediately to avoid showing previous user's contact details
  setContactExists(false);
  setContactFirstName("");
  setContactLastName("");
  setContactEditorInitial({
    firstName: "",
    lastName: "",
  });

  if (lower === ECLIPSE_DIALOG_LINK || lower === "saved") {
    const saved = lower === "saved";
    setProfileData({
      id: saved ? "saved" : "eclipse-system",
      link: saved ? "saved" : ECLIPSE_DIALOG_LINK,
      displayName: saved ? t("Избранное") : "Eclipse",
      isBot: !saved,
      avatarUrl: null,
      usernameHidden: saved,
      description: null,
      createdAt: "",
    });
    setProfileLoading(false);
    setProfileError(null);
    setProfileMoreOpen(false);
    return;
  }

  // Fast cache resolution: primary link or secondary link
  let cachedProfile = selfId
    ? readProfileDetailsMemoryCache(selfId, targetLink) ?? loadProfilePersistentCache(selfId, targetLink)
    : null;

  if (!cachedProfile && selfId) {
    const matchingChat = chats.find(
      (c) =>
        c.link?.trim().toLowerCase().replace(/^@+/, "") === lower ||
        c.secondaryLinks?.some((l) => l.trim().toLowerCase().replace(/^@+/, "") === lower)
    );
    if (matchingChat?.link) {
      cachedProfile =
        readProfileDetailsMemoryCache(selfId, matchingChat.link) ??
        loadProfilePersistentCache(selfId, matchingChat.link);
    }
  }

  // STRICT VALIDATION: cachedProfile MUST actually match lower
  const matchesTarget = Boolean(
    cachedProfile?.profile &&
    (cachedProfile.profile.link?.trim().toLowerCase().replace(/^@+/, "") === lower ||
      cachedProfile.profile.secondaryLinks?.some((l) => l.trim().toLowerCase().replace(/^@+/, "") === lower))
  );
  if (!matchesTarget) {
    cachedProfile = null;
  }

  const isFreshProfile =
    Boolean(cachedProfile) &&
    matchesTarget &&
    cachedProfile?.profile?.secondaryLinks !== undefined &&
    Date.now() - (cachedProfile?.savedAt ?? 0) <= 30_000;

  const seedProfile: ProfilePreview = (matchesTarget ? cachedProfile?.profile : null) ?? (() => {
    const peer =
      (activeConversation?.peer?.link?.trim().toLowerCase().replace(/^@+/, "") === lower ||
        activeConversation?.peer?.secondaryLinks?.some((l) => l.trim().toLowerCase().replace(/^@+/, "") === lower)
        ? activeConversation.peer
        : null) ||
      (activeChat?.link?.trim().toLowerCase().replace(/^@+/, "") === lower ||
        activeChat?.secondaryLinks?.some((l) => l.trim().toLowerCase().replace(/^@+/, "") === lower)
        ? activeChat
        : null) ||
      chats.find(
        (c) =>
          c.link?.trim().toLowerCase().replace(/^@+/, "") === lower ||
          c.secondaryLinks?.some((l) => l.trim().toLowerCase().replace(/^@+/, "") === lower)
      ) ||
      null;

    if (peer && (peer.link?.trim().toLowerCase().replace(/^@+/, "") === lower || (peer as any).secondaryLinks?.some((l: string) => l.trim().toLowerCase().replace(/^@+/, "") === lower))) {
      return {
        id: (peer as any).id ?? (peer as any).peerId ?? "",
        link: peer.link,
        secondaryLinks: (peer as any).secondaryLinks,
        displayName: peer.displayName,
        isBot: peer.isBot,
        avatarUrl: peer.avatarUrl ?? null,
        description: (peer as any).description ?? (peer as any).statusText ?? null,
        presenceVisibility: "all" as const,
        createdAt: "",
      };
    }

    return {
      id: "",
      link: targetLink,
      secondaryLinks: [],
      displayName: `@${targetLink}`,
      avatarUrl: null,
      description: null,
      presenceVisibility: "all" as const,
      createdAt: "",
    };
  })();

  setProfileData(seedProfile);
  setContactEditorTarget({
    link: seedProfile.link,
    displayName: seedProfile.displayName,
    avatarUrl: seedProfile.avatarUrl ?? null,
  });
  if (cachedProfile?.contact?.exists) {
    setContactExists(true);
    const draftParts = splitContactAliasParts(cachedProfile.contact.contact?.alias ?? cachedProfile.profile.displayName);
    setContactFirstName(draftParts.firstName);
    setContactLastName(draftParts.lastName);
    setContactEditorInitial({
      firstName: draftParts.firstName.trim(),
      lastName: draftParts.lastName.trim(),
    });
  }

  setProfileLoading(!cachedProfile && seedProfile.id === "");
  setProfileError(null);
  setContactMessage(null);

  if (isFreshProfile) {
    return;
  }

  try {
    const [profile, contact] = await Promise.all([
      apiRequest<ProfilePreview>(`/api/profile/${encodeURIComponent(targetLink)}`, { method: "GET" }),
      apiRequest<ContactResponse>(`/api/contacts/${encodeURIComponent(targetLink)}`, { method: "GET" }).catch(() => ({ exists: false, contact: null })),
    ]);
    if (!isCurrent()) return;

    const snapshot = { savedAt: Date.now(), profile, contact };
    writeProfileDetailsMemoryCache(selfId, targetLink, snapshot);
    if (profile.link && profile.link.toLowerCase() !== lower) {
      writeProfileDetailsMemoryCache(selfId, profile.link, snapshot);
    }
    for (const sec of profile.secondaryLinks || []) {
      if (sec.toLowerCase() !== lower) {
        writeProfileDetailsMemoryCache(selfId, sec, snapshot);
      }
    }

    if (selfId) {
      saveProfilePersistentCache(selfId, targetLink, snapshot);
      if (profile.link && profile.link.toLowerCase() !== lower) {
        saveProfilePersistentCache(selfId, profile.link, snapshot);
      }
    }

    setProfileData(profile);
    setInspectedDetailsEntity((current) =>
      current?.type === "direct" && current.link === targetLink ? { ...current, link: profile.link } : current,
    );
    setContactEditorTarget({ link: profile.link, displayName: profile.displayName, avatarUrl: profile.avatarUrl ?? null });
    if (contact.exists && contact.contact) {
      setContactExists(true);
      const draftParts = splitContactAliasParts(contact.contact.alias);
      setContactFirstName(draftParts.firstName);
      setContactLastName(draftParts.lastName);
      setContactEditorInitial({
        firstName: draftParts.firstName.trim(),
        lastName: draftParts.lastName.trim(),
      });
    } else {
      setContactExists(false);
      setContactFirstName("");
      setContactLastName("");
      setContactEditorInitial({
        firstName: "",
        lastName: "",
      });
    }
    broadcastProfileUpdated({
      id: profile.id,
      link: profile.link,
      secondaryLinks: profile.secondaryLinks,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
      description: profile.description ?? null,
    });

    setChats((prev) =>
      prev.map((c) =>
        c.link?.toLowerCase() === profile.link.toLowerCase() ||
          c.link?.toLowerCase() === targetLink.toLowerCase() ||
          c.secondaryLinks?.some((l) => l.toLowerCase() === targetLink.toLowerCase()) ||
          (profile.id && c.peerId === profile.id)
          ? {
            ...c,
            link: directChatProfileLink(c, profile.link),
            contactAlias: contact.exists ? contact.contact?.alias ?? null : null,
            secondaryLinks: profile.secondaryLinks ?? c.secondaryLinks,
            peerId: profile.id || c.peerId,
            displayName: contact.contact?.alias?.trim() || profile.displayName || c.displayName,
            avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : c.avatarUrl,
          }
          : c
      )
    );
  } catch (error) {
    if (isCurrent() && !cachedProfile && seedProfile.id === "") {
      setProfileData(null);
      setContactEditorTarget(null);
      setDesktopDetailsPanelOpen(false);
      setInspectedDetailsEntity(null);
      setProfileModalOpen(false);
      const msg = error instanceof Error ? error.message : t("Не удалось загрузить профиль");
      setProfileError(msg);
      showAppToast({
        type: "error",
        title: t("Пользователь не найден"),
        description: t("Пользователь @{0} не найден или не существует.", { 0: targetLink }),
        durationMs: 4000,
      });
    }
  } finally {
    if (isCurrent()) setProfileLoading(false);
  }
}

export interface OpenGroupModalActionContext {
  detailsTargetRef: React.RefObject<{ kind: "direct" | "group" | "channel"; link: string; } | null>;
  groupMembersReturnViewRef: React.RefObject<"settings" | null>;
  showDetailsPanel: (kind: "direct" | "group" | "channel", link: string) => void;
  setGroupNameEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setContactEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setGroupModalError: React.Dispatch<React.SetStateAction<string | null>>;
  setContactMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setGroupSubView: React.Dispatch<React.SetStateAction<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>>;
  setProfileActiveTab: React.Dispatch<React.SetStateAction<"voice" | "music" | "members" | "media" | "files" | "links">>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  activeGroupModalSeed: GroupModalData | null;
  chats: ChatSummary[];
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  setGroupNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setGroupDescriptionDraft: React.Dispatch<React.SetStateAction<string>>;
  setGroupAvatarDraft: React.Dispatch<React.SetStateAction<string | null>>;
  setGroupIsPublicDraft: React.Dispatch<React.SetStateAction<boolean>>;
  setGroupLinkDraft: React.Dispatch<React.SetStateAction<string>>;
  setGroupModalLoading: React.Dispatch<React.SetStateAction<boolean>>;
  groupDetailsInFlightRef: React.RefObject<Set<string>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function openGroupModalAction({ detailsTargetRef, groupMembersReturnViewRef, showDetailsPanel, setGroupNameEditing, setContactEditorOpen, setGroupModalError, setContactMessage, setGroupSubView, setProfileActiveTab, groupModalCacheRef, activeGroupModalSeed, chats, setGroupModalData, setGroupNameDraft, setGroupDescriptionDraft, setGroupAvatarDraft, setGroupIsPublicDraft, setGroupLinkDraft, setGroupModalLoading, groupDetailsInFlightRef, t }: OpenGroupModalActionContext, link: string, options?: { forceRefresh?: boolean }): Promise<void> {
  detailsTargetRef.current = { kind: "group", link };
  const isCurrent = () => detailsTargetRef.current?.kind === "group" && detailsTargetRef.current.link === link;
  groupMembersReturnViewRef.current = null;
  showDetailsPanel("group", link);
  setGroupNameEditing(false);
  setContactEditorOpen(false);
  setGroupModalError(null);
  setContactMessage(null);
  setGroupSubView(null);
  setProfileActiveTab("members");
  const cached = groupModalCacheRef.current.get(link);
  const seeded = activeGroupModalSeed?.group.link === link ? activeGroupModalSeed : null;
  const fallbackGroupChat = chats.find((c) => c.link === link && c.chatType === "group");
  const fallbackSeed: GroupModalData | null = fallbackGroupChat ? {
    group: {
      id: fallbackGroupChat.peerId || "",
      link: fallbackGroupChat.link,
      name: fallbackGroupChat.displayName,
      avatarUrl: fallbackGroupChat.avatarUrl ?? null,
      ownerId: undefined,
      myRole: fallbackGroupChat.isGroupOwner ? "owner" : undefined,
      myCanAddMembers: fallbackGroupChat.isGroupOwner || undefined,
      isPublic: isLikelyPublicLink(fallbackGroupChat.link),
    },
    members: [],
  } : null;
  const immediate = cached?.data ?? seeded ?? fallbackSeed;
  const isFresh = cached ? (Date.now() - cached.savedAt <= GROUP_MODAL_CACHE_TTL_MS && (cached.data.members?.length ?? 0) > 0) : false;
  if (immediate) {
    setGroupModalData(immediate);
    setGroupNameDraft(immediate.group.name ?? "");
    setGroupDescriptionDraft(immediate.group.description ?? "");
    setGroupAvatarDraft(immediate.group.avatarUrl ?? null);
    setGroupIsPublicDraft(Boolean(immediate.group.isPublic));
    setGroupLinkDraft(immediate.group.link ?? "");
  } else {
    setGroupModalData(null);
    setGroupNameDraft("");
    setGroupDescriptionDraft("");
    setGroupAvatarDraft(null);
    setGroupIsPublicDraft(false);
    setGroupLinkDraft("");
  }
  setGroupModalLoading(!immediate);
  if (cached && isFresh && !options?.forceRefresh) {
    return;
  }
  if (groupDetailsInFlightRef.current.has(link) && immediate && !options?.forceRefresh) {
    return;
  }
  groupDetailsInFlightRef.current.add(link);
  try {
    const data = await apiRequest<GroupModalData>(`/api/groups/${encodeURIComponent(link)}/members`, {
      method: "GET",
      cache: "no-store",
    });
    groupModalCacheRef.current.set(link, { savedAt: Date.now(), data });
    if (!isCurrent()) return;
    setGroupModalData(data);
    setGroupNameDraft(data.group.name ?? "");
    setGroupDescriptionDraft(data.group.description ?? "");
    setGroupAvatarDraft(data.group.avatarUrl ?? null);
    setGroupIsPublicDraft(Boolean(data.group.isPublic));
    setGroupLinkDraft(data.group.link ?? "");
  } catch (error) {
    if (isCurrent() && !immediate) {
      setGroupModalData(null);
      setGroupModalError(error instanceof Error ? error.message : t("Не удалось загрузить группу"));
    }
  } finally {
    groupDetailsInFlightRef.current.delete(link);
    if (isCurrent()) setGroupModalLoading(false);
  }
}

export interface OpenAddMembersModalActionContext {
  groupSubView: "type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null;
  groupAddMembersReturnViewRef: React.RefObject<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>;
  setGroupSubView: React.Dispatch<React.SetStateAction<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>>;
  channelSubView: "type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null;
  channelAddMembersReturnViewRef: React.RefObject<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>;
  setChannelSubView: React.Dispatch<React.SetStateAction<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>>;
  setAddMembersContactQuery: React.Dispatch<React.SetStateAction<string>>;
  setAddMembersTargetKind: React.Dispatch<React.SetStateAction<"group" | "channel">>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  contactsForAddCacheRef: React.RefObject<{ savedAt: number; contacts: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]; } | null>;
  setContactsForAdd: React.Dispatch<React.SetStateAction<{ id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]>>;
  setAddMembersContactsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export async function openAddMembersModalAction({ groupSubView, groupAddMembersReturnViewRef, setGroupSubView, channelSubView, channelAddMembersReturnViewRef, setChannelSubView, setAddMembersContactQuery, setAddMembersTargetKind, setSelectedContactIds, contactsForAddCacheRef, setContactsForAdd, setAddMembersContactsLoading }: OpenAddMembersModalActionContext, kind: "group" | "channel" = "group"): Promise<void> {
  if (kind === "group") {
    if (groupSubView !== "add_members") groupAddMembersReturnViewRef.current = groupSubView;
    setGroupSubView("add_members");
  } else {
    if (channelSubView !== "add_subscribers") channelAddMembersReturnViewRef.current = channelSubView;
    setChannelSubView("add_subscribers");
  }
  setAddMembersContactQuery("");
  setAddMembersTargetKind(kind);
  setSelectedContactIds([]);
  const cached = contactsForAddCacheRef.current;
  const isFresh = cached ? Date.now() - cached.savedAt <= CONTACTS_FOR_ADD_CACHE_TTL_MS : false;
  if (cached) {
    setContactsForAdd(cached.contacts);
  }
  if (cached && isFresh) {
    return;
  }
  setAddMembersContactsLoading(true);
  try {
    const data = await apiRequest<{
      contacts: Array<{ id: string; link: string; alias: string; avatarUrl?: string | null; displayName?: string }>;
    }>("/api/contacts", { method: "GET" });
    contactsForAddCacheRef.current = { savedAt: Date.now(), contacts: data.contacts };
    setContactsForAdd(data.contacts);
  } catch {
    if (!cached || !isFresh) {
      setContactsForAdd([]);
    }
  } finally {
    setAddMembersContactsLoading(false);
  }
}

export interface ToggleCreateChatContactActionContext {
  setCreateChatSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  createChatKind: CreateChatKind | null;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  selfProfile: SelfProfile | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setCreateChatDraft: React.Dispatch<React.SetStateAction<CreateChatDraft>>;
}

export function toggleCreateChatContactAction({ setCreateChatSelectedIds, createChatKind, contactsForAdd, selfProfile, t, setCreateChatDraft }: ToggleCreateChatContactActionContext, id: string): void {
  setCreateChatSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    if (createChatKind === "group") {
      const names = Array.from(next)
        .map((uid) => {
          const contact = contactsForAdd.find((c) => c.id === uid);
          return contact ? (contact.alias || contact.displayName || contact.link) : "";
        })
        .filter(Boolean);

      const myName = selfProfile?.displayName || selfProfile?.link || t("Вы");
      const allNames = [myName, ...names];

      let autoName = "";
      if (allNames.length === 1) {
        autoName = allNames[0];
      } else if (allNames.length === 2) {
        autoName = t("{0} и {1}", { 0: allNames[0], 1: allNames[1] });
      } else if (allNames.length === 3) {
        autoName = t("{0}, {1} и {2}", { 0: allNames[0], 1: allNames[1], 2: allNames[2] });
      } else if (allNames.length > 3) {
        autoName = t("{0}, {1}, {2} и еще {3}", { 0: allNames[0], 1: allNames[1], 2: allNames[2], 3: allNames.length - 3 });
      }

      setCreateChatDraft((prevDraft) => ({
        ...prevDraft,
        name: autoName,
      }));
    }

    return next;
  });
}

export interface SubmitCreateChatActionContext {
  createChatKind: CreateChatKind | null;
  createChatCreating: boolean;
  createChatDraft: CreateChatDraft;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setCreateChatStep: React.Dispatch<React.SetStateAction<CreateChatStep>>;
  createChatSelectedIds: Set<string>;
  setCreateChatCreating: React.Dispatch<React.SetStateAction<boolean>>;
  rotateSharedKey: (chatType: "group" | "channel", link: string, chatId: string) => Promise<{ version: number; keyBase64: string; createdAt: number; }>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setCreateChatKind: React.Dispatch<React.SetStateAction<CreateChatKind | null>>;
  setCreateChatSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCreateChatContactQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  selectedLinkRef: React.RefObject<string | null>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  router: AppRouterInstance;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
}

export async function submitCreateChatAction({ createChatKind, createChatCreating, createChatDraft, setErrorText, t, setCreateChatStep, createChatSelectedIds, setCreateChatCreating, rotateSharedKey, setChats, setCreateChatKind, setCreateChatSelectedIds, setCreateChatContactQuery, setActiveConversation, setMessages, selectedLinkRef, setSelectedLink, router, openConversationRef }: SubmitCreateChatActionContext): Promise<void> {
  if (!createChatKind || createChatCreating) return;
  const normalizedName = createChatDraft.name.trim();
  const normalizedLink = createChatDraft.link.trim().replace(/^@+/, "").toLowerCase();
  const isLinkValid = /^[a-z][a-z0-9_]{2,30}[a-z0-9]$/.test(normalizedLink);
  if (normalizedName.length < 2) {
    setErrorText(null);
    showAppToast({ title: t("Название должно содержать не менее 2 символов"), type: "error" });
    setCreateChatStep("details");
    return;
  }
  if (createChatDraft.isPublic && !isLinkValid) {
    setErrorText(null);
    showAppToast({ title: t("Введите корректное уникальное имя (от 4 символов)"), type: "error" });
    setCreateChatStep("settings");
    return;
  }
  if (createChatKind === "group" && createChatSelectedIds.size === 0) {
    setErrorText(null);
    showAppToast({ title: t("Выберите хотя бы одного участника"), type: "error" });
    setCreateChatStep("members");
    return;
  }
  setCreateChatCreating(true);
  try {
    const createdChatType = createChatKind;
    const endpoint = createChatKind === "group" ? "/api/groups" : "/api/channels";
    const data = await apiRequest<
      | { group: { id: string; link: string; name: string; avatarUrl?: string | null; createdAt: string } }
      | { channel: { id: string; link: string; name: string; avatarUrl?: string | null; createdAt: string } }
    >(endpoint, {
      method: "POST",
      body: JSON.stringify({
        name: normalizedName,
        link: createChatDraft.isPublic ? normalizedLink : null,
        isPublic: Boolean(createChatDraft.isPublic),
        avatarUrl: createChatDraft.photoDataUrl,
        description: createChatDraft.description?.trim() || null,
        memberIds: Array.from(createChatSelectedIds),
      }),
    });
    const created = "group" in data ? data.group : data.channel;
    const createdLink = created.link.trim().toLowerCase();
    void rotateSharedKey(createdChatType, createdLink, created.id).catch((keyErr) => {
      console.warn("Initial shared key rotation deferred:", keyErr);
    });
    const nextChat: ChatSummary = {
      chatType: createdChatType,
      conversationId: `${createdChatType}:${created.id}`,
      peerId: created.id,
      link: createdLink,
      displayName: created.name,
      avatarUrl: created.avatarUrl ?? null,
      membersCount: createdChatType === "group" ? String(createChatSelectedIds.size + 1) : undefined,
      subscribersCount: createdChatType === "channel" ? "1" : undefined,
      lastMessage: "",
      lastMessageAt: created.createdAt,
      lastMessageMine: false,
      unreadCount: 0,
      contactTag: null,
      contactTagVariant: "outline",
      lastMessageCipherText: null,
      lastMessageIv: null,
      lastMessageEncryptedKey: null,
      lastMessageKeyVersion: null,
      lastMessageSenderId: null,
      lastMessageSenderAlias: null,
    };
    setChats((prev) => [
      nextChat,
      ...prev.filter((chat) => !(chat.chatType === createdChatType && chat.link === createdLink)),
    ]);
    setCreateChatKind(null);
    setCreateChatStep("intro");
    setCreateChatSelectedIds(new Set());
    setCreateChatContactQuery("");
    setActiveConversation(null);
    setMessages([]);
    selectedLinkRef.current = createdLink;
    setSelectedLink(createdLink);
    showAppToast({
      title: createdChatType === "channel" ? t("Канал успешно создан") : t("Группа успешно создана"),
      type: "success",
    });
    router.replace(`/app?chat=${encodeURIComponent(createdLink)}&chatType=${createdChatType}`, { scroll: false });
    void openConversationRef.current(createdLink, { force: true, chatType: createdChatType });
  } catch (error) {
    const msg = error instanceof Error ? error.message : t("Не удалось создать чат.");
    setErrorText(null);
    showAppToast({ title: msg, type: "error", durationMs: 5000 });
    if (msg.toLowerCase().includes("ссылка") || msg.toLowerCase().includes("имя") || msg.toLowerCase().includes("занят")) {
      setCreateChatStep("settings");
    }
  } finally {
    setCreateChatCreating(false);
  }
}
