"use client";

import { type ChatSummary, type StoryFeedGroup, type DecryptedMessage, type ConversationResponse, type EditTarget, type GroupModalData, type ChannelModalData, type SelfProfile, type StoryReplyTarget, type ProfilePreview, type ProfileBatchItem, type ConversationChatType, type AppBootstrapResponse, type ChatsListCacheSnapshot, type StoryFeedCacheSnapshot } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type CryptoDiagnosticLogger, decryptDirectPayloadDeterministic } from "@/lib/client/e2e-decrypt-pipeline";
import { directChatProfileLink } from "@/lib/client/direct-chat-summary";
import { apiRequest } from "@/lib/client/http";
import { subscribeProfileUpdated } from "@/lib/client/local-updates";
import { type E2EIdentity, setActiveE2EUserId } from "@/lib/client/e2e";
import { deduplicateChatSummaries } from "../chat-realtime-chatlist";
import { PERSISTENT_LAST_SELF_PROFILE_KEY, CHAT_PAGE_SIZE, CHAT_PREVIEW_DECRYPT_LIMIT } from "./config";
import { clearChatMemoryCaches, chatMemory, saveSelfProfilePersistentCache, loadInitialStoryFeedSnapshot, saveChatListSessionCache, saveChatListPersistentCache, loadInitialChatListSnapshot, normalizeCachedChatsForSelf, storyFeedInMemoryCache, saveStoryFeedSessionCache, saveStoryFeedPersistentCache, readProfileDetailsMemoryCache, writeProfileDetailsMemoryCache, saveProfilePersistentCache, deleteProfileDetailsMemoryCache, profileByIdInMemoryCache, clearConversationCaches, canDecryptPayload, decryptWithTextCache, buildDirectDecryptCacheKey } from "./chat-cache";
import { normalizeChatSummaryPreview, mergeIncomingChatSummaries } from "./chat-previews";
import { contactDisplayName } from "./profile-primitives";
import { filterDeletedStories } from "./story-deletions";

export interface BootstrapChatIdentityContext {
  currentSessionIdRef: React.RefObject<string | null>;
  currentUserIdRef: React.RefObject<string | null>;
  setPrivateKey: React.Dispatch<React.SetStateAction<CryptoKey | null>>;
  setSelfPublicKey: React.Dispatch<React.SetStateAction<string | null>>;
  setE2EIdentityReady: React.Dispatch<React.SetStateAction<boolean>>;
  setE2EBootstrapCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  listCacheHydratedRef: React.RefObject<boolean>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setStoryFeed: React.Dispatch<React.SetStateAction<StoryFeedGroup[]>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setUnreadByLink: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setHasMoreChats: React.Dispatch<React.SetStateAction<boolean>>;
  setChatsCursor: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditTarget: React.Dispatch<React.SetStateAction<EditTarget | null>>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  requestedChatLink: string | null;
  readMarkersRef: React.RefObject<Record<string, string>>;
  readReceiptsRef: React.RefObject<Record<string, string>>;
  sentReadReceiptIdsRef: React.RefObject<Set<string>>;
  profileFetchInFlightRef: React.RefObject<Set<string>>;
  profileDetailsInFlightRef: React.RefObject<Set<string>>;
  groupDetailsInFlightRef: React.RefObject<Set<string>>;
  channelDetailsInFlightRef: React.RefObject<Set<string>>;
  inflightHydrationRef: React.RefObject<Set<string>>;
  openConversationInFlightRef: React.RefObject<Map<string, number>>;
  reactionInFlightRef: React.RefObject<Set<string>>;
  sharedKeyWarmupAtRef: React.RefObject<Record<string, number>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  contactsForAddCacheRef: React.RefObject<{ savedAt: number; contacts: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[]; } | null>;
  sharedKeyServerCacheRef: React.RefObject<Map<string, { expiresAt: number; value: { version: number; keyBase64: string; createdAt: number; } | null; }>>;
  setSelfId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelfProfile: React.Dispatch<React.SetStateAction<SelfProfile | null>>;
  skipNextInitialStoriesReloadRef: React.RefObject<boolean>;
  setStoriesLoading: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLink: string | null;
  skipNextInitialChatReloadRef: React.RefObject<boolean>;
  setLoadingChats: React.Dispatch<React.SetStateAction<boolean>>;
  setChatListResolvedOnce: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  resolveAndSyncOwnE2EIdentity: (options?: { forceServerRestore?: boolean | undefined; allowPrompt?: boolean | undefined; } | undefined) => Promise<E2EIdentity>;
  setErrorText: (message: string | null) => void;
  ensureCreateChatContacts: (force?: boolean | undefined) => Promise<void>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  loadChatPage: (cursor: string | null, mode: "replace" | "append") => Promise<void>;
}

