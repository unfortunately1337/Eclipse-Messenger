"use client";

import { useMemo } from "react";
import { useStableEvent } from "@/lib/client/use-stable-event";
import { type ConversationMessagesProps } from "./ConversationMessages";
import { type useCalls } from "../hooks/useCalls";
import { type useMessagePins } from "../hooks/useMessagePins";
import { type ChatSidebarProps } from "./ChatSidebar";

type SidebarActions = Pick<ChatSidebarProps,
  "toggleChatListMenuFromButton" | "handleSwitchAccount" |
  "handleAddAccountClick" | "openCreateChat" | "createStoryFromSelection">;

export function useChatSidebarActions(actions: SidebarActions): SidebarActions {
  const toggleChatListMenuFromButton = useStableEvent(actions.toggleChatListMenuFromButton);
  const handleSwitchAccount = useStableEvent(actions.handleSwitchAccount);
  const handleAddAccountClick = useStableEvent(actions.handleAddAccountClick);
  const openCreateChat = useStableEvent(actions.openCreateChat);
  const createStoryFromSelection = useStableEvent(actions.createStoryFromSelection);
  return useMemo(() => ({
    toggleChatListMenuFromButton, handleSwitchAccount,
    handleAddAccountClick, openCreateChat, createStoryFromSelection
  }),
    [toggleChatListMenuFromButton, handleSwitchAccount, handleAddAccountClick,
      openCreateChat, createStoryFromSelection]);
}

type MessageActions = Pick<ConversationMessagesProps,
  "openForwardAuthorProfile" | "beginForwardMessages" | "beginEditMessage" |
  "copyMessageText" | "deleteMessage" | "sendWelcomeSticker">;

/** Message event handlers keep their identity without closing over an old draft,
 * conversation or permission. Render functions deliberately aren't events. */
export function useMessageListActions(actions: MessageActions): MessageActions {
  const openForwardAuthorProfile = useStableEvent(actions.openForwardAuthorProfile);
  const beginForwardMessages = useStableEvent(actions.beginForwardMessages);
  const beginEditMessage = useStableEvent(actions.beginEditMessage);
  const copyMessageText = useStableEvent(actions.copyMessageText);
  const deleteMessage = useStableEvent(actions.deleteMessage);
  const sendWelcomeSticker = useStableEvent(actions.sendWelcomeSticker);
  return useMemo(() => ({
    openForwardAuthorProfile, beginForwardMessages, beginEditMessage,
    copyMessageText, deleteMessage, sendWelcomeSticker,
  }), [openForwardAuthorProfile, beginForwardMessages, beginEditMessage,
    copyMessageText, deleteMessage, sendWelcomeSticker]);
}

export function useMessageListCallControls(calls: ReturnType<typeof useCalls>) {
  const start = useStableEvent(calls.start);
  const { enabled, busy } = calls;
  const hasCurrentCall = Boolean(calls.current);
  return useMemo(() => ({ enabled, busy, current: hasCurrentCall, start }),
    [enabled, busy, hasCurrentCall, start]);
}

export function useMessageListPins(pins: ReturnType<typeof useMessagePins>) {
  const { active, canManage, busy, toggle, pins: items } = pins;
  return useMemo(() => ({ active, canManage, busy, toggle, pins: items }),
    [active, canManage, busy, toggle, items]);
}
