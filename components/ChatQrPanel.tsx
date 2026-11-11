import React from "react";
import ProfileQrPanel from "@/components/ProfileQrPanel";
export { preloadProfileQrPanel as preloadChatQrPanel } from "@/components/ProfileQrPanel";

interface ChatQrPanelProps {
  displayName: string;
  link: string;
  avatarUrl?: string | null;
  title?: string;
  kind?: "group" | "channel";
  onBack?: () => void;
  onClose?: () => void;
}

export default function ChatQrPanel({ displayName, link, avatarUrl, title, kind, onBack, onClose }: ChatQrPanelProps) {
  return (
    <ProfileQrPanel
      displayName={displayName}
      link={link}
      avatarUrl={avatarUrl}
      title={title}
      kind={kind}
      onBack={onBack}
      onClose={onClose}
    />
  );
}
