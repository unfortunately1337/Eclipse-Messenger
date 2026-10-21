"use client";
import { dateLocale, translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { profileChatUrl } from "@/lib/client/deployment-url";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IProfile } from "@/types/profile.type";
import { CircleEllipsis, Copy, Eye, EyeOff, Heart, Info, Music, QrCode, X } from "lucide-react";
import { MdDelete, MdEdit } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";
import { MediaAvatar, MediaBanner, isRealMediaAvatar } from "@/components/ui/media";
import { AvatarMediaViewerModal } from "../(chats)/components/common/AvatarMediaViewerModal";
import { CollectibleUsernameModal } from "../(chats)/components/common/CollectibleUsernameModal";
import { showAppToast } from "@/lib/client/app-toast";
import { OnlineStatusDot } from "@/components/ui/online-status-dot";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/http";
import { cn } from "@/lib/utils";
import { loadPageCache, savePageCache } from "@/lib/client/page-cache";
import { normalizeStoryOverlay, type StoryMediaTransform, type StoryOverlay } from "@/lib/story-overlay";
import { subscribeSelfProfileUpdated } from "@/lib/client/local-updates";
import { ProfileMusicCaption } from "../(chats)/components/common/ProfileMusicCaption";
import { getEffectiveProfileGradient, isMediaBackgroundUrl } from "@/lib/profile-gradients";

interface Props {
  profile: IProfile & { backgroundUrl?: string };
  isOwner?: boolean;
  emailLabel?: string | null;
}

type StoryFeedItem = {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  durationMs?: number | null;
  caption: string | null;
  overlay?: StoryOverlay | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
  isMine: boolean;
  viewsCount?: number;
};

type StoryViewerItem = {
  id: string;
  link: string;
  displayName: string;
  avatarUrl?: string | null;
  viewedAt: string;
  liked?: boolean;
};

type StoryViewerStats = {
  storyId: string;
  viewsCount: number;
  viewers: StoryViewerItem[];
};

