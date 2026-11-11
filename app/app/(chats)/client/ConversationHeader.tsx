"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type DecryptedMessage, type ConversationResponse, type ChatSummary, type ActivityIndicatorKind, type StoryFeedGroup, type SelfProfile } from "../types";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { CSSProperties, memo } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useMessageSearch } from "../hooks/useMessageSearch";
import { MessageSearchBar } from "../components/common/MessageSearchBar";
import { IoArrowRedo } from "react-icons/io5";
import { FaLock } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { MediaAvatar } from "@/components/ui/media";
import { EclipseBotAvatar, EclipseVerifiedTitle } from "../EclipseChatUi";
import { cn } from "@/lib/utils";
import { SavedMessagesAvatar } from "../components/common/Avatars";
import { SmoothStatusLine } from "../components/common/ActivityStatus";
import { StoryAvatarRing } from "../components/story/StoryAvatarRing";
import { isGeneratedDefaultAvatarUrl } from "./profile-primitives";

export interface ConversationHeaderProps {
  isDesktop: boolean;
  messageSearch: ReturnType<typeof useMessageSearch>;
  composerInputThemeStyle: React.CSSProperties;
  selectionMode: boolean;
  selectedMessageIds: string[];
  selectionDeleting: boolean;
  setSelectionDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatHeaderThemeStyle: React.CSSProperties;
  t: (source: string, values?: TranslationValues | undefined) => string;
  selectedMessages: DecryptedMessage[];
  forwardSending: boolean;
  selectedLink: string | null;
  beginForwardMessages: (source: DecryptedMessage[]) => void;
  clearSelectionMode: () => void;
  suppressRequestedChatSyncRef: React.RefObject<boolean>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  otherUnreadNotifications: number;
  unreadBadgeThemeStyle: React.CSSProperties | undefined;
  openActiveDetails: () => void;
  isEclipseConversation: boolean;
  activeTitle: string;
  isSecretChat: boolean;
  activeChat: ChatSummary;
  isManagedBotConversation: boolean;
  activeStatusIndicatorKind: ActivityIndicatorKind | null;
  activeStatusText: string;
  activeStatusClass: "text-white/90" | "text-zinc-500";
  activeChatStoryEntry: { group: StoryFeedGroup; index: number; } | null;
  openStoryViewer: (groupIndex: number, storyIndex?: number, source?: HTMLElement | null | undefined) => void;
  selfProfile: SelfProfile | null;
}

