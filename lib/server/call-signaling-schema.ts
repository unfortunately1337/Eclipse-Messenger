import { z } from "zod";

const media = z.object({ microphone: z.boolean(), camera: z.boolean(), screen: z.boolean(), screenAudio: z.boolean() }).strict();
const candidate = z.object({
  candidate: z.string().max(4096).optional(), sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(7).nullable().optional(), usernameFragment: z.string().max(256).nullable().optional(),
}).strict();
export const callSignalSchema = z.object({
  id: z.uuid(), clientId: z.uuid(), epoch: z.uuid(), payload: z.discriminatedUnion("type", [
    z.object({ type: z.literal("ready") }).strict(),
    z.object({ type: z.literal("description"), negotiationId: z.uuid(), description: z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().min(1).max(64 * 1024) }).strict() }).strict(),
    z.object({ type: z.literal("candidates"), negotiationId: z.uuid(), candidates: z.array(candidate).min(1).max(16) }).strict(),
    z.object({ type: z.literal("media"), state: media }).strict(),
    z.object({ type: z.literal("bye") }).strict(),
  ]),
}).strict();
