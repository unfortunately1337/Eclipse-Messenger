"use client";

/* eslint-disable @next/next/no-img-element */
import { type CreateChatKind, type CreateChatStep, type CreateChatDraft, type ProfileBatchItem } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { PanelNavigation } from "../components/common/PanelNavigation";
import { PANEL_TRANSITION } from "@/lib/client/panel-motion";
import { CSSProperties, ChangeEvent, memo } from "react";
import { ArrowLeft, Camera, Check, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { MediaAvatar } from "@/components/ui/media";
import { OnlineStatusDot } from "@/components/ui/online-status-dot";
import { Spinner } from "@/components/ui/spinner";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { showAppToast } from "@/lib/client/app-toast";
import { cn } from "@/lib/utils";
import { type LiveBackgroundNeatPreset } from "@/lib/client/live-background";
import { THEME_SOLID_COLOR_MAP } from "../components/common/TelegramDoodleWallpaper";
import { telegramSubViewVariants } from "./config";

export interface CreateCommunityPanelProps {
  createChatKind: CreateChatKind | null;
  closeCreateChat: () => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  uiAccentStyle: React.CSSProperties;
  leftSidebarThemeStyle: React.CSSProperties | undefined;
  createChatStep: CreateChatStep;
  setCreateChatStep: React.Dispatch<React.SetStateAction<CreateChatStep>>;
  createChatSelectedIds: Set<string>;
  setErrorText: (message: string | null) => void;
  submitCreateChat: () => Promise<void>;
  createChatDraft: CreateChatDraft;
  setCreateChatContactQuery: React.Dispatch<React.SetStateAction<string>>;
  ensureCreateChatContacts: (force?: boolean | undefined) => Promise<void>;
  createChatCreating: boolean;
  createChatNavDirection: "forward" | "backward";
  liveBackgroundPreset: LiveBackgroundNeatPreset;
  pickCreateChatPhoto: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  setCreateChatDraft: React.Dispatch<React.SetStateAction<CreateChatDraft>>;
  createChatContactQuery: string;
  createChatContactsLoading: boolean;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  filteredCreateChatContacts: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  selfId: string | null;
  toggleCreateChatContact: (id: string) => void;
}

export const CreateCommunityPanel = memo(function CreateCommunityPanel({ createChatKind, closeCreateChat, t, uiAccentStyle, leftSidebarThemeStyle, createChatStep, setCreateChatStep, createChatSelectedIds, setErrorText, submitCreateChat, createChatDraft, setCreateChatContactQuery, ensureCreateChatContacts, createChatCreating, createChatNavDirection, liveBackgroundPreset, pickCreateChatPhoto, setCreateChatDraft, createChatContactQuery, createChatContactsLoading, contactsForAdd, filteredCreateChatContacts, readProfileFromCache, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, selfId, toggleCreateChatContact }: CreateCommunityPanelProps) {
  return (
    <AnimatePresence>
      {createChatKind ? (
        <motion.div
          className="fixed inset-0 z-[145] flex justify-start p-0"
        >
          <motion.button
            type="button"
            className="fixed inset-0 z-[135] bg-black/35 md:bg-black/12"
            onClick={closeCreateChat}
            aria-label={t("Закрыть создание чата")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
          <motion.div
            data-app-panel className="fixed inset-y-0 left-0 z-[145] flex w-full flex-col overflow-hidden bg-[#1b1b1b] text-zinc-50 shadow-[18px_0_42px_rgba(0,0,0,0.28)] md:w-[350px] lg:w-[370px] md:inset-y-2 md:left-2 md:rounded-2xl"
            style={{ ...uiAccentStyle, ...leftSidebarThemeStyle }}
            initial={{ x: -36, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -28, opacity: 0 }}
            transition={PANEL_TRANSITION}
          >
            <div className="flex h-14 shrink-0 items-center gap-3 px-4">
              <button
                type="button"
                onClick={() => {
                  if (createChatKind === "group") {
                    if (createChatStep === "settings") {
                      setCreateChatStep("details");
                      return;
                    }
                    if (createChatStep === "details") {
                      setCreateChatStep("members");
                      return;
                    }
                  } else if (createChatKind === "channel") {
                    if (createChatStep === "members") {
                      setCreateChatStep("settings");
                      return;
                    }
                    if (createChatStep === "settings") {
                      setCreateChatStep("details");
                      return;
                    }
                  }
                  closeCreateChat();
                }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                aria-label={t("Назад")}
              >
                <ArrowLeft size={23} />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[20px] font-semibold leading-none">
                  {createChatStep === "members"
                    ? (createChatKind === "group" ? t("Создать группу") : t("Добавить участников"))
                    : createChatStep === "settings"
                      ? (createChatKind === "group" ? t("Настройки группы") : t("Настройки канала"))
                      : createChatKind === "channel"
                        ? t("Новый канал")
                        : t("Новая группа")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (createChatStep === "members") {
                    if (createChatKind === "group") {
                      if (createChatSelectedIds.size === 0) {
                        setErrorText(null);
                        showAppToast({ title: t("Выберите хотя бы одного участника."), type: "error" });
                        return;
                      }
                      setCreateChatStep("details");
                      return;
                    }
                    void submitCreateChat();
                    return;
                  }
                  if (createChatStep === "details") {
                    const normalizedName = createChatDraft.name.trim();
                    if (normalizedName.length < 2) {
                      setErrorText(null);
                      showAppToast({ title: t("Название должно содержать не менее 2 символов."), type: "error" });
                      return;
                    }
                    setCreateChatStep("settings");
                    return;
                  }
                  if (createChatStep === "settings") {
                    if (createChatKind === "channel") {
                      const normalizedLink = createChatDraft.link.trim().replace(/^@+/, "").toLowerCase();
                      const isLinkValid = /^[a-z][a-z0-9_]{2,30}[a-z0-9]$/.test(normalizedLink);
                      if (createChatDraft.isPublic && !isLinkValid) {
                        setErrorText(null);
                        showAppToast({ title: t("Введите корректное уникальное имя (от 4 символов, буквы, цифры, подчеркивания)."), type: "error" });
                        return;
                      }
                      setCreateChatContactQuery("");
                      setCreateChatStep("members");
                      void ensureCreateChatContacts();
                    } else {
                      void submitCreateChat();
                    }
                    return;
                  }
                }}
                disabled={createChatCreating}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-40 cursor-pointer"
                aria-label={t("Далее")}
              >
                {createChatCreating ? (
                  <Spinner className="h-5 w-5" />
                ) : (
                  <Check size={22} />
                )}
              </button>
            </div>

            <div
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6"
            >
              <PanelNavigation direction={createChatNavDirection}>
                {createChatStep === "details" && (
                  <motion.div
                    key="create-step-details"
                    custom={createChatNavDirection}
                    variants={telegramSubViewVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="pb-6 pt-1"
                  >
                    {/* Combined Panel Card matching Image 3 */}
                    <div className="mx-4 overflow-hidden rounded-[26px] bg-white/[0.04] p-5 pb-5 space-y-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                      {/* Centered Avatar Picker without plus icon */}
                      <div className="flex flex-col items-center pt-2 pb-3 text-center">
                        <label
                          className={cn(
                            "group relative w-[108px] h-[108px] flex items-center justify-center shrink-0 cursor-pointer rounded-full overflow-hidden transition-colors",
                            liveBackgroundPreset === "none"
                              ? "bg-white text-zinc-950 shadow-[0_12px_32px_rgba(255,255,255,0.18)]"
                              : "bg-[var(--ui-accent-solid,#38bdf8)] text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)]"
                          )}
                          style={
                            liveBackgroundPreset !== "none" && THEME_SOLID_COLOR_MAP[liveBackgroundPreset]
                              ? { backgroundColor: THEME_SOLID_COLOR_MAP[liveBackgroundPreset] }
                              : undefined
                          }
                        >
                          {createChatDraft.photoDataUrl ? (
                            <img src={createChatDraft.photoDataUrl} alt={t("Аватар")} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Camera size={46} strokeWidth={2} />
                            </div>
                          )}
                          <span className="absolute inset-0 bg-black/35 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                            <Camera size={38} />
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => void pickCreateChatPhoto(event)} />
                        </label>
                      </div>

                      {/* Name Input matching Image 3 */}
                      <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5 flex items-center">
                        <input
                          type="text"
                          value={createChatDraft.name}
                          onChange={(event) => setCreateChatDraft((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder={createChatKind === "channel" ? t("Название канала") : t("Название группы")}
                          className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500"
                          maxLength={60}
                        />
                      </div>
                      <label className="block rounded-[18px] border border-white/[0.08] px-4 py-3.5 focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-colors duration-200">
                        <textarea aria-label={t("Описание")} value={createChatDraft.description ?? ""} onChange={event => setCreateChatDraft(prev => ({ ...prev, description: event.target.value }))} placeholder={t("Описание")} maxLength={255} rows={2} className="block w-full resize-none bg-transparent text-[15px] leading-6 text-white outline-none placeholder:text-zinc-500" />
                        <span className="block text-right text-[11px] text-zinc-500">{(createChatDraft.description ?? "").length}/255</span>
                      </label>
                    </div>

                    <p className="px-6 pt-3 text-[13px] text-zinc-400/90 leading-relaxed">
                      {createChatKind === "channel"
                        ? t("Укажите название вашего канала для будущих подписчиков.")
                        : t("Укажите название для участников группы.")}
                    </p>

                  </motion.div>
                )}

                {createChatStep === "settings" && (
                  <motion.div
                    key="create-step-settings"
                    custom={createChatNavDirection}
                    variants={telegramSubViewVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="pt-3 pb-6 space-y-4"
                  >
                    <div className="px-5">
                      <span className="text-[13px] font-medium text-zinc-400 block mb-2 px-1">
                        {t("Тип ")}{createChatKind === "channel" ? t("канала") : t("группы")}
                      </span>

                      <div className="overflow-hidden rounded-[24px] bg-white/[0.04] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)] flex flex-col">
                        {/* Option 1: Private */}
                        <button
                          type="button"
                          onClick={() => setCreateChatDraft((prev) => ({ ...prev, isPublic: false }))}
                          className="flex min-h-[56px] w-full items-center justify-between px-3.5 py-3 text-left rounded-[18px] transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <span className="block text-[15px] font-medium text-zinc-100">
                              {createChatKind === "channel" ? t("Приватный") : t("Приватная")}
                            </span>
                            <span className="block mt-0.5 text-[12px] leading-normal text-zinc-400">
                              {createChatKind === "channel"
                                ? t("Приватные каналы доступны только по ссылке-приглашению.")
                                : t("Приватные группы доступны только по приглашению участников.")}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                              !createChatDraft.isPublic ? "border-[color:var(--ui-accent-solid,#38bdf8)]" : "border-zinc-600"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full transition-transform",
                                !createChatDraft.isPublic ? "scale-100 bg-[var(--ui-accent-solid,#38bdf8)]" : "scale-0 bg-transparent"
                              )}
                            />
                          </span>
                        </button>

                        {/* Option 2: Public */}
                        <button
                          type="button"
                          onClick={() => setCreateChatDraft((prev) => ({ ...prev, isPublic: true }))}
                          className="flex min-h-[56px] w-full items-center justify-between px-3.5 py-3 text-left rounded-[18px] transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <span className="block text-[15px] font-medium text-zinc-100">
                              {createChatKind === "channel" ? t("Публичный") : t("Публичная")}
                            </span>
                            <span className="block mt-0.5 text-[12px] leading-normal text-zinc-400">
                              {createChatKind === "channel"
                                ? t("Публичные каналы доступны для входа всем желающим через поиск.")
                                : t("Публичные группы доступны для входа всем желающим через поиск.")}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                              createChatDraft.isPublic ? "border-[color:var(--ui-accent-solid,#38bdf8)]" : "border-zinc-600"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full transition-transform",
                                createChatDraft.isPublic ? "scale-100 bg-[var(--ui-accent-solid,#38bdf8)]" : "scale-0 bg-transparent"
                              )}
                            />
                          </span>
                        </button>
                      </div>
                    </div>

                    {createChatDraft.isPublic ? (
                      <div className="space-y-2">
                        <div className="mx-5 overflow-hidden rounded-[24px] bg-white/[0.04] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-2.5">
                          <span className="text-[14px] font-medium text-zinc-300 px-1">
                            {createChatKind === "group" ? t("Уникальное имя группы") : t("Уникальное имя канала")}
                          </span>
                          <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5 flex items-center">
                            <span className="text-[15px] font-mono text-zinc-400 select-none shrink-0 pr-1">@</span>
                            <input
                              type="text"
                              value={createChatDraft.link}
                              onChange={(event) =>
                                setCreateChatDraft((prev) => ({
                                  ...prev,
                                  link: event.target.value.toLowerCase().replace(/^@+/u, ""),
                                }))
                              }
                              placeholder=""
                              className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-white outline-none placeholder:text-zinc-500"
                              maxLength={32}
                            />
                          </div>
                        </div>
                        <p className="px-7 text-[12.5px] text-zinc-500 leading-relaxed">
                          {t("Выберите уникальное имя. По нему другие люди смогут найти ")}{createChatKind === "group" ? t("группу") : t("канал")} {t(" в поиске и присоединиться.")}<br />
                          {t("Минимальная длина — ")}<strong className="font-semibold text-zinc-300">4</strong> {t(" символа (буквы, цифры и знак подчеркивания).")}</p>
                      </div>
                    ) : (
                      <p className="px-7 text-[12.5px] text-zinc-500 leading-relaxed">
                        {t("Люди смогут присоединиться к ")}{createChatKind === "channel" ? t("каналу") : t("группе")} {t(" только по специальной ссылке-приглашению. Вы сможете создать её сразу после завершения создания.")}</p>
                    )}
                  </motion.div>
                )}

                {createChatStep === "members" && (
                  <motion.div
                    key="create-step-members"
                    custom={createChatNavDirection}
                    variants={telegramSubViewVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <div className="px-4 pb-3 pt-1">
                      <div className="relative flex h-[40px] w-full items-center rounded-xl bg-[#212124] px-3.5 transition-colors focus-within:bg-[#28282c]">
                        <Search size={18} strokeWidth={1.8} className="text-[#707076] shrink-0" />
                        <input
                          value={createChatContactQuery}
                          onChange={(event) => setCreateChatContactQuery(event.target.value)}
                          placeholder={t("Поиск контактов...")}
                          className="ml-2.5 w-full bg-transparent text-[15px] font-normal text-zinc-100 placeholder:text-[#707076] outline-none focus:ring-0"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div>
                      {createChatContactsLoading ? (
                        <div className="grid min-h-[180px] place-items-center">
                          <Spinner className="h-6 w-6 text-zinc-400" />
                        </div>
                      ) : contactsForAdd.length === 0 ? (
                        <div className="px-7 py-6 text-[14.5px] text-zinc-400">{t("У вас пока нет сохраненных контактов.")}</div>
                      ) : filteredCreateChatContacts.length === 0 ? (
                        <div className="px-7 py-6 text-[14.5px] text-zinc-400">{t("Пользователи не найдены.")}</div>
                      ) : (
                        <div className="space-y-0.5 px-2">
                          {filteredCreateChatContacts.map((contact) => {
                            const selected = createChatSelectedIds.has(contact.id);
                            const displayName = contact.alias || contact.displayName || contact.link;
                            const cachedProfile = readProfileFromCache(contact.id);
                            const isOnline = onlineUserIds.has(contact.id);
                            const statusText = t(getPresenceStatusText(
                              contact.id,
                              onlineUserIds,
                              lastOfflineAtByUserId,
                              presenceNowTs,
                              contact.id === selfId || cachedProfile?.presenceVisibility !== "none",
                              contact.id === selfId || cachedProfile?.lastSeenVisibility !== "none",
                            ));
                            return (
                              <button
                                key={contact.id}
                                type="button"
                                onClick={() => toggleCreateChatContact(contact.id)}
                                className="mx-1 w-[calc(100%-8px)] rounded-[18px] px-3.5 py-2 text-left outline-none transition-all duration-200 hover:bg-white/[0.05] active:scale-[0.99] flex items-center gap-3.5 cursor-pointer"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="relative shrink-0">
                                    <MediaAvatar
                                      src={contact.avatarUrl ?? undefined}
                                      alt={displayName}
                                      className="h-10 w-10 rounded-full"
                                      fallbackText={displayName.slice(0, 1)}
                                      autoPlay
                                    />
                                    <AnimatePresence initial={false} mode="wait">
                                      {selected ? (
                                        <motion.div
                                          key="check"
                                          initial={{ scale: 0, opacity: 0 }}
                                          animate={{ scale: 1, opacity: 1 }}
                                          exit={{ scale: 0, opacity: 0 }}
                                          transition={{ duration: 0.15, ease: "easeOut" }}
                                          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast,#ffffff)] shadow-[0_1px_4px_rgba(0,0,0,0.4)] ring-1 ring-[#1f1f1f]"
                                        >
                                          <Check size={11} strokeWidth={4} className="shrink-0" />
                                        </motion.div>
                                      ) : (
                                        isOnline ? (
                                          <motion.div
                                            key="online"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                          >
                                            <OnlineStatusDot className="bottom-0.5 right-0.5 h-2.5 w-2.5" />
                                          </motion.div>
                                        ) : null
                                      )}
                                    </AnimatePresence>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[14.5px] font-semibold text-zinc-100"><VerifiedTitle kind="user" link={contact.link}>{displayName}</VerifiedTitle></p>
                                    <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400">{statusText}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </PanelNavigation>
            </div>

          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});
