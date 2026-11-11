"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, type ReactNode } from "react";
import { MessageDeliveryProvider } from "../components/common/MessageStatus";
import type { MessageRowProps } from "./message-row-equality";
import { messageDeletionOffset } from "./message-deletion-layout";
import { readCallMessage } from "@/lib/call-history";

/** Layout moves independently of the expensive bubble/media subtree. */
export function ConversationMessagePosition({ row, shared, children }: MessageRowProps & { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { message, index, top, rowSpacingClassName } = row;
  const { deletingShift, animatedMessageIdsRef, suppressMessageEntranceRef, chatUiSettings, getMessageRowRef } = shared;
  const measure = getMessageRowRef(message.id, message.localId);
  const attach = useCallback((node: HTMLDivElement | null) => {
    measure(node);
    if (!node) return;
    const key = message.localId ?? message.id;
    const enter = !reduced && chatUiSettings.animateMessages && !suppressMessageEntranceRef.current && !animatedMessageIdsRef.current.has(key) && !animatedMessageIdsRef.current.has(message.id);
    animatedMessageIdsRef.current.add(key); animatedMessageIdsRef.current.add(message.id);
    if (enter && node.animate) node.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 140, easing: "cubic-bezier(0.2,0.9,0.3,1)" });
  }, [measure, message.id, message.localId, reduced, chatUiSettings.animateMessages, suppressMessageEntranceRef, animatedMessageIdsRef]);
  const call = shared.activeConversation?.chatType === "direct" ? readCallMessage(message.systemPayload) : null;
  if (message.systemPayload && message.systemPayload.botRole !== "user" && !call) return children;
  const mine = call ? call.callerId === (shared.selfId ?? shared.selfProfile?.id) : shared.activeConversation?.chatType !== "channel" && (message.pending || message.senderId === (shared.selfId ?? shared.selfProfile?.id) || shared.activeConversation?.chatType === "saved");
  const offset = messageDeletionOffset(deletingShift, index);
  const shifted = offset > 0;
  return <MessageDeliveryProvider pending={Boolean(message.pending)} failed={Boolean(message.sendFailure)}>
    <motion.div data-message-id={message.id} data-message-date={message.createdAt} data-message-local-id={message.localId ?? undefined}
      ref={attach}
      initial={false}
      animate={{ opacity: 1, y: -offset }}
      transition={{ duration: !reduced && shifted ? 0.28 : 0, delay: !reduced && shifted ? 0.12 : 0, ease: [0.25, 1, 0.5, 1] }}
      className={`px-0 ${rowSpacingClassName}`}
      style={{ position: "absolute", top, left: 0, right: 0, transformOrigin: mine ? "bottom right" : "bottom left", zIndex: shared.messageHelperId === message.id ? 40 : 10, contain: "layout style", willChange: shifted ? "transform, opacity" : undefined }}>
      {children}
    </motion.div>
  </MessageDeliveryProvider>;
}