export function bootstrapChatIdentity({ currentSessionIdRef, currentUserIdRef, setPrivateKey, setSelfPublicKey, setE2EIdentityReady, setE2EBootstrapCompleted, listCacheHydratedRef, setChats, setStoryFeed, setMessages, setUnreadByLink, setHasMoreChats, setChatsCursor, setActiveConversation, setMessageHelperId, setReplyToMessageId, setEditTarget, setSelectedLink, requestedChatLink, readMarkersRef, readReceiptsRef, sentReadReceiptIdsRef, profileFetchInFlightRef, profileDetailsInFlightRef, groupDetailsInFlightRef, channelDetailsInFlightRef, inflightHydrationRef, openConversationInFlightRef, reactionInFlightRef, sharedKeyWarmupAtRef, groupModalCacheRef, channelModalCacheRef, contactsForAddCacheRef, sharedKeyServerCacheRef, setSelfId, setSelfProfile, skipNextInitialStoriesReloadRef, setStoriesLoading, selectedLink, skipNextInitialChatReloadRef, setLoadingChats, setChatListResolvedOnce, setSyncing, resolveAndSyncOwnE2EIdentity, setErrorText, ensureCreateChatContacts, t, loadChatPage }: BootstrapChatIdentityContext): () => void {
  let mounted = true;

  async function bootstrapKeys() {
    try {
      const bootstrapLimit =
        typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
          ? 28
          : 20;
      const bootstrap = await apiRequest<AppBootstrapResponse>(
        `/api/app/bootstrap?stage=critical&chatLimit=${bootstrapLimit}`,
        { method: "GET" },
      );
      if (bootstrap.sessionId) {
        currentSessionIdRef.current = bootstrap.sessionId;
      }
      const me = bootstrap.me;
      if (!mounted) return;
      setActiveE2EUserId(me.id);
      const previousUserId =
        currentUserIdRef.current ||
        (typeof window !== "undefined" ? window.localStorage.getItem("eclipse:active-user-id")?.trim() : null) ||
        null;
      const switchedUser = Boolean(previousUserId && previousUserId !== me.id);
      currentUserIdRef.current = me.id;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("eclipse:active-user-id", me.id);
        window.localStorage.setItem(PERSISTENT_LAST_SELF_PROFILE_KEY, me.id);
      }
      if (switchedUser) {
        clearChatMemoryCaches();
        setPrivateKey(null);
        setSelfPublicKey(null);
        setE2EIdentityReady(false);
        setE2EBootstrapCompleted(false);
        chatMemory.selfProfileInMemoryCache = null;
        listCacheHydratedRef.current = false;
        setChats([]);
        setStoryFeed([]);
        setMessages([]);
        setUnreadByLink({});
        setHasMoreChats(false);
        setChatsCursor(null);
        setActiveConversation(null);
        setMessageHelperId(null);
        setReplyToMessageId(null);
        setEditTarget(null);
        setSelectedLink(requestedChatLink);
        readMarkersRef.current = {};
        readReceiptsRef.current = {};
        sentReadReceiptIdsRef.current.clear();
        profileFetchInFlightRef.current.clear();
        profileDetailsInFlightRef.current.clear();
        groupDetailsInFlightRef.current.clear();
        channelDetailsInFlightRef.current.clear();
        inflightHydrationRef.current.clear();
        openConversationInFlightRef.current.clear();
        reactionInFlightRef.current.clear();
        sharedKeyWarmupAtRef.current = {};
        groupModalCacheRef.current.clear();
        channelModalCacheRef.current.clear();
        contactsForAddCacheRef.current = null;
        sharedKeyServerCacheRef.current.clear();
      }
      chatMemory.selfProfileInMemoryCache = { savedAt: Date.now(), me };
      saveSelfProfilePersistentCache(chatMemory.selfProfileInMemoryCache);
      setSelfId(me.id);
      setSelfProfile(me);
      const cachedStoryFeed = loadInitialStoryFeedSnapshot(me.id);
      if (cachedStoryFeed) {
        setStoryFeed(cachedStoryFeed.stories);
      }
      // Keep first paint focused on profile/chat list; load stories in deferred pass.
      skipNextInitialStoriesReloadRef.current = true;
      setStoriesLoading(false);
      if (Array.isArray(bootstrap.chats)) {
        const normalizedBootstrapChats = bootstrap.chats.map((chat) => normalizeChatSummaryPreview(chat));
        const nextSelectedLink = requestedChatLink ?? selectedLink ?? null;
        const bootstrapUnreadByLink = Object.fromEntries(
          bootstrap.chats
            .filter((chat) => (chat.unreadCount ?? 0) > 0)
            .map((chat) => [chat.link, Math.min(99, chat.unreadCount ?? 0)]),
        ) as Record<string, number>;
        const chatSnapshot: ChatsListCacheSnapshot = {
          savedAt: Date.now(),
          chats: normalizedBootstrapChats,
          unreadByLink: bootstrapUnreadByLink,
          hasMoreChats: Boolean(bootstrap.hasMoreChats),
          chatsCursor: bootstrap.chatsCursor ?? null,
          selectedLink: nextSelectedLink,
          selfId: me.id,
        };
        chatMemory.chatsListInMemoryCache = chatSnapshot;
        saveChatListSessionCache(me.id, chatSnapshot);
        saveChatListPersistentCache(me.id, chatSnapshot);
        if (switchedUser) {
          setChats(normalizedBootstrapChats);
        } else {
          setChats((prev) => mergeIncomingChatSummaries(prev, normalizedBootstrapChats, { isFullReplace: true }));
        }
        setUnreadByLink((prev) => {
          const next = { ...bootstrapUnreadByLink };
          Object.entries(prev).forEach(([link, count]) => {
            if (count > 0) {
              next[link] = Math.max(next[link] ?? 0, count);
            }
          });
          return next;
        });
        setHasMoreChats(Boolean(bootstrap.hasMoreChats));
        setChatsCursor(bootstrap.chatsCursor ?? null);
        skipNextInitialChatReloadRef.current = true;
        setLoadingChats(false);
        setChatListResolvedOnce(true);
        listCacheHydratedRef.current = true;
      } else if (!listCacheHydratedRef.current) {
        const cached = loadInitialChatListSnapshot(me.id);
        if (cached) {
          const normalizedChats = normalizeCachedChatsForSelf(cached.chats, me.id);
          setChats(normalizedChats);
          setUnreadByLink(cached.unreadByLink);
          setHasMoreChats(cached.hasMoreChats);
          setChatsCursor(cached.chatsCursor);
          if (chatMemory.chatsListInMemoryCache?.selfId !== me.id) {
            chatMemory.chatsListInMemoryCache = { ...cached, chats: normalizedChats, selfId: me.id };
          }
        }
        listCacheHydratedRef.current = true;
      }

      // Deferred payload: non-critical data that can safely arrive after first paint.
      void (async () => {
        try {
          const deferred = await apiRequest<AppBootstrapResponse>("/api/app/bootstrap?stage=deferred", {
            method: "GET",
            cache: "no-store",
          });
          if (!mounted) return;
          if (Array.isArray(deferred.stories)) {
            const storySnapshot: StoryFeedCacheSnapshot = {
              savedAt: Date.now(),
              stories: filterDeletedStories(me.id, deferred.stories),
            };
            storyFeedInMemoryCache.set(me.id, storySnapshot);
            saveStoryFeedSessionCache(me.id, storySnapshot);
            saveStoryFeedPersistentCache(me.id, storySnapshot);
            setStoryFeed(storySnapshot.stories);
          }
        } catch {
          // deferred bootstrap is best-effort
        } finally {
          if (mounted) {
            // allow regular stories polling/loading after deferred pass settles
            skipNextInitialStoriesReloadRef.current = false;
          }
        }
      })();

      // Critical path complete: render basic UI instantly, continue E2E bootstrap in background.
      setSyncing(false);

      const runDeferred = (task: () => void) => {
        if (typeof window === "undefined") {
          task();
          return;
        }
        if ("requestIdleCallback" in window) {
          (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
            .requestIdleCallback(task, { timeout: 900 });
          return;
        }
        setTimeout(task, 0);
      };

      runDeferred(() => {
        void (async () => {
          let resolved = false;
          let lastError: unknown = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              await resolveAndSyncOwnE2EIdentity();
              resolved = true;
              break;
            } catch (error) {
              lastError = error;
              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
              }
            }
          }
          if (!mounted) return;
          if (resolved) {
            setE2EIdentityReady(true);
          } else {
            setE2EIdentityReady(false);
            if (lastError instanceof Error) {
              setErrorText(lastError.message);
            }
          }
          setE2EBootstrapCompleted(true);
          void ensureCreateChatContacts();
        })();
      });
    } catch (error) {
      if (mounted) {
        setE2EIdentityReady(false);
        setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
        setSyncing(false);
        setE2EBootstrapCompleted(true);
        setChatListResolvedOnce(true);
        setLoadingChats(false);
        void loadChatPage(null, "replace");
      }
    }
  }

  void bootstrapKeys();

  return () => {
    mounted = false;
  };
  // resolveAndSyncOwnE2EIdentity is declared later in this component.

}

