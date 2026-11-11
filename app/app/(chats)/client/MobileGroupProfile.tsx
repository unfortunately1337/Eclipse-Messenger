"use client";
import { panelPropsEquality } from "@/lib/client/panel-props-equality";
import type { GroupMember } from "../types";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type GroupModalData, type ProfileBatchItem } from "../types";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { CommunityDescription } from "../components/common/CommunitySettingsPanel";
import { PanelNavigation } from "../components/common/PanelNavigation";
import { CSSProperties, Fragment, memo } from "react";
import { ArrowLeft, AtSign, Check, ChevronRight, Plus, Search, X, Users } from "lucide-react";
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

export interface MobileGroupProfileProps {
  isDesktop: boolean;
  groupModalOpen: boolean;
  setGroupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  desktopDetailsPanelThemeStyle: React.CSSProperties | undefined;
  detailsPanelMotion: { initial: { opacity: number; y: string | number; x?: undefined; } | { opacity: number; x: string | number; y?: undefined; }; onAnimationStart: (() => void) | undefined; animate: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; exit: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; };
  groupModalLoading: boolean;
  groupModalError: string | null;
  groupModalData: GroupModalData | null;
  groupNavDirection: "forward" | "backward";
  groupSubView: "type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null;
  setGroupSubView: React.Dispatch<React.SetStateAction<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>>;
  groupMembersReturnViewRef: React.RefObject<"settings" | null>;
  canManageGroup: boolean;
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
  renderCommunityReactions: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  renderCommunityType: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  isGroupDirty: boolean;
  saveGroupSettings: () => Promise<void>;
  groupSaving: boolean;
  renderCommunitySettings: (kind: "group" | "channel") => React.JSX.Element | null;
  closeAddMembersView: (kind: "group" | "channel") => void;
  submitAddCommunityMembers: () => void;
  addingMembers: boolean;
  selectedContactIds: string[];
  addMembersContactQuery: string;
  setAddMembersContactQuery: React.Dispatch<React.SetStateAction<string>>;
  addMembersContactsLoading: boolean;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  groupNameDraft: string;
  groupAvatarDraft: string | null;
  openAvatarViewer: (params: { mediaUrl?: string | null | undefined; title: string; subtitle?: string | undefined; timestamp?: string | number | Date | null | undefined; showUploadTimestamp?: boolean | undefined; fallbackText?: string | undefined; }) => void;
  renderCommunityProfileActions: (kind: "group" | "channel") => React.JSX.Element | null;
  chatProfileSectionThemeStyle: React.CSSProperties | undefined;
  renderCommunitySharedTabs: (includeVoice?: boolean) => React.JSX.Element;
}

