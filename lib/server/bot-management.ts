import { createHash, randomUUID } from "crypto";
import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import type { BotManagementAction, BotManagementResult, BotManagementState, BotManagementStep } from "@/lib/bot-management";
import type { EclipseSystemMessage, EclipseSystemPayload } from "@/lib/eclipse-system";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { encryptAtRest, decryptAtRest } from "./db-crypto";
import { ensureEclipseBotUser, getOrCreateEclipseDialog } from "./eclipse-bot";
import { botName, botUsername, issueBotToken, hashBotToken } from "./bot-management-validation";
import { revealEclipsePayload } from "./eclipse-payload";
import { invalidateChatListPayloadCache } from "./chat-list";
import { triggerRealtimeEvent, userPrivateChannel } from "./realtime";
import { deleteMediaObject } from "./media-storage";
import { redis } from "./redis";
import { invalidateUserCache } from "./auth";

type Db = Prisma.TransactionClient;
type DeletedBot = { profileId: string; link: string; userIds: string[]; media: { bucket: string | null; objectKey: string | null }[] };
export type BotManagementInput = {
  action: BotManagementAction;
  revision: number;
  requestId: string;
  text?: string;
  botId?: string;
  avatar?: { objectKey: string; bucket: string; mimeType: string; size: number };
};

async function stateFor(ownerId: string, db: Db = prisma): Promise<BotManagementState> {
  if (!db.botManagementSession) throw new HttpError(503, "Управление ботами временно недоступно. Попробуйте позже.");
  const [session, bots] = await Promise.all([
    db.botManagementSession.findUnique({ where: { ownerId } }),
    db.managedBot.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" }, include: { profile: { select: { displayName: true, link: true, avatarUrl: true } } } }),
  ]);
  return {
    step: (session?.step ?? "root") as BotManagementStep,
    revision: session?.revision ?? 0,
    selectedBotId: session?.selectedBotId ?? null,
    bots: bots.map(bot => ({ id: bot.id, name: bot.profile.displayName, username: bot.profile.link, avatarUrl: bot.profile.avatarUrl, tokenActive: Boolean(bot.tokenHash) })),
  };
}
export async function getBotManagementState(ownerId: string) { return stateFor(ownerId); }

async function usernameTaken(db: Db, username: string, excludeProfileId?: string) {
  const [user, group, channel] = await Promise.all([
    db.user.findFirst({ where: { ...(excludeProfileId ? { id: { not: excludeProfileId } } : {}), OR: ["link", "link2", "link3", "link4", "link5"].map(key => ({ [key]: { equals: username, mode: "insensitive" as const } })) }, select: { id: true } }),
    db.group.findFirst({ where: { link: { equals: username, mode: "insensitive" } }, select: { id: true } }),
    db.channel.findFirst({ where: { link: { equals: username, mode: "insensitive" } }, select: { id: true } }),
  ]);
  return Boolean(user || group || channel);
}

function tokenBody(username: string, token: string) {
  return `Бот зарегистрирован: @${username}\n\nAPI токен:\n${token}\n\nНе передавайте токен другим и не публикуйте его. Он даёт доступ к вашему боту и его сообщениям.`;
}

function botMenuBody(username: string) {
  return `Это ваш бот @${username}.\n\nВыберите действие в меню.`;
}