export interface LoadChatPageActionContext {
  loadingMoreChatsRef: React.RefObject<boolean>;
  setLoadingMoreChats: React.Dispatch<React.SetStateAction<boolean>>;
  chatsRef: React.RefObject<ChatSummary[]>;
  setLoadingChats: React.Dispatch<React.SetStateAction<boolean>>;
  isDesktop: boolean;
  inflightChatListRequestKeyRef: React.RefObject<string | null>;
  setReadReceiptMarker: (link: string, isoTime: string) => void;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setUnreadByLink: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setHasMoreChats: React.Dispatch<React.SetStateAction<boolean>>;
  setChatsCursor: React.Dispatch<React.SetStateAction<string | null>>;
  prewarmSharedKeysForChatPreviews: (chatItems: ChatSummary[]) => Promise<void>;
  selectedLink: string | null;
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setChatListResolvedOnce: React.Dispatch<React.SetStateAction<boolean>>;
}

export async function loadChatPageAction({ loadingMoreChatsRef, setLoadingMoreChats, chatsRef, setLoadingChats, isDesktop, inflightChatListRequestKeyRef, setReadReceiptMarker, setChats, setUnreadByLink, setHasMoreChats, setChatsCursor, prewarmSharedKeysForChatPreviews, selectedLink, setStoryReplyTarget, setErrorText, t, setChatListResolvedOnce }: LoadChatPageActionContext, cursor: string | null, mode: "replace" | "append"): Promise<void> {
  if (mode === "append") {
    if (loadingMoreChatsRef.current) return;
    loadingMoreChatsRef.current = true;
    setLoadingMoreChats(true);
  } else {
    const shouldShowLoading = chatsRef.current.length === 0;
    setLoadingChats(shouldShowLoading);
  }
  const requestKey = `${mode}:${cursor ?? "root"}:${isDesktop ? "desktop" : "mobile"}`;
  if (inflightChatListRequestKeyRef.current === requestKey) {
    if (mode === "append") {
      loadingMoreChatsRef.current = false;
      setLoadingMoreChats(false);
    } else {
      setLoadingChats(false);
    }
    return;
  }
  inflightChatListRequestKeyRef.current = requestKey;

  try {
    const replaceLimit = isDesktop ? 28 : 18;
    const query = new URLSearchParams({
      limit: String(mode === "replace" ? replaceLimit : CHAT_PAGE_SIZE),
    });
    if (cursor) {
      query.set("cursor", cursor);
    }
    const data = await apiRequest<{
      chats: ChatSummary[];
      hasMore?: boolean;
      nextCursor?: string | null;
    }>(`/api/chats?${query.toString()}`, { method: "GET", cache: "no-store" });

    const incoming = data.chats.map((chat) => normalizeChatSummaryPreview(chat));
    const incomingUnreadByLink = Object.fromEntries(
      incoming
        .filter((chat) => (chat.unreadCount ?? 0) > 0)
        .map((chat) => [chat.link, Math.min(99, chat.unreadCount ?? 0)]),
    ) as Record<string, number>;
    incoming.forEach((chat) => {
      if ((chat.chatType === "direct" || !chat.chatType) && chat.peerReadAt) {
        setReadReceiptMarker(chat.link, chat.peerReadAt);
      }
    });

    if (mode === "replace") {
      setChats((prev) => mergeIncomingChatSummaries(prev, incoming, { isFullReplace: true }));
      setUnreadByLink((prev) => {
        const links = new Set(incoming.map((chat) => chat.link));
        const next: Record<string, number> = {};
        Object.entries(prev).forEach(([link, count]) => {
          if (links.has(link) && count > 0) {
            next[link] = count;
          }
        });
        Object.entries(incomingUnreadByLink).forEach(([link, count]) => {
          next[link] = Math.max(next[link] ?? 0, count);
        });
        return next;
      });
    } else {
      setChats((prev) => {
        if (incoming.length === 0) return prev;
        return mergeIncomingChatSummaries(prev, incoming);
      });
    }

    setHasMoreChats(Boolean(data.hasMore));
    setChatsCursor(data.nextCursor ?? null);
    if (mode === "replace" && incoming.length > 0) {
      void prewarmSharedKeysForChatPreviews(incoming);
    }
    if (mode === "replace" && selectedLink && !incoming.some((chat) => chat.link === selectedLink)) {
      setStoryReplyTarget(null);
    }
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  } finally {
    setChatListResolvedOnce(true);
    if (inflightChatListRequestKeyRef.current === requestKey) {
      inflightChatListRequestKeyRef.current = null;
    }
    if (mode === "append") {
      loadingMoreChatsRef.current = false;
      setLoadingMoreChats(false);
    } else {
      setLoadingChats(false);
    }
  }
}

