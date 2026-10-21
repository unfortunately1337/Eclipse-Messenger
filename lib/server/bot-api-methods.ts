import { z } from "zod";
import type { NextRequest } from "next/server";
import { BOT_API_METHODS, BOT_TRANSPORT, botCommandsSchema, botMessageRequestSchema, botReplyMarkupSchema } from "@/lib/bot-api";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import type { AuthenticatedBot } from "./bot-api-auth";
import { readBotRequestBody } from "./bot-request-body";
import { apiBotMessage, notifyBotChat, requireBotChat, writeBotMessage } from "./bot-messaging";
import { getPrivacySettings, shouldHideUsername, getPrivacyDisplayName } from "./privacy-settings";
import { decryptAtRest, encryptAtRest } from "./db-crypto";
import { getBotUpdates } from "./bot-updates";
import { resolveWebhookTarget } from "./bot-webhook-target";
import { buildPublicMediaPath, deleteMediaObject, getMediaObjectStream, sniffMediaBuffer, uploadMediaBuffer } from "./media-storage";
import { triggerRealtimeEvent, userPrivateChannel } from "./realtime";
import { BOT_CHAT_SETTINGS_METHODS, notifyBotSettings, runBotChatSettingsMethod } from "./bot-chat-settings";

const chatId = z.string().min(1).max(128), messageId = z.string().min(1).max(128);
const mediaSchema = z.object({ chat_id: chatId, file_id: z.string().min(1).max(1024), file_name: z.string().trim().min(1).max(255).optional(), caption: z.string().max(4096).optional(), reply_to_message_id: messageId.optional(), reply_markup: botReplyMarkupSchema.optional(), request_id: z.string().uuid().optional() }).strict();
export function botMe(bot: AuthenticatedBot) {
  return { id: bot.id, profile_id: bot.profileId, username: bot.profile.link, name: bot.profile.displayName, avatarUrl: bot.profile.avatarUrl, capabilities: BOT_API_METHODS, messagingAvailable: true, chat_types: ["private"], transport: BOT_TRANSPORT };
}
async function body(req: NextRequest) {
  if (req.method === "GET") return Object.fromEntries(req.nextUrl.searchParams);
  try { return JSON.parse(new TextDecoder().decode(await readBotRequestBody(req, 100000))); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Invalid JSON body."); }
}
export async function botFile(bot: AuthenticatedBot, id: string) {
  const path = id.split("#", 1)[0];
  let objectKey: string | undefined;
  if (path.startsWith("/media/")) {
    try { objectKey = decodeURIComponent(path.slice(7)); } catch { throw new HttpError(400, "Invalid file reference."); }
  }
  const asset = await prisma.mediaAsset.findFirst({ where: { OR: [{ id }, ...(objectKey ? [{ objectKey }] : [])], status: "ready" } });
  if (!asset?.objectKey || !asset.bucket || asset.clientEncrypted || (asset.expiresAt && asset.expiresAt < new Date())) throw new HttpError(404, "File not found.");
  if (asset.ownerId !== bot.profileId) {
    if (asset.scopeType !== "conversation" || !asset.scopeId) throw new HttpError(403, "File not accessible to this bot.");
    await requireBotChat(bot.profileId, asset.scopeId);
  }
  return asset;
}
export async function downloadBotFile(bot: AuthenticatedBot, id: string) {
  const asset = await botFile(bot, id), object = await getMediaObjectStream(asset.bucket!, asset.objectKey!);
  return new Response(object.body as ReadableStream<Uint8Array>, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
async function uploadFile(bot: AuthenticatedBot, req: NextRequest) {
  const bytes = await readBotRequestBody(req, 21 * 1024 * 1024);
  let form: FormData;
  try { form = await new Request("http://internal.invalid", { method: "POST", headers: { "Content-Type": req.headers.get("content-type") ?? "" }, body: bytes as BodyInit }).formData(); }
  catch { throw new HttpError(400, "Use multipart/form-data with file and chat_id."); }
  const target = chatId.parse(form.get("chat_id")); await requireBotChat(bot.profileId, target);
  const file = form.get("file"), kind = z.enum(["image", "video", "voice", "audio", "file", "video_note"]).parse(form.get("kind") ?? "file");
  if (!(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024) throw new HttpError(413, "File size must be between 1 byte and 20 MiB.");
  const buffer = Buffer.from(await file.arrayBuffer()), detected = sniffMediaBuffer(buffer, kind);
  if (kind !== "file" && (!detected || (kind === "image" && detected.kind !== "image") || (["video", "video_note"].includes(kind) && detected.kind !== "video") || (["audio", "voice"].includes(kind) && !["audio", "video"].includes(detected.kind)))) throw new HttpError(400, "File signature does not match its kind.");
  const mimeType = kind === "file" ? "application/octet-stream" : detected!.mimeType;
  const duration = z.coerce.number().int().min(0).max(86400000).parse(form.get("duration_ms") ?? 0);
  const uploaded = await uploadMediaBuffer({ buffer, size: buffer.length, mimeType, kind, ownerId: bot.profileId });
  try {
    const asset = await prisma.mediaAsset.create({ data: { ownerId: bot.profileId, kind, mimeType, size: file.size, durationMs: duration, objectKey: uploaded.objectKey, bucket: uploaded.bucket, etag: uploaded.etag, scopeType: "conversation", scopeId: target } });
    return { file_id: asset.id, file_size: asset.size, mime_type: mimeType, file_name: file.name };
  } catch (error) { await deleteMediaObject(uploaded.bucket, uploaded.objectKey).catch(() => {}); throw error; }
}
async function mediaContent(bot: AuthenticatedBot, method: string, args: z.infer<typeof mediaSchema>) {
  await requireBotChat(bot.profileId, args.chat_id);
  const asset = await botFile(bot, args.file_id);
  if (asset.scopeId !== args.chat_id || asset.scopeType !== "conversation") throw new HttpError(403, "Upload this file to the destination chat first.");
  const src = buildPublicMediaPath(asset.objectKey!), caption = args.caption ?? "";
  const expected: Record<string, string[]> = { sendPhoto: ["image"], sendVideo: ["video"], sendVideoNote: ["video_note", "video"], sendVoice: ["voice", "audio"], sendAudio: ["audio", "voice"], sendSticker: ["image"], sendDocument: ["file", "image", "video", "audio", "voice", "video_note"] };
  if (!expected[method]?.includes(asset.kind)) throw new HttpError(400, "File kind does not match this method.");
  const content = method === "sendPhoto" ? { type: "image", src, caption }
    : method === "sendVideo" || method === "sendVideoNote" ? { type: "video", src, caption, durationMs: asset.durationMs ?? 0, mode: method === "sendVideoNote" ? "note" : "file" }
    : method === "sendVoice" ? { type: "voice", src, durationMs: asset.durationMs ?? 0 }
    : method === "sendSticker" ? { type: "sticker", src }
    : { type: "file", src, caption, name: args.file_name ?? (method === "sendAudio" ? "audio" : "document"), mimeType: asset.mimeType, size: asset.size };
  return "__eclipse_media__:" + JSON.stringify(content);
}
export async function runBotApi(bot: AuthenticatedBot, method: string, req: NextRequest) {
  if (method === "getMe" || method === "me") return botMe(bot);
  if (method === "uploadFile") return uploadFile(bot, req);
  const input = await body(req);
  if ((BOT_CHAT_SETTINGS_METHODS as readonly string[]).includes(method)) return runBotChatSettingsMethod(bot, method, input);
  if (method === "getUpdates") {
    const args = z.object({ offset: z.coerce.number().int().min(0).max(2147483647).default(0), limit: z.coerce.number().int().min(1).max(100).default(100), timeout: z.coerce.number().int().min(0).max(25).default(0) }).strict().parse(input);
    return getBotUpdates(bot, args.offset, args.limit, args.timeout, req.signal);
  }
  if (method === "sendMessage" || ["sendPhoto", "sendVideo", "sendVoice", "sendAudio", "sendDocument", "sendVideoNote", "sendSticker"].includes(method)) {
    const args = method === "sendMessage" ? botMessageRequestSchema.parse(input) : mediaSchema.parse(input);
    const text = "text" in args ? args.text : await mediaContent(bot, method, args);
    const message = await writeBotMessage({ botId: bot.id, botProfileId: bot.profileId, conversationId: args.chat_id, senderId: bot.profileId, content: { text, reply_markup: args.reply_markup }, requestId: args.request_id, replyToMessageId: args.reply_to_message_id, incoming: false });
    return apiBotMessage(message, args.chat_id, text, bot.profile);
  }
  if (method === "sendMediaGroup") {
    const args = z.object({ chat_id: chatId, media: z.array(z.object({ type: z.enum(["photo", "video"]), file_id: z.string().min(1).max(1024) }).strict()).min(2).max(6), caption: z.string().max(4096).default(""), request_id: z.string().uuid().optional() }).strict().parse(input);
    const items = await Promise.all(args.media.map(async item => JSON.parse((await mediaContent(bot, item.type === "photo" ? "sendPhoto" : "sendVideo", { chat_id: args.chat_id, file_id: item.file_id })).slice("__eclipse_media__:".length))));
    const text = "__eclipse_media__:" + JSON.stringify({ type: "album", caption: args.caption, items: items.map(item => ({ src: item.src, kind: item.type, durationMs: item.durationMs })) });
    const message = await writeBotMessage({ botId: bot.id, botProfileId: bot.profileId, conversationId: args.chat_id, senderId: bot.profileId, content: { text }, requestId: args.request_id, incoming: false });
    return apiBotMessage(message, args.chat_id, text, bot.profile);
  }
  if (method === "getChat") {
    const { chat_id } = z.object({ chat_id: chatId }).strict().parse(input);
    const { peer } = await requireBotChat(bot.profileId, chat_id);
    const privacy = await getPrivacySettings(peer.id);
    return { id: chat_id, type: "private", user: { id: peer.id, username: shouldHideUsername(bot.profileId, peer.id, privacy) ? undefined : peer.link, name: getPrivacyDisplayName(bot.profileId, peer.id, peer.displayName, privacy) } };
  }
  if (method === "getFile") {
    const { file_id } = z.object({ file_id: z.string().min(1).max(1024) }).strict().parse(input);
    const asset = await botFile(bot, file_id);
    return { file_id: asset.id, file_size: asset.size, mime_type: asset.mimeType, download_path: `/api/bot/v1/files/${asset.id}` };
  }
  if (method === "editMessageText" || method === "deleteMessage") {
    const args = z.object({ chat_id: chatId, message_id: messageId, text: z.string().min(1).max(16384).optional(), reply_markup: botReplyMarkupSchema.optional() }).strict().parse(input);
    await requireBotChat(bot.profileId, args.chat_id);
    const message = await prisma.message.findFirst({ where: { id: args.message_id, conversationId: args.chat_id, senderId: bot.profileId, encryptionScheme: BOT_TRANSPORT } });
    if (!message) throw new HttpError(403, "Only the bot's own messages can be changed.");
    if (method === "deleteMessage") await prisma.message.delete({ where: { id: message.id } });
    else {
      if (!args.text || args.text.startsWith("__eclipse_media__:")) throw new HttpError(400, "Plain text is required.");
      await prisma.message.update({ where: { id: message.id }, data: { botContentEnc: encryptAtRest(JSON.stringify({ text: args.text, reply_markup: args.reply_markup })) } });
    }
    await notifyBotChat(args.chat_id, message.id);
    return method === "deleteMessage" ? true : apiBotMessage(message, args.chat_id, args.text!, bot.profile);
  }
  if (method === "setMyCommands") {
    const { commands } = z.object({ commands: botCommandsSchema }).strict().parse(input);
    await prisma.managedBot.update({ where: { id: bot.id }, data: { commands } });
    await notifyBotSettings(bot.profileId); return true;
  }
  if (method === "getMyCommands") return bot.commands;
  if (method === "setWebhook") {
    const args = z.object({ url: z.string().max(2048), secret_token: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/), drop_pending_updates: z.boolean().default(false) }).strict().parse(input);
    await resolveWebhookTarget(args.url);
    await prisma.$transaction(async db => {
      await db.managedBot.update({ where: { id: bot.id }, data: { webhookUrlEnc: encryptAtRest(args.url), webhookSecretEnc: encryptAtRest(args.secret_token), webhookVersion: { increment: 1 } } });
      if (args.drop_pending_updates) await db.botUpdate.updateMany({ where: { botId: bot.id, acknowledgedAt: null }, data: { acknowledgedAt: new Date() } });
    }); return true;
  }
  if (method === "deleteWebhook") {
    const args = z.object({ drop_pending_updates: z.boolean().default(false) }).strict().parse(input);
    await prisma.$transaction(async db => {
      await db.managedBot.update({ where: { id: bot.id }, data: { webhookUrlEnc: null, webhookSecretEnc: null, webhookVersion: { increment: 1 } } });
      if (args.drop_pending_updates) await db.botUpdate.updateMany({ where: { botId: bot.id, acknowledgedAt: null }, data: { acknowledgedAt: new Date() } });
    }); return true;
  }
  if (method === "getWebhookInfo") {
    return { url: bot.webhookUrlEnc ? decryptAtRest(bot.webhookUrlEnc) : "", pending_update_count: await prisma.botUpdate.count({ where: { botId: bot.id, acknowledgedAt: null, expiresAt: { gt: new Date() } } }), last_error: (await prisma.botUpdate.findFirst({ where: { botId: bot.id, lastError: { not: null } }, orderBy: { createdAt: "desc" } }))?.lastError ?? null };
  }
  if (method === "answerCallbackQuery") {
    const args = z.object({ callback_query_id: z.string().uuid(), text: z.string().max(200).default("") }).strict().parse(input);
    const update = await prisma.botUpdate.findUnique({ where: { botId_dedupKey: { botId: bot.id, dedupKey: `callback:${args.callback_query_id}` } } });
    if (!update || update.createdAt < new Date(Date.now() - 5 * 60000)) throw new HttpError(400, "Callback query expired or does not belong to this bot.");
    // Legacy text is accepted for compatibility, but bot-controlled text must
    // never be displayed as a trusted application toast.
    return true;
  }
  if (method === "sendChatAction") {
    const args = z.object({ chat_id: chatId, action: z.enum(["typing", "upload_photo", "upload_video", "record_voice", "upload_document"]) }).strict().parse(input);
    const { peer } = await requireBotChat(bot.profileId, args.chat_id);
    const identity = { chatType: "direct", fromLink: bot.profile.link, fromUserId: bot.profileId, fromDisplayName: bot.profile.displayName, at: new Date().toISOString() };
    const name = args.action === "typing" ? "typing:update" : args.action === "record_voice" ? "recording:update" : "sending:update";
    const activity = args.action === "typing" ? { isTyping: true } : args.action === "record_voice" ? { isRecording: true, mode: "voice" } : { isSending: true, kind: args.action === "upload_photo" ? "image" : args.action === "upload_video" ? "video" : "file" };
    await triggerRealtimeEvent({ channel: userPrivateChannel(peer.id), name, data: { ...identity, ...activity } }).catch(() => {}); return true;
  }
  throw new HttpError(404, "Unknown Bot API method.");
}
