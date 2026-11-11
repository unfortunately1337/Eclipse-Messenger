import type { ChatSidebarProps } from "./ChatSidebar";

export type ChatSidebarRowProps = {
  row: ChatSidebarProps["virtualChatRows"][number];
  shared: ChatSidebarProps;
  selected: boolean;
  isDirectOnlineVisible: boolean;
  helperOpen: boolean;
  chatOrderKey: string;
};

/** Selection, presence and helpers affect their own row, not every chat. */
export function areChatSidebarRowPropsEqual(previous: ChatSidebarRowProps, next: ChatSidebarRowProps, keys: readonly (keyof ChatSidebarProps)[]) {
  if (previous.selected !== next.selected || previous.isDirectOnlineVisible !== next.isDirectOnlineVisible ||
      previous.helperOpen !== next.helperOpen || previous.chatOrderKey !== next.chatOrderKey) return false;
  const rowKeys = Object.keys(previous.row) as (keyof ChatSidebarRowProps["row"])[];
  if (rowKeys.length !== Object.keys(next.row).length || !rowKeys.every(key => key === "index" || Object.is(previous.row[key], next.row[key]))) return false;
  return keys.every(key => {
    if (key === "selfProfile" && next.row.chat.chatType !== "saved") return true;
    return Object.is(previous.shared[key], next.shared[key]);
  });
}
