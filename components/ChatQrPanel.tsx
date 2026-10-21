import React from "react";
import ProfileQrPanel from "@/components/ProfileQrPanel";

interface ChatQrPanelProps {
  displayName: string;
  link: string;
  avatarUrl?: string | null;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
}

export default function ChatQrPanel({ displayName, link, avatarUrl, title, onBack, onClose }: ChatQrPanelProps) {
  return (
    <ProfileQrPanel
      displayName={displayName}
      link={link}
      avatarUrl={avatarUrl}
      title={title}
      onBack={onBack}
      onClose={onClose}
    />
  );
}