async function activeBotToken(db: Db, conversationId: string, bot: { id: string; tokenHash: string | null; tokenEnc: string | null }) {
  if (!bot.tokenHash) return undefined;
  if (bot.tokenEnc) {
    const token = decryptAtRest(bot.tokenEnc);
    if (hashBotToken(token) !== bot.tokenHash) throw new HttpError(503, "Не удалось прочитать текущий токен.");
    return token;
  }
  // Recover existing tokens from the owner's encrypted history without replacing them.
  let cursor: string | undefined;
  while (true) {
    const messages = await db.message.findMany({
      where: { conversationId, isSystemMessage: true, systemPayload: { path: ["botRole"], equals: "assistant" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, systemPayload: true },
    });
    for (const message of messages) {
      const token = revealEclipsePayload(message.systemPayload)?.botToken;
      if (token && hashBotToken(token) === bot.tokenHash) {
        await db.managedBot.update({ where: { id: bot.id }, data: { tokenEnc: encryptAtRest(token) } });
        return token;
      }
    }
    if (messages.length < 100) return undefined;
    cursor = messages.at(-1)!.id;
  }
}

export async function runBotManagement(ownerId: string, input: BotManagementInput): Promise<BotManagementResult> {
  const [systemBot, conversationId] = await Promise.all([ensureEclipseBotUser(), getOrCreateEclipseDialog(ownerId)]);
  // A bot never receives a known password or an ordinary user's login session.
  const passwordHash = ["skip", "avatar"].includes(input.action) ? await argon2.hash(randomUUID()) : null;
  const inputHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  let deletedBot: DeletedBot | null = null;
  let updatedBotProfile: { id: string; link: string; displayName: string; avatarUrl: string | null; backgroundUrl: string | null } | null = null;
  let previousBotLink: string | null = null;
  const result = await prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-management:${ownerId}`}, 0))`;
    const replay = await db.botManagementRequest.findUnique({ where: { id: input.requestId } });
    if (replay) {
      if (replay.ownerId !== ownerId || replay.inputHash !== inputHash) throw new HttpError(409, "Этот запрос уже использован. Повторите действие.");
      const previous = JSON.parse(decryptAtRest(replay.responseEnc)) as BotManagementResult;
      return { ...previous, state: await stateFor(ownerId, db) };
    }
    const session = await db.botManagementSession.upsert({ where: { ownerId }, create: { ownerId }, update: {} });
    if (session.revision !== input.revision) throw new HttpError(409, "Меню изменилось на другом устройстве. Повторите действие в обновлённом меню.");
    let step = session.step as BotManagementStep;
    let displayName = session.displayName;
    let username = session.username;
    let selectedBotId = session.selectedBotId;
    let echo = input.text?.trim() ?? "";
    let title = "Eclipse API";
    let body = "";
    let shouldReply = true;
    let token: string | undefined;
    const invalidStep = () => { throw new HttpError(409, "Это действие недоступно на текущем шаге. Обновите меню."); };
    const clearDraft = () => { displayName = null; username = null; selectedBotId = null; };
    if (input.action === "back") {
      if (["avatar_edit", "group_permissions", "name_edit", "username_edit"].includes(step)) {
        const bot = await db.managedBot.findFirst({ where: { id: selectedBotId ?? "", ownerId }, include: { profile: true } });
        if (!bot) throw new HttpError(404, "Бот не найден.");
        echo = "Назад"; step = "settings";
        body = `Настройки бота @${bot.profile.link}.\n\nВыберите действие в меню.`;
      } else if (step === "delete_confirm" || step === "api_token" || step === "settings") {
        echo = step === "delete_confirm" ? "Отмена" : "Назад";
        const bot = await db.managedBot.findFirst({ where: { id: selectedBotId ?? "", ownerId }, include: { profile: true } });
        if (!bot) throw new HttpError(404, "Бот не найден.");
        step = "detail";
        body = botMenuBody(bot.profile.link);
      } else {
        echo = "Назад";
        step = step === "bots" || step === "root" ? "root" : "bots";
        clearDraft();
        if (step === "root") title = "Eclipse";
        body = step === "root" ? "Выберите раздел в меню." : "Выберите действие: создайте нового бота или откройте список своих ботов.";
      }
    } else if (input.action === "bots") {
      echo = "Боты"; step = "bots"; clearDraft();
      body = "Здесь можно создать своего бота и управлять подключением. Выберите «Создать бота» или «Мои боты».";
    } else if (input.action === "create") {
      if (step !== "bots") invalidStep();
      if (await db.managedBot.count({ where: { ownerId } }) >= 10) throw new HttpError(400, "Можно создать до 10 ботов. Лимит уже достигнут.");
      echo = "Создать бота"; clearDraft(); step = "name";
      title = "Как назовём вашего бота?";
      body = "Введите имя вашего бота. До 64 символов.";
    } else if (input.action === "mine") {
      if (step !== "bots") invalidStep();
      echo = "Мои боты"; step = "mine"; clearDraft();
      const mine = await stateFor(ownerId, db);
      body = mine.bots.length ? "Выберите бота в меню." : "У вас пока нет ботов.";
    } else if (input.action === "select") {
      if (step !== "mine") invalidStep();
      const bot = await db.managedBot.findFirst({ where: { id: input.botId, ownerId }, include: { profile: true } });
      if (!bot || !input.botId) throw new HttpError(404, "Бот не найден.");
      echo = bot.profile.displayName; step = "detail"; selectedBotId = bot.id;
      body = botMenuBody(bot.profile.link);
    } else if (input.action === "api_token" || input.action === "settings") {
      if (step !== "detail" || !selectedBotId) invalidStep();
      const bot = await db.managedBot.findFirst({ where: { id: selectedBotId!, ownerId }, include: { profile: true } });
      if (!bot) throw new HttpError(404, "Бот не найден.");
      step = input.action; echo = step === "api_token" ? "API Токен" : "Настройки бота";
      if (step === "api_token") {
        token = await activeBotToken(db, conversationId, bot);
        body = token ? `API токен для @${bot.profile.link}:\n${token}` : "Текущий токен недоступен. Нажмите «Отозвать токен», чтобы получить новый.";
      } else {
        body = `Настройки бота @${bot.profile.link}.\n\nВыберите действие в меню.`;
      }
    } else if (input.action === "change_name" || input.action === "change_username") {
      if (step !== "settings" || !selectedBotId) invalidStep();
      const bot = await db.managedBot.findFirst({ where: { id: selectedBotId!, ownerId }, include: { profile: true } });
      if (!bot || !bot.profile.isBot || bot.profile.isSystemAccount) throw new HttpError(404, "Бот не найден.");
      const editingName = input.action === "change_name";
      step = editingName ? "name_edit" : "username_edit";
      echo = editingName ? "Изменить имя" : "Изменить уникальное имя";
      title = editingName ? "Как назовём вашего бота?" : "Новое уникальное имя";
      body = editingName ? "Введите новое имя вашего бота. До 64 символов." : "Введите новое уникальное имя бота. 4–32 символа: латинские буквы, цифры и _. Окончание — bot.";
    } else if (input.action === "change_avatar" || input.action === "group_permissions") {
      if (step !== "settings" || !selectedBotId) invalidStep();
      const bot = await db.managedBot.findFirst({ where: { id: selectedBotId!, ownerId }, include: { profile: true } });
      if (!bot) throw new HttpError(404, "Бот не найден.");
      if (input.action === "change_avatar") {
        echo = "Сменить аватар"; step = "avatar_edit"; title = "Загрузите аватар";
        body = "Пришлите изображение для профиля вашего бота. Подойдут JPG, PNG или WebP размером до 5 МБ.";
      } else {
        echo = "Разрешение для групп"; step = "group_permissions"; title = "Эта функция в разработке";
        body = "Возможность добавлять ботов в группы пока недоступна.\n\nСледите за обновлениями, ведь эта функция появится в следующем обновлении!";
      }
    } else if (input.action === "avatar" && step === "avatar_edit") {
      if (!selectedBotId) invalidStep();
      if (!input.avatar) throw new HttpError(400, "Пришлите изображение.");
      const bot = await db.managedBot.findFirst({ where: { id: selectedBotId!, ownerId }, include: { profile: true } });
      if (!bot || !bot.profile.isBot || bot.profile.isSystemAccount) throw new HttpError(404, "Бот не найден.");
      const avatarUrl = `/media/${input.avatar.objectKey}`;
      await db.mediaAsset.create({ data: { ownerId: bot.profileId, kind: "image", scopeType: "legacy", ...input.avatar } });
      updatedBotProfile = await db.user.update({ where: { id: bot.profileId }, data: { avatarUrl }, select: { id: true, link: true, displayName: true, avatarUrl: true, backgroundUrl: true } });
      echo = "Аватар для бота"; step = "settings";
      body = `Аватар бота @${bot.profile.link} обновлён.\n\nВыберите действие в меню.`;
    } else if (input.action === "delete" || input.action === "confirm_delete") {
      if (step !== (input.action === "delete" ? "detail" : "delete_confirm") || !selectedBotId) invalidStep();
      const bot = await db.managedBot.findFirst({ where: { id: selectedBotId!, ownerId }, include: { profile: true } });
      if (!bot || !bot.profile.isBot || bot.profile.isSystemAccount || bot.profileId === ownerId) throw new HttpError(404, "Бот не найден.");
      if (input.action === "delete") {
        echo = "Удалить бота"; step = "delete_confirm";
        body = `Вы уверены, что хотите удалить бота ${bot.profile.displayName} (@${bot.profile.link})?\n\nПрофиль бота и его личные диалоги будут удалены, а токен перестанет работать. Юзернейм освободится. Восстановить бота и переписку будет невозможно.\n\nЧтобы удалить бота, нажмите «Подтвердить».`;
      } else {
        echo = "Подтвердить";
        const conversations = await db.conversation.findMany({ where: { type: "direct", participants: { some: { userId: bot.profileId } } }, select: { id: true, participants: { select: { userId: true } } } });
        const conversationIds = conversations.map(conversation => conversation.id);
        const messages = await db.message.findMany({ where: { conversationId: { in: conversationIds } }, select: { id: true } });
        await db.hiddenChatMessage.deleteMany({ where: { chatType: "direct", messageId: { in: messages.map(message => message.id) } } });
        await db.conversation.deleteMany({ where: { id: { in: conversationIds } } });
        const media = await db.mediaAsset.findMany({ where: { ownerId: bot.profileId }, select: { bucket: true, objectKey: true } });
        await db.user.delete({ where: { id: bot.profileId } });
        deletedBot = { profileId: bot.profileId, link: bot.profile.link, userIds: [...new Set(conversations.flatMap(conversation => conversation.participants.map(participant => participant.userId)).filter(id => id !== bot.profileId))], media };
        body = "Бот удалён. Его токен больше не работает, а юзернейм свободен. Выберите действие в меню.";
        step = "bots"; clearDraft();
      }
    } else if (input.action === "rotate" || input.action === "revoke") {
      if (step !== "api_token" || !selectedBotId) invalidStep();
      const bot = await db.managedBot.findFirst({ where: { id: selectedBotId!, ownerId }, include: { profile: true } });
      if (!bot) throw new HttpError(404, "Бот не найден.");
      echo = "Отозвать токен";
      const issued = issueBotToken(bot.id);
      await db.managedBot.update({ where: { id: bot.id }, data: { tokenHash: issued.hash, tokenEnc: encryptAtRest(issued.token), webhookUrlEnc: null, webhookSecretEnc: null, webhookVersion: { increment: 1 } } });
      token = issued.token;
      body = `Токен для @${bot.profile.link} отозван.\n\nНовый токен:\n${token}`;
    } else if (input.action === "submit") {
      if (step === "name_edit" || step === "username_edit") {
        if (!selectedBotId) invalidStep();
        const bot = await db.managedBot.findFirst({ where: { id: selectedBotId!, ownerId }, include: { profile: true } });
        if (!bot || !bot.profile.isBot || bot.profile.isSystemAccount) throw new HttpError(404, "Бот не найден.");
        const editingName = step === "name_edit";
        const value = editingName ? botName(echo) : botUsername(echo);
        if (!editingName) {
          await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-username:${value}`}, 0))`;
          if (await usernameTaken(db, value, bot.profileId)) throw new HttpError(409, "Это уникальное имя уже занято. Выберите другое.");
        }
        previousBotLink = bot.profile.link;
        updatedBotProfile = await db.user.update({ where: { id: bot.profileId }, data: editingName ? { displayName: value } : { link: value }, select: { id: true, link: true, displayName: true, avatarUrl: true, backgroundUrl: true } });
        step = "settings";
        body = editingName ? `Имя бота изменено: ${value}.\n\nВыберите действие в меню.` : `Уникальное имя бота изменено: @${value}.\n\nВыберите действие в меню.`;
      } else if (step === "name") {
        displayName = botName(echo); step = "username";
        title = "Выберите адрес бота";
        body = "Введите юзернейм бота. 4–32 символа: латинские буквы, цифры и _. Окончание — bot.";
      } else if (step === "username") {
        username = botUsername(echo);
        if (await usernameTaken(db, username)) {
          username = null; title = "Этот адрес уже занят"; body = "Попробуйте другой юзернейм. Имя вашего бота сохранено.";
        } else {
          step = "avatar"; title = "Добавим аватар?";
          body = "Пришлите изображение для аватара бота или нажмите «Пропустить».";
        }
      } else {
        shouldReply = false;
      }
    } else if (input.action === "skip" || input.action === "avatar") {
      if (step !== "avatar" || !displayName || !username) invalidStep();
      if (input.action === "avatar" && !input.avatar) throw new HttpError(400, "Пришлите изображение.");
      echo = input.action === "skip" ? "Пропустить" : "Аватар для бота";
      // Serialize creations of the same address, then check the whole existing namespace again.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-username:${username}`}, 0))`;
      if (!username!.toLowerCase().endsWith("bot")) {
        step = "username"; username = null;
        title = "Выберите адрес бота"; body = "Юзернейм бота должен оканчиваться на bot.";
      } else if (await usernameTaken(db, username!)) {
        step = "username"; username = null;
        title = "Адрес успели занять"; body = "Выберите другой юзернейм. Имя бота сохранено.";
      } else {
        if (await db.managedBot.count({ where: { ownerId } }) >= 10) throw new HttpError(400, "Лимит: 10 ботов.");
        const profileId = randomUUID();
        let avatarUrl: string | null = null;
        if (input.avatar) {
          avatarUrl = `/media/${input.avatar.objectKey}`;
          await db.mediaAsset.create({ data: { ownerId, kind: "image", scopeType: "legacy", ...input.avatar } });
        }
        const profile = await db.user.create({ data: { id: profileId, link: username!, displayName: displayName!, passwordHash: passwordHash!, isBot: true, isSystemAccount: false, avatarUrl } });
        if (input.avatar) {
          // Ownership of public bot artwork moves to the bot profile; ordinary uploads remain private.
          await db.mediaAsset.updateMany({ where: { objectKey: input.avatar.objectKey, ownerId }, data: { ownerId: profile.id } });
        }
        const id = randomUUID(); const issued = issueBotToken(id);
        await db.managedBot.create({ data: { id, ownerId, profileId: profile.id, tokenHash: issued.hash, tokenEnc: encryptAtRest(issued.token), legacyUpdatesImported: true } });
        token = issued.token; title = "Eclipse API";
        body = tokenBody(username!, token);
        step = "bots"; clearDraft();
      }
    } else invalidStep();
    const messages: EclipseSystemMessage[] = [];
    const write = async (senderId: string, role: "user" | "assistant", messageTitle: string, messageBody: string, botToken?: string) => {
      const payload: EclipseSystemPayload = { title: messageTitle, body: "", eventType: "bot_management", botRole: role,
        protectedBody: encryptAtRest(JSON.stringify({ body: messageBody, ...(botToken ? { botToken } : {}) })) };
      const message = await db.message.create({ data: { conversationId, senderId, isSystemMessage: true, systemPayload: payload as Prisma.InputJsonValue } });
      messages.push({ id: message.id, senderId, senderType: "system", systemPayload: revealEclipsePayload(message.systemPayload), createdAt: message.createdAt.toISOString(), reactions: [] });
    };
    await write(ownerId, "user", "", echo);
    if (shouldReply) await write(systemBot.id, "assistant", title, body, token);
    await db.botManagementSession.update({ where: { ownerId }, data: { step, displayName, username, selectedBotId, revision: { increment: 1 } } });
    await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    await db.conversationParticipant.updateMany({ where: { conversationId, userId: ownerId }, data: { lastReadAt: new Date() } });
    const response = { state: await stateFor(ownerId, db), messages };
    await db.botManagementRequest.deleteMany({ where: { ownerId, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
    await db.botManagementRequest.create({ data: { id: input.requestId, ownerId, inputHash, responseEnc: encryptAtRest(JSON.stringify(response)) } });
    return response;
  }, { timeout: 15_000 });
  if (updatedBotProfile) {
    const profile = updatedBotProfile as { id: string; link: string; displayName: string; avatarUrl: string | null; backgroundUrl: string | null };
    invalidateUserCache(profile.id);
    await Promise.allSettled([redis.del(`profile:page:v3:${profile.link}`), redis.del(`profile:page:v3:${previousBotLink ?? profile.link}`), redis.del(`profile:preview:v2:${profile.id}`), redis.del(`profile:details:${profile.id}`), redis.del(`profile:preview:${profile.id}`)]);
    const peers = await prisma.conversationParticipant.findMany({ where: { conversation: { type: "direct", participants: { some: { userId: profile.id } } } }, select: { userId: true } });
    const userIds = [...new Set([ownerId, ...peers.map(peer => peer.userId)])];
    await invalidateChatListPayloadCache(userIds);
    await Promise.allSettled(userIds.map(userId => triggerRealtimeEvent({ channel: userPrivateChannel(userId), name: "profile:updated", data: { ...profile, previousLink: previousBotLink ?? profile.link } })));
  }
  if (deletedBot) {
    const removed = deletedBot as DeletedBot;
    await invalidateChatListPayloadCache(removed.userIds);
    await Promise.allSettled(removed.userIds.map(userId => triggerRealtimeEvent({ channel: userPrivateChannel(userId), name: "chat:deleted", data: { chatType: "direct", fromUserId: removed.profileId, fromLink: removed.link } })));
    await Promise.allSettled(removed.media.filter(asset => asset.bucket && asset.objectKey).map(asset => deleteMediaObject(asset.bucket!, asset.objectKey!)));
  }
  invalidateChatListPayloadCache(ownerId);
  // Never publish tokens or protected message bodies through realtime notifications.
  await triggerRealtimeEvent({ channel: userPrivateChannel(ownerId), name: "message:new", data: { chatType: "eclipse", fromLink: "eclipse", id: result.messages.at(-1)?.id, createdAt: result.messages.at(-1)?.createdAt, refresh: true } }).catch(() => {});
  return result;
}
