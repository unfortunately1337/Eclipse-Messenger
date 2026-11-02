"use client";
import AccountPackPicker from "./AccountPackPicker";
export default function TextEmojiPicker({ onSelect, mobile = false }: { onSelect: (value: string) => void; mobile?: boolean }) {
  return <AccountPackPicker kind="emoji" includeDefault showRecent mobile={mobile} onEmoji={onSelect} />;
}
