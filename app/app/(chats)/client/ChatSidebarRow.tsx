"use client";
import { MediaAvatar } from "@/components/ui/media";
import { OnlineStatusDot } from "@/components/ui/online-status-dot";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Image as ImageIcon, ListCollapse, Mic, Music2, Paperclip, SquarePlay } from "lucide-react";
import { GroupCallListMarker } from "../components/common/GroupVideoChat";
import { memo } from "react";
import { FaLock, FaVolumeMute } from "react-icons/fa";
import { FiPhone, FiVideo } from "react-icons/fi";
import { TiPin } from "react-icons/ti";
import { EclipseBotAvatar, EclipseVerifiedTitle } from "../EclipseChatUi";
import { ActivityStatusIndicator } from "../components/common/ActivityStatus";
import { SavedMessagesAvatar } from "../components/common/Avatars";
import { ChatListMediaPreview } from "../components/common/ChatListMediaPreview";
import { MessageStatusTicks } from "../components/common/MessageStatus";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import type { ChatSidebarProps } from "./ChatSidebar";
import { areChatSidebarRowPropsEqual, type ChatSidebarRowProps } from "./chat-sidebar-row-equality";
import { CHAT_ITEM_ESTIMATED_HEIGHT } from "./config";
import { renderTextWithEmojis } from "./message-content";
import { isGeneratedDefaultAvatarUrl } from "./profile-primitives";
const sharedKeys = ["t", "selfProfile", "shouldVirtualizeChatList", "chatListSuppressClickLinkRef", "suppressRequestedChatSyncRef", "setSelectedLink", "setChatListHelper", "resolveChatListDangerAction", "clearChatListLongPress", "chatListLongPressTimerRef", "unreadBadgeThemeStyle"] as const satisfies readonly (keyof ChatSidebarProps)[];
export const ChatSidebarRow = memo(function ChatSidebarRow({ row, shared, selected, isDirectOnlineVisible, helperOpen, chatOrderKey }: ChatSidebarRowProps) {
  const { chat, preview, isEmptyChat, safePreviewText, callPreview, senderPrefix, timeLabel, unreadCount, isChatMuted, isPinned, isLastDirectMessageRead, sendingLabel, recordingLabel, isTyping, } = row;
  const { t, selfProfile, shouldVirtualizeChatList, chatListSuppressClickLinkRef, suppressRequestedChatSyncRef, setSelectedLink, setChatListHelper, resolveChatListDangerAction, clearChatListLongPress, chatListLongPressTimerRef, unreadBadgeThemeStyle } = shared;
  return (<motion.div layout={shouldVirtualizeChatList ? false : "position"} layoutDependency={chatOrderKey} data-chat-list-row={chat.link} transition={{
    layout: {
      type: "spring",
      stiffness: 360,
      damping: 32,
      mass: 0.8,
    },
  }} className={cn("w-full", helperOpen
    ? "relative z-[95]"
    : "overflow-hidden")}>
    <button key={chat.conversationId} onClick={() => {
      if (chatListSuppressClickLinkRef.current === chat.link) {
        chatListSuppressClickLinkRef.current = null;
        return;
      }
      suppressRequestedChatSyncRef.current = false;
      setSelectedLink(chat.link);
    }} onContextMenu={(event) => {
      if (chat.chatType === "saved")
        return;
      event.preventDefault();
      const anchorRect = event.currentTarget.getBoundingClientRect();
      setChatListHelper({
        link: chat.link,
        chatType: chat.chatType ?? "direct",
        dangerAction: chat.chatType === "group"
          ? chat.isGroupOwner
            ? "delete"
            : "leave"
          : null,
        displayName: chat.displayName,
        x: event.clientX,
        y: event.clientY,
        touch: false,
        anchorRect: {
          left: anchorRect.left,
          top: anchorRect.top,
          width: anchorRect.width,
          height: anchorRect.height,
        },
      });
      void resolveChatListDangerAction({ link: chat.link, chatType: chat.chatType ?? "direct" });
    }} onTouchStart={(event) => {
      if (chat.chatType === "saved")
        return;
      clearChatListLongPress();
      const touch = event.touches[0];
      if (!touch)
        return;
      const anchorRect = event.currentTarget.getBoundingClientRect();
      chatListLongPressTimerRef.current = window.setTimeout(() => {
        chatListSuppressClickLinkRef.current = chat.link;
        setChatListHelper({
          link: chat.link,
          chatType: chat.chatType ?? "direct",
          dangerAction: chat.chatType === "group"
            ? chat.isGroupOwner
              ? "delete"
              : "leave"
            : null,
          displayName: chat.displayName,
          x: touch.clientX,
          y: touch.clientY,
          touch: true,
          anchorRect: {
            left: anchorRect.left,
            top: anchorRect.top,
            width: anchorRect.width,
            height: anchorRect.height,
          },
        });
        void resolveChatListDangerAction({ link: chat.link, chatType: chat.chatType ?? "direct" });
      }, 420);
    }} onTouchMove={() => clearChatListLongPress()} onTouchEnd={() => clearChatListLongPress()} onTouchCancel={() => clearChatListLongPress()} className={cn("w-full rounded-[20px] border-b border-transparent px-4 py-2.5 text-left outline-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-0", "hover:bg-zinc-100/45 dark:hover:bg-white/[0.035]", "md:mx-3 md:w-[calc(100%-24px)] md:rounded-[22px] md:hover:bg-white/[0.05]", selected
      ? "bg-zinc-100/50 dark:bg-white/[0.06] md:bg-white/[0.06]"
      : "", helperOpen
      ? "relative z-[95] bg-zinc-200 dark:bg-[#202022] shadow-[0_12px_40px_rgba(0,0,0,0.42)] scale-[1.015] md:scale-[1.015]"
      : "")} style={{ contentVisibility: "auto", containIntrinsicSize: `${CHAT_ITEM_ESTIMATED_HEIGHT}px` }}>
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          {chat.chatType === "saved" ? (<SavedMessagesAvatar className="h-12 w-12" seedDisplayName={isGeneratedDefaultAvatarUrl(selfProfile?.avatarUrl) ? selfProfile?.displayName : null} seedLink={selfProfile?.link} />) : chat.chatType === "eclipse" ? (<EclipseBotAvatar className="h-12 w-12" />) : (<MediaAvatar src={chat.avatarUrl ?? undefined} alt={chat.displayName} className="h-12 w-12" fallbackText={chat.displayName.slice(0, 1)} autoPlay />)}
          {isDirectOnlineVisible ? (<OnlineStatusDot className="bottom-0.5 right-0.5 h-2.5 w-2.5" />) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50">
                {chat.chatType === "eclipse" ? (<EclipseVerifiedTitle title={chat.displayName} className="text-[15px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50" />) : chat.conversationId?.startsWith("secret:") || chat.link?.startsWith("secret-") ? (<>
                  <FaLock size={12} className="shrink-0 text-green-500" />
                  <span className="truncate text-green-500">{renderTextWithEmojis(chat.chatType === "saved" ? t("Избранное") : chat.displayName)}</span>
                </>) : (<VerifiedTitle emojiStatusInteractive={false} kind={chat.chatType === "group" ? "group" : chat.chatType === "channel" ? "channel" : "user"} link={chat.link} isBot={chat.isBot}>{renderTextWithEmojis(chat.chatType === "saved" ? t("Избранное") : chat.displayName)}</VerifiedTitle>)}
                {isChatMuted ? <FaVolumeMute size={12} className="shrink-0 text-zinc-500" /> : null}
              </span>
              <GroupCallListMarker link={chat.chatType === "group" ? chat.link : ""} />
            </div>
            {!isEmptyChat ? (<span className={cn("shrink-0 inline-flex items-center gap-1 pt-0.5 text-[12px] font-medium leading-none text-zinc-500 dark:text-zinc-400", isPinned ? "text-zinc-400 dark:text-zinc-300" : "")}>
              {chat.chatType === "direct" && chat.lastMessageMine ? (<MessageStatusTicks read={isLastDirectMessageRead} />) : null}
              <span className="tabular-nums">{timeLabel}</span>
              {isPinned ? <TiPin size={16} className="shrink-0 text-zinc-300/90 -mr-0.5" /> : null}
            </span>) : null}
          </div>
          {!isEmptyChat ? <div className="mt-0.5 flex items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              {Boolean(sendingLabel) ? (<motion.p key={`sending:${sendingLabel}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }} className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[14px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
                <ActivityStatusIndicator kind="pulse" className="shrink-0" />
                <span className="truncate">{sendingLabel}</span>
              </motion.p>) : Boolean(recordingLabel) ? (<motion.p key={`recording:${recordingLabel}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }} className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[14px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
                <ActivityStatusIndicator kind="pulse" className="shrink-0" />
                <span className="truncate">{recordingLabel}</span>
              </motion.p>) : isTyping ? (<motion.p key={`typing:${chat.chatType}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }} className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[14px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
                <ActivityStatusIndicator kind="typing" className="shrink-0" />
                <span className="truncate">{chat.chatType === "group" ? t("печатают") : t("печатает")}</span>
              </motion.p>) : (<motion.p key={`preview:${preview.kind}:${senderPrefix}:${safePreviewText}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }} className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[14px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
                {senderPrefix ? (<span className="truncate text-zinc-500 dark:text-zinc-400">{senderPrefix}</span>) : null}
                {callPreview ? (callPreview.mode === "video" ? <FiVideo size={15} className="shrink-0 opacity-80" aria-hidden /> : <FiPhone size={15} className="shrink-0 opacity-80" aria-hidden />) : preview.thumbUrl && preview.kind !== "sticker" ? (<ChatListMediaPreview src={preview.thumbUrl} preview={preview.thumbPreview} video={preview.thumbKind === "video" || preview.kind === "video" || preview.kind === "video_note"} round={preview.kind === "video_note"} />) : (<>
                  {preview.kind === "image" || preview.kind === "album" ? <ImageIcon size={14} className="shrink-0 opacity-80" /> : null}
                  {preview.kind === "video" || preview.kind === "video_note" ? <SquarePlay size={14} className="shrink-0 opacity-80" /> : null}
                  {preview.kind === "music" ? <Music2 size={14} className="shrink-0 opacity-80" /> : null}
                  {preview.kind === "voice" ? <Mic size={14} className="shrink-0 opacity-80" /> : null}
                  {preview.kind === "file" ? <Paperclip size={14} className="shrink-0 opacity-80" /> : null}
                  {preview.kind === "poll" ? <ListCollapse size={14} className="shrink-0 opacity-80" /> : null}
                </>)}
                <span className="truncate inline-flex items-center gap-0.5">{renderTextWithEmojis(safePreviewText, { size: 14 })}</span>
              </motion.p>)}
            </AnimatePresence>
            {unreadCount > 0 ? (<span className={`shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${unreadBadgeThemeStyle
              ? "shadow-[0_8px_20px_-10px_rgba(0,0,0,0.65)]"
              : "bg-zinc-300 text-zinc-950 dark:bg-zinc-400 dark:text-zinc-950"}`} style={unreadBadgeThemeStyle}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>) : null}
          </div> : null}
        </div>
      </div>
    </button>
  </motion.div>);
}, (previous, next) => areChatSidebarRowPropsEqual(previous, next, sharedKeys));
