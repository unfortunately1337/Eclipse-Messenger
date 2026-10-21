import { z } from "zod";

export const BOT_TRANSPORT = "bot-cloud-v1";
export const botButtonSchema = z.object({
  text: z.string().trim().min(1).max(64),
  callback_data: z.string().min(1).refine(value => new TextEncoder().encode(value).length <= 64).optional(),
  url: z.string().url().refine(value => /^https:\/\//i.test(value)).optional(),
}).strict().refine(button => Boolean(button.callback_data) !== Boolean(button.url));
export const botReplyMarkupSchema = z.object({
  inline_keyboard: z.array(z.array(botButtonSchema).min(1).max(4)).max(8),
}).strict();
export type BotReplyMarkup = z.infer<typeof botReplyMarkupSchema>;
export const botContentSchema = z.object({
  text: z.string().min(1).max(65536),
  reply_markup: botReplyMarkupSchema.optional(),
}).strict();
export type BotContent = z.infer<typeof botContentSchema>;
export const botMessageRequestSchema = z.object({
  chat_id: z.string().min(1).max(128),
  text: z.string().min(1).max(16384).refine(value => !value.startsWith("__eclipse_media__:"), "Use a media method for attachments."),
  reply_to_message_id: z.string().min(1).max(128).optional(),
  reply_markup: botReplyMarkupSchema.optional(),
  request_id: z.string().uuid().optional(),
}).strict();
export const botCommandsSchema = z.array(z.object({
  command: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
  description: z.string().trim().min(1).max(100),
}).strict()).max(100).refine(items => new Set(items.map(item => item.command)).size === items.length);

export const BOT_API_METHODS = ["getMe", "getUpdates", "sendMessage", "editMessageText", "deleteMessage", "getChat", "getFile", "uploadFile", "sendPhoto", "sendVideo", "sendVoice", "sendAudio", "sendDocument", "sendVideoNote", "sendSticker", "sendMediaGroup", "setMyCommands", "getMyCommands", "setMyChatSettings", "getMyChatSettings", "setChatSettings", "getChatSettings", "setWebhook", "deleteWebhook", "getWebhookInfo", "answerCallbackQuery", "sendChatAction"] as const;
