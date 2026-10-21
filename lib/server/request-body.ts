import { readBotRequestBody } from "./bot-request-body";
import { HttpError } from "./http";

export const readRequestBody = readBotRequestBody;

// Enforce the byte limit while reading, before JSON.parse or schema validation.
export async function readJsonBody(request: Request, maximum = 128 * 1024): Promise<unknown> {
  const bytes = await readRequestBody(request, maximum);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, "Некорректное тело запроса"); }
}
