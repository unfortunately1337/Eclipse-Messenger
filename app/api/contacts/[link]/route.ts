import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { saveContact, getContact, deleteContact } from "@/lib/server/contacts";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { normalizeLink } from "@/lib/server/validation";
import { getPrivacySettings } from "@/lib/server/privacy-settings";

type Params = {
  params: Promise<{ link: string }>;
};

const bodySchema = z.object({
  alias: z.string().trim().max(60),
});

async function resolvePeer(rawLink: string) {
  const normalized = normalizeLink(rawLink);
  let user = await prisma.user.findFirst({
    where: { link: { equals: normalized, mode: "insensitive" } },
    select: { id: true, link: true, displayName: true, isBot: true, isSystemAccount: true },
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
      select: { id: true, link: true, displayName: true, isBot: true, isSystemAccount: true },
    });
  }
  if (!user) {
    throw new HttpError(404, "Пользователь не найден");
  }
  return user;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const peer = await resolvePeer(link);
    const contact = await getContact(user.id, peer.id);

    const res = jsonOk({
      exists: Boolean(contact),
      contact: contact
        ? {
            alias: contact.alias,
            updatedAt: contact.updatedAt,
          }
        : null,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const body = bodySchema.parse(await readJsonBody(req, 128 * 1024));
    const { link } = await params;
    const peer = await resolvePeer(link);

    if (peer.id === user.id) {
      throw new HttpError(400, "Нельзя добавить себя в контакты");
    }

    if (peer.isBot || peer.isSystemAccount) {
      throw new HttpError(400, "Нельзя добавить бота в контакты");
    }

    const [existingContact, peerPrivacy] = await Promise.all([
      getContact(user.id, peer.id),
      getPrivacySettings(peer.id),
    ]);
    if (!existingContact && !peerPrivacy.allowProfileLink) {
      throw new HttpError(403, "Пользователь запретил добавление по ссылке");
    }

    const saved = await saveContact({
      ownerId: user.id,
      peerId: peer.id,
      alias: body.alias,
    });

    const res = jsonOk({
      contact: {
        alias: saved.alias,
        updatedAt: saved.updatedAt,
      },
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const { link } = await params;
    const peer = await resolvePeer(link);

    await deleteContact(user.id, peer.id);
    const res = jsonOk({ deleted: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
