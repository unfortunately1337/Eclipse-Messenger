"use client";

import { type ChatSummary, type ConversationResponse } from "../types";

export interface PublishTypingActivityContext {
  activeChat: ChatSummary | null;
  activeConversation: ConversationResponse | null;
  typingStopTimerRef: React.RefObject<NodeJS.Timeout | null>;
  isDesktop: boolean;
  selectedLink: string | null;
  messageText: string;
  lastTypingValueRef: React.RefObject<boolean | null>;
  lastTypingSentAtRef: React.RefObject<number>;
  pushTyping: (isTyping: boolean) => Promise<void>;
}

export function publishTypingActivity({ activeChat, activeConversation, typingStopTimerRef, isDesktop, selectedLink, messageText, lastTypingValueRef, lastTypingSentAtRef, pushTyping }: PublishTypingActivityContext): () => void {
  const activeChatType = activeChat?.chatType;
  const activeChatLink = activeChat?.link;
  const isChannel = activeChatType === "channel" || activeConversation?.chatType === "channel";

  if (typingStopTimerRef.current) {
    clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;
  }

  if (isChannel || !activeChatLink || (isDesktop === false && !selectedLink)) {
    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
    };
  }

  const typingNow = Boolean(messageText.trim());
  const now = Date.now();
  const stateChanged = lastTypingValueRef.current !== typingNow;
  const heartbeatDue = now - lastTypingSentAtRef.current > 1800;
  if (stateChanged || heartbeatDue) {
    lastTypingSentAtRef.current = now;
    lastTypingValueRef.current = typingNow;
    void pushTyping(typingNow);
  }

  typingStopTimerRef.current = setTimeout(() => {
    lastTypingValueRef.current = false;
    void pushTyping(false);
  }, 4500);

  return () => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
  };
}
