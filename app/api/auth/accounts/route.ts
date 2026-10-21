import { NextRequest } from "next/server";
import { ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { getAccountUnreadCounts } from "@/lib/server/account-unread";
import {
  clearSecondarySessionCookie,
  getSessionFromRequest,
  getSecondarySessionFromRequest,
} from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const primarySession = await getSessionFromRequest(req);
    if (!primarySession) {
      return applyCors(req, jsonOk({ accounts: [], canAddAccount: true }));
    }

    const secondarySession = await getSecondarySessionFromRequest(req);

    const hasSecondary = Boolean(
      secondarySession && secondarySession.data.userId !== primarySession.data.userId
    );
    const duplicateSecondary = Boolean(
      secondarySession && secondarySession.data.userId === primarySession.data.userId
    );

    const [primaryUser, secondaryUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: primarySession.data.userId },
        select: {
          id: true,
          displayName: true,
          link: true,
          avatarUrl: true,
        },
      }),
      hasSecondary
        ? prisma.user.findUnique({
            where: { id: secondarySession!.data.userId },
            select: {
              id: true,
              displayName: true,
              link: true,
              avatarUrl: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!primaryUser) {
      return applyCors(req, jsonOk({ accounts: [], canAddAccount: true }));
    }

    const shouldClearSecondary = duplicateSecondary || (hasSecondary && !secondaryUser);
    const unreadCounts = await getAccountUnreadCounts([
      { userId: primaryUser.id, sessionId: primarySession.sessionId },
      ...(secondaryUser ? [{ userId: secondaryUser.id, sessionId: secondarySession!.sessionId }] : []),
    ]);

    const accounts = [
      {
        id: primaryUser.id,
        displayName: primaryUser.displayName,
        link: primaryUser.link,
        avatarUrl: primaryUser.avatarUrl,
        isActive: true,
        unreadCount: unreadCounts.get(primaryUser.id) ?? 0,
      },
    ];

    if (secondaryUser) {
      accounts.push({
        id: secondaryUser.id,
        displayName: secondaryUser.displayName,
        link: secondaryUser.link,
        avatarUrl: secondaryUser.avatarUrl,
        isActive: false,
        unreadCount: unreadCounts.get(secondaryUser.id) ?? 0,
      });
    }

    const res = jsonOk({
      accounts,
      canAddAccount: accounts.length < 2,
    });

    ensureCsrfCookie(req, res);
    res.headers.set("Cache-Control", "private, no-store");
    if (shouldClearSecondary) {
      clearSecondarySessionCookie(res);
    }

    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
