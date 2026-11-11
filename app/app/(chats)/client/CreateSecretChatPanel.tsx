"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type ProfileBatchItem } from "../types";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { PANEL_TRANSITION } from "@/lib/client/panel-motion";
import { memo } from "react";
import { ArrowLeft, Check, Info, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { MediaAvatar } from "@/components/ui/media";
import { OnlineStatusDot } from "@/components/ui/online-status-dot";
import { Spinner } from "@/components/ui/spinner";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { cn } from "@/lib/utils";

export interface CreateSecretChatPanelProps {
  secretChatCreateOpen: boolean;
  secretChatCreateStep: "details" | "members";
  setSecretChatCreateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  secretChatSearchQuery: string;
  setSecretChatSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  createChatContactsLoading: boolean;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  selfId: string | null;
  setSecretChatSelectedUserIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSecretChatTitle: React.Dispatch<React.SetStateAction<string>>;
  setSecretChatCreateStep: React.Dispatch<React.SetStateAction<"details" | "members">>;
  handleSecretChatPresetSelect: (preset: "custom" | "1h" | "1d" | "1w" | "1m") => void;
  secretChatLifetimePreset: "custom" | "1h" | "1d" | "1w" | "1m";
  secretChatLifetimeDays: number;
  setSecretChatLifetimeDays: React.Dispatch<React.SetStateAction<number>>;
  secretChatLifetimeHours: number;
  setSecretChatLifetimeHours: React.Dispatch<React.SetStateAction<number>>;
  secretChatLifetimeMinutes: number;
  setSecretChatLifetimeMinutes: React.Dispatch<React.SetStateAction<number>>;
  submitCreateSecretChat: () => Promise<void>;
  secretChatCreating: boolean;
  secretChatSelectedUserIds: Set<string>;
}

export const CreateSecretChatPanel = memo(function CreateSecretChatPanel({ secretChatCreateOpen, secretChatCreateStep, setSecretChatCreateOpen, t, secretChatSearchQuery, setSecretChatSearchQuery, createChatContactsLoading, contactsForAdd, readProfileFromCache, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, selfId, setSecretChatSelectedUserIds, setSecretChatTitle, setSecretChatCreateStep, handleSecretChatPresetSelect, secretChatLifetimePreset, secretChatLifetimeDays, setSecretChatLifetimeDays, secretChatLifetimeHours, setSecretChatLifetimeHours, secretChatLifetimeMinutes, setSecretChatLifetimeMinutes, submitCreateSecretChat, secretChatCreating, secretChatSelectedUserIds }: CreateSecretChatPanelProps) {
  return (
    <AnimatePresence>
      {secretChatCreateOpen ? (
        <motion.div
          className="fixed inset-0 z-[94] flex justify-start p-0"
        >
          {/* Backdrop — only for the details step so user can close */}
          {secretChatCreateStep === "details" && (
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/38"
              onClick={() => setSecretChatCreateOpen(false)}
              aria-label={t("Закрыть")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            />
          )}

          <motion.div
            className="app-panel-surface relative flex h-full w-full flex-col overflow-hidden bg-[#1f1f1f] text-zinc-100 shadow-[18px_0_42px_rgba(0,0,0,0.30)] md:w-[350px] lg:w-[370px]"
            initial={{ opacity: 0, x: -34 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={PANEL_TRANSITION}
          >
            {/* ---- STEP 1: Contact picker ---- */}
            {secretChatCreateStep === "members" && (
              <>
                {/* Header */}
                <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                  <button
                    type="button"
                    onClick={() => setSecretChatCreateOpen(false)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                    aria-label={t("Закрыть")}
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <h2 className="flex-1 truncate text-[21px] font-semibold leading-none text-zinc-50">{t("Секретный чат")}</h2>
                </div>

                <div className="px-4 pb-3 pt-1">
                  <div className="relative flex h-[40px] w-full items-center rounded-xl bg-[#212124] px-3.5 transition-colors focus-within:bg-[#28282c]">
                    <Search size={18} strokeWidth={1.8} className="text-[#707076] shrink-0" />
                    <input
                      value={secretChatSearchQuery}
                      onChange={(e) => setSecretChatSearchQuery(e.target.value)}
                      placeholder={t("Поиск контактов...")}
                      className="ml-2.5 w-full bg-transparent text-[15px] font-normal text-zinc-100 placeholder:text-[#707076] outline-none focus:ring-0"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Contact list — same item layout as the real chat list */}
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-1">
                  {createChatContactsLoading ? (
                    <div className="grid min-h-[180px] place-items-center">
                      <Spinner className="h-6 w-6 text-zinc-400" />
                    </div>
                  ) : contactsForAdd.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[15px] text-zinc-400">{t("Нет знакомых.")}</div>
                  ) : (
                    <>
                      {contactsForAdd
                        .filter((c) => {
                          const q = secretChatSearchQuery.trim().toLowerCase();
                          if (!q) return true;
                          const name = c.alias || c.displayName || c.link || "";
                          return name.toLowerCase().includes(q) || c.link.toLowerCase().includes(q);
                        })
                        .map((contact) => {
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
                              onClick={() => {
                                setSecretChatSelectedUserIds(new Set([contact.id]));
                                setSecretChatTitle(displayName);
                                setSecretChatCreateStep("details");
                              }}
                              className="mx-3 w-[calc(100%-24px)] rounded-[16px] px-3.5 py-2 text-left outline-none transition-all duration-200 hover:bg-white/[0.05] active:scale-[0.99] flex items-center justify-between gap-3.5"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                  <MediaAvatar
                                    src={contact.avatarUrl ?? undefined}
                                    alt={displayName}
                                    className="h-10 w-10 rounded-full"
                                    fallbackText={displayName.slice(0, 1)}
                                    autoPlay
                                  />
                                  {isOnline && <OnlineStatusDot className="bottom-0.5 right-0.5 h-2.5 w-2.5" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[14.5px] font-semibold text-zinc-100"><VerifiedTitle kind="user" link={contact.link}>{displayName}</VerifiedTitle></p>
                                  <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400">{statusText}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ---- STEP 2: Duration picker ---- */}
            {secretChatCreateStep === "details" && (
              <>
                <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                  <button
                    type="button"
                    onClick={() => setSecretChatCreateStep("members")}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                    aria-label={t("Назад")}
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <h2 className="truncate text-[21px] font-semibold leading-none text-zinc-50">{t("Время жизни")}</h2>
                </div>

                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-28 px-4 py-4 space-y-4">
                  {/* Time picker preset list */}
                  <div className="space-y-4">
                    <span className="text-[13px] font-semibold text-zinc-400 block px-1">
                      {t("Выберите время жизни чата")}</span>

                    <div className="overflow-hidden rounded-2xl bg-white/[0.045] flex flex-col">
                      {/* Option 1: 1 Hour */}
                      <button
                        type="button"
                        onClick={() => handleSecretChatPresetSelect('1h')}
                        className="flex w-full items-center justify-between border-b border-white/[0.045] px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/[0.03]"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <span className="block text-[15px] font-semibold text-zinc-100">{t("1 час")}</span>
                          <span className="block mt-0.5 text-[12.5px] text-zinc-400">
                            {t("Чат автоматически удалится через 1 час.")}</span>
                        </div>
                        <span className={cn(
                          "grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          secretChatLifetimePreset === '1h' ? "border-[color:var(--ui-accent-solid)]" : "border-zinc-600"
                        )}>
                          <span className={cn(
                            "h-2.5 w-2.5 rounded-full transition-transform",
                            secretChatLifetimePreset === '1h' ? "scale-100 bg-[var(--ui-accent-solid)]" : "scale-0 bg-transparent"
                          )} />
                        </span>
                      </button>

                      {/* Option 2: 1 Day */}
                      <button
                        type="button"
                        onClick={() => handleSecretChatPresetSelect('1d')}
                        className="flex w-full items-center justify-between border-b border-white/[0.045] px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/[0.03]"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <span className="block text-[15px] font-semibold text-zinc-100">{t("1 день")}</span>
                          <span className="block mt-0.5 text-[12.5px] text-zinc-400">
                            {t("Чат автоматически удалится через 24 часа.")}</span>
                        </div>
                        <span className={cn(
                          "grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          secretChatLifetimePreset === '1d' ? "border-[color:var(--ui-accent-solid)]" : "border-zinc-600"
                        )}>
                          <span className={cn(
                            "h-2.5 w-2.5 rounded-full transition-transform",
                            secretChatLifetimePreset === '1d' ? "scale-100 bg-[var(--ui-accent-solid)]" : "scale-0 bg-transparent"
                          )} />
                        </span>
                      </button>

                      {/* Option 3: 1 Week */}
                      <button
                        type="button"
                        onClick={() => handleSecretChatPresetSelect('1w')}
                        className="flex w-full items-center justify-between border-b border-white/[0.045] px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/[0.03]"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <span className="block text-[15px] font-semibold text-zinc-100">{t("1 неделя")}</span>
                          <span className="block mt-0.5 text-[12.5px] text-zinc-400">
                            {t("Чат автоматически удалится через 7 дней.")}</span>
                        </div>
                        <span className={cn(
                          "grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          secretChatLifetimePreset === '1w' ? "border-[color:var(--ui-accent-solid)]" : "border-zinc-600"
                        )}>
                          <span className={cn(
                            "h-2.5 w-2.5 rounded-full transition-transform",
                            secretChatLifetimePreset === '1w' ? "scale-100 bg-[var(--ui-accent-solid)]" : "scale-0 bg-transparent"
                          )} />
                        </span>
                      </button>

                      {/* Option 4: 1 Month */}
                      <button
                        type="button"
                        onClick={() => handleSecretChatPresetSelect('1m')}
                        className="flex w-full items-center justify-between border-b border-white/[0.045] px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/[0.03]"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <span className="block text-[15px] font-semibold text-zinc-100">{t("1 месяц")}</span>
                          <span className="block mt-0.5 text-[12.5px] text-zinc-400">
                            {t("Чат автоматически удалится через 30 дней.")}</span>
                        </div>
                        <span className={cn(
                          "grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          secretChatLifetimePreset === '1m' ? "border-[color:var(--ui-accent-solid)]" : "border-zinc-600"
                        )}>
                          <span className={cn(
                            "h-2.5 w-2.5 rounded-full transition-transform",
                            secretChatLifetimePreset === '1m' ? "scale-100 bg-[var(--ui-accent-solid)]" : "scale-0 bg-transparent"
                          )} />
                        </span>
                      </button>

                      {/* Option 5: Custom */}
                      <button
                        type="button"
                        onClick={() => handleSecretChatPresetSelect('custom')}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/[0.03]"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <span className="block text-[15px] font-semibold text-zinc-100">{t("Свой вариант")}</span>
                          <span className="block mt-0.5 text-[12.5px] text-zinc-400">
                            {t("Настроить произвольный таймер жизни.")}</span>
                        </div>
                        <span className={cn(
                          "grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          secretChatLifetimePreset === 'custom' ? "border-[color:var(--ui-accent-solid)]" : "border-zinc-600"
                        )}>
                          <span className={cn(
                            "h-2.5 w-2.5 rounded-full transition-transform",
                            secretChatLifetimePreset === 'custom' ? "scale-100 bg-[var(--ui-accent-solid)]" : "scale-0 bg-transparent"
                          )} />
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Custom time picker dropdown */}
                  <AnimatePresence>
                    {secretChatLifetimePreset === 'custom' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.96 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/[0.045] p-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">{t("Дни")}</span>
                            <select
                              value={secretChatLifetimeDays}
                              onChange={(e) => setSecretChatLifetimeDays(Number(e.target.value))}
                              className="h-10 rounded-xl bg-white/[0.05] border-0 px-3.5 text-sm font-semibold text-zinc-100 outline-none focus:ring-0 cursor-pointer"
                            >
                              {Array.from({ length: 31 }, (_, i) => (
                                <option key={i} value={i} className="bg-[#18181b]">{i} {t(" д.")}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">{t("Часы")}</span>
                            <select
                              value={secretChatLifetimeHours}
                              onChange={(e) => setSecretChatLifetimeHours(Number(e.target.value))}
                              className="h-10 rounded-xl bg-white/[0.05] border-0 px-3.5 text-sm font-semibold text-zinc-100 outline-none focus:ring-0 cursor-pointer"
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i} className="bg-[#18181b]">{i} {t(" ч.")}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider pl-1">{t("Минуты")}</span>
                            <select
                              value={secretChatLifetimeMinutes}
                              onChange={(e) => setSecretChatLifetimeMinutes(Number(e.target.value))}
                              className="h-10 rounded-xl bg-white/[0.05] border-0 px-3.5 text-sm font-semibold text-zinc-100 outline-none focus:ring-0 cursor-pointer"
                            >
                              {Array.from({ length: 60 }, (_, i) => (
                                <option key={i} value={i} className="bg-[#18181b]">{i} {t(" мин.")}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Information about automatic deletion */}
                  <div className="flex gap-2.5 rounded-xl bg-white/[0.03] px-3.5 py-3 text-zinc-400">
                    <Info size={16} className="mt-0.5 shrink-0 text-zinc-400/80" />
                    <p className="text-[12px] leading-relaxed font-medium">
                      {t("Все сообщения, медиафайлы и ключи шифрования этого чата будут безвозвратно удалены по истечении таймера у обоих участников.")}</p>
                  </div>
                </div>

                {/* Create button */}
                <button
                  type="button"
                  onClick={() => void submitCreateSecretChat()}
                  disabled={secretChatCreating || secretChatSelectedUserIds.size === 0}
                  className="absolute bottom-8 right-6 z-10 grid h-14 w-14 place-items-center rounded-full bg-[var(--ui-accent-solid)] text-[color:var(--ui-accent-contrast)] shadow-[0_14px_34px_rgba(0,0,0,0.34)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-55"
                  aria-label={t("Создать чат")}
                >
                  {secretChatCreating ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <Check size={27} strokeWidth={2.5} />
                  )}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});
