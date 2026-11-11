"use client";
import { panelPropsEquality } from "@/lib/client/panel-props-equality";
import type { GroupMember } from "../types";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type ChannelModalData, type ProfileBatchItem } from "../types";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { CommunityDescription } from "../components/common/CommunitySettingsPanel";
import { PanelNavigation } from "../components/common/PanelNavigation";
import { CSSProperties, Fragment, memo } from "react";
import { ArrowLeft, AtSign, Check, Search, X, UserRoundPlus } from "lucide-react";
import { PiQrCodeBold as QrCode } from "react-icons/pi";
import { AnimatePresence, motion } from "framer-motion";
import { MediaAvatar, isRealMediaAvatar } from "@/components/ui/media";
import { OnlineStatusDot } from "@/components/ui/online-status-dot";
import { Spinner } from "@/components/ui/spinner";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { cn } from "@/lib/utils";
import { appToast as toast } from "@/lib/client/app-toast";
import ChatQrPanel, { preloadChatQrPanel } from "@/components/ChatQrPanel";
import { CommunityDetailsSkeleton } from "./profile-primitives";
import { telegramSubViewVariants } from "./config";
import { formatSearchCount } from "./virtualization";

export interface MobileChannelProfileProps {
  isDesktop: boolean;
  channelModalOpen: boolean;
  setChannelModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  desktopDetailsPanelThemeStyle: React.CSSProperties | undefined;
  detailsPanelMotion: { initial: { opacity: number; y: string | number; x?: undefined; } | { opacity: number; x: string | number; y?: undefined; }; onAnimationStart: (() => void) | undefined; animate: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; exit: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; };
  channelModalLoading: boolean;
  channelModalError: string | null;
  channelModalData: ChannelModalData | null;
  channelNavDirection: "forward" | "backward";
  channelSubView: "type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null;
  renderCommunityReactions: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  renderCommunityType: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  setChannelSubView: React.Dispatch<React.SetStateAction<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>>;
  isChannelDirty: boolean;
  saveChannelSettings: () => Promise<void>;
  channelSaving: boolean;
  renderCommunitySettings: (kind: "group" | "channel") => React.JSX.Element | null;
  channelMembersReturnViewRef: React.RefObject<"settings" | null>;
  openAddMembersModal: (kind?: "group" | "channel") => Promise<void>;
  memberSearchQuery: string;
  setMemberSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  memberLongPress: (member: GroupMember, kind: "group" | "channel") => React.HTMLAttributes<HTMLDivElement>;
  openCommunityProfile: (member: { id: string; link: string; }) => void;
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  selfId: string | null;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  closeAddMembersView: (kind: "group" | "channel") => void;
  submitAddCommunityMembers: () => void;
  addingMembers: boolean;
  selectedContactIds: string[];
  addMembersContactQuery: string;
  setAddMembersContactQuery: React.Dispatch<React.SetStateAction<string>>;
  addMembersContactsLoading: boolean;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  channelNameDraft: string;
  channelAvatarDraft: string | null;
  openAvatarViewer: (params: { mediaUrl?: string | null | undefined; title: string; subtitle?: string | undefined; timestamp?: string | number | Date | null | undefined; showUploadTimestamp?: boolean | undefined; fallbackText?: string | undefined; }) => void;
  renderCommunityProfileActions: (kind: "group" | "channel") => React.JSX.Element | null;
  renderCommunitySharedTabs: (includeVoice?: boolean) => React.JSX.Element;
}

