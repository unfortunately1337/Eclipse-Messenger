"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import React, { CSSProperties } from "react";
import { ECLIPSE_INLINE_ACTION_CLASS_NAME } from "@/app/app/(chats)/EclipseChatUi";

interface WallpaperSystemBubbleProps {
  messageId: string;
  payload: {
    eventType: string;
    title?: string;
    body?: string;
    metadata?: {
      senderId?: string;
      senderName?: string;
      senderAvatar?: string | null;
      wallpaperUrl?: string;
      wallpaperPosY?: number;
    };
  };
  selfId: string;
  isMine?: boolean;
  peerName?: string;
  isApplied?: boolean;
  dateSeparatorThemeStyle?: CSSProperties;
  onApplyWallpaper?: (url: string, posY?: number) => void;
  applying?: boolean;
}

export function WallpaperSystemBubble({
  payload,
  selfId,
  isMine,
  peerName,
  isApplied = false,
  dateSeparatorThemeStyle,
  onApplyWallpaper,
  applying = false,
}: WallpaperSystemBubbleProps) {
  const t = useTranslation();
  const metadata = payload.metadata ?? {};
  const senderId = metadata.senderId;
  const wallpaperUrl = metadata.wallpaperUrl;
  const wallpaperPosY = metadata.wallpaperPosY ?? 50;

  const isSelf = isMine !== undefined ? isMine : Boolean(senderId && selfId && senderId === selfId);
  const displayName = (!isSelf && peerName) ? peerName : (metadata.senderName || peerName || t("Собеседник"));

  return (
    <div className="flex w-full select-none flex-col items-center gap-2 px-3 py-1.5 text-center">
        {wallpaperUrl ? (
          <img
            src={wallpaperUrl}
            alt={t("Установленные обои")}
            loading="lazy"
            decoding="async"
            width={64}
            height={64}
            className="h-16 w-16 rounded-[12px] object-cover"
            style={{ objectPosition: `50% ${wallpaperPosY}%` }}
          />
        ) : null}
        <span className="chat-service-pill" style={dateSeparatorThemeStyle}>
          {isSelf ? t("Вы установили обои") : t("{0} поставил(а) обои", { 0: displayName })}
        </span>
        {!isSelf && wallpaperUrl ? (
          isApplied ? (
            <span className="text-[11px] opacity-70">{t("Установлено")}</span>
          ) : (
            <button
              type="button"
              onClick={() => onApplyWallpaper?.(wallpaperUrl, wallpaperPosY)}
              disabled={applying || !onApplyWallpaper}
              className={`${ECLIPSE_INLINE_ACTION_CLASS_NAME} max-w-[180px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-default`}
            >
              {applying ? t("Установка…") : t("Поставить обои")}
            </button>
          )
        ) : null}
    </div>
  );
}