export interface SubscribeProfileChangesContext {
  setSelfProfile: React.Dispatch<React.SetStateAction<SelfProfile | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setUnreadByLink: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  selectedLinkRef: React.RefObject<string | null>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  setStoryFeed: React.Dispatch<React.SetStateAction<StoryFeedGroup[]>>;
  setProfileData: React.Dispatch<React.SetStateAction<ProfilePreview | null>>;
  selfId: string | null;
  bumpProfileBatchVersion: React.Dispatch<React.SetStateAction<number>>;
}

export function subscribeProfileChanges({ setSelfProfile, setChats, setUnreadByLink, selectedLinkRef, setSelectedLink, setActiveConversation, setGroupModalData, groupModalCacheRef, setStoryFeed, setProfileData, selfId, bumpProfileBatchVersion }: SubscribeProfileChangesContext): () => void {
  return subscribeProfileUpdated((profile) => {
    const nextLink = profile.link.trim().replace(/^@+/u, "").toLowerCase();
    const previousLink = profile.previousLink?.trim().replace(/^@+/u, "").toLowerCase() || null;
    const matchesSelf = (id?: string | null, link?: string | null) => {
      if (profile.id && id && profile.id === id) return true;
      const normalizedLink = link?.trim().replace(/^@+/u, "").toLowerCase() || "";
      return Boolean(normalizedLink && (normalizedLink === nextLink || normalizedLink === previousLink));
    };

    setSelfProfile((prev) => {
      if (!prev || !matchesSelf(prev.id, prev.link)) return prev;
      const next = {
        ...prev,
        link: nextLink || prev.link,
        displayName: profile.displayName || prev.displayName,
        emojiStatusId: profile.emojiStatusId !== undefined ? profile.emojiStatusId : prev.emojiStatusId,
        avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : prev.avatarUrl,
        backgroundUrl: profile.backgroundUrl !== undefined ? profile.backgroundUrl : prev.backgroundUrl,
        email: profile.email ?? prev.email ?? null,
        musicUrl: profile.musicUrl !== undefined ? profile.musicUrl : prev.musicUrl,
        musicTitle: profile.musicTitle !== undefined ? profile.musicTitle : prev.musicTitle,
        musicAuthor: profile.musicAuthor !== undefined ? profile.musicAuthor : prev.musicAuthor,
        musicCoverUrl: profile.musicCoverUrl !== undefined ? profile.musicCoverUrl : prev.musicCoverUrl,
        description: profile.description !== undefined ? profile.description : prev.description,
        usernameHidden: (profile.usernameHidden !== undefined && profile.usernameHidden !== null) ? profile.usernameHidden : prev.usernameHidden,
      };
      chatMemory.selfProfileInMemoryCache = { savedAt: Date.now(), me: next };
      saveSelfProfilePersistentCache(chatMemory.selfProfileInMemoryCache);
      return next;
    });

    setChats((prev) => {
      const updated = prev.map((chat) =>
        chat.chatType === "direct" && matchesSelf(chat.peerId, chat.link)
          ? {
            ...chat,
            link: directChatProfileLink(chat, nextLink),
            displayName: contactDisplayName(chat, profile.displayName),
            avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : chat.avatarUrl,
          }
          : chat,
      );
      return deduplicateChatSummaries(updated);
    });

    if (previousLink && nextLink && previousLink !== nextLink) {
      setUnreadByLink((prev) => {
        if (!(previousLink in prev)) return prev;
        const count = prev[previousLink];
        const next = { ...prev };
        delete next[previousLink];
        next[nextLink] = (next[nextLink] ?? 0) + count;
        return next;
      });
      if (selectedLinkRef.current === previousLink) {
        setSelectedLink(nextLink);
      }
    }

    setActiveConversation((prev) => {
      if (prev?.chatType === "group" && Array.isArray(prev.members)) {
        return {
          ...prev,
          members: prev.members.map((member) =>
            matchesSelf(member.id, member.link)
              ? {
                ...member,
                link: nextLink || member.link,
                displayName: member.contactAlias?.trim() || profile.displayName || member.displayName,
                avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : member.avatarUrl,
              }
              : member,
          ),
        };
      }
      if (!prev?.peer || !matchesSelf(prev.peer.id, prev.peer.link)) return prev;
      return {
        ...prev,
        peer: {
          ...prev.peer,
          link: nextLink || prev.peer.link,
          displayName: profile.displayName || prev.peer.displayName,
          avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : prev.peer.avatarUrl,
        },
      };
    });

    setGroupModalData((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        members: prev.members.map((member) =>
          matchesSelf(member.id, member.link)
            ? {
              ...member,
              link: nextLink || member.link,
              displayName: member.contactAlias?.trim() || profile.displayName || member.displayName,
              avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : member.avatarUrl,
            }
            : member,
        ),
      };
      groupModalCacheRef.current.set(prev.group.link, { savedAt: Date.now(), data: next });
      return next;
    });

    setStoryFeed((prev) =>
      prev.map((group) =>
        matchesSelf(group.author.id, group.author.link)
          ? {
            ...group,
            author: {
              ...group.author,
              link: nextLink || group.author.link,
              displayName: profile.displayName || group.author.displayName,
              avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : group.author.avatarUrl,
            },
          }
          : group,
      ),
    );

    setProfileData((prev) =>
      prev && matchesSelf(prev.id, prev.link)
        ? {
          ...prev,
          link: nextLink || prev.link,
          secondaryLinks: profile.secondaryLinks !== undefined ? (profile.secondaryLinks ?? undefined) : prev.secondaryLinks,
          displayName: profile.displayName || prev.displayName,
          avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : prev.avatarUrl,
          backgroundUrl: profile.backgroundUrl !== undefined ? profile.backgroundUrl : prev.backgroundUrl,
          musicUrl: profile.musicUrl !== undefined ? profile.musicUrl : prev.musicUrl,
          musicTitle: profile.musicTitle !== undefined ? profile.musicTitle : prev.musicTitle,
          musicAuthor: profile.musicAuthor !== undefined ? profile.musicAuthor : prev.musicAuthor,
          musicCoverUrl: profile.musicCoverUrl !== undefined ? profile.musicCoverUrl : prev.musicCoverUrl,
          description: profile.description !== undefined ? profile.description : prev.description,
          usernameHidden: (profile.usernameHidden !== undefined && profile.usernameHidden !== null) ? profile.usernameHidden : prev.usernameHidden,
        }
        : prev,
    );

    const cacheKeys = [nextLink, previousLink].filter(Boolean) as string[];
    cacheKeys.forEach((key) => {
      const cached = readProfileDetailsMemoryCache(selfId, key);
      if (!cached) return;
      const nextProfile = {
        ...cached.profile,
        link: nextLink || cached.profile.link,
        secondaryLinks: profile.secondaryLinks !== undefined ? (profile.secondaryLinks ?? undefined) : cached.profile.secondaryLinks,
        displayName: profile.displayName || cached.profile.displayName,
        avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : cached.profile.avatarUrl,
        backgroundUrl: profile.backgroundUrl !== undefined ? profile.backgroundUrl : cached.profile.backgroundUrl,
        musicUrl: profile.musicUrl !== undefined ? profile.musicUrl : cached.profile.musicUrl,
        musicTitle: profile.musicTitle !== undefined ? profile.musicTitle : cached.profile.musicTitle,
        musicAuthor: profile.musicAuthor !== undefined ? profile.musicAuthor : cached.profile.musicAuthor,
        musicCoverUrl: profile.musicCoverUrl !== undefined ? profile.musicCoverUrl : cached.profile.musicCoverUrl,
        description: profile.description !== undefined ? profile.description : cached.profile.description,
        usernameHidden: (profile.usernameHidden !== undefined && profile.usernameHidden !== null) ? profile.usernameHidden : cached.profile.usernameHidden,
      };
      writeProfileDetailsMemoryCache(selfId, nextProfile.link, { ...cached, savedAt: Date.now(), profile: nextProfile });
      if (selfId) {
        saveProfilePersistentCache(selfId, nextProfile.link, { ...cached, savedAt: Date.now(), profile: nextProfile });
      }
      if (key !== nextProfile.link) {
        deleteProfileDetailsMemoryCache(selfId, key);
      }
    });

    if (profile.id) {
      profileByIdInMemoryCache.set(profile.id, {
        savedAt: Date.now(),
        profile: {
          id: profile.id,
          link: nextLink,
          secondaryLinks: profile.secondaryLinks ?? undefined,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl ?? null,
        },
      });
      bumpProfileBatchVersion((prev) => prev + 1);
    }

    if (selfId) {
      if (nextLink) clearConversationCaches(selfId, nextLink, "direct");
      if (previousLink) clearConversationCaches(selfId, previousLink, "direct");
    }
  });
}