export const MobileChannelProfile = memo(function MobileChannelProfile({ isDesktop, channelModalOpen, setChannelModalOpen, t, desktopDetailsPanelThemeStyle, detailsPanelMotion, channelModalLoading, channelModalError, channelModalData, channelNavDirection, channelSubView, renderCommunityReactions, renderCommunityType, setChannelSubView, isChannelDirty, saveChannelSettings, channelSaving, renderCommunitySettings, channelMembersReturnViewRef, openAddMembersModal, memberSearchQuery, setMemberSearchQuery, memberLongPress, openCommunityProfile, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, selfId, readProfileFromCache, closeAddMembersView, submitAddCommunityMembers, addingMembers, selectedContactIds, addMembersContactQuery, setAddMembersContactQuery, addMembersContactsLoading, contactsForAdd, setSelectedContactIds, channelNameDraft, channelAvatarDraft, openAvatarViewer, renderCommunityProfileActions, renderCommunitySharedTabs }: MobileChannelProfileProps) {
  return (
    <AnimatePresence>
      {!isDesktop && channelModalOpen ? (
        <motion.div
          className="fixed inset-0 z-[91] flex justify-end md:hidden"
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setChannelModalOpen(false)}
            aria-label={t("Закрыть")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
          <motion.div
            className="relative flex h-full w-full flex-col overflow-hidden bg-[#171719] text-zinc-100 shadow-[-18px_0_42px_rgba(0,0,0,0.36)]"
            data-app-panel style={desktopDetailsPanelThemeStyle}
            {...detailsPanelMotion}
          >
            <AnimatePresence initial={false}><Fragment key="profile-content">

            {channelModalLoading ? (
              <div className="relative z-[1]">
                <CommunityDetailsSkeleton />
              </div>
            ) : channelModalError ? (
              <div className="relative z-[1] p-2 text-sm text-red-500">{t(channelModalError ?? "")}</div>
            ) : channelModalData?.channel ? (
              <div className="relative z-[1] flex h-full min-h-0 flex-col">
                <PanelNavigation direction={channelNavDirection} className="min-h-0 flex-1 h-full grid-rows-[minmax(0,1fr)]">
                  {channelSubView === "reactions" ? renderCommunityReactions("channel", true) : channelSubView === "type" ? renderCommunityType("channel", true) : channelSubView === "settings" ? (
                    /* Channel Settings View */
                    <motion.div
                      key="channel-modal-settings"
                      custom={channelNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col h-full w-full"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setChannelSubView(null)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Назад")}
                        >
                          <ArrowLeft size={24} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[21px] font-semibold leading-tight text-zinc-100">{t("Настройки канала")}</h2>
                        </div>
                        {(channelModalData.channel.isOwner || channelModalData.channel.myCanChangeName || channelModalData.channel.myCanChangeAvatar) && isChannelDirty && (
                          <button
                            type="button"
                            onClick={() => void saveChannelSettings()}
                            disabled={channelSaving}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white transition-colors hover:bg-white/8 disabled:opacity-50"
                            aria-label={t("Сохранить")}
                          >
                            {channelSaving ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                          </button>
                        )}
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">{renderCommunitySettings("channel")}</div>
                    </motion.div>

                  ) : channelSubView === "subscribers" ? (
                    /* Channel Subscribers View */
                    <motion.div
                      key="channel-modal-subscribers"
                      custom={channelNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col h-full w-full"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setChannelSubView(channelMembersReturnViewRef.current)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Назад")}
                        >
                          <ArrowLeft size={24} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[21px] font-semibold leading-tight text-zinc-100">{t("Подписчики")}</h2>
                        </div>
                        {channelModalData.channel.isOwner && (
                          <button
                            type="button"
                            onClick={() => void openAddMembersModal("channel")}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                            aria-label={t("Добавить подписчиков")}
                          >
                            <UserRoundPlus size={20} />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col px-4 pb-20 pt-1 overflow-y-auto no-scrollbar">

                        <div className="pb-2 pt-0 px-1">
                          <div className="relative flex items-center rounded-xl bg-white/[0.045] px-3.5 py-1.5 focus-within:bg-white/[0.075] transition-all duration-200">
                            <Search size={17} className="text-zinc-400/80 shrink-0" />
                            <input
                              value={memberSearchQuery}
                              onChange={(event) => setMemberSearchQuery(event.target.value)}
                              placeholder={t("Поиск подписчиков...")}
                              className="ml-2 w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-500/80 outline-none focus:ring-0"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 max-h-[45vh] overflow-y-auto no-scrollbar">
                          {(() => {
                            const query = memberSearchQuery.trim().toLowerCase();
                            const allSubs = channelModalData.subscribers || channelModalData.members || [];
                            const filtered = allSubs.filter((member) => {
                              if (!query) return true;
                              const name = (member.displayName || member.link || "").toLowerCase();
                              return name.includes(query);
                            });
                            if (filtered.length === 0) {
                              return <p className="text-sm text-zinc-500 text-center py-4">{t("Подписчики не найдены")}</p>;
                            }
                            return filtered.slice(0, 100).map((member) => (
                              <div
                                key={member.id}
                                role="button"
                                tabIndex={0}
                                {...memberLongPress(member, "channel")}
                                onClick={() => openCommunityProfile(member)}
                                onKeyDown={(event) => {
                                  if (event.target !== event.currentTarget) return;
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openCommunityProfile(member);
                                  }
                                }}
                                className="mx-1 w-[calc(100%-8px)] cursor-pointer rounded-[16px] px-3.5 py-2 hover:bg-white/[0.05] active:scale-[0.99] transition-all duration-200 flex items-center justify-between"
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <MediaAvatar
                                    src={member.avatarUrl ?? undefined}
                                    alt={member.displayName}
                                    className="h-10 w-10 rounded-full"
                                    fallbackText={member.displayName.slice(0, 1)}
                                    autoPlay
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-[14.5px] font-semibold text-zinc-100"><VerifiedTitle kind="user" link={member.link ?? ""}>{member.displayName}</VerifiedTitle></p>
                                    <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400">
                                      {t(getPresenceStatusText(
                                        member.id,
                                        onlineUserIds,
                                        lastOfflineAtByUserId,
                                        presenceNowTs,
                                        member.id === selfId || readProfileFromCache(member.id)?.presenceVisibility !== "none",
                                        member.id === selfId || readProfileFromCache(member.id)?.lastSeenVisibility !== "none",
                                      ))}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {member.id === channelModalData.channel.ownerId ? (
                                    <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                      {t("создатель")}</span>
                                  ) : member.role === "admin" ? (
                                    <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                      {t("админ")}</span>
                                  ) : (
                                    <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                      {t("читатель")}</span>
                                  )}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ) : channelSubView === "admins" ? (
                    /* Channel Admins View / "Выберите участника" list view */
                    <motion.div
                      key="channel-modal-admins"
                      custom={channelNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col h-full w-full"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setChannelSubView(channelMembersReturnViewRef.current)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Назад")}
                        >
                          <ArrowLeft size={24} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[21px] font-semibold leading-tight text-zinc-100">{t("Выберите участника")}</h2>
                        </div>
                      </div>
                      <div className="flex flex-col px-4 pb-20 pt-3 overflow-y-auto no-scrollbar">

                        <div className="pb-2 pt-0 px-1">
                          <div className="relative flex items-center rounded-xl bg-white/[0.045] px-3.5 py-1.5 focus-within:bg-white/[0.075] transition-all duration-200">
                            <Search size={17} className="text-zinc-400/80 shrink-0" />
                            <input
                              value={memberSearchQuery}
                              onChange={(event) => setMemberSearchQuery(event.target.value)}
                              placeholder={t("Поиск подписчиков...")}
                              className="ml-2 w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-500/80 outline-none focus:ring-0"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 max-h-[45vh] overflow-y-auto no-scrollbar py-2">
                          {(() => {
                            const query = memberSearchQuery.trim().toLowerCase();
                            const allSubs = channelModalData.subscribers || channelModalData.members || [];
                            const filtered = allSubs.filter((member) => {
                              if (!query) return true;
                              const name = (member.displayName || member.link || "").toLowerCase();
                              return name.includes(query);
                            });
                            if (filtered.length === 0) {
                              return <p className="text-sm text-zinc-500 text-center py-4">{t("Подписчики не найдены")}</p>;
                            }
                            return filtered.slice(0, 100).map((member) => {
                              const isOwner = member.id === channelModalData.channel.ownerId;
                              const isAdmin = member.role === "admin";
                              const isClickable = (channelModalData.channel.isOwner || channelModalData.channel.myCanManageAdmins) && !isOwner;

                              return (
                                <div
                                  key={member.id}
                                  role="button"
                                  tabIndex={0}
                                  {...memberLongPress(member, "channel")}
                                  onClick={() => openCommunityProfile(member)}
                                  onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      openCommunityProfile(member);
                                    }
                                  }}
                                  className={cn(
                                    "mx-1 w-[calc(100%-8px)] rounded-[16px] px-3.5 py-2 flex items-center justify-between transition-all duration-200",
                                    "hover:bg-white/[0.05] active:scale-[0.99] cursor-pointer"
                                  )}
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <MediaAvatar
                                      src={member.avatarUrl ?? undefined}
                                      alt={member.displayName}
                                      className="h-10 w-10 rounded-full"
                                      fallbackText={member.displayName.slice(0, 1)}
                                      autoPlay
                                    />
                                    <div className="min-w-0">
                                      <p className="truncate text-[14.5px] font-semibold text-zinc-100"><VerifiedTitle kind="user" link={member.link ?? ""}>{member.displayName}</VerifiedTitle></p>
                                      <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400">
                                        {t(getPresenceStatusText(
                                          member.id,
                                          onlineUserIds,
                                          lastOfflineAtByUserId,
                                          presenceNowTs,
                                          member.id === selfId || readProfileFromCache(member.id)?.presenceVisibility !== "none",
                                          member.id === selfId || readProfileFromCache(member.id)?.lastSeenVisibility !== "none",
                                        ))}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">

                                    {isOwner ? (
                                      <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                        {t("создатель")}</span>
                                    ) : isAdmin ? (
                                      <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                        {member.roleLabel || t("админ")}
                                      </span>
                                    ) : (
                                      <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                        {t("читатель")}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ) : channelSubView === "add_subscribers" ? (
                    /* Mobile Channel Add Subscribers View */
                    <motion.div
                      key="channel-modal-add-subscribers"
                      custom={channelNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col h-full w-full"
                    >
                      <div className="flex h-14 shrink-0 items-center justify-between px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => closeAddMembersView("channel")}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                            aria-label={t("Назад")}
                          >
                            <ArrowLeft size={22} />
                          </button>
                          <h2 className="truncate text-[20px] font-semibold leading-tight text-zinc-100">{t("Добавить подписчиков")}</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => void submitAddCommunityMembers()}
                          disabled={addingMembers || selectedContactIds.length === 0}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-40"
                          aria-label={t("Сохранить")}
                        >
                          {addingMembers ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                        </button>
                      </div>
                      <div className="flex flex-col px-4 pb-20 pt-1 overflow-y-auto no-scrollbar flex-1 min-h-0">
                        <div className="pb-2 pt-0 px-1 shrink-0">
                          <div className="relative flex h-[40px] w-full items-center rounded-xl bg-[#212124] px-3.5 transition-colors focus-within:bg-[#28282c]">
                            <Search size={18} strokeWidth={1.8} className="text-[#707076] shrink-0" />
                            <input
                              value={addMembersContactQuery}
                              onChange={(event) => setAddMembersContactQuery(event.target.value)}
                              placeholder={t("Поиск контактов...")}
                              className="ml-2.5 w-full bg-transparent text-[15px] font-normal text-zinc-100 placeholder:text-[#707076] outline-none focus:ring-0"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 overflow-y-auto no-scrollbar py-2 flex-1 min-h-0">
                          {addMembersContactsLoading && contactsForAdd.length === 0 ? (
                            <div className="grid min-h-[180px] place-items-center">
                              <Spinner className="h-6 w-6 text-zinc-400" />
                            </div>
                          ) : (() => {
                            const query = addMembersContactQuery.trim().toLowerCase();
                            const filtered = contactsForAdd
                              .filter((contact) => {
                                if (!query) return true;
                                const name = (contact.alias || contact.displayName || contact.link || "").toLowerCase();
                                return name.includes(query);
                              });

                            if (filtered.length === 0) {
                              return <p className="text-[14.5px] text-zinc-500 py-6 text-center">{t("Контакты не найдены")}</p>;
                            }

                            return filtered.slice(0, 100).map((contact) => {
                              const checked = selectedContactIds.includes(contact.id);
                              const cachedProfile = readProfileFromCache(contact.id);
                              const displayName = contact.alias || contact.displayName || contact.link;
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
                                  onClick={() =>
                                    setSelectedContactIds((prev) =>
                                      checked ? prev.filter((id) => id !== contact.id) : [...prev, contact.id],
                                    )
                                  }
                                  className="mx-0.5 w-[calc(100%-4px)] rounded-[16px] px-3.5 py-2 text-left outline-none transition-all duration-200 hover:bg-white/[0.05] active:scale-[0.99] flex items-center justify-between cursor-pointer"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="relative shrink-0">
                                      <MediaAvatar
                                        src={contact.avatarUrl ?? undefined}
                                        alt={displayName}
                                        className="h-10 w-10 rounded-full"
                                        fallbackText={displayName.slice(0, 1)}
                                        autoPlay
                                      />
                                      <AnimatePresence initial={false} mode="wait">
                                        {checked ? (
                                          <motion.div
                                            key="check"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            transition={{ duration: 0.15, ease: "easeOut" }}
                                            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast)] shadow-[0_1px_4px_rgba(0,0,0,0.4)] ring-1 ring-[#1f1f1f]"
                                          >
                                            <Check size={11} strokeWidth={4} className="shrink-0" />
                                          </motion.div>
                                        ) : (
                                          onlineUserIds.has(contact.id) ? (
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
                                    <div className="min-w-0">
                                      <p className="truncate text-[14.5px] font-semibold text-zinc-100"><VerifiedTitle kind="user" link={contact.link}>{displayName}</VerifiedTitle></p>
                                      <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400">{statusText}</p>
                                    </div>
                                  </div>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ) : channelSubView === "qrcode" ? (
                    /* Mobile Channel QR Code View */
                    <motion.div
                      key="channel-modal-qrcode"
                      custom={channelNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="relative flex flex-col h-full w-full min-h-0 overflow-hidden"
                    >
                      <ChatQrPanel
                        kind="channel"
                        displayName={channelNameDraft || channelModalData.channel.name}
                        link={channelModalData.channel.link}
                        avatarUrl={channelAvatarDraft || channelModalData.channel.avatarUrl}
                        onBack={() => setChannelSubView(null)}
                      />
                    </motion.div>
                  ) : (
                    /* Main Channel Info View */
                    <motion.div
                      key="channel-modal-main"
                      custom={channelNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col pb-20 overflow-y-auto no-scrollbar"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setChannelModalOpen(false)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Закрыть")}
                        >
                          <X size={22} />
                        </button>
                        <h2 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-none">{t("Информация о канале")}</h2>

                      </div>
                      <div className="flex flex-col px-4 pt-2">
                        <div className="flex flex-col items-center text-center">
                          <div
                            onClick={() => {
                              const avatar = channelAvatarDraft || channelModalData.channel.avatarUrl;
                              if (isRealMediaAvatar(avatar)) {
                                openAvatarViewer({
                                  mediaUrl: avatar,
                                  title: channelNameDraft || channelModalData.channel.name,
                                  timestamp: channelAvatarDraft ? new Date() : (channelModalData.channel.avatarUploadedAt || channelModalData.channel.updatedAt || channelModalData.channel.createdAt),
                                  fallbackText: (channelNameDraft || "C").slice(0, 1),
                                });
                              }
                            }}
                            className={cn(
                              "rounded-full",
                              isRealMediaAvatar(channelAvatarDraft || channelModalData.channel.avatarUrl) &&
                              "cursor-pointer active:scale-[0.97] transition-transform"
                            )}
                          >
                            <MediaAvatar
                              src={(channelAvatarDraft || channelModalData.channel.avatarUrl) ?? undefined}
                              alt={channelNameDraft || t("Канал")}
                              className="h-[92px] w-[92px] shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                              fallbackText={(channelNameDraft || "C").slice(0, 1)}
                              autoPlay
                            />
                          </div>
                          <p className="mt-4 max-w-full truncate text-[20px] font-semibold text-white"><VerifiedTitle showDetails kind="channel" link={channelModalData!.channel.link}>{channelNameDraft}</VerifiedTitle></p>
                          <p className="mt-1 text-sm text-zinc-400">{formatSearchCount(channelModalData.channel.subscribersCount, t("подписчик"), t("подписчика"), t("подписчиков"))}</p>
                        </div>

                        {/* Profile actions and community information */}
                        {renderCommunityProfileActions("channel")}
                        {(channelModalData.channel.description?.trim() || channelModalData.channel.isPublic) ? (<div className="mt-5 overflow-hidden rounded-[24px] bg-white/[0.04] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">

                          {channelModalData.channel.isPublic && channelModalData.channel.link ? (
                            <div
                              onClick={() => {
                                navigator.clipboard.writeText(`@${channelModalData.channel.link.replace(/^@+/, "")}`);
                                toast.success(t("Ссылка скопирована"));
                              }}
                              className="flex min-h-[52px] w-full items-center justify-between px-3.5 py-2 rounded-[18px] transition-colors hover:bg-white/[0.06] active:scale-[0.99] cursor-pointer"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <AtSign size={20} className="shrink-0 text-zinc-400" />
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-100">
                                    {`@${channelModalData.channel.link.replace(/^@+/, "")}`}
                                  </span>
                                  <span className="mt-0.5 block text-[12.5px] leading-4 text-zinc-400">{t("Уникальное имя")}</span>
                                </div>
                              </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChannelSubView("qrcode");
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                                  aria-label={t("QR-код")} onPointerEnter={preloadChatQrPanel} onFocus={preloadChatQrPanel}
                                >
                                  <QrCode size={18} />
                                </button>
                            </div>
                          ) : null}
                          <CommunityDescription description={channelModalData.channel.description} />

                        </div>) : null}

                        {/* Channel Community Shared Tabs */}
                        <div className="mt-3">
                          {renderCommunitySharedTabs(true)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </PanelNavigation>
              </div>
            ) : null}
            </Fragment></AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}, panelPropsEquality<MobileChannelProfileProps>(props => props.isDesktop || !props.channelModalOpen, props => String(props.selfId) + ':' + props.isDesktop));
