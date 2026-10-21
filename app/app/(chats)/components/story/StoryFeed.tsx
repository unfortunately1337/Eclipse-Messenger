import React, { ChangeEvent, RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PANEL_EASE } from "@/lib/client/panel-motion";
import { cn } from "@/lib/utils";
import { MediaAvatar } from "@/components/ui/media";
import { Skeleton } from "@/components/ui/skeleton";
import { StoryAvatarRing } from "./StoryAvatarRing";
import type { StoryFeedGroup } from "../../types";

export function StoryFeed({
  storiesHidden,
  storiesLoading,
  storyFeed,
  mobileStoryRailGroups,
  storyInputRef,
  openStoryViewer,
  createStoryFromSelection,
}: {
  storiesHidden: boolean;
  storiesLoading: boolean;
  storyFeed: StoryFeedGroup[];
  mobileStoryRailGroups: StoryFeedGroup[];
  storyInputRef: RefObject<HTMLInputElement | null>;
  openStoryViewer: (groupIndex: number, storyIndex: number, source?: HTMLElement) => void;
  createStoryFromSelection: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      id="story-feed-rail" data-story-feed
      aria-hidden={storiesHidden} inert={storiesHidden}
      initial={false}
      animate={storiesHidden ? "hidden" : "visible"}
      variants={{
        hidden: {
          height: 0,
          opacity: 0,
          y: reducedMotion ? 0 : -8,
          transition: { duration: reducedMotion ? 0 : 0.22, ease: PANEL_EASE },
        },
        visible: {
          height: 96,
          opacity: 1,
          y: 0,
          transition: { duration: reducedMotion ? 0 : 0.24, ease: PANEL_EASE },
        }
      }}
      className="relative overflow-hidden px-0 mt-1.5"
    >
      <input
        ref={storyInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => void createStoryFromSelection(event)}
      />
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "min-w-0 flex-1",
            mobileStoryRailGroups.length >= 5 ? "overflow-x-auto no-scrollbar" : "overflow-hidden",
          )}
        >
          <div
            className={cn(
              "flex items-start pr-1",
              mobileStoryRailGroups.length <= 1
                ? "justify-center"
                : mobileStoryRailGroups.length === 2
                  ? "justify-center gap-4"
                  : mobileStoryRailGroups.length === 3
                    ? "justify-center gap-4"
                    : mobileStoryRailGroups.length === 4
                      ? "justify-center gap-3 flex-wrap max-w-[308px] mx-auto"
                      : "justify-start gap-4 w-max",
            )}
          >
            {storiesLoading && storyFeed.length === 0 ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={`story-skeleton-${idx}`} className="flex w-[72px] shrink-0 flex-col items-center gap-2">
                  <Skeleton className="h-[52px] w-[52px] rounded-full" />
                  <Skeleton className="h-3 w-12 rounded-full" />
                </div>
              ))
            ) : (
              <>
                {/* Other user stories */}
                {mobileStoryRailGroups.map((group) => {
                  const groupIndex = storyFeed.findIndex((item) => item.author.id === group.author.id);
                  if (groupIndex < 0) return null;
                  return (
                    <button
                      key={`story-group-${group.author.id}`}
                      type="button"
                      onClick={(event) => openStoryViewer(groupIndex, 0, event.currentTarget)}
                      className="group flex w-[72px] shrink-0 flex-col items-center gap-2 transition-transform duration-200 active:scale-95"
                    >
                      <StoryAvatarRing seen={!group.hasUnviewed} stories={group.stories} className="w-[54px] h-[54px] p-[4px]">
                        <MediaAvatar
                          src={group.author.avatarUrl ?? undefined}
                          alt={group.author.displayName}
                          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                          fallbackText={group.author.displayName.slice(0, 1)}
                          autoPlay
                        />
                      </StoryAvatarRing>
                      <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-zinc-650 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-zinc-100 transition-colors">
                        {group.author.displayName}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