export const MobileGroupProfile = memo(function MobileGroupProfile({ isDesktop, groupModalOpen, setGroupModalOpen, t, desktopDetailsPanelThemeStyle, detailsPanelMotion, groupModalLoading, groupModalError, groupModalData, groupNavDirection, groupSubView, setGroupSubView, groupMembersReturnViewRef, canManageGroup, openAddMembersModal, memberSearchQuery, setMemberSearchQuery, memberLongPress, openCommunityProfile, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, selfId, readProfileFromCache, renderCommunityReactions, renderCommunityType, isGroupDirty, saveGroupSettings, groupSaving, renderCommunitySettings, closeAddMembersView, submitAddCommunityMembers, addingMembers, selectedContactIds, addMembersContactQuery, setAddMembersContactQuery, addMembersContactsLoading, contactsForAdd, setSelectedContactIds, groupNameDraft, groupAvatarDraft, openAvatarViewer, renderCommunityProfileActions, chatProfileSectionThemeStyle, renderCommunitySharedTabs }: MobileGroupProfileProps) {
  return (
    <AnimatePresence>
      {!isDesktop && groupModalOpen ? (
        <motion.div
          className="fixed inset-0 z-[92] flex justify-end md:hidden"
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setGroupModalOpen(false)}
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

            {groupModalLoading ? (
              <div className="relative z-[1] h-full">
                <CommunityDetailsSkeleton withMembers />
              </div>
            ) : groupModalError ? (
              <div className="relative z-[1] p-6 text-sm text-red-500">{t(groupModalError ?? "")}</div>
            ) : groupModalData?.group ? (
              <div className="relative z-[1] flex h-full min-h-0 flex-col">
                <PanelNavigation direction={groupNavDirection} className={groupSubView === "qrcode" ? "min-h-0 flex-1 h-full" : ""}>
                  {groupSubView === "members" ? (
                    /* Group Members View */
                    <motion.div
                      key="group-modal-members"
                      custom={groupNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col h-full w-full"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setGroupSubView(groupMembersReturnViewRef.current)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Назад")}
                        >
                          <ArrowLeft size={24} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[21px] font-semibold leading-tight text-zinc-100">{t("Участники")}</h2>
                        </div>
                        {canManageGroup && (
                          <button
                            type="button"
                            onClick={() => void openAddMembersModal("group")}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-0 bg-transparent text-zinc-100 outline-none transition-opacity duration-200 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-white/40 cursor-pointer"
                            aria-label={t("Добавить участников")}
                          >
                            <Plus size={23} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col px-4 pb-20 pt-1 overflow-y-auto no-scrollbar flex-1 min-h-0">

                        <div className="pb-2 pt-0 px-1">
                          <div className="relative flex items-center rounded-xl bg-white/[0.045] px-3.5 py-1.5 focus-within:bg-white/[0.075] transition-all duration-200">
                            <Search size={17} className="text-zinc-400/80 shrink-0" />
                            <input
                              value={memberSearchQuery}
                              onChange={(event) => setMemberSearchQuery(event.target.value)}
                              placeholder={t("Поиск участников...")}
                              className="ml-2 w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-500/80 outline-none focus:ring-0"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 overflow-y-auto no-scrollbar py-2 flex-1 min-h-0">
                          {(() => {
                            const query = memberSearchQuery.trim().toLowerCase();
                            const filtered = (groupModalData.members || []).filter((member) => {
                              if (!query) return true;
                              const name = (member.displayName || member.link || "").toLowerCase();
                              return name.includes(query);
                            });
                            if (filtered.length === 0) {
                              return <p className="text-sm text-zinc-500 text-center py-4">{t("Участники не найдены")}</p>;
                            }
                            return filtered.slice(0, 100).map((member) => {
                              const isOwner = member.id === groupModalData.group.ownerId;
                              const isAdmin = member.role === "admin";
                              const isClickable = canManageGroup && !isOwner;

                              return (
                                <div
                                  key={member.id}
                                  role="button"
                                  tabIndex={0}
                                  {...memberLongPress(member, "group")}
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

                                  <div className="flex items-center gap-1 shrink-0">
                                    {isOwner ? (
                                      <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                        {t("владелец")}</span>
                                    ) : isAdmin ? (
                                      <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                        {(member.roleLabel?.trim() || t("админ")).slice(0, 28)}
                                      </span>
                                    ) : null}

                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ) : groupSubView === "reactions" ? renderCommunityReactions("group", true) : groupSubView === "type" ? renderCommunityType("group", true) : groupSubView === "settings" ? (
                    /* Group Settings View */
                    <motion.div
                      key="group-modal-settings"
                      custom={groupNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col h-full w-full"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setGroupSubView(null)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Назад")}
                        >
                          <ArrowLeft size={24} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[21px] font-semibold leading-tight text-zinc-100">{t("Настройки группы")}</h2>
                        </div>
                        {canManageGroup && isGroupDirty && (
                          <button
                            type="button"
                            onClick={() => void saveGroupSettings()}
                            disabled={groupSaving}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white transition-colors hover:bg-white/8 disabled:opacity-50"
                            aria-label={t("Сохранить")}
                          >
                            {groupSaving ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                          </button>
                        )}
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">{renderCommunitySettings("group")}</div>
                    </motion.div>
                  ) : groupSubView === "admins" ? (
                    /* Admins View / "Выберите участника" list view */
                    <motion.div
                      key="group-modal-admins"
                      custom={groupNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col h-full w-full"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setGroupSubView(groupMembersReturnViewRef.current)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Назад")}
                        >
                          <ArrowLeft size={24} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[21px] font-semibold leading-tight text-zinc-100">{t("Выберите участника")}</h2>
                        </div>
                      </div>
                      <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-20 pt-3 overflow-y-auto no-scrollbar">

                        <div className="pb-2 pt-0 px-1">
                          <div className="relative flex items-center rounded-xl bg-white/[0.045] px-3.5 py-1.5 focus-within:bg-white/[0.075] transition-all duration-200">
                            <Search size={17} className="text-zinc-400/80 shrink-0" />
                            <input
                              value={memberSearchQuery}
                              onChange={(event) => setMemberSearchQuery(event.target.value)}
                              placeholder={t("Поиск участников...")}
                              className="ml-2 w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-500/80 outline-none focus:ring-0"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar py-2 space-y-1">
                          {(() => {
                            const query = memberSearchQuery.trim().toLowerCase();
                            const filtered = (groupModalData.members || []).filter((member) => {
                              if (!query) return true;
                              const name = (member.displayName || member.link || "").toLowerCase();
                              return name.includes(query);
                            });
                            if (filtered.length === 0) {
                              return <p className="text-[13px] text-zinc-500 text-center py-4">{t("Участники не найдены")}</p>;
                            }
                            return filtered.slice(0, 100).map((member) => {
                              const isOwner = member.id === groupModalData.group.ownerId;
                              const isAdmin = member.role === "admin";
                              const isClickable = canManageGroup && !isOwner;

                              return (
                                <div
                                  key={member.id}
                                  role="button"
                                  tabIndex={0}
                                  {...memberLongPress(member, "group")}
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
                                        {t("владелец")}</span>
                                    ) : isAdmin ? (
                                      <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                        {(member.roleLabel?.trim() || t("админ")).slice(0, 28)}
                                      </span>
                                    ) : (
                                      <span className="max-w-[110px] truncate text-[12px] font-normal leading-5 text-zinc-400">
                                        {t("участник")}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ) : groupSubView === "add_members" ? (
                    /* Mobile Group Add Members View */
                    <motion.div
                      key="group-modal-add-members"
                      custom={groupNavDirection}
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
                            onClick={() => closeAddMembersView("group")}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                            aria-label={t("Назад")}
                          >
                            <ArrowLeft size={22} />
                          </button>
                          <h2 className="truncate text-[20px] font-semibold leading-tight text-zinc-100">{t("Добавить участников")}</h2>
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
                                const isNotMember = groupModalData
                                  ? !groupModalData.members.some((member) => member.id === contact.id)
                                  : true;
                                if (!isNotMember) return false;
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
                  ) : groupSubView === "qrcode" ? (
                    /* Mobile Group QR Code View */
                    <motion.div
                      key="group-modal-qrcode"
                      custom={groupNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="relative flex flex-col h-full w-full min-h-0 overflow-hidden"
                    >
                      <ChatQrPanel
                        kind="group"
                        displayName={groupNameDraft || groupModalData.group.name}
                        link={groupModalData.group.link}
                        avatarUrl={groupAvatarDraft || groupModalData.group.avatarUrl}
                        onBack={() => setGroupSubView(null)}
                      />
                    </motion.div>
                  ) : (
                    /* Main Group Info View */
                    <motion.div
                      key="group-modal-main"
                      custom={groupNavDirection}
                      variants={telegramSubViewVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="relative flex min-h-0 flex-1 flex-col pb-6 overflow-y-auto no-scrollbar"
                    >
                      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                        <button
                          type="button"
                          onClick={() => setGroupModalOpen(false)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label={t("Закрыть")}
                        >
                          <X size={22} />
                        </button>
                        <h2 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-none">{t("Информация о группе")}</h2>

                      </div>
                      <div className="flex flex-col px-4 pt-2">
                        <div className="flex flex-col items-center text-center">
                          <div
                            onClick={() => {
                              const avatar = groupAvatarDraft || groupModalData.group.avatarUrl;
                              if (isRealMediaAvatar(avatar)) {
                                openAvatarViewer({
                                  mediaUrl: avatar,
                                  title: groupNameDraft || groupModalData.group.name,
                                  timestamp: groupAvatarDraft ? new Date() : (groupModalData.group.avatarUploadedAt || groupModalData.group.updatedAt || groupModalData.group.createdAt),
                                  fallbackText: (groupNameDraft || t("Г")).slice(0, 1),
                                });
                              }
                            }}
                            className={cn(
                              "rounded-full",
                              isRealMediaAvatar(groupAvatarDraft || groupModalData.group.avatarUrl) &&
                              "cursor-pointer active:scale-[0.97] transition-transform"
                            )}
                          >
                            <MediaAvatar
                              src={(groupAvatarDraft || groupModalData.group.avatarUrl) ?? undefined}
                              alt={groupNameDraft || t("Группа")}
                              className="h-[92px] w-[92px] shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                              fallbackText={(groupNameDraft || t("Г")).slice(0, 1)}
                              autoPlay
                            />
                          </div>
                          <p className="mt-4 max-w-full truncate text-[19px] font-semibold text-zinc-100"><VerifiedTitle showDetails kind="group" link={groupModalData!.group.link}>{groupNameDraft}</VerifiedTitle></p>
                          <p className="mt-1 text-sm text-zinc-400">{groupModalData.members.length} {t(" участников")}</p>
                        </div>

                        {/* Profile actions and community information */}
                        {renderCommunityProfileActions("group")}
                        {(groupModalData.group.description?.trim() || groupModalData.group.isPublic) ? (<div className="mt-5 overflow-hidden rounded-[24px] bg-white/[0.04] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">

                          {groupModalData.group.isPublic && groupModalData.group.link ? (
                            <div
                              onClick={() => {
                                navigator.clipboard.writeText(`@${groupModalData.group.link.replace(/^@+/, "")}`);
                                toast.success(t("Ссылка скопирована"));
                              }}
                              className="flex min-h-[52px] w-full items-center justify-between px-3.5 py-2 rounded-[18px] transition-colors hover:bg-white/[0.06] active:scale-[0.99] cursor-pointer"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <AtSign size={20} className="shrink-0 text-zinc-400" />
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate text-[15px] font-semibold leading-5 text-zinc-100">
                                    {`@${groupModalData.group.link.replace(/^@+/, "")}`}
                                  </span>
                                  <span className="mt-0.5 block text-[12.5px] leading-4 text-zinc-400">{t("Уникальное имя")}</span>
                                </div>
                              </div>
                              {canManageGroup && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupSubView("qrcode");
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                                  aria-label={t("QR-код")} onPointerEnter={preloadChatQrPanel} onFocus={preloadChatQrPanel}
                                >
                                  <QrCode size={18} />
                                </button>
                              )}
                            </div>
                          ) : null}
                          <CommunityDescription description={groupModalData.group.description} />

                        </div>) : null}

                        {/* Action Panels: Members, Admins, Settings */}
                        <div className="mt-4 overflow-hidden rounded-[24px] bg-white/[0.04] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.12)]" style={chatProfileSectionThemeStyle}>
                          <button
                            type="button"
                            onClick={() => { groupMembersReturnViewRef.current = null; setGroupSubView("members"); }}
                            className="flex min-h-14 w-full items-center justify-between px-4 py-3 text-left rounded-[18px] transition-all hover:bg-white/[0.06] active:scale-[0.99] cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Users size={20} className="shrink-0 text-zinc-400" />
                              <span className="text-[15px] font-semibold text-zinc-100">{t("Участники")}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14px] text-zinc-400 font-medium">
                                {groupModalData.members.length}
                              </span>
                              <ChevronRight size={16} className="text-zinc-500" />
                            </div>
                          </button>

                        </div>

                        {/* Group Community Shared Tabs */}
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
}, panelPropsEquality<MobileGroupProfileProps>(props => props.isDesktop || !props.groupModalOpen, props => String(props.selfId) + ':' + props.isDesktop));
