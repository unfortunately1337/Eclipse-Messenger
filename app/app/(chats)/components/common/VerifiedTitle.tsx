"use client";
import type { ReactNode } from "react";
import { useEntityAppearance, type VerificationKind } from "@/lib/client/verification";
import { EmojiStatusBadge } from "@/components/EmojiStatusBadge";
import { VerifiedBadge } from "../../EclipseChatUi";
import { cn } from "@/lib/utils";

export function VerifiedTitle({ children, kind, link, isBot = false, className, showDetails = false, showEmojiStatus = true, badgeSize = 16, statusSize = 20 }: {
  children: ReactNode; kind: VerificationKind; link: string; isBot?: boolean; className?: string; showDetails?: boolean; showEmojiStatus?: boolean; badgeSize?: number; statusSize?: number;
}) {
  const appearance = useEntityAppearance(kind, link);
  return <span data-verification-entity={`${kind}:${link}`} className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
    <span className="min-w-0 truncate">{children}</span>
    {appearance.isVerified && <VerifiedBadge size={badgeSize} kind={kind === "user" && isBot ? "bot" : kind} showDetails={showDetails} />}
    {showEmojiStatus && kind === "user" && <EmojiStatusBadge size={statusSize} id={appearance.emojiStatusId} />}
  </span>;
}
