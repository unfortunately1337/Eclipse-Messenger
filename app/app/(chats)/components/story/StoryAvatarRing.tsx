"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import React, { useState, useEffect, useId, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MediaAvatar } from "@/components/ui/media";
import type { StoryFeedGroup } from "../../types";
import { pluralizeStoryTime } from "../../helpers";
export { pluralizeStoryTime };

const getArcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const startX = cx + r * Math.cos(startRad);
  const startY = cy + r * Math.sin(startRad);
  const endX = cx + r * Math.cos(endRad);
  const endY = cy + r * Math.sin(endRad);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
};

export function StoryAvatarRing({
  className,
  innerClassName,
  seen,
  thick,
  animateOnMount = false,
  stories,
  children,
}: {
  className?: string;
  innerClassName?: string;
  seen: boolean;
  thick?: boolean;
  animateOnMount?: boolean;
  stories?: Array<{ viewed: boolean }>;
  children: ReactNode;
}) {
  const t = useTranslation();
  const gradientId = useId();
  const list = stories && stories.length > 0 ? stories : [{ viewed: seen }];
  const N = list.length;
  const strokeWidth = thick ? 3.6 : 2.8;
  const radius = 50 - strokeWidth / 2 - 0.5;
  const gapDegrees = N > 1 ? (N === 2 ? 8 : N === 3 ? 6 : N === 4 ? 5 : N === 5 ? 4.5 : 4) : 0;
  const segmentTotal = 360 / N;
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }
  }, []);

  let insetOffset = "4.5px";
  if (className) {
    const padMatch = className.match(/p-\[([^\]]+)\]/);
    if (padMatch) {
      insetOffset = padMatch[1];
    } else if (className.includes("p-0")) {
      insetOffset = "0px";
    }
  }

  return (
    <div className={cn("relative shrink-0 flex items-center justify-center", className)}>
      <div
        className={cn("absolute rounded-full overflow-hidden flex items-center justify-center pointer-events-auto", innerClassName)}
        style={{
          top: insetOffset,
          left: insetOffset,
          right: insetOffset,
          bottom: insetOffset,
        }}
      >
        {children}
      </div>

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-visible"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FF88" />
            <stop offset="45%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#0066FF" />
          </linearGradient>
        </defs>
        {N === 1 ? (
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={list[0].viewed
              ? (isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.22)")
              : `url(#${gradientId})`
            }
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              transformOrigin: "50% 50%",
              rotate: -90,
            }}
            initial={animateOnMount ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ pathLength: 0, opacity: 0 }}
            transition={{
              pathLength: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.22, ease: "easeOut" },
            }}
          />
        ) : (
          list.map((story, i) => {
            const startAngle = -90 + i * segmentTotal + gapDegrees / 2;
            const endAngle = -90 + (i + 1) * segmentTotal - gapDegrees / 2;
            const pathData = getArcPath(50, 50, radius, startAngle, endAngle);
            const strokeColor = story.viewed
              ? (isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.22)")
              : `url(#${gradientId})`;
            return (
              <motion.path
                key={`story-segment-${i}`}
                d={pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                initial={animateOnMount ? { pathLength: 0, opacity: 0 } : false}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{
                  pathLength: { duration: 0.65, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.2, ease: "easeOut" },
                }}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

export function StoryCompactStack({
  groups,
  onToggle,
  expanded,
  className,
  sizeClass = "h-6 w-6",
}: {
  groups: StoryFeedGroup[];
  onToggle: () => void;
  expanded: boolean;
  className?: string;
  sizeClass?: string;
}) {
  const t = useTranslation();
  if (!groups.length) return null;
  return (
    <div className={cn("flex items-center -space-x-2.5", className)}>
      {groups.slice(0, 3).map((group) => (
        <button
          key={`story-stack-${group.author.id}`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className={cn("relative shrink-0 rounded-full transition-transform hover:z-10 hover:scale-[1.04]", sizeClass)}
          aria-label={expanded ? t("Свернуть истории") : t("Показать истории")}
          aria-expanded={expanded}
          aria-controls="story-feed-rail"
        >
          <StoryAvatarRing
            seen={!group.hasUnviewed}
            className={cn("w-full h-full p-[1.5px] shadow-none", sizeClass)}
            innerClassName="p-[0.5px]"
          >
            <MediaAvatar
              src={group.author.avatarUrl ?? undefined}
              alt={group.author.displayName}
              className="h-full w-full"
              fallbackText={group.author.displayName.slice(0, 1)}
              autoPlay
            />
          </StoryAvatarRing>
        </button>
      ))}
    </div>
  );
}
