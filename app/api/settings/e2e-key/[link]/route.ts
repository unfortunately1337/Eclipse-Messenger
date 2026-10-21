import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { getUserPublicKey } from "@/lib/server/e2e-key";
import { prisma } from "@/lib/server/prisma";
import { normalizeLink } from "@/lib/server/validation";

type Params = {
  params: Promise<{ link: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireUserFromRequest(req);
    const { link: rawLink } = await params;
    const link = normalizeLink(rawLink);

    const peer = await prisma.user.findUnique({
      where: { link },
      select: { id: true },
    });

    const publicKey = peer ? await getUserPublicKey(peer.id) : null;
    const res = jsonOk({ publicKey: publicKey ?? null });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
