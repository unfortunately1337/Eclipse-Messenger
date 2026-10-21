import { HttpError } from "./http";

export async function readBotRequestBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length") ?? 0) > maximum) throw new HttpError(413, "Слишком большой запрос.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) { await reader.cancel(); throw new HttpError(413, "Слишком большой запрос."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