export const ConversationHeader = memo(function ConversationHeader({ isDesktop, messageSearch, composerInputThemeStyle, selectionMode, selectedMessageIds, selectionDeleting, setSelectionDeleteDialogOpen, chatHeaderThemeStyle, t, selectedMessages, forwardSending, selectedLink, beginForwardMessages, clearSelectionMode, suppressRequestedChatSyncRef, setSelectedLink, setActiveConversation, setMessages, otherUnreadNotifications, unreadBadgeThemeStyle, openActiveDetails, isEclipseConversation, activeTitle, isSecretChat, activeChat, isManagedBotConversation, activeStatusIndicatorKind, activeStatusText, activeStatusClass, activeChatStoryEntry, openStoryViewer, selfProfile }: ConversationHeaderProps) {
  return (
    <header
      className={`${isDesktop ? "px-5 pt-2.5" : "px-2.5 pt-[max(env(safe-area-inset-top),8px)]"} pointer-events-none absolute inset-x-0 top-0 z-30`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {messageSearch.open ? <MessageSearchBar query={messageSearch.query} count={messageSearch.matches.length} index={messageSearch.index} busy={messageSearch.busy} hasMore={messageSearch.hasMore} failed={messageSearch.failed} style={composerInputThemeStyle} onChange={messageSearch.change} onMove={messageSearch.move} onClose={messageSearch.close} /> : selectionMode ? (
          <motion.div
            key="selection-header"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            data-message-selection-header
            className="mx-auto grid h-12 w-full max-w-[700px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-white md:h-[46px]"
          >
            {/* Delete Panel */}
            <div className="flex justify-start">
              <button
                type="button"
                disabled={selectedMessageIds.length === 0 || selectionDeleting}
                onClick={() => setSelectionDeleteDialogOpen(true)}
                className="pointer-events-auto flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] sm:px-4 font-semibold text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors md:h-9"
                style={chatHeaderThemeStyle}
                aria-label={t("Удалить выбранные сообщения")}
              >
                <MdDelete size={17} />
                <span className="hidden sm:inline">{t("Удалить")}</span>
              </button>

            </div>
            {/* Selected Count Panel */}
            <div
              className="pointer-events-auto flex h-10 items-center justify-center rounded-full px-4 text-center text-[13px] font-semibold text-zinc-100 md:h-9"
              style={chatHeaderThemeStyle}
            >
              <span>{t("Выбрано: ")}{selectedMessageIds.length}</span>
            </div>

            <div className="flex justify-end gap-1.5">
              <button type="button" aria-label={t("Переслать выбранные сообщения")} disabled={!selectedMessages.length || forwardSending || Boolean(selectedLink?.startsWith("secret-"))} onClick={() => beginForwardMessages(selectedMessages)} className="pointer-events-auto flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] sm:px-4 font-semibold text-zinc-100 disabled:opacity-40 md:h-9" style={chatHeaderThemeStyle}><IoArrowRedo size={17} /><span className="hidden sm:inline">{t("Переслать")}</span></button>
              {/* Cancel Panel */}
              <button
                type="button"
                onClick={clearSelectionMode}
                className="pointer-events-auto flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] sm:px-4 font-semibold text-zinc-300 hover:text-white transition-colors md:h-9"
                style={chatHeaderThemeStyle}
                aria-label={t("Отменить выделение")}
              >
                <X size={15} />
                <span className="hidden sm:inline">{t("Отмена")}</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="regular-header"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto mx-auto flex h-12 w-full max-w-[700px] items-center gap-2 text-white md:h-[46px]"
          >
            <button
              type="button"
              className="group flex h-10 shrink-0 items-center gap-1.5 rounded-full border-0 bg-transparent px-2 text-zinc-100 transition-colors hover:text-white focus-visible:ring-white/[0.14] md:h-9"
              style={chatHeaderThemeStyle}
              aria-label={t("Назад")}
              onClick={() => {
                suppressRequestedChatSyncRef.current = true;
                setSelectedLink(null);
                setActiveConversation(null);
                setMessages([]);
                if (typeof window !== "undefined") {
                  const nextParams = new URLSearchParams(window.location.search);
                  nextParams.delete("chat");
                  nextParams.delete("chatType");
                  const query = nextParams.toString();
                  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
                  window.history.replaceState(null, "", nextUrl);
                }
              }}
            >
              <span className="relative inline-flex items-center justify-center">
                <ChevronLeft size={22} strokeWidth={2.35} className="shrink-0" />
                {otherUnreadNotifications > 0 ? (
                  <span
                    className={`absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${unreadBadgeThemeStyle
                      ? "shadow-[0_4px_10px_-4px_rgba(0,0,0,0.65)]"
                      : "bg-zinc-300 text-zinc-950 dark:bg-zinc-400 dark:text-zinc-950"
                      }`}
                    style={unreadBadgeThemeStyle}
                  >
                    {otherUnreadNotifications > 99 ? "99+" : otherUnreadNotifications}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"

              onClick={openActiveDetails}
              className="mx-auto flex h-10 min-w-0 max-w-[min(58vw,280px)] flex-none flex-col items-center justify-center rounded-full px-6 text-center text-zinc-100 transition-colors md:h-9 md:max-w-[320px] md:px-7 hover:text-white"
              style={chatHeaderThemeStyle}
            >
              <div className="flex items-center justify-center gap-1.5 min-w-0 max-w-full">
                {isEclipseConversation ? (
                  <EclipseVerifiedTitle title={activeTitle} className="max-w-full text-[14px] font-semibold leading-[1.05] text-white md:text-[15px]" />
                ) : isSecretChat ? (
                  <>
                    <FaLock size={12} className="shrink-0 text-green-500" />
                    <p className="max-w-full truncate text-[14px] font-semibold leading-[1.05] text-green-500 md:text-[15px]">{activeTitle}</p>
                  </>
                ) : (
                  <p className="max-w-full truncate text-[14px] font-semibold leading-[1.05] text-white md:text-[15px]"><VerifiedTitle emojiStatusInteractive={false} kind={activeChat?.chatType === "group" ? "group" : activeChat?.chatType === "channel" ? "channel" : "user"} link={activeChat?.link ?? ""} isBot={isManagedBotConversation}>{activeTitle}</VerifiedTitle></p>
                )}
              </div>
              {!isEclipseConversation && <SmoothStatusLine
                kind={activeStatusIndicatorKind}
                text={activeStatusText}
                className="mt-[1px] h-3.5 w-full -translate-y-[2px]"
                labelClassName={cn("text-[11px] leading-none", activeStatusIndicatorKind ? activeStatusClass : "text-zinc-300/74")}
                align="center"
              />}
            </button>
            <button
              type="button"

              onClick={
                activeChatStoryEntry
                  ? (event) => openStoryViewer(activeChatStoryEntry.index, 0, event.currentTarget)
                  : openActiveDetails
              }
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors md:h-9 md:w-9",
                activeChatStoryEntry
                  ? "bg-transparent p-0 overflow-visible"
                  : "bg-transparent p-0 overflow-hidden hover:bg-white/8",
              )}
              style={chatHeaderThemeStyle}
              aria-label={activeChatStoryEntry ? t("Открыть историю {0}", { 0: activeTitle }) : t("Открыть профиль {0}", { 0: activeTitle })}
            >
              {activeChat.chatType === "saved" ? (
                <SavedMessagesAvatar
                  className="h-full w-full"
                  seedDisplayName={isGeneratedDefaultAvatarUrl(selfProfile?.avatarUrl) ? selfProfile?.displayName : null}
                  seedLink={selfProfile?.link}
                />
              ) : activeChat.chatType === "eclipse" ? (
                <EclipseBotAvatar className="h-full w-full" />
              ) : activeChatStoryEntry ? (
                <StoryAvatarRing seen={!activeChatStoryEntry.group.hasUnviewed} className="h-10 w-10 p-[3px] md:h-9 md:w-9" stories={activeChatStoryEntry.group.stories}>
                  <MediaAvatar
                    src={activeChat.avatarUrl ?? undefined}
                    alt={activeTitle}
                    className="h-full w-full"
                    fallbackText={activeTitle.slice(0, 1)}
                    autoPlay
                  />
                </StoryAvatarRing>
              ) : (
                <MediaAvatar
                  src={activeChat.avatarUrl ?? undefined}
                  alt={activeTitle}
                  className="h-full w-full"
                  fallbackText={activeTitle.slice(0, 1)}
                  autoPlay
                />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
});
