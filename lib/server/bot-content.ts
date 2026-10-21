import { botContentSchema, type BotContent } from "@/lib/bot-api";
import { decryptAtRest } from "./db-crypto";
export function readBotContent(value: string | null | undefined): BotContent | null {
  return value ? botContentSchema.parse(JSON.parse(decryptAtRest(value))) : null;
}
