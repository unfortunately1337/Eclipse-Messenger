import { z } from "zod";
import { readJsonBody, readRequestBody } from "@/lib/server/request-body";
import { NextRequest, NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { HttpError, applyCors, handleOptions, jsonError } from "@/lib/server/http";
import { buildPusherAuth } from "@/lib/server/realtime";

type PusherAuthPayload = {
  socket_id?: string;
  channel_name?: string;
};

async function readPayload(req: NextRequest): Promise<PusherAuthPayload> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return z.object({ socket_id: z.string().max(64).optional(), channel_name: z.string().max(160).optional() }).parse(await readJsonBody(req, 16 * 1024));
  }
  const form = new URLSearchParams(new TextDecoder().decode(await readRequestBody(req, 16 * 1024)));
  return {
    socket_id: form.get("socket_id")?.toString(),
    channel_name: form.get("channel_name")?.toString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const payload = await readPayload(req);
    const socketId = payload.socket_id?.trim();
    const channelName = payload.channel_name?.trim();

    if (!socketId || !/^\d+\.\d+$/.test(socketId) || !channelName || channelName.length > 160) {
      return applyCors(req, NextResponse.json({ error: "Invalid realtime auth payload" }, { status: 400 }));
    }

    const allowedPrivateChannel = `private-user-${user.id}`;
    if (channelName !== allowedPrivateChannel) {
      throw new HttpError(403, "Realtime channel is not available for this account");
    }

    const auth = buildPusherAuth(socketId, channelName);

    return applyCors(req, NextResponse.json(auth));
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