type StoryFeedGroup = {
  author: {
    id: string;
    link: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  hasUnviewed: boolean;
  stories: StoryFeedItem[];
};

function clampStoryMediaTransform(value: Partial<StoryMediaTransform> | null | undefined): StoryMediaTransform {
  const scale = Math.max(0.45, Math.min(3, Number.isFinite(value?.scale) ? Number(value?.scale) : 1));
  const maxOffset = Math.max(0, (scale - 1) / (2 * scale));
  const bgColor = typeof value?.bgColor === "string" && /^#([0-9a-fA-F]{6})$/.test(value.bgColor.trim()) ? value.bgColor.trim() : undefined;
  return {
    scale,
    x: Math.max(-maxOffset, Math.min(maxOffset, Number.isFinite(value?.x) ? Number(value?.x) : 0)),
    y: Math.max(-maxOffset, Math.min(maxOffset, Number.isFinite(value?.y) ? Number(value?.y) : 0)),
    ...(bgColor ? { bgColor } : {}),
  };
}

function buildStoryMediaTransformStyle(transform: Partial<StoryMediaTransform> | null | undefined) {
  const media = clampStoryMediaTransform(transform);
  return {
    transform: `translate3d(${media.x * 100}%, ${media.y * 100}%, 0) scale(${media.scale})`,
    transformOrigin: "center",
  };
}

const PROFILE_STORY_GROUP_CACHE_TTL_MS = 45 * 1000;

function getProfileStoryGroupCacheKey(profileId: string) {
  return `eclipse:profile:stories:${profileId}:v1`;
}

function StoryAvatarRing({
  stories = [],
  isLoading = false,
  children,
  className,
}: {
  stories?: StoryFeedItem[];
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslation();
  const gradientId = useId();
  const N = stories.length || 1;
  const radius = 47.2;
  const circumference = 2 * Math.PI * radius; // ~296.57
  const gap = N > 1 ? 2.8 : 0; // gap size in units
  const segmentLength = (circumference / N) - gap;
  const mergedSegmentLength = circumference / N;

  const [isDark, setIsDark] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "merging" | "morphing" | "spinning">("idle");

  useEffect(() => {
    if (isLoading) {
      setLoadingPhase("merging");
      const t1 = setTimeout(() => {
        setLoadingPhase("morphing");
      }, 350);
      const t2 = setTimeout(() => {
        setLoadingPhase("spinning");
      }, 550);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setLoadingPhase("idle");
    }
  }, [isLoading]);

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

  return (
    <div className={cn("relative w-[92px] h-[92px] flex items-center justify-center shrink-0", className)}>
      {/* Inner wrapper for padding and avatar */}
      <div
        className="absolute rounded-full bg-zinc-50 p-[3px] dark:bg-zinc-950 z-10 flex items-center justify-center"
        style={{
          top: "5px",
          left: "5px",
          right: "5px",
          bottom: "5px",
        }}
      >
        <motion.div
          animate={isLoading ? { scale: 0.92 } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        >
          {children}
        </motion.div>
      </div>

      {/* Circle Loader / Story Ring */}
      <motion.div
        className="absolute inset-0 w-full h-full pointer-events-none select-none z-20"
        style={{ transformOrigin: "center" }}
        animate={loadingPhase === "spinning" ? { rotate: 360 } : { rotate: 0 }}
        transition={
          loadingPhase === "spinning"
            ? { duration: 0.95, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full pointer-events-none select-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00FF88" />
              <stop offset="45%" stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#0066FF" />
            </linearGradient>
          </defs>

          {Array.from({ length: N }).map((_, i) => {
            const story = stories[i];
            const isStoryViewed = story ? story.viewed : false;
            const normalRotation = -90 + i * (360 / N);

            // Determine target stroke color
            let strokeColor = isStoryViewed
              ? (isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.22)")
              : `url(#${gradientId})`;
            if (loadingPhase !== "idle") {
              strokeColor = `url(#${gradientId})`;
            }

            // Determine target dasharray based on unified 8-value representation
            let targetDashArray = "";
            if (loadingPhase === "idle") {
              targetDashArray = `${segmentLength} ${circumference - segmentLength} 0 0 0 0 0 0`;
            } else if (loadingPhase === "merging") {
              targetDashArray = `${mergedSegmentLength} ${circumference - mergedSegmentLength} 0 0 0 0 0 0`;
            } else {
              // phase is "morphing" or "spinning"
              if (i === 0) {
                const mainArc = circumference * 0.42;
                const gap1 = 10;
                const dot = 2.5;
                const gap2 = 8;
                const gap3 = 8;
                const gap4 = Math.max(0, circumference - (mainArc + gap1 + dot + gap2 + dot + gap3 + dot));
                targetDashArray = `${mainArc} ${gap1} ${dot} ${gap2} ${dot} ${gap3} ${dot} ${gap4}`;
              } else {
                targetDashArray = `0 ${circumference} 0 0 0 0 0 0`;
              }
            }

            // Determine animate target for opacity
            let targetOpacity = 1;
            if (loadingPhase === "morphing" || loadingPhase === "spinning") {
              if (i > 0) {
                targetOpacity = 0;
              }
            }

            return (
              <motion.circle
                key={`story-ring-segment-${i}`}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke={strokeColor}
                animate={{
                  rotate: normalRotation,
                  strokeDasharray: targetDashArray,
                  opacity: targetOpacity,
                }}
                style={{
                  transformOrigin: "50px 50px",
                }}
                transition={{
                  duration: loadingPhase === "morphing" ? 0.2 : 0.35,
                  ease: loadingPhase === "morphing" ? "easeOut" : "easeInOut",
                }}
              />
            );
          })}
        </svg>
      </motion.div>
    </div>
  );
}

function pluralizeStoryTime(value: number, forms: [string, string, string]) {
  if (dateLocale() === "en-US") return value === 1 ? forms[0] : forms[2];
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

function formatStoryTime(iso: string) {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - target.getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMinutes < 1) return t("только что");
  if (diffMinutes < 60) {
    return t("{0} {1} назад", { 0: diffMinutes, 1: pluralizeStoryTime(diffMinutes, [t("минуту"), t("минуты"), t("минут")]) });
  }
  if (diffHours < 24) {
    return t("{0} {1} назад", { 0: diffHours, 1: pluralizeStoryTime(diffHours, [t("час"), t("часа"), t("часов")]) });
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTargetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfTargetDay.getTime()) / 86_400_000);
  const timeText = target.toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  if (dayDiff === 1) {
    return t("Вчера в {0}", { 0: timeText });
  }
  return target.toLocaleString(dateLocale(), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).replace(",", dateLocale() === "ru-RU" ? " в" : " at");
}

export default function Profile({ profile: initialProfile, isOwner = false }: Props) {
  const t = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [storyGroup, setStoryGroup] = useState<StoryFeedGroup | null>(() =>
    loadPageCache<StoryFeedGroup | null>(
      getProfileStoryGroupCacheKey(initialProfile.id),
      PROFILE_STORY_GROUP_CACHE_TTL_MS,
    ),
  );
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerPaused, setStoryViewerPaused] = useState(false);
  const [storyViewerProgress, setStoryViewerProgress] = useState(0);
  const [storyViewerMoreOpen, setStoryViewerMoreOpen] = useState(false);
  const [storyDeleteConfirmOpen, setStoryDeleteConfirmOpen] = useState(false);
  const [storyViewerStatsOpen, setStoryViewerStatsOpen] = useState(false);
  const [storyViewerStats, setStoryViewerStats] = useState<StoryViewerStats | null>(null);
  const [storyViewerStatsLoading, setStoryViewerStatsLoading] = useState(false);
  const [profileQrOpen, setProfileQrOpen] = useState(false);
  const [profileQrDataUrl, setProfileQrDataUrl] = useState<string | null>(null);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [collectibleModalUsername, setCollectibleModalUsername] = useState<string | null>(null);
  const viewedStoryIdsRef = useRef<Set<string>>(new Set());
  const storyViewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const storyProgressRafRef = useRef<number | null>(null);
  const storyAdvanceTimerRef = useRef<number | null>(null);
  const storyImageProgressStoryIdRef = useRef<string | null>(null);
  const storyImageProgressElapsedRef = useRef(0);
  const storyViewerProgressRef = useRef(0);
  const storyViewerProgressCommittedAtRef = useRef(0);

  const musicUrl = profile.musicUrl ?? "";
  const musicTitle = (profile.musicTitle ?? "").trim();
  const musicAuthor = (profile.musicAuthor ?? "").trim();
  const musicCoverUrl = (profile.musicCoverUrl ?? "").trim();
  const musicLabel = (() => {
    if (musicTitle) return musicTitle;
    if (!musicUrl) return "";
    try {
      const parsed = new URL(musicUrl, typeof window !== "undefined" ? window.location.origin : undefined);
      const last = parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";
      return decodeURIComponent(last).replace(/\.[^.]+$/u, "").replace(/[_]+/g, " ").trim();
    } catch {
      return "";
    }
  })();
  const hasMusic = Boolean(musicUrl);
  const activeStory = storyGroup?.stories[storyViewerIndex] ?? null;
  const activeStoryOverlay = useMemo(() => normalizeStoryOverlay(activeStory?.overlay), [activeStory?.overlay]);
  const hasStory = Boolean(storyGroup?.stories.length);
  const shareChatUrl = useMemo(() => {
    const normalizedLink = String(profile.link ?? "").trim().replace(/^@+/u, "").toLowerCase();
    if (!normalizedLink) return "";
    return profileChatUrl(normalizedLink);
  }, [profile.link]);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (!isOwner) return;
    return subscribeSelfProfileUpdated((next) => {
      setProfile((prev) => ({
        ...prev,
        link: next.link || prev.link,
        displayName: next.displayName || prev.displayName,
        avatarUrl: next.avatarUrl ?? prev.avatarUrl,
        backgroundUrl: next.backgroundUrl ?? prev.backgroundUrl,
        musicUrl: next.musicUrl ?? prev.musicUrl,
        musicTitle: next.musicTitle ?? prev.musicTitle,
        musicAuthor: next.musicAuthor ?? prev.musicAuthor,
        musicCoverUrl: next.musicCoverUrl ?? prev.musicCoverUrl,
      }));
    });
  }, [isOwner]);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ stories: StoryFeedGroup[] }>("/api/stories", { method: "GET" })
      .then((data) => {
        if (cancelled) return;
        console.log("[Profile Stories GET Success] raw data:", data);
        const norm = (s: string) => String(s || "").trim().replace(/^@+/u, "").toLowerCase();
        const match =
          data.stories?.find(
            (group) =>
              norm(group.author.id) === norm(profile.id) ||
              (norm(group.author.link) === norm(profile.link) && norm(profile.link) !== "скрыт"),
          ) ?? null;
        console.log("[Profile Stories GET Success] profile.id:", profile.id, "profile.link:", profile.link, "match group:", match);
        setStoryGroup(match);
        savePageCache(getProfileStoryGroupCacheKey(profile.id), match);
      })
      .catch((err) => {
        console.error("[Profile Stories GET Error]:", err);
        if (!cancelled) setStoryGroup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.id, profile.link]);

  useEffect(() => {
    if (!storyViewerOpen || !activeStory?.id || activeStory.isMine) return;
    if (viewedStoryIdsRef.current.has(activeStory.id)) return;
    viewedStoryIdsRef.current.add(activeStory.id);
    void apiRequest(`/api/stories/${encodeURIComponent(activeStory.id)}/view`, { method: "POST" }).catch(() => undefined);
    setStoryGroup((prev) =>
      prev
        ? {
            ...prev,
            hasUnviewed: prev.stories.some((story, index) => (index === storyViewerIndex ? false : !story.viewed)),
            stories: prev.stories.map((story, index) =>
              index === storyViewerIndex ? { ...story, viewed: true } : story,
            ),
          }
        : prev,
    );
  }, [activeStory?.id, activeStory?.isMine, storyViewerIndex, storyViewerOpen]);

  const [isStoryOpening, setIsStoryOpening] = useState(false);

  const openProfileStory = useCallback(async () => {
    if (!storyGroup?.stories.length || isStoryOpening) return;
    setIsStoryOpening(true);
    const startTime = Date.now();
    try {
      const data = await apiRequest<{ stories: StoryFeedGroup[] }>("/api/stories", { method: "GET" });
      const norm = (s: string) => String(s || "").trim().replace(/^@+/u, "").toLowerCase();
      const match =
        data.stories?.find(
          (group) =>
            norm(group.author.id) === norm(profile.id) ||
            (norm(group.author.link) === norm(profile.link) && norm(profile.link) !== "скрыт"),
        ) ?? null;
      setStoryGroup(match);
      if (match) {
        savePageCache(getProfileStoryGroupCacheKey(profile.id), match);
      }

      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 1500 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (match && match.stories.length > 0) {
        setStoryViewerIndex(0);
        setStoryViewerOpen(true);
      } else {
        toast.error(t("Истории не найдены"));
      }
    } catch (error) {
      console.error("Failed to load stories:", error);

      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 1500 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (storyGroup && storyGroup.stories.length > 0) {
        setStoryViewerIndex(0);
        setStoryViewerOpen(true);
      } else {
        toast.error(t("Не удалось загрузить истории"));
      }
    } finally {
      setIsStoryOpening(false);
    }
  }, [profile.id, profile.link, storyGroup, isStoryOpening, t]);

  const closeProfileStory = useCallback(() => {
    if (storyAdvanceTimerRef.current) {
      window.clearTimeout(storyAdvanceTimerRef.current);
      storyAdvanceTimerRef.current = null;
    }
    if (storyProgressRafRef.current) {
      cancelAnimationFrame(storyProgressRafRef.current);
      storyProgressRafRef.current = null;
    }
    const video = storyViewerVideoRef.current;
    if (video) {
      video.pause();
    }
    setStoryViewerOpen(false);
    setStoryViewerPaused(false);
    setStoryViewerProgress(0);
    setStoryViewerMoreOpen(false);
    setStoryDeleteConfirmOpen(false);
    setStoryViewerStatsOpen(false);
    setStoryViewerStats(null);
  }, []);

  const stepProfileStory = useCallback((direction: 1 | -1) => {
    setStoryViewerIndex((prev) => {
      if (!storyGroup) return prev;
      const next = prev + direction;
      if (next < 0 || next >= storyGroup.stories.length) {
        if (direction > 0) {
          setStoryViewerOpen(false);
        }
        return prev;
      }
      return next;
    });
  }, [storyGroup]);

  async function loadActiveStoryViewers() {
    if (!activeStory?.id || !activeStory.isMine) return;
    setStoryViewerStatsLoading(true);
    try {
      const data = await apiRequest<StoryViewerStats>(`/api/stories/${encodeURIComponent(activeStory.id)}/viewers`, {
        method: "GET",
      });
      setStoryViewerStats(data);
    } finally {
      setStoryViewerStatsLoading(false);
    }
  }

  useEffect(() => {
    if (storyProgressRafRef.current) {
      cancelAnimationFrame(storyProgressRafRef.current);
      storyProgressRafRef.current = null;
    }
    if (!storyViewerOpen || !activeStory) {
      setStoryViewerProgress(0);
      return;
    }
    if (storyAdvanceTimerRef.current) {
      window.clearTimeout(storyAdvanceTimerRef.current);
      storyAdvanceTimerRef.current = null;
    }

    if (storyViewerPaused || storyViewerMoreOpen || storyViewerStatsOpen) return;

    if (activeStory.mediaType !== "image") {
      setStoryViewerProgress(0);
      storyImageProgressStoryIdRef.current = null;
      storyImageProgressElapsedRef.current = 0;
      return;
    }

    const durationMs = 5000;
    if (storyImageProgressStoryIdRef.current !== activeStory.id) {
      storyImageProgressStoryIdRef.current = activeStory.id;
      storyImageProgressElapsedRef.current = 0;
      storyViewerProgressRef.current = 0;
      storyViewerProgressCommittedAtRef.current = performance.now();
      setStoryViewerProgress(0);
    }
    const startedAt = performance.now() - storyImageProgressElapsedRef.current;
    const tick = () => {
      const now = performance.now();
      const elapsed = now - startedAt;
      storyImageProgressElapsedRef.current = elapsed;
      const nextProgress = Math.max(0, Math.min(1, elapsed / durationMs));

      const previousProgress = storyViewerProgressRef.current;
      const shouldCommit =
        nextProgress >= 1 ||
        Math.abs(nextProgress - previousProgress) >= 0.012 ||
        now - storyViewerProgressCommittedAtRef.current >= 60;

      if (shouldCommit) {
        storyViewerProgressRef.current = nextProgress;
        storyViewerProgressCommittedAtRef.current = now;
        setStoryViewerProgress(nextProgress);
      }

      if (nextProgress < 1) {
        storyProgressRafRef.current = requestAnimationFrame(tick);
      }
    };
    storyProgressRafRef.current = requestAnimationFrame(tick);

    const remainingMs = Math.max(0, durationMs - storyImageProgressElapsedRef.current);
    storyAdvanceTimerRef.current = window.setTimeout(() => {
      storyImageProgressElapsedRef.current = durationMs;
      setStoryViewerProgress(1);
      stepProfileStory(1);
    }, remainingMs);

    return () => {
      if (storyAdvanceTimerRef.current) {
        window.clearTimeout(storyAdvanceTimerRef.current);
        storyAdvanceTimerRef.current = null;
      }
      if (storyProgressRafRef.current) {
        cancelAnimationFrame(storyProgressRafRef.current);
        storyProgressRafRef.current = null;
      }
    };
  }, [activeStory, storyViewerOpen, storyViewerPaused, storyViewerMoreOpen, storyViewerStatsOpen, stepProfileStory]);

  useEffect(() => {
    if (!activeStory || activeStory.mediaType !== "image") return;
    storyImageProgressStoryIdRef.current = activeStory.id;
    storyImageProgressElapsedRef.current = 0;
    setStoryViewerProgress(0);
  }, [activeStory?.id, activeStory?.mediaType]);

  useEffect(() => {
    setStoryViewerMoreOpen(false);
    setStoryDeleteConfirmOpen(false);
    setStoryViewerStatsOpen(false);
    setStoryViewerStats(null);
    setStoryViewerStatsLoading(false);
  }, [activeStory?.id]);

  useEffect(() => {
    if (!storyViewerOpen || !activeStory || activeStory.mediaType !== "video") return;
    const video = storyViewerVideoRef.current;
    if (!video) return;

    const syncProgress = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      if (duration <= 0) {
        setStoryViewerProgress(0);
        return;
      }
      setStoryViewerProgress(Math.max(0, Math.min(1, video.currentTime / duration)));
    };

    syncProgress();
    video.addEventListener("timeupdate", syncProgress);
    video.addEventListener("loadedmetadata", syncProgress);

    return () => {
      video.removeEventListener("timeupdate", syncProgress);
      video.removeEventListener("loadedmetadata", syncProgress);
    };
  }, [activeStory, storyViewerOpen]);

  useEffect(() => {
    const video = storyViewerVideoRef.current;
    if (!video || !storyViewerOpen || activeStory?.mediaType !== "video") return;
    if (storyViewerPaused || storyViewerMoreOpen || storyViewerStatsOpen) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, [activeStory?.id, activeStory?.mediaType, storyViewerMoreOpen, storyViewerOpen, storyViewerPaused, storyViewerStatsOpen]);

  useEffect(() => {
    if (!storyViewerOpen || !storyGroup) return;
    const nextStory = storyGroup.stories[storyViewerIndex + 1] ?? null;
    if (!nextStory) return;

    if (nextStory.mediaType === "image") {
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = nextStory.mediaUrl;
      return () => {
        image.src = "";
      };
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = nextStory.mediaUrl;
    video.load();
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [storyGroup, storyViewerIndex, storyViewerOpen]);

  const buildFallbackLabel = () => {
    if (musicLabel.trim()) return musicLabel;
    return t("Музыка");
  };

  const playInGlobalPlayer = () => {
    if (!hasMusic) return;
    const playPayload = {
      url: musicUrl,
      label: buildFallbackLabel(),
      title: musicTitle || buildFallbackLabel(),
      author: musicAuthor,
      coverUrl: musicCoverUrl,
      userInitiated: true,
    };
    if (typeof window !== "undefined" && (window as any).eclipseGlobalMusicPlay) {
      (window as any).eclipseGlobalMusicPlay(playPayload);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("eclipse:music-play", {
        detail: playPayload,
      }),
    );
  };

  useEffect(() => {
    if (!profileQrOpen || !shareChatUrl) return;
    let cancelled = false;
    setProfileQrDataUrl(null);
    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(shareChatUrl, {
          margin: 1,
          width: 320,
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setProfileQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setProfileQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profileQrOpen, shareChatUrl]);

  return (
    <div
      className={cn(
        "w-full max-w-none md:max-w-xl mx-auto p-0 md:p-5",
        isOwner ? "min-h-[100dvh] bg-zinc-950" : "",
      )}
    >
      <motion.div
        initial={{ opacity: 0, x: 26 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-none border-0 shadow-none md:rounded-[2rem] md:bg-white md:dark:bg-zinc-950 md:border md:border-zinc-200 md:dark:border-zinc-800 md:shadow-2xl",
          isOwner ? "bg-zinc-950" : "bg-transparent",
        )}
      >
        <div className="relative h-32 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setProfileQrOpen(true)}
            className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-zinc-950/28 text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors hover:bg-zinc-950/38 active:scale-95"
            aria-label={t("Показать QR-код профиля")}
          >
            <QrCode size={19} />
          </button>

          {isOwner ? (
            <button
              type="button"
              onClick={() => router.push("/app?settings=edit")}
              className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-zinc-950/28 text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors hover:bg-zinc-950/38 active:scale-95"
              aria-label={t("Редактировать профиль")}
            >
              <MdEdit size={20} />
            </button>
          ) : null}

          {(() => {
            const effectiveGradient = getEffectiveProfileGradient(
              profile.backgroundUrl,
              profile.displayName,
              profile.link
            );

            if (isMediaBackgroundUrl(profile.backgroundUrl)) {
              return (
                <MediaBanner
                  src={profile.backgroundUrl}
                  className="absolute inset-0"
                  mediaClassName="transition-transform duration-700 hover:scale-105"
                  autoPlay
                  alt="profile banner"
                />
              );
            }

            if (effectiveGradient) {
              return (
                <div
                  className="absolute inset-0 transition-all duration-300"
                  style={{
                    background: effectiveGradient,
                  }}
                />
              );
            }

            return <div className="absolute inset-0 bg-transparent" />;
          })()}

          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-zinc-950 via-zinc-950/20 to-transparent" />
        </div>

        <div className="relative px-5 pb-5">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-2 md:gap-3.5 mb-3.5 -mt-10">
            <motion.div whileHover={{ scale: 1.05 }} className="relative group z-10">
              <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-purple-500 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-500" />
              {hasStory ? (
                <button
                  type="button"
                  onClick={openProfileStory}
                  aria-label={t("Открыть историю {0}", { 0: profile.displayName })}
                  disabled={isStoryOpening}
                  className="relative w-[92px] h-[92px] flex items-center justify-center shrink-0 focus:outline-none"
                >
                  <StoryAvatarRing
                    stories={storyGroup?.stories ?? []}
                    isLoading={isStoryOpening}
                  >
                    <MediaAvatar
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      className="w-full h-full shadow-2xl"
                      fallbackText={profile.displayName.trim().slice(0, 1)}
                      autoPlay
                    />
                  </StoryAvatarRing>
                </button>
              ) : (
                <div
                  onClick={() => {
                    if (isRealMediaAvatar(profile.avatarUrl)) {
                      setShowAvatarViewer(true);
                    }
                  }}
                  className={cn(
                    "relative rounded-full",
                    isRealMediaAvatar(profile.avatarUrl) &&
                      "cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.97]"
                  )}
                  title={isRealMediaAvatar(profile.avatarUrl) ? t("Нажмите, чтобы просмотреть фотографию") : undefined}
                >
                  <MediaAvatar
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-20 h-20 shadow-2xl"
                    fallbackText={profile.displayName.trim().slice(0, 1)}
                    autoPlay
                  />
                </div>
              )}
            </motion.div>

          <div className="flex-1 text-center md:text-left space-y-0 pb-1">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{profile.displayName}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              <span>{profile.link}</span>
              {profile.secondaryLinks && profile.secondaryLinks.length > 0 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 block sm:inline sm:ml-1.5 font-normal">
                  {t("а также")}{" "}
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {profile.secondaryLinks.map((l, idx) => (
                      <span key={l}>
                        {idx > 0 && ", "}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollectibleModalUsername(l);
                          }}
                          className="cursor-pointer transition-colors duration-150 inline-block rounded-[6px] px-1 py-0.5 -mx-1 -my-0.5 hover:bg-zinc-200/70 dark:hover:bg-white/10 active:bg-zinc-300 dark:active:bg-white/15 text-zinc-900 dark:text-white select-none"
                        >
                          @{l.replace(/^@+/, "")}
                        </span>
                      </span>
                    ))}
                  </span>
                </span>
              )}
            </p>
          </div>
          </div>

          {hasMusic ? (
            <div className="w-full mb-4 overflow-hidden rounded-[14px]">
              <ProfileMusicCaption
                url={musicUrl}
                title={musicTitle}
                author={musicAuthor}
                coverUrl={musicCoverUrl}
              />
            </div>
          ) : null}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[1.5rem] p-4 border border-zinc-100 dark:border-zinc-800 mb-4"
          >
            <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
              <Info size={13} className="shrink-0" />
              <span>{t("О себе")}</span>
            </h4>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed italic text-sm">
              {profile.description || t("Этот пользователь предпочел оставить раздел пустым.")}
            </p>
          </motion.div>

        </div>
      </motion.div>

      <AnimatePresence>
        {profileQrOpen ? (
          <motion.div
            className="fixed inset-0 z-[89] flex items-end justify-center bg-black/60 backdrop-blur-[5px] sm:px-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={() => setProfileQrOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full rounded-t-[32px] border border-b-0 border-white/10 bg-zinc-950 px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-6 text-white shadow-[0_-24px_70px_rgba(0,0,0,0.5)] sm:mb-4 sm:max-w-md sm:rounded-[32px] sm:border sm:pb-5"
            >
              <div className="absolute top-4 right-4 z-10">
                <button
                  type="button"
                  onClick={() => setProfileQrOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label={t("Закрыть")}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-col items-center text-center">
                <MediaAvatar
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="h-16 w-16 border border-white/10 shadow-[0_14px_34px_rgba(0,0,0,0.36)]"
                  fallbackText={profile.displayName.trim().slice(0, 1)}
                  autoPlay
                />
                <div className="mt-3 min-w-0">
                  <div className="truncate text-xl font-black leading-6">{profile.displayName}</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    <span>{profile.link}</span>
                    {profile.secondaryLinks && profile.secondaryLinks.length > 0 && (
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {t("а также")}{" "}
                        <span className="font-semibold text-white">
                          {profile.secondaryLinks.map((l, idx) => (
                            <span key={l}>
                              {idx > 0 && ", "}
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCollectibleModalUsername(l);
                                }}
                                className="cursor-pointer transition-colors duration-150 inline-block rounded-[6px] px-1 py-0.5 -mx-1 -my-0.5 hover:bg-white/10 active:bg-white/15 text-white select-none"
                              >
                                @{l.replace(/^@+/, "")}
                              </span>
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-6 flex w-full max-w-[312px] items-center justify-center rounded-[30px] bg-white p-4 shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
                <div className="flex aspect-square w-full items-center justify-center rounded-[22px] bg-white">
                  {profileQrDataUrl ? (
                    <img src={profileQrDataUrl} alt={`QR ${profile.displayName}`} className="h-full w-full rounded-[18px]" />
                  ) : (
                    <div className="text-sm font-medium text-zinc-500">{t("Генерация QR...")}</div>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={() => {
                  if (!shareChatUrl) return;
                  navigator.clipboard.writeText(shareChatUrl);
                  toast.success(t("Ссылка на чат скопирована"));
                }}
                className="mt-5 h-12 w-full rounded-full border border-white/10 bg-white text-[15px] font-black text-zinc-950 shadow-[0_12px_34px_rgba(255,255,255,0.08)] hover:bg-zinc-100"
              >
                <Copy size={17} />
                {t("Скопировать ссылку")}</Button>
            </motion.div>
          </motion.div>
        ) : null}
        {storyViewerOpen && storyGroup && activeStory ? (
          <motion.div
            className="fixed inset-0 z-[200] bg-black/95 md:bg-[radial-gradient(circle_at_top,rgba(39,39,42,0.55),rgba(0,0,0,0.96)_58%)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="absolute inset-x-0 top-0 z-10 px-3 pt-[max(env(safe-area-inset-top),20px)] md:px-6">
              <div className="mx-auto max-w-[430px] md:max-w-[430px]">
                <div className="mb-3 flex items-center gap-1.5">
                  {storyGroup.stories.map((story, index) => {
                    const segmentProgress = index < storyViewerIndex ? 1 : index === storyViewerIndex ? storyViewerProgress : 0;
                    return (
                      <div key={`profile-story-progress-${story.id}`} className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-100"
                          style={{ width: `${Math.max(0, Math.min(100, segmentProgress * 100))}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <MediaAvatar
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="h-10 w-10"
                    fallbackText={profile.displayName.slice(0, 1)}
                    autoPlay
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-tight text-white">{activeStory.isMine ? t("Моя история") : profile.displayName}</p>
                    <p className="truncate text-sm text-white/68">{formatStoryTime(activeStory.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {false ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        await apiRequest(`/api/stories/${encodeURIComponent(activeStory!.id)}`, { method: "DELETE" }).catch(() => undefined);
                        setStoryGroup((prev) =>
                          prev
                            ? {
                                ...prev,
                                stories: prev.stories.filter((story) => story.id !== activeStory!.id),
                              }
                            : prev,
                        );
                        setStoryViewerOpen(false);
                      }}
                      className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/15"
                      aria-label={t("Удалить историю")}
                    >
                      <MdDelete size={17} />
                    </Button>
                  ) : null}
                  {activeStory.isMine ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setStoryViewerMoreOpen(false);
                          setStoryViewerPaused(true);
                          setStoryViewerStatsOpen(true);
                          void loadActiveStoryViewers();
                        }}
                        className="h-9 w-9 rounded-full border-0 bg-transparent text-white/90 shadow-none hover:bg-transparent hover:text-white focus-visible:border-transparent focus-visible:ring-0"
                        aria-label={t("Открыть статистику просмотров истории")}
                      >
                        <Eye size={16} />
                      </Button>
                      <div className="relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setStoryViewerPaused(storyViewerMoreOpen ? false : true);
                            setStoryViewerMoreOpen((prev) => !prev);
                          }}
                          className="h-9 w-9 rounded-full border-0 bg-transparent text-white/90 shadow-none hover:bg-transparent hover:text-white focus-visible:border-transparent focus-visible:ring-0"
                          aria-label={t("Действия с историей")}
                        >
                          <CircleEllipsis size={17} />
                        </Button>
                        <AnimatePresence>
                          {storyViewerMoreOpen ? (
                            <motion.div
                              className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[176px] rounded-2xl bg-zinc-950/98 p-1.5 shadow-2xl backdrop-blur-md"
                              initial={{ opacity: 0, y: -8, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.97 }}
                              transition={{ duration: 0.16, ease: "easeOut" }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setStoryViewerMoreOpen(false);
                                  setStoryDeleteConfirmOpen(true);
                                }}
                                className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left text-sm font-medium text-red-300 transition-colors hover:bg-white/5"
                              >
                                <MdDelete size={17} />
                                <span>{t("Удалить")}</span>
                              </button>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={closeProfileStory}
                    className="h-9 w-9 rounded-full border-0 bg-transparent text-white/90 shadow-none hover:bg-transparent hover:text-white focus-visible:border-transparent focus-visible:ring-0"
                    aria-label={t("Закрыть")}
                  >
                    <X size={18} />
                  </Button>
                </div>
              </div>
            </div>
            </div>

            <AnimatePresence>
              {storyViewerMoreOpen ? (
                <motion.button
                  type="button"
                  className="absolute inset-0 z-[9]"
                  onClick={() => {
                    setStoryViewerMoreOpen(false);
                    setStoryViewerPaused(false);
                  }}
                  aria-label={t("Закрыть меню истории")}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                />
              ) : null}
            </AnimatePresence>

            <button
              type="button"
              className="absolute inset-y-0 left-0 z-[2] w-1/3"
              onClick={() => stepProfileStory(-1)}
              aria-label={t("Предыдущая история")}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-[2] w-1/3"
              onClick={() => stepProfileStory(1)}
              aria-label={t("Следующая история")}
            />

            <div
              className={cn(
                "flex h-full w-full items-center justify-center px-0 pt-0",
                "pb-0 md:pb-6",
              )}
            >
              <div className="flex h-full w-full items-center justify-center md:max-w-[430px]">
                <div
                  className="relative flex h-full w-full max-w-none items-center justify-center overflow-hidden rounded-none md:h-[min(100%,820px)] md:max-w-[430px] md:rounded-[32px] md:border md:border-white/10 md:shadow-[0_20px_70px_rgba(0,0,0,0.45)]"
                  style={{ backgroundColor: clampStoryMediaTransform(activeStoryOverlay.media).bgColor ?? "#151515" }}
                >
                  {activeStory.mediaType === "video" ? (
                    <video
                      ref={storyViewerVideoRef}
                      key={activeStory.id}
                      src={activeStory.mediaUrl}
                      className="h-full w-full object-contain"
                      style={buildStoryMediaTransformStyle(activeStoryOverlay.media)}
                      autoPlay
                      playsInline
                      controls={false}
                      preload="metadata"
                      controlsList="nodownload nofullscreen noplaybackrate noremoteplayback"
                      disablePictureInPicture
                      disableRemotePlayback
                      onEnded={() => stepProfileStory(1)}
                    />
                  ) : (
                    <img
                      src={activeStory.mediaUrl}
                      alt={activeStory.caption ?? profile.displayName}
                      className="h-full w-full object-contain"
                      style={buildStoryMediaTransformStyle(activeStoryOverlay.media)}
                    />
                  )}
                  {activeStoryOverlay.strokes.length > 0 ? (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                      {activeStoryOverlay.strokes.map((stroke) => (
                        <polyline
                          key={stroke.id}
                          points={stroke.points.map((point) => `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`).join(" ")}
                          fill="none"
                          stroke={stroke.color}
                          strokeWidth={Math.max(1, stroke.width * 2)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </svg>
                  ) : null}
                  {activeStoryOverlay.texts.map((layer) => (
                    <div
                      key={layer.id}
                      className="pointer-events-none absolute select-none whitespace-pre-wrap px-1 text-center font-semibold [text-shadow:0_2px_14px_rgba(0,0,0,0.8)]"
                      style={{
                        left: `${layer.x * 100}%`,
                        top: `${layer.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                        color: layer.color,
                        fontSize: `${layer.size}px`,
                      }}
                    >
                      {layer.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[max(env(safe-area-inset-bottom),14px)] md:px-6">
              <div className="mx-auto flex max-w-[430px] flex-col gap-3">
                {activeStory.caption?.trim() ? (
                  <div className="rounded-[22px] bg-zinc-900/38 px-4 py-3 text-sm leading-6 text-white/94 backdrop-blur-md">
                    {activeStory.caption}
                  </div>
                ) : null}
              </div>
            </div>
            <AnimatePresence>
              {activeStory ? (
                <ConfirmationSheet
                  open={storyDeleteConfirmOpen}
                  onOpenChange={setStoryDeleteConfirmOpen}
                  title={t("Удалить историю?")}
                  description={t("История исчезнет у всех и восстановить ее уже не получится.")}
                  actionLabel={t("Удалить")}
                  actionIcon={MdDelete}
                  onAction={async () => {
                    const targetId = activeStory.id;
                    setStoryDeleteConfirmOpen(false);
                    // Close the viewer immediately and reset all player animations and timers
                    closeProfileStory();

                    // Optimistically remove the story from state to update UI immediately
                    setStoryGroup((prev) => {
                      if (!prev) return null;
                      const nextStories = prev.stories.filter((story) => story.id !== targetId);
                      return {
                        ...prev,
                        stories: nextStories,
                        hasUnviewed: nextStories.some((story) => !story.viewed),
                      };
                    });

                    // Update cache instantly
                    if (storyGroup) {
                      savePageCache(getProfileStoryGroupCacheKey(profile.id), {
                        ...storyGroup,
                        stories: storyGroup.stories.filter((story) => story.id !== targetId),
                      });
                    }

                    // Perform deletion on backend
                    try {
                      await apiRequest(`/api/stories/${encodeURIComponent(targetId)}`, { method: "DELETE" });
                      toast.success(t("История удалена"));
                    } catch (error) {
                      console.error("Failed to delete story on server:", error);
                      toast.error(t("Не удалось удалить историю с сервера"));
                    }
                  }}
                  backdropClassName="bg-black/50"
                  zIndex={220}
                />
              ) : null}
              {storyViewerStatsOpen && activeStory.isMine ? (
                <>
                  <motion.button
                    type="button"
                    className="absolute inset-0 z-20 bg-black/40"
                    onClick={() => {
                      setStoryViewerStatsOpen(false);
                      setStoryViewerPaused(false);
                    }}
                    aria-label={t("Закрыть статистику просмотров")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                  <motion.div
                    className="absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md rounded-t-xl bg-zinc-800 px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 shadow-2xl"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3 px-1">
                      <div>
                        <p className="font-sans text-[17px] font-semibold text-white/95">{t("Просмотры")}</p>
                      </div>
                    </div>
                    <div className="max-h-[42dvh] space-y-1 overflow-y-auto pr-1">
                      {storyViewerStatsLoading ? (
                        <div className="flex items-center justify-center py-10 text-zinc-400">
                          <Spinner className="h-5 w-5" />
                        </div>
                      ) : storyViewerStats?.viewers.length ? (
                        storyViewerStats.viewers.map((viewer) => (
                          <div
                            key={`profile-story-viewer-${viewer.id}-${viewer.viewedAt}`}
                            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-white/[0.04]"
                          >
                            <div className="relative">
                              <MediaAvatar
                                src={viewer.avatarUrl ?? undefined}
                                alt={viewer.displayName}
                                className="h-10 w-10 ring-1 ring-white/10"
                                fallbackText={viewer.displayName.slice(0, 1)}
                                autoPlay
                              />
                              {viewer.liked ? (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-[2.5px] border-zinc-800 bg-red-500 shadow-sm">
                                  <Heart size={9} fill="white" className="text-white" />
                                </span>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white/90">{viewer.displayName}</p>
                              <p className="truncate text-[11px] font-medium text-zinc-500">@{viewer.link}</p>
                            </div>
                            <div className="shrink-0 text-xs font-medium text-zinc-500 bg-white/[0.05] px-2 py-0.5 rounded-full">{formatStoryTime(viewer.viewedAt)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-zinc-500/80">
                          <EyeOff size={18} className="text-zinc-500/60" />
                          <p className="text-xs font-medium text-zinc-500">{t("еще никто не посмотрел")}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AvatarMediaViewerModal
        open={Boolean(showAvatarViewer && isRealMediaAvatar(profile.avatarUrl))}
        onClose={() => setShowAvatarViewer(false)}
        mediaUrl={profile.avatarUrl}
        title={profile.displayName}
        timestamp={isOwner ? profile.avatarUploadedAt : undefined}
        showUploadTimestamp={isOwner}
        fallbackText={profile.displayName.trim().slice(0, 1)}
        zIndex={350}
      />

      <CollectibleUsernameModal
        isOpen={Boolean(collectibleModalUsername)}
        username={collectibleModalUsername}
        onClose={() => setCollectibleModalUsername(null)}
        showToast={showAppToast}
        isSelf={Boolean(isOwner)}
        ownerName={isOwner ? t("вам") : profile.displayName}
      />
    </div>
  );
}
