import type { EclipseSystemPayload } from "@/lib/eclipse-system";
import { decryptAtRest } from "./db-crypto";

// Call only after authenticating the owner of the system conversation.
export function revealEclipsePayload(value: unknown): EclipseSystemPayload {
  const payload = value as EclipseSystemPayload;
  if (payload?.eventType !== "bot_management" || !payload.protectedBody) return payload;
  const { protectedBody, ...rest } = payload;
  const revealed = JSON.parse(decryptAtRest(protectedBody)) as { body: string; botToken?: string };
  return { ...rest, ...revealed };
}
