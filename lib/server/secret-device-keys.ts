import { z } from "zod";
import { isValidPublicKeyBase64 } from "./e2e-crypto-validate";
import { HttpError } from "./http";

export const secretDeviceKeySchema = z.object({
  deviceKeyId: z.string().uuid(),
  devicePublicKey: z.string().max(2048).refine(isValidPublicKeyBase64, "Некорректный ключ устройства"),
});

export function secretDeviceEnvelope(version: number, keyId: string | null | undefined, wrappedKey: string | null) {
  if (version === 1) return wrappedKey;
  if (version !== 2) throw new HttpError(409, "Неподдерживаемый протокол секретного чата");
  if (!keyId || !wrappedKey) throw new HttpError(409, "Ключи секретного чата не согласованы");
  return `secret:v2:${keyId}:${wrappedKey}`;
}
