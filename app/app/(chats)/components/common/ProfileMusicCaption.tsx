"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import React, { useEffect, useRef, useState } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { deriveMusicLabel } from "../../chat-message-transport";

export function ProfileMusicCaption({
  url,
  title,
  author,
  coverUrl,
  className,
}: {
  url: string;
  title?: string | null;
  author?: string | null;
  coverUrl?: string | null;
  className?: string;
}) {
  const t = useTranslation();
  const safeUrl = url.trim();
  const safeTitle = (title ?? "").trim() || deriveMusicLabel(safeUrl);
  const safeAuthor = (author ?? "").trim();
  const fullLabel = safeAuthor ? `${safeAuthor} - ${safeTitle}` : safeTitle;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const textWidth = textRef.current.scrollWidth;
        if (containerWidth > 0 && textWidth > containerWidth + 4) {
          setOverflowPx(textWidth - containerWidth + 14);
        } else {
          setOverflowPx(0);
        }
      }
    };

    checkOverflow();
    const timer = setTimeout(checkOverflow, 80);
    const observer = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", checkOverflow);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [fullLabel]);

  if (!safeUrl) return null;

  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("eclipse:music-play", {
            detail: {
              url: safeUrl,
              label: safeTitle,
              title: safeTitle,
              author: safeAuthor,
              coverUrl: (coverUrl ?? "").trim(),
              userInitiated: true,
            },
          }),
        );
      }}
      className={cn(
        "w-full h-7 min-h-[28px] flex items-center justify-center px-3 rounded-none bg-black/25 hover:bg-black/40 backdrop-blur-[2px] transition-colors cursor-pointer text-white select-none border-0",
        className,
      )}
      aria-label={t("Воспроизвести музыку: {0}", { 0: fullLabel })}
    >
      <div
        ref={containerRef}
        className="relative min-w-0 flex-1 overflow-hidden text-[12.5px] leading-tight flex items-center justify-center tracking-tight"
      >
        <span
          ref={textRef}
          style={
            overflowPx > 0
              ? ({
                  "--overflow-shift": `-${overflowPx}px`,
                  animation: `profile-music-bounce ${Math.max(6, Math.min(18, overflowPx * 0.08 + 4))}s ease-in-out infinite alternate`,
                  animationDelay: "1.2s",
                } as React.CSSProperties)
              : undefined
          }
          className="inline-flex items-center gap-1.5 whitespace-nowrap will-change-transform"
        >
          <Music size={13} className="shrink-0 text-white/90" />
          <span>
            {safeAuthor ? (
              <>
                <strong className="font-semibold text-white">{safeAuthor}</strong>
                <span className="text-white/70"> - </span>
              </>
            ) : null}
            <span className="text-white/90 font-normal">{safeTitle}</span>
          </span>
        </span>
      </div>
    </button>
  );
}
