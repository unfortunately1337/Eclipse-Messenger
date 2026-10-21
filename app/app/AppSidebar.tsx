"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { GiNestedEclipses } from "react-icons/gi";
import { usePathname } from "next/navigation";
import { MessageCircleMore, UserRound, UsersRound } from "lucide-react";
import { subscribeSelfProfileUpdated } from "@/lib/client/local-updates";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type AppSidebarProps = {
  profileLink: string;
};

function StoryAvatarRing({
  className,
  innerClassName,
  seen,
  thick,
  stories,
  children,
}: {
  className?: string;
  innerClassName?: string;
  seen: boolean;
  thick?: boolean;
  stories?: Array<{ viewed: boolean }>;
  children: React.ReactNode;
}) {
  const t = useTranslation();
  const gradientId = useId();
  const list = stories && stories.length > 0 ? stories : [{ viewed: seen }];
  const N = list.length;
  const strokeWidth = thick ? 4.2 : 3.2;
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

  const getArcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  let insetOffset = "3px";
  if (className) {
    const padMatch = className.match(/p-\[([^\]]+)\]/);
    if (padMatch) {
      insetOffset = padMatch[1];
    } else if (className.includes("p-0")) {
      insetOffset = "0px";
    }
  }

  return (
    <div className={`relative shrink-0 flex items-center justify-center ${className || ""}`}>
      <div
        className={`rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center absolute ${innerClassName || ""}`}
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
        className="absolute inset-0 w-full h-full pointer-events-none"
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
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={list[0].viewed
              ? (isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.22)")
              : `url(#${gradientId})`
            }
            strokeWidth={strokeWidth}
            className="transition-colors duration-300"
          />
        ) : (
          list.map((story: any, i: number) => {
            const startAngle = -90 + i * segmentTotal + gapDegrees / 2;
            const endAngle = -90 + (i + 1) * segmentTotal - gapDegrees / 2;
            const pathData = getArcPath(50, 50, radius, startAngle, endAngle);
            const strokeColor = story.viewed
              ? (isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.22)")
              : `url(#${gradientId})`;
            return (
              <path
                key={i}
                d={pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="transition-colors duration-300"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

export default function AppSidebar({ profileLink }: AppSidebarProps) {
  const t = useTranslation();
  const pathname = usePathname();
  const profileHref = `/app/${profileLink}`;
  const isProfile = pathname === profileHref || pathname.startsWith(`${profileHref}/`);
  const isChats = pathname === "/app";
  const isContacts = pathname.startsWith("/app/contacts");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const lastId = window.localStorage.getItem("eclipse:cache:self-profile:last:v2") || window.localStorage.getItem("eclipse:active-user-id");
      if (lastId) {
        const cached = window.localStorage.getItem(`eclipse:cache:self-profile:${lastId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed?.me?.avatarUrl || null;
        }
      }
    } catch {}
    return null;
  });
  const [displayName, setDisplayName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const lastId = window.localStorage.getItem("eclipse:cache:self-profile:last:v2") || window.localStorage.getItem("eclipse:active-user-id");
      if (lastId) {
        const cached = window.localStorage.getItem(`eclipse:cache:self-profile:${lastId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed?.me?.displayName || "";
        }
      }
    } catch {}
    return "";
  });
  const [stories, setStories] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const lastId = window.localStorage.getItem("eclipse:active-user-id");
      if (lastId) {
        const cachedStories = window.sessionStorage.getItem(`eclipse:cache:story-feed:${lastId}`);
        if (cachedStories) {
          const parsed = JSON.parse(cachedStories);
          if (Array.isArray(parsed?.stories)) {
            const ownGroup = parsed.stories.find((group: any) => group.author?.link === profileLink);
            return ownGroup?.stories || [];
          }
        }
      }
    } catch {}
    return [];
  });
  const [seen, setSeen] = useState<boolean>(true);

  useEffect(() => {
    // Listen for live self profile updates (e.g. settings changes)
    const unsub = subscribeSelfProfileUpdated((updated) => {
      if (updated.avatarUrl !== undefined) {
        setAvatarUrl(updated.avatarUrl || null);
      }
      if (updated.displayName) {
        setDisplayName(updated.displayName);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    // If not cached, fetch profile once
    if (!avatarUrl || !displayName) {
      fetch("/api/settings/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.avatarUrl) setAvatarUrl(data.avatarUrl);
          if (data && data.displayName) setDisplayName(data.displayName);
        })
        .catch(() => {});
    }

    // Read stories from session cache or fallback fetch
    try {
      const lastId = typeof window !== "undefined" ? window.localStorage.getItem("eclipse:active-user-id") : null;
      if (lastId) {
        const cachedStories = window.sessionStorage.getItem(`eclipse:cache:story-feed:${lastId}`);
        if (cachedStories) {
          const parsed = JSON.parse(cachedStories);
          if (Array.isArray(parsed?.stories)) {
            const ownGroup = parsed.stories.find((group: any) => group.author?.link === profileLink);
            if (ownGroup) {
              setStories(ownGroup.stories || []);
              setSeen(!ownGroup.hasUnviewed);
              return;
            }
          }
        }
      }
    } catch {}

    fetch("/api/stories")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.stories) {
          const ownGroup = data.stories.find((group: any) => group.author.link === profileLink);
          if (ownGroup) {
            setStories(ownGroup.stories || []);
            setSeen(!ownGroup.hasUnviewed);
          }
        }
      })
      .catch(() => {});
  }, [profileLink, avatarUrl, displayName]);

  const items = [
    { href: "/app", label: t("Чаты"), icon: MessageCircleMore, active: isChats },
    { href: "/app/contacts", label: t("Контакты"), icon: UsersRound, active: isContacts },
    { href: profileHref, label: t("Профиль"), icon: UserRound, active: isProfile },
  ];

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="pt-1 pb-0 px-2">
        <SidebarMenu className="gap-0">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="h-auto w-full justify-center rounded-xl p-0 hover:bg-transparent data-[active=true]:bg-transparent"
            >
              <Link href="/app" className="flex w-full items-center justify-center py-4">
                <GiNestedEclipses className="h-10 w-10 text-white transition-transform hover:scale-105 active:scale-95" aria-hidden />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="pt-0">
        <SidebarGroup className="px-2 pt-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.active}
                    tooltip={t(item.label ?? "")}
                    className="h-9 rounded-lg px-2.5 text-sm"
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(item.label ?? "")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
        <SidebarMenu className="pt-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-10 rounded-lg px-2.5 text-sm">
              <Link href={profileHref} className="flex items-center gap-2">
                {stories.length > 0 ? (
                  <StoryAvatarRing seen={seen} stories={stories} className="w-7 h-7">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-5 h-5 object-cover rounded-full" />
                    ) : (
                      <UserRound className="w-5 h-5" />
                    )}
                  </StoryAvatarRing>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-6 h-6 object-cover rounded-full border border-zinc-200/50 dark:border-zinc-800/50" />
                ) : (
                  <UserRound className="w-5 h-5" />
                )}
                <span className="truncate">@{profileLink}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
