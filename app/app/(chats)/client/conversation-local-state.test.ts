import { beforeEach, expect, it, vi } from "vitest";
import type { DecryptedMessage } from "../types";
import type { OpenConversationActionContext } from "./open-conversation";
import type { ResetConversationViewportContext } from "./attachment-actions";
const fake = vi.hoisted(() => ({ api: vi.fn(), failures: [] as DecryptedMessage[] }));
vi.mock("@/lib/client/http", () => ({ apiRequest: fake.api }));
vi.mock("@/lib/client/failed-message-store", () => ({ peekFailedMessages: () => fake.failures, readFailedMessages: () => new Promise(() => {}) }));
vi.mock("./chat-cache", () => ({ readConversationMemoryCache: () => null, loadConversationSessionCache: () => null, loadConversationPersistentCache: () => null, normalizeConversationCacheSnapshot: (value: unknown) => value, buildConversationCacheKey: (link: string, type: string) => type + ":" + link }));
import { openConversationAction } from "./open-conversation";
import { resetConversationViewport } from "./attachment-actions";
beforeEach(() => { vi.clearAllMocks(); fake.api.mockReturnValue(new Promise(() => {})); });

it("shows known failed messages before the conversation request or IndexedDB read finishes", () => {
  fake.failures = [{ id: "failed", senderId: "self", text: "retry me", createdAt: "2026-11-11T09:41:00Z", sendFailure: { kind: "rate_limit", retryAt: 0 } }];
  const setMessages = vi.fn();
  const context = { chats: [{ link: "peer", chatType: "direct" }], selectedSearchTargetRef: { current: null }, openConversationInFlightRef: { current: new Map() }, conversationRequestSeqRef: { current: 0 }, selectedLinkRef: { current: "previous" }, activeConversationRef: { current: null }, currentUserIdRef: { current: "self" }, selfId: "self", setActiveConversation: vi.fn(), setMessages, setHasMoreMessagesBefore: vi.fn(), setDecryptingConversation: vi.fn(), setInspectedDetailsEntity: vi.fn(), setLoadingConversation: vi.fn(), sanitizeMessages: (value: DecryptedMessage[]) => value, unreadByLink: {}, setErrorText: vi.fn(), isDesktop: true } as unknown as OpenConversationActionContext;
  void openConversationAction(context, "peer", { chatType: "direct" });
  expect(setMessages).toHaveBeenCalledWith(fake.failures);
  expect(fake.api).toHaveBeenCalledOnce();
});

it("keeps the desktop details panel open when switching conversations", () => {
  const closePanel = vi.fn();
  const context = { selectedLink: "next", bottomScrollAnimationRef: { current: null }, isScrollingToBottomRef: { current: false }, programmaticScrollRef: { current: false }, lastHandledSelectedLinkRef: { current: "old" }, chatScrollRef: { current: null }, selectedSearchTargetRef: { current: null }, selectedChat: { chatType: "direct" }, selfId: "self", currentUserIdRef: { current: "self" }, chatReadingPositionsRef: { current: new Map() }, setProfileData: vi.fn(), setContactEditorTarget: vi.fn(), setDesktopDetailsPanelOpen: closePanel, setInspectedDetailsEntity: vi.fn(), detailsTargetRef: { current: { kind: "direct", link: "old" } }, userScrolledUpRef: { current: false }, userSentMessageRef: { current: false }, lastObservedMessagesScrollTopRef: { current: 0 }, lastCommittedMessagesScrollTopRef: { current: 0 }, setMessagesScrollTop: vi.fn(), messagesAtBottomRef: { current: true }, preservingHistoryScrollRef: { current: false }, prependScrollSnapshotRef: { current: null }, setShowScrollToBottomButton: vi.fn(), setMessageHelperId: vi.fn(), setStickerPickerOpen: vi.fn(), setAttachmentMenuOpen: vi.fn(), setActiveConversation: vi.fn(), setMessages: vi.fn(), setDecryptingConversation: vi.fn(), openConversationRef: { current: vi.fn() } } as unknown as ResetConversationViewportContext;
  resetConversationViewport(context);
  expect(closePanel).not.toHaveBeenCalled();
  expect(context.setInspectedDetailsEntity).toHaveBeenCalledWith(null);
  expect(context.detailsTargetRef.current).toEqual({ kind: "direct", link: "next" });
  expect(context.openConversationRef.current).toHaveBeenCalledWith("next", { chatType: "direct", revalidate: true });
});