export function restoreThemeWallpaperPreviews(): () => void {
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      clearChatMemoryCaches();
    }
  };

  const onPageHide = () => {
    clearChatMemoryCaches();
  };

  const memoryGuardTimer = window.setInterval(() => {
    const perf = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };
    const mem = perf.memory;
    if (!mem || !mem.jsHeapSizeLimit) return;
    const pressure = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
    if (pressure >= 0.72) {
      clearChatMemoryCaches();
    }
  }, 30000);

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    clearInterval(memoryGuardTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
  };
}

export interface DecryptChatListPreviewsContext {
  privateKey: CryptoKey | null;
  chats: ChatSummary[];
  decryptedPreviewFingerprintRef: React.RefObject<Record<string, string>>;
  decryptMessageWithRecovery: (params: { privateKey: CryptoKey; cipherText: string; iv: string; encryptedKey: string; }) => Promise<string>;
  cryptoDiagnosticRef: React.RefObject<CryptoDiagnosticLogger>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
}

export function decryptChatListPreviews({ privateKey, chats, decryptedPreviewFingerprintRef, decryptMessageWithRecovery, cryptoDiagnosticRef, setChats }: DecryptChatListPreviewsContext): (() => void) | undefined {
  if (!privateKey || chats.length === 0) {
    return;
  }

  let cancelled = false;
  const pending = chats
    .filter(
      (chat) =>
        Boolean(chat.lastMessageCipherText && chat.lastMessageIv && chat.lastMessageEncryptedKey) &&
        canDecryptPayload({
          cipherText: chat.lastMessageCipherText,
          iv: chat.lastMessageIv,
          encryptedKey: chat.lastMessageEncryptedKey,
        }) &&
        (chat.lastMessage === "Сообщение" || !chat.lastMessage.trim()) &&
        decryptedPreviewFingerprintRef.current[chat.link] !== chat.lastMessageAt,
    )
    .slice(0, CHAT_PREVIEW_DECRYPT_LIMIT);
  if (pending.length === 0) {
    return;
  }

  void (async () => {
    const decryptedPreviews = await Promise.all(
      pending.map(async (chat) => {
        const payload = {
          cipherText: chat.lastMessageCipherText as string,
          iv: chat.lastMessageIv as string,
          encryptedKey: chat.lastMessageEncryptedKey as string,
        };
        const text = await decryptWithTextCache(
          buildDirectDecryptCacheKey(payload),
          () =>
            decryptDirectPayloadDeterministic({
              payload,
              tryPrimary: () =>
                decryptMessageWithRecovery({
                  privateKey,
                  cipherText: payload.cipherText,
                  iv: payload.iv,
                  encryptedKey: payload.encryptedKey,
                }),
              fallbackText: "Сообщение",
              chatLink: chat.link,
              logger: cryptoDiagnosticRef.current,
            }),
        );
        return {
          link: chat.link,
          lastMessageAt: chat.lastMessageAt,
          text,
          ok: text !== "Сообщение",
        };
      }),
    );

    if (cancelled) return;
    const byLink = new Map(decryptedPreviews.map((item) => [item.link, item]));
    setChats((prev) => {
      let changed = false;
      const next = prev.map((chat) => {
        const item = byLink.get(chat.link);
        if (!item) return chat;
        if (item.ok) {
          decryptedPreviewFingerprintRef.current[chat.link] = item.lastMessageAt;
        }
        if (chat.lastMessageAt !== item.lastMessageAt) return chat;
        if (chat.lastMessage === item.text) return chat;
        changed = true;
        return { ...chat, lastMessage: item.text };
      });
      return changed ? next : prev;
    });
  })();

  return () => {
    cancelled = true;
  };
  // decryptMessageWithRecovery is declared later in this component.

}

