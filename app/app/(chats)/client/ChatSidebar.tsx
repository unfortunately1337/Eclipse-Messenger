"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaAvatar } from "@/components/ui/media";
import { OnlineStatusDot } from "@/components/ui/online-status-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { type CallMessageData } from "@/lib/call-history";
import { type LiveBackgroundNeatPreset } from "@/lib/client/live-background";
import { NAVIGATION_TRANSITION,PANEL_TRANSITION } from "@/lib/client/panel-motion";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { ECLIPSE_LIST_STATUS } from "@/lib/eclipse-system";
import { type TranslationValues } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { AnimatePresence,LayoutGroup,motion } from "framer-motion";
import { Bookmark,ChevronDown,ChevronRight,CircleFadingPlus,LogOut,Megaphone,MoreVertical,PinOff,Plus,Search,Settings,UsersRound,X } from "lucide-react";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { memo,useMemo } from "react";
import { FaVolumeMute } from "react-icons/fa";
import { GiHamburgerMenu } from "react-icons/gi";
import { MdDelete } from "react-icons/md";
import { TiPin } from "react-icons/ti";
import { AccountUnreadBadge } from "../components/common/AccountUnreadBadge";
import { SavedMessagesAvatar } from "../components/common/Avatars";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { StoryAvatarRing,StoryCompactStack } from "../components/story/StoryAvatarRing";
import { StoryFeed } from "../components/story/StoryFeed";
import { EclipseBotAvatar,EclipseChatListStatus,EclipseVerifiedTitle } from "../EclipseChatUi";
import { type ChatListPreviewMeta,type ChatSearchChannel,type ChatSearchEclipse,type ChatSearchGroup,type ChatSearchSaved,type ChatSearchScope,type ChatSearchUser,type ChatSummary,type ConversationChatType,type CreateChatKind,type ProfileBatchItem,type SelfProfile,type StoryFeedGroup } from "../types";
import { ChatSidebarRow } from "./ChatSidebarRow";
import { CHAT_ITEM_ESTIMATED_HEIGHT,CHAT_PAGE_SIZE } from "./config";
import { renderTextWithEmojis } from "./message-content";
import { isGeneratedDefaultAvatarUrl } from "./profile-primitives";
import { formatSearchCount } from "./virtualization";

export interface ChatSidebarProps {
  mobileChatOpen: boolean;
  reducedPanelMotion: boolean | null;
  liveBackgroundPreset: LiveBackgroundNeatPreset;
  chatListHelper: { link: string; chatType: ConversationChatType; dangerAction: "leave" | "delete" | null; displayName: string; x: number; y: number; touch: boolean; anchorRect?: { left: number; top: number; width: number; height: number; } | null | undefined; } | null;
  settingsPanelOpen: boolean;
  settingsPanelCovered: boolean;
  createChatKind: CreateChatKind | null;
  leftSidebarThemeStyle: React.CSSProperties | undefined;
  chatSearchOpen: boolean;
  chatSearchInputRef: React.RefObject<HTMLInputElement | null>;
  chatSearchQuery: string;
  setChatSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  closeChatSearchPanel: () => void;
  chatSearchScope: ChatSearchScope;
  setChatSearchScope: React.Dispatch<React.SetStateAction<ChatSearchScope>>;
  toggleChatListMenuFromButton: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  otherAccountsUnreadCount: number;
  openChatSearchPanel: () => void;
  compactStoryGroups: StoryFeedGroup[];
  toggleStoriesRail: () => void;
  storiesHidden: boolean;
  chatListMenuOpen: boolean;
  setChatListMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatListMenuPosition: { left: number; top: number; };
  chatListMenuOrigin: string;
  setSettingsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selfProfile: SelfProfile | null;
  selfStoryGroup: StoryFeedGroup | null;
  selfGroupIndex: number;
  connectedAccounts: { id: string; displayName: string; link: string; avatarUrl: string | null; isActive: boolean; unreadCount?: number | undefined; }[];
  setIsAccountsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isAccountsExpanded: boolean;
  handleSwitchAccount: (targetUserId: string) => Promise<void>;
  handleAddAccountClick: () => void;
  router: AppRouterInstance;
  isMobile: boolean;
  storyInputRef: React.RefObject<HTMLInputElement | null>;
  setMenuShowMore: React.Dispatch<React.SetStateAction<boolean>>;
  menuShowMore: boolean;
  openCreateChat: (kind: CreateChatKind) => void;
  storiesLoading: boolean;
  storyFeed: StoryFeedGroup[];
  mobileStoryRailGroups: StoryFeedGroup[];
  openStoryViewer: (groupIndex: number, storyIndex?: number, source?: HTMLElement | null | undefined) => void;
  createStoryFromSelection: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  chatListViewportRef: React.RefObject<HTMLDivElement | null>;
  handleChatListScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  handleChatListWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  handleChatListTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleChatListTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleChatListTouchEnd: () => void;
  chatSearchNormalizedQuery: string;
  chatSearchLoading: boolean;
  chatSearchError: string | null;
  hasChatSearchResults: boolean;
  showSearchSaved: boolean;
  chatSearchSaved: ChatSearchSaved[];
  openChatSearchResult: (link: string, chatType: ConversationChatType) => void;
  selectedLink: string | null;
  showSearchEclipse: boolean;
  chatSearchEclipse: ChatSearchEclipse[];
  showSearchChats: boolean;
  chatSearchLocalResults: ChatSummary[];
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  chatSearchUsers: ChatSearchUser[];
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  showSearchUsers: boolean;
  visibleChatSearchUsers: ChatSearchUser[];
  showSearchGroups: boolean;
  visibleChatSearchGroups: ChatSearchGroup[];
  showSearchChannels: boolean;
  visibleChatSearchChannels: ChatSearchChannel[];
  showInitialChatListSkeleton: boolean;
  orderedChats: ChatSummary[];
  shouldVirtualizeChatList: boolean;
  chatListWindow: { start: number; end: number; };
  chatListTotalHeight: number;
  virtualChatRows: { chat: ChatSummary; index: number; preview: ChatListPreviewMeta; isEmptyChat: boolean; safePreviewText: string; callPreview: CallMessageData | null; senderPrefix: string; timeLabel: string; unreadCount: number; isChatMuted: boolean; isPinned: boolean; isLastDirectMessageRead: boolean; sendingLabel: string; recordingLabel: string; isTyping: boolean; }[];
  chatListSuppressClickLinkRef: React.RefObject<string | null>;
  suppressRequestedChatSyncRef: React.RefObject<boolean>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setChatListHelper: React.Dispatch<React.SetStateAction<{ link: string; chatType: ConversationChatType; dangerAction: "leave" | "delete" | null; displayName: string; x: number; y: number; touch: boolean; anchorRect?: { left: number; top: number; width: number; height: number; } | null | undefined; } | null>>;
  resolveChatListDangerAction: (chat: { link: string; chatType: ConversationChatType; }) => Promise<void>;
  clearChatListLongPress: () => void;
  chatListLongPressTimerRef: React.RefObject<number | null>;
  unreadBadgeThemeStyle: React.CSSProperties | undefined;
  loadingMoreChats: boolean;
  hasMoreChats: boolean;
  chatListHelperChat: ChatSummary | null;
  chatListHelperFrame: { viewport: { left: number; top: number; width: number; height: number; }; panel: { left: number; top: number; width: number; opensBelow: boolean; }; } | null;
  toggleChatPinnedState: (link: string) => void;
  pinnedChatLinkSet: Set<string>;
  toggleChatMutedState: (link: string) => void;
  mutedChatLinkSet: Set<string>;
  setDirectChatDeleteConfirm: React.Dispatch<React.SetStateAction<{ link: string; displayName: string; } | null>>;
  openChatListDangerAction: (chat: { link: string; chatType: ConversationChatType; }) => Promise<void>;
}

