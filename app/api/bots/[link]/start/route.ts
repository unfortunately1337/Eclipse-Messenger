import { NextRequest } from "next/server";
import { POST as send } from "../messages/route";
import { readBotRequestBody } from "@/lib/server/bot-request-body";
import { z } from "zod";
import { jsonError } from "@/lib/server/http";
export async function POST(req: NextRequest, context: { params: Promise<{ link: string }> }) {
  try {
    const { requestId } = z.object({ requestId: z.string().uuid() }).strict().parse(JSON.parse(new TextDecoder().decode(await readBotRequestBody(req, 512))));
    return send(new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({ requestId, text: "/start" }) }), context);
  } catch (error) { return jsonError(error); }
}
