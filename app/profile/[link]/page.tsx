
import { translate as t } from "@/lib/i18n/translate";
import { getServerTranslation } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Profile from "@/app/app/[username]/profile";
import { prisma } from "@/lib/server/prisma";
import { getCurrentUser } from "@/lib/server/auth";
import { normalizeLink } from "@/lib/server/validation";
import { getPrivacyDisplayName, getPrivacySettings, shouldHideUsername } from "@/lib/server/privacy-settings";

type Params = {
  params: Promise<{ link: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { link } = await params;
  const normalized = normalizeLink(link);

  let user = await prisma.user.findFirst({
    where: { link: { equals: normalized, mode: "insensitive" } },
    select: { id: true, displayName: true },
  });

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { link2: { equals: normalized, mode: "insensitive" } },
          { link3: { equals: normalized, mode: "insensitive" } },
          { link4: { equals: normalized, mode: "insensitive" } },
          { link5: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true, displayName: true },
    });
  }

  if (!user) {
    return { title: t("Профиль не найден") };
  }

  const privacy = await getPrivacySettings(user.id);
  return { title: t("{0} - профиль", { 0: getPrivacyDisplayName(null, user.id, user.displayName, privacy) }) };
}

export default async function PublicProfilePage({ params }: Params) {
  const t = await getServerTranslation();
  const { link } = await params;
  const normalized = normalizeLink(link);
  const currentUser = await getCurrentUser();

  let user = await prisma.user.findFirst({
    where: { link: { equals: normalized, mode: "insensitive" } },
    select: {
      id: true,
      displayName: true,
      link: true,
      link2: true,
      link3: true,
      link4: true,
      link5: true,
      description: true,
      avatarUrl: true,
      backgroundUrl: true,
      musicUrl: true,
      musicTitle: true,
      musicAuthor: true,
      musicCoverUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { link2: { equals: normalized, mode: "insensitive" } },
          { link3: { equals: normalized, mode: "insensitive" } },
          { link4: { equals: normalized, mode: "insensitive" } },
          { link5: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        link: true,
        link2: true,
        link3: true,
        link4: true,
        link5: true,
        description: true,
        avatarUrl: true,
        backgroundUrl: true,
        musicUrl: true,
        musicTitle: true,
        musicAuthor: true,
        musicCoverUrl: true,
        createdAt: true,
      },
    });
  }

  if (!user) {
    notFound();
  }
  const privacy = await getPrivacySettings(user.id);
  if (currentUser?.id !== user.id && !privacy.allowProfileLink) {
    notFound();
  }
  const usernameHidden = shouldHideUsername(currentUser?.id, user.id, privacy);
  const displayName = getPrivacyDisplayName(currentUser?.id, user.id, user.displayName, privacy);

  const secondaryLinks = usernameHidden
    ? []
    : [user.link2, user.link3, user.link4, user.link5].filter(
        (l): l is string => typeof l === "string" && l.trim().length > 0,
      );

  return (
    <Profile
      isOwner={currentUser?.id === user.id}
      profile={{
        id: user.id,
        displayName,
        link: usernameHidden ? t("Скрыт") : `@${user.link}`,
        secondaryLinks,
        description: user.description ?? "",
        avatarUrl: user.avatarUrl ?? "",
        backgroundUrl: user.backgroundUrl ?? "",
        musicUrl: user.musicUrl ?? "",
        musicTitle: user.musicTitle ?? "",
        musicAuthor: user.musicAuthor ?? "",
        musicCoverUrl: user.musicCoverUrl ?? "",
        createdAt: user.createdAt.toISOString(),
      }}
    />
  );
}