export interface SendReadReceiptActionContext {
  readReceiptEndpointUnsupportedRef: React.RefObject<boolean>;
  sentReadReceiptIdsRef: React.RefObject<Set<string>>;
}

export async function sendReadReceiptAction({ readReceiptEndpointUnsupportedRef, sentReadReceiptIdsRef }: SendReadReceiptActionContext, link: string, chatType: ConversationChatType, messageIds: string[]): Promise<void> {
  if (!link || messageIds.length === 0 || readReceiptEndpointUnsupportedRef.current) return;
  const freshIds = messageIds.filter((id) => !sentReadReceiptIdsRef.current.has(id));
  if (freshIds.length === 0) return;

  try {
    for (let offset = 0; offset < freshIds.length; offset += 100) {
      const batch = freshIds.slice(offset, offset + 100);
      await apiRequest("/api/realtime/read", {
        method: "POST",
        body: JSON.stringify({ link, chatType, messageIds: batch }),
      });
      batch.forEach((id) => sentReadReceiptIdsRef.current.add(id));
    }
    if (sentReadReceiptIdsRef.current.size > 5000) {
      const trimmed = Array.from(sentReadReceiptIdsRef.current).slice(-2500);
      sentReadReceiptIdsRef.current = new Set(trimmed);
    }
  } catch (error) {
    if (error instanceof Error && /HTTP 404/.test(error.message)) {
      readReceiptEndpointUnsupportedRef.current = true;
    }
    // read receipt is best-effort
  }
}

