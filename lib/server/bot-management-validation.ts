import { createHash, randomBytes } from "crypto";
import { HttpError } from "./http";
import { linkSchema } from "./validation";

const reserved = new Set(["eclipse", "eclipseaibot", "saved", "admin", "support", "settings", "api", "login", "signup", "system"]);
export function botName(value: string) {
  const name = value.trim();
  if (!name || name.length > 64 || /[\u0000-\u001f\u007f]/.test(name)) throw new HttpError(400, "Имя должно содержать от 1 до 64 символов без переносов строк.");
  return name;
}
export function botUsername(value: string) {
  const parsed = linkSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, "Адрес должен содержать 4–32 символа: латинские буквы, цифры и _. Первый символ — буква, последний — буква или цифра.");
  if (reserved.has(parsed.data)) throw new HttpError(400, "Этот адрес зарезервирован Eclipse. Выберите другой.");
  if (!parsed.data.endsWith("bot")) throw new HttpError(400, "Юзернейм бота должен оканчиваться на bot.");
  return parsed.data;
}
export function hashBotToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function issueBotToken(id: string) {
  const token = `ecb_${id}.${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashBotToken(token) };
}
