"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { UserRound } from "lucide-react";
import { IoChatbubbles } from "react-icons/io5";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { subscribeSelfProfileUpdated } from "@/lib/client/local-updates";

type BottomNavProps = {
  profileLink: string;
  avatarUrl?: string | null;
  displayName?: string;
};

export default function BottomNav({ profileLink, avatarUrl, displayName }: BottomNavProps) {
  const t = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [profileNav, setProfileNav] = useState({
    link: profileLink,
    avatarUrl: avatarUrl ?? null,
    displayName: displayName ?? "",
  });

  const profileHref = `/app/${profileNav.link}`;
  const isProfile = pathname === profileHref || pathname.startsWith(`${profileHref}/`);
  const isChats = pathname === "/app";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = (value: boolean) => setIsMobile(value);
    update(mq.matches);
    const onChange = (event: MediaQueryListEvent) => update(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setProfileNav({
      link: profileLink,
      avatarUrl: avatarUrl ?? null,
      displayName: displayName ?? "",
    });
  }, [avatarUrl, displayName, profileLink]);

  useEffect(() => {
    return subscribeSelfProfileUpdated((profile) => {
      setProfileNav((prev) => ({
        link: profile.link || prev.link,
        avatarUrl: profile.avatarUrl ?? null,
        displayName: profile.displayName || prev.displayName,
      }));
    });
  }, []);

  useEffect(() => {
    const onChatVisibility = (event: Event) => {
      const custom = event as CustomEvent<{ mobileChatOpen?: boolean }>;
      setIsMobileChatOpen(Boolean(custom.detail?.mobileChatOpen));
    };

    window.addEventListener("eclipse:mobile-chat-visibility", onChatVisibility as EventListener);
    return () => window.removeEventListener("eclipse:mobile-chat-visibility", onChatVisibility as EventListener);
  }, []);

  if (!isMobile) return null;
  if (isMobile && pathname === "/app" && isMobileChatOpen) return null;
  if (isMobile && pathname.startsWith("/app") && searchParams.get("settings")) return null;
  if (isMobile && (pathname.startsWith("/app/groups/new") || pathname.startsWith("/app/channels/new"))) return null;

  const items = [
    {
      id: "chats",
      href: "/app",
      label: t("Чаты"),
      icon: <IoChatbubbles size={17} />,
      active: isChats,
    },
    {
      id: "profile",
      href: profileHref,
      label: t("Профиль"),
      icon: profileNav.avatarUrl ? (
        <Avatar className="h-[16px] w-[16px] md:h-[17px] md:w-[17px]">
          <AvatarImage src={profileNav.avatarUrl} alt={profileNav.displayName || t("Профиль")} />
          <AvatarFallback className="text-[8px] font-bold">
            {(profileNav.displayName.trim().slice(0, 1) || "U").toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <UserRound size={17} />
      ),
      active: isProfile,
    },
  ];

  return (
    <div className="fixed inset-x-0 bottom-2 z-50 px-3 pointer-events-none">
      <div className="relative flex items-center justify-center">
        <div className="pointer-events-auto w-[min(38vw,140px)] rounded-full bg-zinc-900/50 px-0.5 py-1 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.82)] backdrop-blur-lg">
          <div className="grid grid-cols-2 gap-0">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full px-0 py-1 transition-colors ${
                  item.active ? "text-zinc-50" : "text-zinc-200/88 hover:text-zinc-50"
                }`}
              >
                <span className="relative">{item.icon}</span>
                <span className="relative text-[8.5px] font-semibold leading-none">{t(item.label ?? "")}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