export interface MergeProfilesToCacheActionContext {
  bumpProfileBatchVersion: React.Dispatch<React.SetStateAction<number>>;
}

export function mergeProfilesToCacheAction({ bumpProfileBatchVersion }: MergeProfilesToCacheActionContext, profiles: ProfileBatchItem[]): void {
  if (profiles.length === 0) return;
  let changed = false;
  const now = Date.now();
  for (const profile of profiles) {
    const existing = profileByIdInMemoryCache.get(profile.id);
    if (
      !existing ||
      existing.profile.displayName !== profile.displayName ||
      existing.profile.avatarUrl !== profile.avatarUrl ||
      existing.profile.link !== profile.link ||
      existing.profile.presenceVisibility !== profile.presenceVisibility ||
      existing.profile.lastSeenVisibility !== profile.lastSeenVisibility ||
      existing.profile.usernameHidden !== profile.usernameHidden ||
      JSON.stringify(existing.profile.secondaryLinks ?? []) !== JSON.stringify(profile.secondaryLinks ?? [])
    ) {
      profileByIdInMemoryCache.set(profile.id, { savedAt: now, profile });
      changed = true;
    } else {
      profileByIdInMemoryCache.set(profile.id, { savedAt: now, profile: existing.profile });
    }
  }
  if (changed) {
    bumpProfileBatchVersion((prev) => prev + 1);
  }
}