export const ChatSidebar = memo(function ChatSidebar(props: ChatSidebarProps) {
  const { mobileChatOpen, reducedPanelMotion, liveBackgroundPreset, chatListHelper, settingsPanelOpen, settingsPanelCovered, createChatKind, leftSidebarThemeStyle, chatSearchOpen, chatSearchInputRef, chatSearchQuery, setChatSearchQuery, t, closeChatSearchPanel, chatSearchScope, setChatSearchScope, toggleChatListMenuFromButton, otherAccountsUnreadCount, openChatSearchPanel, compactStoryGroups, toggleStoriesRail, storiesHidden, chatListMenuOpen, setChatListMenuOpen, chatListMenuPosition, chatListMenuOrigin, setSettingsPanelOpen, selfProfile, selfStoryGroup, selfGroupIndex, connectedAccounts, setIsAccountsExpanded, isAccountsExpanded, handleSwitchAccount, handleAddAccountClick, router, isMobile, storyInputRef, setMenuShowMore, menuShowMore, openCreateChat, storiesLoading, storyFeed, mobileStoryRailGroups, openStoryViewer, createStoryFromSelection, chatListViewportRef, handleChatListScroll, handleChatListWheel, handleChatListTouchStart, handleChatListTouchMove, handleChatListTouchEnd, chatSearchNormalizedQuery, chatSearchLoading, chatSearchError, hasChatSearchResults, showSearchSaved, chatSearchSaved, openChatSearchResult, selectedLink, showSearchEclipse, chatSearchEclipse, showSearchChats, chatSearchLocalResults, readProfileFromCache, chatSearchUsers, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, showSearchUsers, visibleChatSearchUsers, showSearchGroups, visibleChatSearchGroups, showSearchChannels, visibleChatSearchChannels, showInitialChatListSkeleton, orderedChats, shouldVirtualizeChatList, chatListWindow, chatListTotalHeight, virtualChatRows, setChatListHelper, loadingMoreChats, hasMoreChats, chatListHelperChat, chatListHelperFrame, toggleChatPinnedState, pinnedChatLinkSet, toggleChatMutedState, mutedChatLinkSet, setDirectChatDeleteConfirm, openChatListDangerAction } = props;
  const chatOrderKey = useMemo(() => orderedChats.map(chat => chat.conversationId).join("\0"), [orderedChats]);
  return (
    <motion.aside
      animate={
        mobileChatOpen
          ? { x: reducedPanelMotion ? 0 : -28, opacity: 0 }
          : { x: 0, opacity: 1 }
      }
      transition={NAVIGATION_TRANSITION}
      className={cn(
        "relative flex min-h-0 w-full max-w-full flex-col overflow-x-hidden md:my-2.5 md:ml-2.5 md:rounded-[26px] border-0 shadow-2xl shadow-black/50",
        liveBackgroundPreset === "none" ? "bg-[#1c1c1e] dark:bg-[#1c1c1e]" : "",
        mobileChatOpen ? "pointer-events-none md:pointer-events-auto" : "",
        chatListHelper ? "z-[200]" : "",
      )}
      data-call-sidebar data-app-panel data-panel-covered={(settingsPanelOpen && settingsPanelCovered) || !!createChatKind || undefined} style={leftSidebarThemeStyle}
    >
      <div className="px-3.5 pb-1 pt-3 border-b-0">
        <AnimatePresence mode="wait" initial={false}>
          {chatSearchOpen ? (
            <motion.div
              key="chat-search-header"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={PANEL_TRANSITION}
            >
              <div className="flex h-11 items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    ref={chatSearchInputRef}
                    value={chatSearchQuery}
                    onChange={(event) => setChatSearchQuery(event.target.value)}
                    placeholder={t("Поиск")}
                    className={cn(
                      "h-11 rounded-full border-0 bg-[#141416] pr-10 text-[15px] font-medium text-zinc-100 shadow-none outline-none ring-0 transition-colors placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 dark:bg-[#141416] dark:text-zinc-100 dark:placeholder:text-zinc-500",
                      "pl-11"
                    )}
                  />
                  {chatSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => setChatSearchQuery("")}
                      className="absolute right-3 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-zinc-400/90 text-[#141416] shadow-sm transition-transform hover:scale-105 active:scale-95"
                      aria-label={t("Очистить поиск")}
                    >
                      <X size={10} strokeWidth={2.8} />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closeChatSearchPanel}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#141416] text-zinc-400 hover:bg-[#222226] hover:text-white transition-colors dark:bg-[#141416] dark:hover:bg-[#222226]"
                  aria-label={t("Закрыть поиск")}
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
              <LayoutGroup id="chat-search-tabs">
                <div className="mt-2.5 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {([
                    { key: "all", label: t("Все") },
                    { key: "chats", label: t("Чаты") },
                    { key: "users", label: t("Люди") },
                    { key: "groups", label: t("Группы") },
                    { key: "channels", label: t("Каналы") },
                  ] as const).map((item) => {
                    const active = chatSearchScope === item.key;
                    return (
                      <motion.button
                        key={item.key}
                        type="button"
                        onClick={() => setChatSearchScope(item.key)}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "relative px-3.5 py-1.5 rounded-full text-[13.5px] font-medium transition-colors shrink-0 select-none",
                          active
                            ? "text-white"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]",
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="chat-search-active-tab-pill"
                            className="absolute inset-0 rounded-full bg-white/[0.07] dark:bg-white/[0.07]"
                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                          />
                        )}
                        <span className="relative z-10">{t(item.label ?? "")}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </motion.div>
          ) : (
            <motion.div
              key="chat-list-header"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={PANEL_TRANSITION}
            >
              <div className="relative hidden min-w-0 items-center gap-2 md:flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleChatListMenuFromButton}
                  className="relative h-10 w-10 rounded-full text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/8 dark:hover:text-zinc-100"
                  aria-label={t("Меню чатов")}
                >
                  <GiHamburgerMenu size={20} />
                  <AccountUnreadBadge accountId="other-accounts" count={otherAccountsUnreadCount} placement="corner" />
                </Button>
                <div className="relative min-w-0 flex-1">
                  <button
                    onClick={openChatSearchPanel}
                    className={cn(
                      "flex h-11 w-full items-center rounded-full border-0 bg-[#141416] px-5 text-[15px] font-medium text-zinc-500 shadow-none outline-none ring-0 transition-colors hover:bg-[#18181a] hover:text-zinc-400 active:scale-[0.99] dark:bg-[#141416] dark:text-zinc-500 dark:hover:bg-[#18181a] dark:hover:text-zinc-400",
                      compactStoryGroups.length > 0 ? "pr-[84px]" : "pr-6",
                    )}
                  >
                    <Search size={19} className="mr-3.5 shrink-0 text-zinc-500" />
                    {t("Поиск")}</button>
                  {compactStoryGroups.length > 0 ? (
                    <StoryCompactStack
                      groups={compactStoryGroups}
                      onToggle={toggleStoriesRail}
                      expanded={!storiesHidden}
                      className="absolute right-2.5 top-1/2 z-[2] -translate-y-1/2"
                      sizeClass="h-6 w-6"
                    />
                  ) : null}
                </div>

              </div>

              <div className="relative flex min-h-11 items-center gap-3 md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleChatListMenuFromButton}
                  className="relative z-[1] h-10 w-10 shrink-0 rounded-full text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/8 dark:hover:text-zinc-100"
                  aria-label={t("Меню чатов")}
                >
                  <GiHamburgerMenu size={20} />
                  <AccountUnreadBadge accountId="other-accounts" count={otherAccountsUnreadCount} placement="corner" />
                </Button>

                <div className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={openChatSearchPanel}
                    className={cn(
                      "flex h-11 w-full min-w-0 items-center rounded-full border-0 bg-[#141416] px-5 text-[15px] font-medium text-zinc-500 shadow-none outline-none ring-0 transition-colors hover:bg-[#18181a] hover:text-zinc-400 active:scale-[0.99] dark:bg-[#141416] dark:text-zinc-500 dark:hover:bg-[#18181a] dark:hover:text-zinc-400",
                      compactStoryGroups.length > 0 ? "pr-[84px]" : "pr-5",
                    )}
                  >
                    <Search size={19} className="mr-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">{t("Поиск")}</span>
                  </button>
                  {compactStoryGroups.length > 0 ? (
                    <StoryCompactStack
                      groups={compactStoryGroups}
                      onToggle={toggleStoriesRail}
                      expanded={!storiesHidden}
                      className="absolute right-2.5 top-1/2 z-[2] -translate-y-1/2"
                      sizeClass="h-6 w-6"
                    />
                  ) : null}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {chatListMenuOpen ? (
            <>
              <motion.button
                type="button"
                className="fixed inset-0 z-[120] bg-black/30"
                onClick={() => setChatListMenuOpen(false)}
                aria-label={t("Закрыть меню чатов")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              />
              <motion.div
                data-chat-list-menu="true"
                className="app-panel-surface app-chat-menu-surface fixed z-[130] w-[min(70vw,230px)] overflow-hidden rounded-[20px] border border-white/[0.1] bg-[#161618]/80 text-zinc-50 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-black/20 backdrop-blur-2xl py-1 will-change-transform"
                style={{
                  left: chatListMenuPosition.left,
                  top: chatListMenuPosition.top,
                  transformOrigin: chatListMenuOrigin,
                }}
                initial="closed"
                animate="open"
                exit="closed"
                variants={{
                  closed: {
                    opacity: 0,
                    scale: 0.78,
                    transition: {
                      duration: 0.14,
                      ease: [0.32, 0, 0.67, 0],
                    },
                  },
                  open: {
                    opacity: 1,
                    scale: 1,
                    transition: {
                      type: "spring",
                      stiffness: 450,
                      damping: 28,
                      mass: 0.7,
                    },
                  },
                }}
              >
                {/* Accounts / Profiles */}
                <div
                  onClick={() => {
                    setChatListMenuOpen(false);
                    setSettingsPanelOpen(true);
                  }}
                  className="flex items-center gap-3 mx-1 my-0.5 rounded-[12px] px-3 py-2 text-left transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985] cursor-pointer"
                >
                  <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                    {selfProfile ? (
                      selfStoryGroup && selfStoryGroup.stories.length > 0 && selfGroupIndex !== -1 ? (
                        <StoryAvatarRing
                          seen={!selfStoryGroup.hasUnviewed}
                          stories={selfStoryGroup.stories}
                          className="w-full h-full p-[2px] shadow-none"
                          innerClassName="p-[0.5px]"
                        >
                          <MediaAvatar
                            src={selfProfile.avatarUrl ?? undefined}
                            alt={selfProfile.displayName}
                            className="h-7.5 w-7.5 shrink-0 bg-zinc-700 shadow-sm"
                            fallbackText={selfProfile.displayName.slice(0, 1)}
                            autoPlay
                          />
                        </StoryAvatarRing>
                      ) : (
                        <MediaAvatar
                          src={selfProfile.avatarUrl ?? undefined}
                          alt={selfProfile.displayName}
                          className="h-8 w-8 shrink-0 bg-zinc-700 shadow-md rounded-full"
                          fallbackText={selfProfile.displayName.slice(0, 1)}
                          autoPlay
                        />
                      )
                    ) : (
                      <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-white/95 leading-tight">
                      <VerifiedTitle emojiStatusInteractive={false} kind="user" link={selfProfile?.link ?? ""}>{selfProfile?.displayName ?? t("Аккаунт")}</VerifiedTitle>
                    </span>
                  </div>
                  {connectedAccounts.length >= 2 && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAccountsExpanded((prev) => !prev);
                      }}
                      className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-90 transition-all cursor-pointer -mr-0.5"
                      title={isAccountsExpanded ? t("Свернуть") : t("Развернуть аккаунты")}
                      aria-label={isAccountsExpanded ? t("Свернуть аккаунты") : t("Развернуть аккаунты")}
                    >
                      <ChevronDown
                        size={17}
                        className={cn(
                          "transition-transform duration-200 ease-out",
                          isAccountsExpanded && "rotate-180 text-white"
                        )}
                        strokeWidth={2.2}
                      />
                      {!isAccountsExpanded && <AccountUnreadBadge accountId="other-accounts-menu" count={otherAccountsUnreadCount} placement="arrow" />}
                    </div>
                  )}
                </div>

                {/* Second Account or Add Account Button */}
                {connectedAccounts.length >= 2 ? (() => {
                  const secondaryAccount = connectedAccounts.find((a) => !a.isActive) ?? connectedAccounts[1];
                  if (!secondaryAccount) return null;
                  return (
                    <AnimatePresence initial={false}>
                      {isAccountsExpanded && (
                        <motion.div
                          key="secondary-account-accordion"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              void handleSwitchAccount(secondaryAccount.id);
                            }}
                            className="flex h-[38px] w-[calc(100%-8px)] items-center gap-3 mx-1 my-0.5 rounded-[10px] px-3 text-left transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985] cursor-pointer"
                          >
                            <span className="grid h-5 w-5 shrink-0 place-items-center">
                              <MediaAvatar
                                src={secondaryAccount.avatarUrl ?? undefined}
                                alt={secondaryAccount.displayName}
                                className="h-5.5 w-5.5 shrink-0 bg-zinc-700 shadow-sm rounded-full text-[10px]"
                                fallbackText={secondaryAccount.displayName.slice(0, 1)}
                                autoPlay
                              />
                            </span>
                            <span className="block min-w-0 flex-1 truncate text-[13.5px] font-semibold text-zinc-100 leading-tight">
                              <VerifiedTitle emojiStatusInteractive={false} kind="user" link={secondaryAccount.link}>{secondaryAccount.displayName}</VerifiedTitle>
                            </span>
                            <AccountUnreadBadge accountId={secondaryAccount.id} count={secondaryAccount.unreadCount} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  );
                })() : (
                  <button
                    type="button"
                    onClick={handleAddAccountClick}
                    className="flex h-[38px] w-[calc(100%-8px)] items-center gap-3 mx-1 rounded-[10px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985] cursor-pointer"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center text-zinc-300">
                      <Plus size={17} strokeWidth={2.2} />
                    </span>
                    <span>{t("Добавить аккаунт")}</span>
                  </button>
                )}

                <div className="my-0.5 border-t border-white/[0.07] mx-1" />

                {/* Saved Messages Option */}
                <button
                  type="button"
                  onClick={() => {
                    setChatListMenuOpen(false);
                    router.push("/app?chat=saved&chatType=saved");
                  }}
                  className="flex h-[38px] w-[calc(100%-8px)] items-center gap-3 mx-1 rounded-[10px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985]"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center text-zinc-300">
                    <Bookmark size={17} strokeWidth={2.2} />
                  </span>
                  <span>{t("Избранное")}</span>
                </button>

                {/* Stories Option - Hidden on PC/Desktop */}
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => {
                      setChatListMenuOpen(false);
                      storyInputRef.current?.click();
                    }}
                    className="flex h-[38px] w-[calc(100%-8px)] items-center gap-3 mx-1 rounded-[12px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985]"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center text-zinc-300">
                      <CircleFadingPlus size={17} strokeWidth={2.2} />
                    </span>
                    <span>{t("История")}</span>
                  </button>
                )}

                {/* Settings Option */}
                <button
                  type="button"
                  onClick={() => {
                    setChatListMenuOpen(false);
                    setSettingsPanelOpen(true);
                  }}
                  className="flex h-[38px] w-[calc(100%-8px)] items-center gap-3 mx-1 rounded-[12px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985]"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center text-zinc-300">
                    <Settings size={17} strokeWidth={2.2} />
                  </span>
                  <span>{t("Настройки")}</span>
                </button>

                {/* More Option with Custom creation options */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuShowMore((prev) => !prev);
                  }}
                  className={cn(
                    "flex h-[38px] w-[calc(100%-8px)] items-center justify-between mx-1 rounded-[12px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985]",
                    menuShowMore && "bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-5 w-5 shrink-0 place-items-center text-zinc-300">
                      <MoreVertical size={17} strokeWidth={2.2} />
                    </span>
                    <span>{t("Создать...")}</span>
                  </div>
                  <ChevronRight
                    size={14}
                    className={cn("text-zinc-400 transition-transform duration-200", menuShowMore && "rotate-90")}
                  />
                </button>

                {/* Sub-menu options */}
                <AnimatePresence>
                  {menuShowMore && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden bg-black/15 mx-1 rounded-[12px] my-0.5 py-1 flex flex-col gap-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setChatListMenuOpen(false);
                          openCreateChat("group");
                        }}
                        className="flex h-[36px] w-[calc(100%-8px)] items-center gap-3 mx-1 rounded-[10px] px-2.5 text-left text-[12.5px] font-semibold text-zinc-200 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985]"
                      >
                        <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-zinc-400">
                          <UsersRound size={15} />
                        </span>
                        <span>{t("Создать группу")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChatListMenuOpen(false);
                          openCreateChat("channel");
                        }}
                        className="flex h-[36px] w-[calc(100%-8px)] items-center gap-3 mx-1 rounded-[10px] px-2.5 text-left text-[12.5px] font-semibold text-zinc-200 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.985]"
                      >
                        <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-zinc-400">
                          <Megaphone size={15} />
                        </span>
                        <span>{t("Создать канал")}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <StoryFeed
          storiesHidden={storiesHidden}
          storiesLoading={storiesLoading}
          storyFeed={storyFeed}
          mobileStoryRailGroups={mobileStoryRailGroups}
          storyInputRef={storyInputRef}
          openStoryViewer={openStoryViewer}
          createStoryFromSelection={createStoryFromSelection}
        />

      </div>

      <div id="global-voice-list-slot" className="sticky top-0 z-10 px-3 pb-0.5 pt-0.5 empty:hidden" />
      <div id="global-music-list-slot" className="sticky top-0 z-10 px-3 pb-3 pt-0.5 empty:hidden" />

      <div
        ref={chatListViewportRef}
        onScroll={handleChatListScroll}
        onWheel={handleChatListWheel}
        onTouchStart={handleChatListTouchStart}
        onTouchMove={handleChatListTouchMove}
        onTouchEnd={handleChatListTouchEnd}
        onTouchCancel={handleChatListTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar pb-[calc(env(safe-area-inset-bottom)+86px)] md:pb-0"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
      >
        {chatSearchOpen ? (
          <motion.div
            key="chat-search-panel"
            data-chat-search-panel
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-full pb-5 pt-1 text-zinc-950 dark:text-zinc-50"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${chatSearchScope}-${chatSearchNormalizedQuery ? "query" : "empty"}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {chatSearchLoading ? (
                  <div className="flex flex-col">
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <div
                        key={`search-skeleton-${idx}`}
                        className={cn(
                          "flex w-full items-center gap-3.5 rounded-[20px] px-4 py-2.5 md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px]",
                          idx >= 9 && "hidden md:flex"
                        )}
                      >
                        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Skeleton
                              className="h-4 rounded-md"
                              style={{ width: `${Math.min(70, 35 + ((idx * 17) % 35))}%` }}
                            />
                          </div>
                          <Skeleton
                            className="h-3 rounded-md"
                            style={{ width: `${Math.min(85, 45 + ((idx * 23) % 40))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {chatSearchError ? (
                  <p className="px-4 py-3 text-[13px] font-medium text-red-400 md:px-6">{t(chatSearchError ?? "")}</p>
                ) : null}

                {!chatSearchLoading && !chatSearchError && !hasChatSearchResults ? (
                  <div className="flex min-h-[42vh] flex-col items-center justify-center text-center text-zinc-500">
                    <Search size={34} className="mb-3 opacity-60" />
                    <p className="text-[15px] font-semibold">
                      {chatSearchNormalizedQuery ? t("Ничего не найдено") : t("Начните поиск")}
                    </p>
                    <p className="mt-1 text-[13px] text-zinc-500/75">
                      {chatSearchNormalizedQuery ? t("Попробуйте другой запрос") : t("Ищите чаты, людей, группы и каналы")}
                    </p>
                  </div>
                ) : null}

                {!chatSearchLoading && (
                  <div className="flex flex-col">
                    {showSearchSaved && chatSearchSaved.length > 0 ? (
                      <>
                        {chatSearchSaved.map((saved) => (
                          <button
                            key={`search-saved-${saved.id}`}
                            type="button"
                            onClick={() => openChatSearchResult(saved.link, "saved")}
                            className={cn(
                              "w-full rounded-[20px] border-b border-transparent px-4 py-2.5 text-left outline-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-0",
                              "hover:bg-zinc-100/45 dark:hover:bg-white/[0.035]",
                              "md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px] md:hover:bg-white/[0.05]",
                              selectedLink === saved.link ? "bg-zinc-100/50 dark:bg-white/[0.06] md:bg-white/[0.06]" : ""
                            )}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="relative shrink-0">
                                <SavedMessagesAvatar
                                  className="h-12 w-12"
                                  seedDisplayName={isGeneratedDefaultAvatarUrl(selfProfile?.avatarUrl) ? selfProfile?.displayName : null}
                                  seedLink={selfProfile?.link}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50">
                                  {saved.title}
                                </span>
                                <span className="mt-0.5 block truncate text-[13px] font-normal leading-4 text-zinc-400 dark:text-zinc-400">
                                  {t("ваше облачное хранилище")}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : null}

                    {showSearchEclipse && chatSearchEclipse.length > 0 ? (
                      <>
                        {chatSearchEclipse.map((eclipse) => (
                          <button
                            key={`search-eclipse-${eclipse.id}`}
                            type="button"
                            onClick={() => openChatSearchResult(eclipse.link, "eclipse")}
                            className={cn(
                              "w-full rounded-[20px] border-b border-transparent px-4 py-2.5 text-left outline-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-0",
                              "hover:bg-zinc-100/45 dark:hover:bg-white/[0.035]",
                              "md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px] md:hover:bg-white/[0.05]",
                              selectedLink === eclipse.link ? "bg-zinc-100/50 dark:bg-white/[0.06] md:bg-white/[0.06]" : ""
                            )}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="relative shrink-0">
                                <EclipseBotAvatar className="h-12 w-12" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50">
                                  <EclipseVerifiedTitle title={eclipse.title} className="text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50" />
                                </span>
                                <span className="mt-0.5 block truncate text-[13px] font-normal leading-4 text-zinc-400 dark:text-zinc-400">
                                  <EclipseChatListStatus />
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : null}

                    {(showSearchChats || !chatSearchNormalizedQuery) && chatSearchLocalResults.length > 0 ? (
                      <>
                        {chatSearchLocalResults.map((chat) => {
                          const cachedProfile = chat.chatType === "direct" ? readProfileFromCache(chat.peerId) : null;
                          const isBot = chat.isBot || chatSearchUsers.some(user => user.id === chat.peerId && user.isBot);
                          const onlineVisible =
                            chat.chatType === "direct" && !isBot &&
                            onlineUserIds.has(chat.peerId);
                          const statusText =
                            chat.chatType === "saved"
                              ? t("ваше облачное хранилище")
                              : chat.chatType === "eclipse"
                                ? chat.statusText ?? ECLIPSE_LIST_STATUS
                                : chat.chatType === "direct"
                                  ? isBot ? t("бот") : t(getPresenceStatusText(
                                    chat.peerId,
                                    onlineUserIds,
                                    lastOfflineAtByUserId,
                                    presenceNowTs,
                                    cachedProfile?.presenceVisibility !== "none",
                                    cachedProfile?.lastSeenVisibility !== "none",
                                  ))
                                  : chat.chatType === "channel"
                                    ? formatSearchCount(chat.subscribersCount, t("подписчик"), t("подписчика"), t("подписчиков"))
                                    : chat.chatType === "group"
                                      ? formatSearchCount(chat.membersCount, t("участник"), t("участника"), t("участников"))
                                      : `@${chat.link}`;
                          return (
                            <button
                              key={`search-chat-${chat.conversationId}`}
                              type="button"
                              onClick={() => openChatSearchResult(chat.link, chat.chatType ?? "direct")}
                              className={cn(
                                "w-full rounded-[20px] border-b border-transparent px-4 py-2.5 text-left outline-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-0",
                                "hover:bg-zinc-100/45 dark:hover:bg-white/[0.035]",
                                "md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px] md:hover:bg-white/[0.05]",
                                selectedLink === chat.link ? "bg-zinc-100/50 dark:bg-white/[0.06] md:bg-white/[0.06]" : ""
                              )}
                            >
                              <div className="flex items-center gap-3.5">
                                <div className="relative shrink-0">
                                  {chat.chatType === "saved" ? (
                                    <SavedMessagesAvatar
                                      className="h-12 w-12"
                                      seedDisplayName={isGeneratedDefaultAvatarUrl(selfProfile?.avatarUrl) ? selfProfile?.displayName : null}
                                      seedLink={selfProfile?.link}
                                    />
                                  ) : chat.chatType === "eclipse" ? (
                                    <EclipseBotAvatar className="h-12 w-12" />
                                  ) : (
                                    <MediaAvatar
                                      src={chat.avatarUrl ?? undefined}
                                      alt={chat.displayName}
                                      className="h-12 w-12"
                                      fallbackText={chat.displayName.slice(0, 1)}
                                      autoPlay
                                    />
                                  )}
                                  {onlineVisible ? <OnlineStatusDot className="bottom-0.5 right-0.5 h-2.5 w-2.5" /> : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50">
                                    {chat.chatType === "eclipse" ? (
                                      <EclipseVerifiedTitle title={chat.displayName} className="text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50" />
                                    ) : (
                                      chat.chatType === "saved" ? t("Избранное") : <VerifiedTitle emojiStatusInteractive={false} kind={chat.chatType === "group" ? "group" : chat.chatType === "channel" ? "channel" : "user"} link={chat.link} isBot={isBot}>{renderTextWithEmojis(chat.displayName)}</VerifiedTitle>
                                    )}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[13px] font-normal leading-4 text-zinc-400 dark:text-zinc-400">
                                    {statusText}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    ) : null}

                    {showSearchUsers && visibleChatSearchUsers.length > 0 ? (
                      <>
                        {visibleChatSearchUsers.map((user) => {
                          const cachedProfile = readProfileFromCache(user.id);
                          const onlineVisible =
                            !user.isBot && onlineUserIds.has(user.id);
                          const statusText = user.isBot ? t("бот") : t(getPresenceStatusText(
                            user.id,
                            onlineUserIds,
                            lastOfflineAtByUserId,
                            presenceNowTs,
                            cachedProfile?.presenceVisibility !== "none",
                            cachedProfile?.lastSeenVisibility !== "none",
                          ));
                          return (
                            <button
                              key={`search-user-${user.id}`}
                              type="button"
                              onClick={() => openChatSearchResult(user.link, "direct")}
                              className={cn(
                                "w-full rounded-[20px] border-b border-transparent px-4 py-2.5 text-left outline-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-0",
                                "hover:bg-zinc-100/45 dark:hover:bg-white/[0.035]",
                                "md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px] md:hover:bg-white/[0.05]",
                                selectedLink === user.link ? "bg-zinc-100/50 dark:bg-white/[0.06] md:bg-white/[0.06]" : ""
                              )}
                            >
                              <div className="flex items-center gap-3.5">
                                <div className="relative shrink-0">
                                  <MediaAvatar
                                    src={user.avatarUrl ?? undefined}
                                    alt={user.displayName}
                                    className="h-12 w-12"
                                    fallbackText={user.displayName.slice(0, 1)}
                                    autoPlay
                                  />
                                  {onlineVisible ? <OnlineStatusDot className="bottom-0.5 right-0.5 h-2.5 w-2.5" /> : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50">
                                    <VerifiedTitle emojiStatusInteractive={false} kind="user" link={user.link} isBot={user.isBot}>{renderTextWithEmojis(user.displayName)}</VerifiedTitle>
                                  </span>
                                  <span className="mt-0.5 block truncate text-[13px] font-normal leading-4 text-zinc-400 dark:text-zinc-400">
                                    {statusText}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    ) : null}

                    {showSearchGroups && visibleChatSearchGroups.length > 0 ? (
                      <>
                        {visibleChatSearchGroups.map((group) => (
                          <button
                            key={`search-group-${group.id}`}
                            type="button"
                            onClick={() => openChatSearchResult(group.link, "group")}
                            className={cn(
                              "w-full rounded-[20px] border-b border-transparent px-4 py-2.5 text-left outline-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-0",
                              "hover:bg-zinc-100/45 dark:hover:bg-white/[0.035]",
                              "md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px] md:hover:bg-white/[0.05]",
                              selectedLink === group.link ? "bg-zinc-100/50 dark:bg-white/[0.06] md:bg-white/[0.06]" : ""
                            )}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="relative shrink-0">
                                <MediaAvatar
                                  src={group.avatarUrl ?? undefined}
                                  alt={group.name}
                                  className="h-12 w-12"
                                  fallbackText={group.name.slice(0, 1)}
                                  autoPlay
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50">
                                  <VerifiedTitle emojiStatusInteractive={false} kind="group" link={group.link}>{renderTextWithEmojis(group.name)}</VerifiedTitle>
                                </span>
                                <span className="mt-0.5 block truncate text-[13px] font-normal leading-4 text-zinc-400 dark:text-zinc-400">
                                  {formatSearchCount(group.membersCount, t("участник"), t("участника"), t("участников"))}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : null}

                    {showSearchChannels && visibleChatSearchChannels.length > 0 ? (
                      <>
                        {visibleChatSearchChannels.map((channel) => (
                          <button
                            key={`search-channel-${channel.id}`}
                            type="button"
                            onClick={() => openChatSearchResult(channel.link, "channel")}
                            className={cn(
                              "w-full rounded-[20px] border-b border-transparent px-4 py-2.5 text-left outline-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-0",
                              "hover:bg-zinc-100/45 dark:hover:bg-white/[0.035]",
                              "md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px] md:hover:bg-white/[0.05]",
                              selectedLink === channel.link ? "bg-zinc-100/50 dark:bg-white/[0.06] md:bg-white/[0.06]" : ""
                            )}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="relative shrink-0">
                                <MediaAvatar
                                  src={channel.avatarUrl ?? undefined}
                                  alt={channel.name}
                                  className="h-12 w-12"
                                  fallbackText={channel.name.slice(0, 1)}
                                  autoPlay
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50">
                                  <VerifiedTitle emojiStatusInteractive={false} kind="channel" link={channel.link}>{renderTextWithEmojis(channel.name)}</VerifiedTitle>
                                </span>
                                <span className="mt-0.5 block truncate text-[13px] font-normal leading-4 text-zinc-400 dark:text-zinc-400">
                                  {formatSearchCount(channel.subscribersCount, t("подписчик"), t("подписчика"), t("подписчиков"))}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : null}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        ) : (
          <>
            {showInitialChatListSkeleton ? (
              <div className="px-3.5 pb-3 space-y-3">
                {Array.from({ length: 11 }).map((_, idx) => (
                  <div
                    key={`chat-skeleton-${idx}`}
                    className={cn("flex items-center gap-3.5 py-1", idx >= 9 && "hidden md:flex")}
                  >
                    <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-4 w-28 rounded-md" />
                        <Skeleton className="h-3 w-8 rounded-md" />
                      </div>
                      <Skeleton className="h-3.5 w-40 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {orderedChats.length > 0 ? (
              <div
                style={{
                  paddingTop: shouldVirtualizeChatList
                    ? `${chatListWindow.start * CHAT_ITEM_ESTIMATED_HEIGHT}px`
                    : undefined,
                  paddingBottom: shouldVirtualizeChatList
                    ? `${Math.max(
                      0,
                      chatListTotalHeight - (chatListWindow.end + 1) * CHAT_ITEM_ESTIMATED_HEIGHT,
                    )}px`
                    : undefined,
                }}
              >
                <div className="flex flex-col">
                  {virtualChatRows.map(row => <ChatSidebarRow key={row.chat.conversationId} row={row} shared={props} selected={selectedLink === row.chat.link} helperOpen={chatListHelper?.link === row.chat.link} isDirectOnlineVisible={row.chat.chatType === "direct" && onlineUserIds.has(row.chat.peerId)} chatOrderKey={shouldVirtualizeChatList ? "" : chatOrderKey} />)}
                </div>
                {loadingMoreChats ? (
                  <div className="px-3.5 py-2 space-y-2">
                    <div className="flex items-center gap-3.5 py-1">
                      <div className="h-12 w-12 rounded-full bg-white/[0.045] shrink-0 animate-pulse" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3.5 w-28 rounded-full bg-white/[0.055] animate-pulse" />
                        <div className="h-3 w-40 rounded-full bg-white/[0.035] animate-pulse" />
                      </div>
                    </div>
                  </div>
                ) : null}
                {!hasMoreChats && orderedChats.length > CHAT_PAGE_SIZE ? (
                  <div className="px-4 py-2 text-[11px] text-zinc-500">{t("Все чаты загружены")}</div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <AnimatePresence>
        {chatListHelper && chatListHelperChat ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={() => setChatListHelper(null)}
              className="fixed inset-0 z-[90] rounded-none bg-black/35"
              aria-label={t("Закрыть хелпер чата")}
            />
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                closed: {
                  opacity: 0,
                  scale: 0.78,
                  transition: {
                    duration: 0.14,
                    ease: [0.32, 0, 0.67, 0],
                  },
                },
                open: {
                  opacity: 1,
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 450,
                    damping: 28,
                    mass: 0.7,
                  },
                },
              }}
              className={cn(
                "fixed z-[100] will-change-transform",
                chatListHelperFrame ? "" : "left-1/2 top-1/2 w-[210px] -translate-x-1/2 -translate-y-1/2",
              )}
              style={
                chatListHelperFrame
                  ? {
                    left: chatListHelperFrame.panel.left,
                    top: chatListHelperFrame.panel.top,
                    width: chatListHelperFrame.panel.width,
                    transformOrigin: chatListHelperFrame.panel.opensBelow ? "top left" : "bottom left",
                  }
                  : undefined
              }
            >
              <div
                data-chat-context-menu
                className="app-panel-surface app-chat-menu-surface overflow-hidden rounded-[20px] border border-transparent bg-[#1c1c1e] p-1.5 text-zinc-100"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      toggleChatPinnedState(chatListHelper.link);
                      setChatListHelper(null);
                    }}
                    className="group flex h-[36px] w-full items-center gap-3 rounded-[11px] px-3 text-left text-[13px] font-medium text-zinc-100 transition-all duration-150 hover:bg-white/[0.08] active:bg-white/[0.12] active:scale-[0.985]"
                  >
                    <span className="grid size-5 shrink-0 place-items-center text-zinc-400 group-hover:text-zinc-200">
                      {pinnedChatLinkSet.has(chatListHelper.link) ? <PinOff size={17} /> : <TiPin size={18} />}
                    </span>
                    <span className="truncate">
                      {pinnedChatLinkSet.has(chatListHelper.link) ? t("Открепить") : t("Закрепить")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleChatMutedState(chatListHelper.link);
                      setChatListHelper(null);
                    }}
                    className="group flex h-[36px] w-full items-center gap-3 rounded-[11px] px-3 text-left text-[13px] font-medium text-zinc-100 transition-all duration-150 hover:bg-white/[0.08] active:bg-white/[0.12] active:scale-[0.985]"
                  >
                    <span className="grid size-5 shrink-0 place-items-center text-zinc-400 group-hover:text-zinc-200"><FaVolumeMute size={17} /></span>
                    <span className="truncate">
                      {mutedChatLinkSet.has(chatListHelper.link) ? t("Уведомления вкл.") : t("Уведомления откл.")}
                    </span>
                  </button>
                  {chatListHelper.chatType === "direct" || chatListHelper.chatType === "eclipse" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDirectChatDeleteConfirm({
                          link: chatListHelper.link,
                          displayName: chatListHelper.displayName,
                        });
                        setChatListHelper(null);
                      }}
                      className="group flex h-[36px] w-full items-center gap-3 rounded-[11px] px-3 text-left text-[13px] font-medium text-red-400 transition-all duration-150 hover:bg-red-500/[0.12] hover:text-red-300 active:bg-red-500/[0.18] active:scale-[0.985]"
                    >
                      <span className="grid size-5 shrink-0 place-items-center"><MdDelete size={18} /></span>
                      <span className="truncate">{t("Удалить чат")}</span>
                    </button>
                  ) : null}
                  {chatListHelper.chatType === "group" || chatListHelper.chatType === "channel" ? (
                    <button
                      type="button"
                      onClick={() => {
                        void openChatListDangerAction({
                          link: chatListHelper.link,
                          chatType: chatListHelper.chatType,
                        }).finally(() => setChatListHelper(null));
                      }}
                      className="group flex h-[36px] w-full items-center gap-3 rounded-[11px] px-3 text-left text-[13px] font-medium text-red-400 transition-all duration-150 hover:bg-red-500/[0.12] hover:text-red-300 active:bg-red-500/[0.18] active:scale-[0.985]"
                    >
                      <span className="grid size-5 shrink-0 place-items-center">
                        {chatListHelper.dangerAction === "delete" ? <MdDelete size={18} /> : <LogOut size={17} />}
                      </span>
                      <span className="truncate">
                        {chatListHelper.chatType === "channel"
                          ? chatListHelper.dangerAction === "delete"
                            ? t("Удалить канал")
                            : t("Покинуть канал")
                          : chatListHelper.dangerAction === "delete"
                            ? t("Удалить группу")
                            : t("Покинуть группу")}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

    </motion.aside>
  );
});
