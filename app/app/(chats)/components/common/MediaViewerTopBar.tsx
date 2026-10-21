"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { ChevronLeft, Download } from "lucide-react";
import { MdDelete } from "react-icons/md";
import { Spinner } from "@/components/ui/spinner";
import { LIQUID_GLASS_STYLE } from "@/components/ui/skiper91";
import { cn } from "@/lib/utils";

export function MediaViewerTopBar({
  authorName,
  authorAvatarUrl,
  dateText,
  galleryText,
  src,
  downloadLabel,
  onDownload,
  isMine,
  onAuthorClick,
  onClose,
  onDelete,
  deleting,
}: {
  authorName: string;
  authorAvatarUrl?: string | null;
  dateText: string;
  galleryText?: string | null;
  src: string;
  downloadLabel: string;
  onDownload?: () => void;
  isMine?: boolean;
  menuOpen?: boolean;
  onToggleMenu?: () => void;
  onAuthorClick?: () => void;
  onClose: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const t = useTranslation();
  const displayName = isMine || authorName === "Вы" ? t("Вы") : authorName;
  const canClickAuthor = !isMine && displayName !== t("Вы") && displayName !== "Вы" && Boolean(onAuthorClick);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center pt-[max(env(safe-area-inset-top),12px)] md:pt-4 pb-3 px-3 sm:px-5 md:px-7 pointer-events-none">
        {/* Left: Back Arrow */}
        <div className="flex items-center justify-start md:justify-end md:pr-28 lg:pr-36 pointer-events-auto">
          <button
            type="button"
            onClick={onClose}
            style={LIQUID_GLASS_STYLE}
            className="flex size-10 md:size-11 shrink-0 items-center justify-center rounded-full border text-white/90 hover:text-white hover:border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xl select-none"
            aria-label={t("Назад")}
            title={t("Назад")}
          >
            <ChevronLeft size={22} strokeWidth={2.4} />
          </button>
        </div>

        {/* Center: Nickname & Date (Dead-Center via 1fr/auto/1fr grid) */}
        <div className="pointer-events-auto flex flex-col items-center justify-center select-none text-center shrink-0 px-2 md:px-0">
          <div
            {...(canClickAuthor ? { onClick: onAuthorClick, role: "button", tabIndex: 0 } : {})}
            style={LIQUID_GLASS_STYLE}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-4 sm:px-5 md:px-6 py-1.5 border shadow-xl text-center transition-all",
              canClickAuthor
                ? "cursor-pointer hover:bg-white/10 active:scale-[0.98]"
                : "cursor-default"
            )}
          >
            <span className="truncate text-[13.5px] md:text-[14px] font-semibold text-white/95 leading-tight max-w-[130px] sm:max-w-[200px] md:max-w-[340px] text-center block">
              {displayName}
            </span>
            <span className="truncate text-[10.5px] md:text-[11px] text-white/60 leading-tight mt-0.5 max-w-[130px] sm:max-w-[200px] md:max-w-[340px] text-center block">
              {dateText}
            </span>
          </div>
          {galleryText ? (
            <div
              style={LIQUID_GLASS_STYLE}
              className="mt-1 flex items-center justify-center rounded-full px-3 py-0.5 border shadow-md text-center"
            >
              <span className="text-[10.5px] md:text-[11px] font-medium text-white/75 leading-tight text-center block">
                {galleryText}
              </span>
            </div>
          ) : null}
        </div>

        {/* Right: Download & Delete Pill */}
        <div className="flex items-center justify-end md:justify-start md:pl-28 lg:pl-36 pointer-events-auto">
          <div
            style={LIQUID_GLASS_STYLE}
            className="flex items-center rounded-full border shadow-xl p-0.5 shrink-0 select-none"
          >
            <a
              href={src}
              download
              className="flex size-9 md:size-10 items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              aria-label={downloadLabel}
              title={t("Сохранить")}
            >
              <Download size={18} />
            </a>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="flex size-9 md:size-10 items-center justify-center rounded-full text-white/90 hover:text-red-300 hover:bg-red-500/20 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                aria-label={deleting ? t("Удаление") : t("Удалить")}
                title={t("Удалить")}
              >
                {deleting ? (
                  <Spinner className="size-4 text-red-400 animate-spin" />
                ) : (
                  <MdDelete size={19} />
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