export interface EnsureProfilesBatchActionContext {
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  profileFetchInFlightRef: React.RefObject<Set<string>>;
  queuedProfileFetchIdsRef: React.RefObject<Set<string>>;
  queuedProfileFetchPromiseRef: React.RefObject<Promise<void> | null>;
  queuedProfileFetchTimerRef: React.RefObject<NodeJS.Timeout | null>;
  flushQueuedProfilesBatch: () => Promise<void>;
}

export async function ensureProfilesBatchAction({ readProfileFromCache, profileFetchInFlightRef, queuedProfileFetchIdsRef, queuedProfileFetchPromiseRef, queuedProfileFetchTimerRef, flushQueuedProfilesBatch }: EnsureProfilesBatchActionContext, userIds: string[]): Promise<void> {
  const normalized = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  if (normalized.length === 0) return;

  let hasQueuedIds = false;
  normalized.forEach((id) => {
    if (readProfileFromCache(id) || profileFetchInFlightRef.current.has(id)) return;
    if (queuedProfileFetchIdsRef.current.has(id)) return;
    queuedProfileFetchIdsRef.current.add(id);
    hasQueuedIds = true;
  });
  if (!hasQueuedIds && !queuedProfileFetchPromiseRef.current) return;

  if (!queuedProfileFetchTimerRef.current) {
    queuedProfileFetchPromiseRef.current = new Promise<void>((resolve) => {
      queuedProfileFetchTimerRef.current = setTimeout(() => {
        queuedProfileFetchTimerRef.current = null;
        void flushQueuedProfilesBatch().finally(() => {
          queuedProfileFetchPromiseRef.current = null;
          resolve();
        });
      }, 18);
    });
  }

  await (queuedProfileFetchPromiseRef.current ?? Promise.resolve());
}
