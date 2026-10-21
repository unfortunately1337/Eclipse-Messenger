import { z } from "zod";

const safeText = (max: number) => z.string().trim().max(max).refine(text => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text), "Invalid control characters.");
export const botMenuButtonSchema = z.object({
  text: safeText(64).min(1),
  message: safeText(4096).min(1).optional(),
  callback_data: z.string().min(1).refine(value => new TextEncoder().encode(value).length <= 64).optional(),
  url: z.string().url().refine(value => /^https:\/\//i.test(value)).optional(),
}).strict().refine(button => [button.message, button.callback_data, button.url].filter(value => value !== undefined).length <= 1, "Choose one button action.")
  .refine(button => !(button.message ?? button.text).startsWith("__eclipse_media__:"), "Reserved message prefix.");
export const botMenuSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("commands") }).strict(),
  z.object({
    type: z.literal("keyboard"),
    button_text: safeText(32).min(1).optional(),
    open_by_default: z.boolean().optional(),
    keyboard: z.array(z.array(botMenuButtonSchema).min(1).max(4)).min(1).max(8),
  }).strict(),
]);
export const botChatSettingsSchema = z.object({
  empty_text: safeText(2048).optional(),
  input_placeholder: safeText(128).refine(text => !/[\r\n]/.test(text)).optional(),
  menu: botMenuSchema.optional(),
}).strict();
export type BotChatSettings = { empty_text: string; input_placeholder: string; menu: z.infer<typeof botMenuSchema> };
export type BotChatSettingsPatch = z.infer<typeof botChatSettingsSchema>;
export type BotMenuButton = z.infer<typeof botMenuButtonSchema>;
export const DEFAULT_BOT_CHAT_SETTINGS: BotChatSettings = {
  empty_text: "Сообщений пока нет…", input_placeholder: "Сообщение", menu: { type: "commands" },
};
export function resolveBotChatSettings(global: unknown, override?: unknown): BotChatSettings {
  const base = botChatSettingsSchema.safeParse(global);
  const chat = botChatSettingsSchema.safeParse(override);
  return { ...DEFAULT_BOT_CHAT_SETTINGS, ...(base.success ? base.data : {}), ...(chat.success ? chat.data : {}) };
}
