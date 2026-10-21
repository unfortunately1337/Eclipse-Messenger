import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { getContactsMap } from "@/lib/server/contacts";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { canViewerSeeLastSeen, canViewerSeePresence, getPrivacyDisplayName, getPrivacySettings } from "@/lib/server/privacy-settings";

type ContactView = {
  id: string;
  link: string;
  avatarUrl: string | null;
  displayName: string;
  alias: string;
  presenceVisibility: "all" | "none";
  lastSeenVisibility: "all" | "none";
  updatedAt: string;
};

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const contactsMap = await getContactsMap(user.id);
    let peerIds = Array.from(contactsMap.keys());

    const acquaintancesOnly = req.nextUrl.searchParams.get("acquaintances") === "true";
    if (acquaintancesOnly) {
      const directConversations = await prisma.conversation.findMany({
        where: {
          type: "direct",
          participants: {
            some: { userId: user.id },
          },
          messages: {
            some: {},
          },
        },
        include: {
          participants: {
            select: { userId: true },
          },
        },
      });
      const conversationUserIds = directConversations.flatMap((c) =>
        c.participants.map((p) => p.userId).filter((uid) => uid !== user.id)
      );
      peerIds = Array.from(new Set([...peerIds, ...conversationUserIds]));
    }

    if (peerIds.length === 0) {
      return applyCors(req, jsonOk({ contacts: [] }));
    }

    const peers = await prisma.user.findMany({
      where: {
        id: { in: peerIds },
        isBot: false,
        isSystemAccount: false,
      },
      select: {
        id: true,
        link: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const privacyByPeerId = new Map(
      await Promise.all(
        peers.map(async (peer) => {
          const settings = await getPrivacySettings(peer.id);
          return [peer.id, settings] as const;
        }),
      ),
    );

    const contacts = peers
      .map((peer: (typeof peers)[number]): ContactView | null => {
        const saved = contactsMap.get(peer.id);
        const privacy = privacyByPeerId.get(peer.id);
        return {
          id: peer.id,
          link: peer.link,
          avatarUrl: peer.avatarUrl,
          displayName: privacy ? getPrivacyDisplayName(user.id, peer.id, peer.displayName, privacy) : peer.displayName,
          alias: saved ? saved.alias : "",
          presenceVisibility: privacy && canViewerSeePresence(user.id, peer.id, privacy) ? "all" : "none",
          lastSeenVisibility: privacy && canViewerSeeLastSeen(user.id, peer.id, privacy) ? "all" : "none",
          updatedAt: saved ? saved.updatedAt : new Date(peer.createdAt).toISOString(),
        } as any;
      })
      .filter((item: ContactView | null): item is ContactView => item !== null)
      .sort((a: ContactView, b: ContactView) => (a.updatedAt < b.updatedAt ? 1 : -1));

    const res = jsonOk({ contacts });
    res.headers.set("Cache-Control", "private, no-store");
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
