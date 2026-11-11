"use client";
import type { GroupMember } from "../types";

/* eslint-disable @next/next/no-img-element */
import { type ConversationChatType, type ChatSummary, type ProfilePreview, type ChannelModalData, type StoryFeedGroup, type SelfProfile, type ChatImageGalleryItem, type GroupModalData, type ProfileBatchItem } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { type ReactionMode } from "@/lib/reaction-policy";
import { CommunityDescription } from "../components/common/CommunitySettingsPanel";
import { PanelNavigation } from "../components/common/PanelNavigation";
import { CSSProperties, Fragment, UIEvent, memo } from "react";
import { ArrowLeft, AtSign, Bell, Check, Download, Image as ImageIcon, Info, Lock, MoreVertical, Music2, Pause, Play, Plus, Search, X, UserRoundPlus } from "lucide-react";
import { PiQrCodeBold as QrCode } from "react-icons/pi";
import { MdEdit } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { MediaAvatar, MediaBanner, isRealMediaAvatar } from "@/components/ui/media";
import { OnlineStatusDot } from "@/components/ui/online-status-dot";
import { Spinner } from "@/components/ui/spinner";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { showAppToast, appToast as toast } from "@/lib/client/app-toast";
import { EclipseBotAvatar, EclipseVerifiedTitle } from "../EclipseChatUi";
import { cn } from "@/lib/utils";
import { SavedMessagesAvatar } from "../components/common/Avatars";
import ChatQrPanel, { preloadChatQrPanel } from "@/components/ChatQrPanel";
import { type LiveBackgroundNeatPreset } from "@/lib/client/live-background";
import { getEffectiveProfileGradient, getEffectiveProfileAccentColor, isMediaBackgroundUrl } from "@/lib/profile-gradients";
import { splitContactAliasParts } from "../helpers";
import { ProfileMusicCaption } from "../components/common/ProfileMusicCaption";
import { StoryAvatarRing } from "../components/story/StoryAvatarRing";
import { telegramSubViewVariants } from "./config";
import { ScrollableTabsBar, CommunityDetailsSkeleton } from "./profile-primitives";
import { formatSharedFileSize } from "./media-thumbnails";
import { ProfileMediaThumb } from "./ProfileMediaThumb";
import { formatDurationFromSeconds } from "./media-recording";
import { formatSearchCount } from "./virtualization";

export interface DesktopDetailsPanelProps {
  desktopDetailsPanelOpen: boolean;
  liveBackgroundPreset: LiveBackgroundNeatPreset;
  desktopDetailsPanelThemeStyle: React.CSSProperties | undefined;
  detailsPanelMotion: { initial: { opacity: number; y: string | number; x?: undefined; } | { opacity: number; x: string | number; y?: undefined; }; onAnimationStart: (() => void) | undefined; animate: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; exit: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; };
  profileSubView: "qrcode" | "contact_editor" | "secret_chat" | null;
  groupSubView: "type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null;
  channelSubView: "type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null;
  effectiveDetailsChatType: ConversationChatType | null;
  profileScrollTop: number;
  inspectedDetailsEntity: { type: "direct" | "group" | "channel"; link: string; } | null;
  activeChat: ChatSummary | null;
  setProfileSubView: React.Dispatch<React.SetStateAction<"qrcode" | "contact_editor" | "secret_chat" | null>>;
  setGroupSubView: React.Dispatch<React.SetStateAction<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>>;
  groupMembersReturnViewRef: React.RefObject<"settings" | null>;
  closeAddMembersView: (kind: "group" | "channel") => void;
  setChannelSubView: React.Dispatch<React.SetStateAction<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>>;
  channelMembersReturnViewRef: React.RefObject<"settings" | null>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setDesktopDetailsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInspectedDetailsEntity: React.Dispatch<React.SetStateAction<{ type: "direct" | "group" | "channel"; link: string; } | null>>;
  profileData: ProfilePreview | null;
  contactExists: boolean;
  contactDraftDisplayName: string;
  profileHeaderStatusText: string;
  saveCommunityReactions: (kind: "group" | "channel") => Promise<void>;
  groupSaving: boolean;
  channelSaving: boolean;
  reactionSettingsDraft: { reactionMode: ReactionMode; allowedReactions: string[]; };
  saveCommunityType: (kind: "group" | "channel") => Promise<void>;
  canManageGroup: boolean;
  isGroupDirty: boolean;
  saveGroupSettings: () => Promise<void>;
  channelModalData: ChannelModalData | null;
  isChannelDirty: boolean;
  saveChannelSettings: () => Promise<void>;
  submitAddCommunityMembers: () => void;
  addingMembers: boolean;
  selectedContactIds: string[];
  openAddMembersModal: (kind?: "group" | "channel") => Promise<void>;
  saveContact: () => Promise<void>;
  contactSaving: boolean;
  profileIsBot: boolean;
  profileIsSaved: boolean;
  selfId: string | null;
  setContactEditorTarget: React.Dispatch<React.SetStateAction<{ link: string; displayName: string; avatarUrl?: string | null | undefined; } | null>>;
  setContactFirstName: React.Dispatch<React.SetStateAction<string>>;
  setContactLastName: React.Dispatch<React.SetStateAction<string>>;
  setProfileMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  profileMoreOpen: boolean;
  wallpaperTargetRef: React.RefObject<string | null>;
  wallpaperFileInputRef: React.RefObject<HTMLInputElement | null>;
  uploadingWallpaper: boolean;
  openSecretChatFromProfile: () => Promise<void>;
  handleProfileScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  profileLoading: boolean;
  renderProfileDetailsSkeleton: () => React.JSX.Element;
  profileNavDirection: "forward" | "backward";
  renderContactEditorContent: () => React.JSX.Element | null;
  renderSecretChatPanelContent: () => React.JSX.Element;
  storyGroupByAuthorId: Map<string, { group: StoryFeedGroup; index: number; }>;
  openStoryViewerByAuthorId: (authorId: string, source?: HTMLElement | null | undefined) => void;
  openAvatarViewer: (params: { mediaUrl?: string | null | undefined; title: string; subtitle?: string | undefined; timestamp?: string | number | Date | null | undefined; showUploadTimestamp?: boolean | undefined; fallbackText?: string | undefined; }) => void;
  profileIsEclipse: boolean;
  selfProfile: SelfProfile | null;
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  renderUserProfileActions: () => React.JSX.Element | null;
  setCollectibleModalUsername: React.Dispatch<React.SetStateAction<string | null>>;
  toggleChatMutedState: (link: string) => void;
  mutedChatLinkSet: Set<string>;
  setProfileActiveTab: React.Dispatch<React.SetStateAction<"voice" | "music" | "members" | "media" | "files" | "links">>;
  profileActiveTab: "voice" | "music" | "members" | "media" | "files" | "links";
  profileMediaVisible: boolean;
  chatSharedFilesList: { id: string; messageId: string; name: string; size?: number | undefined; src: string; dateText: string; timeText: string; extension: string; }[];
  chatSharedVoiceList: { id: string; messageId: string; src: string; durationMs?: number | undefined; dateText: string; timeText: string; authorName: string; authorAvatarUrl: string | null; isMine: boolean; }[];
  profilePlayingAudioUrl: string | null;
  setProfilePlayingAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  chatSharedLinksList: { id: string; messageId: string; url: string; domain: string; snippet: string; dateText: string; timeText: string; }[];
  openExternalLinkPrompt: (url: string) => void;
  chatSharedMusicList: { id: string; messageId: string; url: string; title: string; author: string; coverUrl?: string | null | undefined; durationMs?: number | undefined; dateText: string; timeText: string; }[];
  chatSharedMediaList: { id: string; messageId: string; kind: "image" | "video"; src: string; caption?: string | undefined; preview?: string; durationMs?: number | undefined; mode?: "note" | "file" | undefined; timeText: string; dateText: string; authorName: string; authorAvatarUrl: string | null; authorLink: string | null; canDelete: boolean; isMine: boolean; }[];
  setVideoViewer: React.Dispatch<React.SetStateAction<{ src: string; caption: string; timeText: string; dateText: string; messageId: string; authorName: string; authorAvatarUrl?: string | null | undefined; authorLink?: string | null | undefined; canDelete: boolean; isMine?: boolean | undefined; } | null>>;
  setImageViewer: React.Dispatch<React.SetStateAction<ChatImageGalleryItem | null>>;
  profileError: string | null;
  groupModalLoading: boolean;
  groupModalData: GroupModalData | null;
  groupNavDirection: "forward" | "backward";
  renderCommunityReactions: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  renderCommunityType: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  renderCommunitySettings: (kind: "group" | "channel") => React.JSX.Element | null;
  memberLongPress: (member: GroupMember, kind: "group" | "channel") => React.HTMLAttributes<HTMLDivElement>;
  openCommunityProfile: (member: { id: string; link: string; }) => void;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  memberSearchQuery: string;
  setMemberSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  addMembersContactQuery: string;
  setAddMembersContactQuery: React.Dispatch<React.SetStateAction<string>>;
  addMembersContactsLoading: boolean;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  groupNameDraft: string;
  groupAvatarDraft: string | null;
  renderCommunityProfileActions: (kind: "group" | "channel") => React.JSX.Element | null;
  renderCommunitySharedTabs: (includeVoice?: boolean) => React.JSX.Element;
  groupModalError: string | null;
  channelModalLoading: boolean;
  channelNavDirection: "forward" | "backward";
  channelNameDraft: string;
  channelAvatarDraft: string | null;
  channelModalError: string | null;
}

function DesktopDetailsPanelSurface({ desktopDetailsPanelOpen, liveBackgroundPreset, desktopDetailsPanelThemeStyle, detailsPanelMotion, profileSubView, groupSubView, channelSubView, effectiveDetailsChatType, profileScrollTop, inspectedDetailsEntity, activeChat, setProfileSubView, setGroupSubView, groupMembersReturnViewRef, closeAddMembersView, setChannelSubView, channelMembersReturnViewRef, t, setDesktopDetailsPanelOpen, setInspectedDetailsEntity, profileData, contactExists, contactDraftDisplayName, profileHeaderStatusText, saveCommunityReactions, groupSaving, channelSaving, reactionSettingsDraft, saveCommunityType, canManageGroup, isGroupDirty, saveGroupSettings, channelModalData, isChannelDirty, saveChannelSettings, submitAddCommunityMembers, addingMembers, selectedContactIds, openAddMembersModal, saveContact, contactSaving, profileIsBot, profileIsSaved, selfId, setContactEditorTarget, setContactFirstName, setContactLastName, setProfileMoreOpen, profileMoreOpen, wallpaperTargetRef, wallpaperFileInputRef, uploadingWallpaper, openSecretChatFromProfile, handleProfileScroll, profileLoading, renderProfileDetailsSkeleton, profileNavDirection, renderContactEditorContent, renderSecretChatPanelContent, storyGroupByAuthorId, openStoryViewerByAuthorId, openAvatarViewer, profileIsEclipse, selfProfile, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, renderUserProfileActions, setCollectibleModalUsername, toggleChatMutedState, mutedChatLinkSet, setProfileActiveTab, profileActiveTab, profileMediaVisible, chatSharedFilesList, chatSharedVoiceList, profilePlayingAudioUrl, setProfilePlayingAudioUrl, chatSharedLinksList, openExternalLinkPrompt, chatSharedMusicList, chatSharedMediaList, setVideoViewer, setImageViewer, profileError, groupModalLoading, groupModalData, groupNavDirection, renderCommunityReactions, renderCommunityType, renderCommunitySettings, memberLongPress, openCommunityProfile, readProfileFromCache, memberSearchQuery, setMemberSearchQuery, addMembersContactQuery, setAddMembersContactQuery, addMembersContactsLoading, contactsForAdd, setSelectedContactIds, groupNameDraft, groupAvatarDraft, renderCommunityProfileActions, renderCommunitySharedTabs, groupModalError, channelModalLoading, channelNavDirection, channelNameDraft, channelAvatarDraft, channelModalError }: DesktopDetailsPanelProps) {
  return (
    <motion.aside data-community-details
          className={cn(
            "absolute inset-y-2.5 right-2.5 flex min-h-0 w-[324px] lg:w-[344px] flex-col overflow-hidden rounded-[26px] text-zinc-100 border-0 shadow-2xl shadow-black/50",
            liveBackgroundPreset === "none" ? "bg-[#1c1c1e] dark:bg-[#1c1c1e]" : "",
          )}
          data-app-panel style={desktopDetailsPanelThemeStyle}
          {...detailsPanelMotion}
        >
          <AnimatePresence initial={false}><Fragment key="details-content">
          {(() => {
            if (profileSubView === "qrcode" || groupSubView === "qrcode" || channelSubView === "qrcode") {
              return null;
            }
            const isTransparentDetailsHeader = (effectiveDetailsChatType === "direct" && profileSubView === null);
            const isCollapsedDetailsHeader = isTransparentDetailsHeader && profileScrollTop > 140;
            const isInspectingForeign = Boolean(
              inspectedDetailsEntity &&
              (!activeChat ||
                inspectedDetailsEntity.link.toLowerCase() !== activeChat.link.toLowerCase() ||
                inspectedDetailsEntity.type !== activeChat.chatType)
            );
            const hasBackButton = Boolean(
              (effectiveDetailsChatType === "direct" && profileSubView !== null) ||
              (effectiveDetailsChatType === "group" && groupSubView !== null) ||
              (effectiveDetailsChatType === "channel" && channelSubView !== null)
            );
            return (
              <div
                style={isCollapsedDetailsHeader ? { backgroundColor: desktopDetailsPanelThemeStyle?.backgroundColor } : undefined}
                className={cn(
                  "flex h-14 shrink-0 items-center gap-3 px-4 transition-[background-color] duration-150 ease-out",
                  isTransparentDetailsHeader
                    ? isCollapsedDetailsHeader
                      ? "absolute top-0 left-0 right-0 z-30 bg-[#1c1c1e] text-white border-0 shadow-none"
                      : "absolute top-0 left-0 right-0 z-20 bg-transparent text-white border-0"
                    : "bg-transparent relative z-20"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {hasBackButton ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (effectiveDetailsChatType === "direct") {
                          if (profileSubView !== null) {
                            setProfileSubView(null);
                            return;
                          }
                        }
                        if (effectiveDetailsChatType === "group") {
                          if (groupSubView === "type" || groupSubView === "reactions") {
                            setGroupSubView("settings");
                            return;
                          }
                          if (groupSubView === "members" || groupSubView === "admins") {
                            setGroupSubView(groupMembersReturnViewRef.current);
                            return;
                          }
                          if (groupSubView === "add_members") {
                            closeAddMembersView("group");
                            return;
                          }
                          if (groupSubView !== null) {
                            setGroupSubView(null);
                            return;
                          }
                        }
                        if (effectiveDetailsChatType === "channel") {
                          if (channelSubView === "type" || channelSubView === "reactions") {
                            setChannelSubView("settings");
                            return;
                          }
                          if (channelSubView === "subscribers" || channelSubView === "admins") {
                            setChannelSubView(channelMembersReturnViewRef.current);
                            return;
                          }
                          if (channelSubView === "add_subscribers") {
                            closeAddMembersView("channel");
                            return;
                          }
                          if (channelSubView !== null) {
                            setChannelSubView(null);
                            return;
                          }
                        }
                      }}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                      aria-label={t("Назад")}
                    >
                      <ArrowLeft size={22} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopDetailsPanelOpen(false);
                        setInspectedDetailsEntity(null);
                      }}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                      aria-label={t("Закрыть")}
                    >
                      <X size={22} />
                    </button>
                  )}
                  <div className={cn("flex flex-col min-w-0 flex-1", isCollapsedDetailsHeader && "pointer-events-none absolute left-16 right-16 items-center text-center")}>
                    <h2 className={cn("min-w-0 max-w-full truncate font-semibold text-zinc-100 transition-opacity duration-150", effectiveDetailsChatType === "direct" ? "text-[17px] leading-tight" : "text-[20px] leading-none")}>
                      {effectiveDetailsChatType === "direct" && profileSubView === null
                        ? isCollapsedDetailsHeader && profileData
                          ? (contactExists && contactDraftDisplayName ? contactDraftDisplayName : profileData.displayName)
                          : t("Информация")
                        : effectiveDetailsChatType === "direct"
                          ? (profileSubView === "contact_editor" ? (contactExists ? t("Контакт") : t("Новый контакт")) : profileSubView === "secret_chat" ? t("Секретный чат") : t("Информация"))
                          : effectiveDetailsChatType === "group"
                            ? (groupSubView === "reactions" ? t("Реакции") : groupSubView === "type" ? t("Тип группы") : groupSubView === "add_members"
                              ? t("Добавить участников")
                              : groupSubView === "members"
                                ? t("Участники")
                                : groupSubView === "admins"
                                  ? t("Администраторы")
                                  : groupSubView === "settings"
                                    ? t("Настройки группы")
                                    : t("Информация о группе"))
                            : effectiveDetailsChatType === "channel"
                              ? (channelSubView === "reactions" ? t("Реакции") : channelSubView === "type" ? t("Тип канала") : channelSubView === "add_subscribers"
                                ? t("Добавить подписчиков")
                                : channelSubView === "subscribers"
                                  ? t("Подписчики")
                                  : channelSubView === "admins"
                                    ? t("Администраторы")
                                    : channelSubView === "settings"
                                      ? t("Настройки канала")
                                      : t("Информация о канале"))
                              : t("Информация")}
                    </h2>
                    {effectiveDetailsChatType === "direct" && profileSubView === null && isCollapsedDetailsHeader && profileData ? (
                      <span className="text-[12px] text-zinc-400 truncate leading-tight mt-0.5 transition-opacity duration-150">
                        {profileHeaderStatusText}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {((effectiveDetailsChatType === "group" && groupSubView === "reactions") || (effectiveDetailsChatType === "channel" && channelSubView === "reactions")) && (
                    <button type="button" onClick={() => void saveCommunityReactions(effectiveDetailsChatType === "group" ? "group" : "channel")} disabled={groupSaving || channelSaving || (reactionSettingsDraft.reactionMode === "some" && !reactionSettingsDraft.allowedReactions.length)} aria-label={t("Сохранить реакции")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 disabled:opacity-40">{groupSaving || channelSaving ? <Spinner className="h-5 w-5" /> : <Check size={22} />}</button>
                  )}
                  {((effectiveDetailsChatType === "group" && groupSubView === "type") || (effectiveDetailsChatType === "channel" && channelSubView === "type")) && (
                    <button type="button" onClick={() => void saveCommunityType(effectiveDetailsChatType === "group" ? "group" : "channel")} disabled={groupSaving || channelSaving} aria-label={effectiveDetailsChatType === "group" ? t("Сохранить тип группы") : t("Сохранить тип канала")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 disabled:opacity-50">
                      {groupSaving || channelSaving ? <Spinner className="h-5 w-5" /> : <Check size={22} />}
                    </button>
                  )}
                  {effectiveDetailsChatType === "group" && groupSubView === "settings" && canManageGroup && isGroupDirty && (
                    <button
                      type="button"
                      onClick={() => void saveGroupSettings()}
                      disabled={groupSaving}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-50 cursor-pointer"
                      aria-label={t("Сохранить настройки группы")}
                    >
                      {groupSaving ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                    </button>
                  )}
                  {effectiveDetailsChatType === "channel" && channelSubView === "settings" && (channelModalData?.channel?.isOwner || channelModalData?.channel?.myCanChangeName || channelModalData?.channel?.myCanChangeAvatar) && isChannelDirty && (
                    <button
                      type="button"
                      onClick={() => void saveChannelSettings()}
                      disabled={channelSaving}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-50 cursor-pointer"
                      aria-label={t("Сохранить настройки канала")}
                    >
                      {channelSaving ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                    </button>
                  )}
                  {effectiveDetailsChatType === "group" && groupSubView === "add_members" && (
                    <button
                      type="button"
                      onClick={() => void submitAddCommunityMembers()}
                      disabled={addingMembers || selectedContactIds.length === 0}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-40 cursor-pointer"
                      aria-label={t("Сохранить")}
                    >
                      {addingMembers ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                    </button>
                  )}
                  {effectiveDetailsChatType === "channel" && channelSubView === "add_subscribers" && (
                    <button
                      type="button"
                      onClick={() => void submitAddCommunityMembers()}
                      disabled={addingMembers || selectedContactIds.length === 0}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-40 cursor-pointer"
                      aria-label={t("Сохранить")}
                    >
                      {addingMembers ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                    </button>
                  )}
                  {effectiveDetailsChatType === "group" && groupSubView === "members" && canManageGroup && (
                    <button
                      type="button"
                      onClick={() => void openAddMembersModal("group")}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-0 bg-transparent text-zinc-100 outline-none transition-opacity duration-200 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-white/40 cursor-pointer"
                      aria-label={t("Добавить участников")}
                    >
                      <Plus size={23} strokeWidth={2} />
                    </button>
                  )}
                  {effectiveDetailsChatType === "channel" && channelSubView === "subscribers" && channelModalData?.channel?.isOwner && (
                    <button
                      type="button"
                      onClick={() => void openAddMembersModal("channel")}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                      aria-label={t("Добавить подписчиков")}
                    >
                      <UserRoundPlus size={20} />
                    </button>
                  )}
                  {effectiveDetailsChatType === "direct" && profileSubView === "contact_editor" && (
                    <button
                      type="button"
                      onClick={async () => {
                        await saveContact();
                        setProfileSubView(null);
                      }}
                      disabled={contactSaving}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-40 cursor-pointer"
                      aria-label={t("Сохранить")}
                    >
                      {contactSaving ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                    </button>
                  )}
                  {effectiveDetailsChatType === "direct" && profileData && profileSubView === null && (
                    <>
                      {!profileIsBot && !profileIsSaved && profileData.id !== selfId && (
                        <button
                          type="button"
                          onClick={() => {
                            setContactEditorTarget({
                              link: profileData.link,
                              displayName: profileData.displayName,
                              avatarUrl: profileData.avatarUrl ?? null,
                            });
                            const draftParts = splitContactAliasParts(contactExists ? contactDraftDisplayName : profileData.displayName);
                            setContactFirstName(draftParts.firstName);
                            setContactLastName(draftParts.lastName);
                            setProfileSubView("contact_editor");
                          }}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                          aria-label={t("Редактировать контакт")}
                        >
                          <MdEdit size={21} />
                        </button>
                      )}
                      {(profileIsBot || profileIsSaved || profileData.id === selfId) && (<div className="relative">
                        <button
                          type="button"
                          onClick={() => setProfileMoreOpen((value) => !value)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                          aria-label={t("Опции")}
                        >
                          <MoreVertical size={20} />
                        </button>
                        <AnimatePresence>
                          {profileMoreOpen ? (
                            <motion.div
                              className="absolute right-0 top-11 z-[150] w-52 overflow-hidden rounded-[18px] bg-[#1e1e1e]/95 p-1 shadow-[0_18px_38px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.08] backdrop-blur-2xl"
                              initial={{ opacity: 0, scale: 0.9, y: -4, transformOrigin: "top right" }}
                              animate={{ opacity: 1, scale: 1, y: 0, transformOrigin: "top right" }}
                              exit={{ opacity: 0, scale: 0.9, y: -4, transformOrigin: "top right" }}
                              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setProfileMoreOpen(false);
                                  wallpaperTargetRef.current = profileData.link;
                                  wallpaperFileInputRef.current?.click();
                                }}
                                disabled={uploadingWallpaper}
                                className="flex h-10 w-full items-center gap-2.5 rounded-[14px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                              >
                                <ImageIcon size={16} className="text-zinc-400" />
                                <span>{uploadingWallpaper ? t("Загрузка...") : t("Поставить обои")}</span>
                              </button>
                              {!profileIsBot && !profileIsSaved && <button
                                type="button"
                                onClick={() => void openSecretChatFromProfile()}
                                className="flex h-10 w-full items-center gap-2.5 rounded-[14px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08] active:scale-[0.98] cursor-pointer"
                              >
                                <Lock size={16} className="text-zinc-400" />
                                <span>{t("Начать секретный чат")}</span>
                              </button>}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>)}
                    </>
                  )}

                  {hasBackButton && effectiveDetailsChatType === "direct" && profileSubView !== "secret_chat" && profileSubView !== "contact_editor" && <button
                    type="button"
                    onClick={() => {
                      setDesktopDetailsPanelOpen(false);
                      setInspectedDetailsEntity(null);
                    }}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                    aria-label={t("Закрыть")}
                  >
                    <X size={22} />
                  </button>}
                </div>
              </div>
            );
          })()}
          <div className={cn("relative z-[1] flex min-h-0 w-full flex-1 flex-col", (profileSubView === "qrcode" || groupSubView === "qrcode" || channelSubView === "qrcode" || (effectiveDetailsChatType === "direct" && profileSubView === null)) ? "h-full" : "h-[calc(100%-56px)]")}>
            <div key={`${effectiveDetailsChatType}:${inspectedDetailsEntity?.link ?? activeChat?.link ?? ""}`} onScroll={handleProfileScroll} className={cn("min-h-0 flex-1 h-full flex flex-col no-scrollbar", (profileSubView === "qrcode" || profileSubView === "secret_chat" || groupSubView === "qrcode" || channelSubView === "qrcode") ? "overflow-hidden" : "overflow-y-auto pb-5")}>
              {effectiveDetailsChatType === "direct" ? (
                profileLoading ? (
                  renderProfileDetailsSkeleton()
                ) : profileData ? (
                  <PanelNavigation direction={profileNavDirection} className={profileSubView === "qrcode" || profileSubView === "secret_chat" ? "min-h-0 flex-1 h-full grid-rows-[minmax(0,1fr)]" : "shrink-0"}>
                    {profileSubView === "qrcode" ? (
                      <motion.div
                        key="profile-details-qrcode"
                        custom={profileNavDirection}
                        variants={telegramSubViewVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-col flex-1 h-full min-h-0 relative overflow-hidden"
                      >
                        <ChatQrPanel
                          displayName={contactExists && contactDraftDisplayName ? contactDraftDisplayName : profileData.displayName}
                          link={profileData.link}
                          avatarUrl={profileData.avatarUrl}
                          onBack={() => setProfileSubView(null)}
                        />
                      </motion.div>
                    ) : profileSubView === "contact_editor" ? (
                      <motion.div
                        key="profile-details-contact-editor"
                        custom={profileNavDirection}
                        variants={telegramSubViewVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-col flex-1 h-full min-h-0 relative"
                      >
                        {renderContactEditorContent()}
                      </motion.div>
                    ) : profileSubView === "secret_chat" ? (
                      <motion.div
                        key="profile-details-secret-chat"
                        custom={profileNavDirection}
                        variants={telegramSubViewVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-col flex-1 h-full min-h-0 relative"
                      >
                        {renderSecretChatPanelContent()}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="profile-details-main"
                        custom={profileNavDirection}
                        variants={telegramSubViewVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-col pb-6"
                      >
                        {(() => {
                          const effectiveGradient = getEffectiveProfileGradient(
                            profileData.backgroundUrl,
                            profileData.displayName,
                            profileData.link
                          );
                          const effectiveAccent = getEffectiveProfileAccentColor(
                            profileData.backgroundUrl,
                            profileData.displayName,
                            profileData.link
                          );
                          const isMediaBg = isMediaBackgroundUrl(profileData.backgroundUrl);

                          return (
                            <div
                              className={cn("relative flex flex-col items-center pt-14 pb-0 text-center transition-colors duration-150 overflow-hidden", effectiveGradient || isMediaBg || profileData.musicUrl?.trim() ? "mb-3" : "mb-2")}
                              style={{
                                background: effectiveGradient || "transparent",
                              }}
                            >
                              {isMediaBg ? (
                                <>
                                  <MediaBanner
                                    src={profileData.backgroundUrl}
                                    className="absolute inset-0"
                                    mediaClassName="object-cover"
                                    autoPlay={desktopDetailsPanelOpen}
                                    alt={t("Фон профиля")}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/25 pointer-events-none" />
                                </>
                              ) : null}
                              <div className={cn("relative z-10 flex flex-col items-center px-5", effectiveGradient || isMediaBg || profileData.musicUrl?.trim() ? "pb-6 sm:pb-7" : "pb-2")}>
                                <div className="relative">
                                  <div className="relative w-[124px] h-[124px] flex items-center justify-center">
                                    {/* Subtle soft white ambient halo behind avatar like in Telegram */}
                                    {(effectiveGradient || isMediaBg) ? (
                                      <div
                                        className="pointer-events-none absolute -inset-6 rounded-full opacity-35 blur-xl select-none"
                                        style={{
                                          background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.12) 45%, transparent 70%)",
                                        }}
                                      />
                                    ) : null}
                                    <AnimatePresence mode="wait">
                                      {storyGroupByAuthorId.has(profileData.id) ? (
                                        <motion.button
                                          key="other-story-avatar"
                                          type="button"
                                          onClick={(event) => openStoryViewerByAuthorId(profileData.id, event.currentTarget)}
                                          aria-label={t("Открыть историю {0}", { 0: profileData.displayName })}
                                          className="relative w-[124px] h-[124px] flex items-center justify-center shrink-0 focus:outline-none cursor-pointer"
                                          initial={{ opacity: 0, scale: 0.95 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.95 }}
                                          transition={{ duration: 0.22, ease: "easeOut" }}
                                        >
                                          <StoryAvatarRing
                                            seen={!storyGroupByAuthorId.get(profileData.id)?.group.hasUnviewed}
                                            stories={storyGroupByAuthorId.get(profileData.id)?.group.stories}
                                            className="w-full h-full p-[8px]"
                                          >
                                            <MediaAvatar
                                              src={profileData.avatarUrl ?? undefined}
                                              alt={profileData.displayName}
                                              className="h-full w-full bg-zinc-800 text-[36px] text-white shadow-[0_16px_38px_rgba(0,0,0,0.3)] border-0"
                                              fallbackText={profileData.displayName.slice(0, 1)}
                                              autoPlay={desktopDetailsPanelOpen}
                                            />
                                          </StoryAvatarRing>
                                        </motion.button>
                                      ) : (
                                        <motion.div
                                          key="other-plain-avatar"
                                          onClick={() => {
                                            if (isRealMediaAvatar(profileData.avatarUrl)) {
                                              openAvatarViewer({
                                                mediaUrl: profileData.avatarUrl,
                                                title: contactExists && contactDraftDisplayName ? contactDraftDisplayName : profileData.displayName,
                                                timestamp: profileData.id === selfId ? profileData.avatarUploadedAt : undefined,
                                                showUploadTimestamp: profileData.id === selfId,
                                                fallbackText: profileData.displayName.slice(0, 1),
                                              });
                                            }
                                          }}
                                          className={cn(
                                            "relative w-[108px] h-[108px] flex items-center justify-center",
                                            isRealMediaAvatar(profileData.avatarUrl) && "cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                          )}
                                          initial={{ opacity: 0, scale: 0.95 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.95 }}
                                          transition={{ duration: 0.22, ease: "easeOut" }}
                                        >
                                          {profileIsEclipse ? <EclipseBotAvatar className="h-[108px] w-[108px]" /> : profileIsSaved ? <SavedMessagesAvatar className="h-[108px] w-[108px]" seedLink={selfProfile?.link} /> : (<MediaAvatar
                                            src={profileData.avatarUrl ?? undefined}
                                            alt={profileData.displayName}
                                            className="h-[108px] w-[108px] bg-zinc-800 text-[36px] text-white shadow-[0_16px_38px_rgba(0,0,0,0.3)] border-0 ring-0 outline-none"
                                            fallbackText={profileData.displayName.slice(0, 1)}
                                            autoPlay={desktopDetailsPanelOpen}
                                          />)}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>

                                <h3 className="mt-2.5 max-w-full truncate text-[20px] font-semibold leading-tight text-white tracking-tight">
                                  {profileIsEclipse ? <EclipseVerifiedTitle showDetails title="Eclipse" /> : profileIsSaved ? t("Избранное") : <VerifiedTitle showDetails kind="user" link={profileData.link} isBot={profileIsBot}>{contactExists && contactDraftDisplayName ? contactDraftDisplayName : profileData.displayName}</VerifiedTitle>}
                                </h3>

                                <div
                                  className="mt-1 flex items-center justify-center text-[13.5px] font-medium text-white/80"
                                >
                                  <span>
                                    {profileIsSaved ? t("ваше облачное хранилище") : profileIsBot ? t("бот") : t(getPresenceStatusText(
                                      profileData.id,
                                      onlineUserIds,
                                      lastOfflineAtByUserId,
                                      presenceNowTs,
                                      profileData.id === selfId || profileData.presenceVisibility !== "none",
                                      profileData.id === selfId || profileData.lastSeenVisibility !== "none",
                                    ))}
                                  </span>
                                </div>
                              </div>

                              {profileData.musicUrl ? (
                                <div className="w-full relative z-10">
                                  <ProfileMusicCaption
                                    url={profileData.musicUrl}
                                    title={profileData.musicTitle}
                                    author={profileData.musicAuthor}
                                    coverUrl={profileData.musicCoverUrl}
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}

                        {renderUserProfileActions()}

                        {/* User Info Card */}
                        <div hidden={profileIsSaved || (profileData.usernameHidden && !profileData.description?.trim() && !profileIsBot && profileData.id !== selfId)} className="mx-4 overflow-hidden rounded-[24px] bg-white/[0.04] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-0.5">
                          {/* Username Row */}
                          {!profileData.usernameHidden && <div
                            className="mx-0.5 w-[calc(100%-4px)] rounded-[16px] flex min-h-[52px] items-center gap-3.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!profileData.usernameHidden) {
                                  const cleanLink = `@${profileData.link.replace(/^@+/, "")}`;
                                  void navigator.clipboard?.writeText(cleanLink);
                                  showAppToast({
                                    title: t("Уникальное имя скопировано"),
                                    type: "success",
                                    icon: "copy",
                                  });
                                }
                              }}
                              className="flex flex-1 min-w-0 items-center gap-3.5 text-left bg-transparent border-0 p-0 cursor-pointer"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-400">
                                <AtSign size={21} />
                              </span>
                              <span className="min-w-0 flex-1">
                                {(() => {
                                  const cleanMainLink = profileData.link.replace(/^@+/, "");
                                  const secondaryUsernames = (profileData.secondaryLinks || []).filter(
                                    (l) => l && l.trim().replace(/^@+/, "").toLowerCase() !== cleanMainLink.toLowerCase(),
                                  );
                                  return (
                                    <>
                                      <span className="block text-[15px] font-semibold leading-5 text-white break-words">
                                        {profileData.usernameHidden ? (
                                          t("Скрыт")
                                        ) : (
                                          <>
                                            <span>@{cleanMainLink}</span>
                                            {secondaryUsernames.length > 0 && (
                                              <span className="block text-[13.5px] font-normal text-zinc-400 mt-0.5">
                                                {t("а также")}{" "}
                                                <span className="text-white font-semibold">
                                                  {secondaryUsernames.map((l, idx) => (
                                                    <Fragment key={l}>
                                                      {idx > 0 && ", "}
                                                      <span
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setCollectibleModalUsername(l);
                                                        }}
                                                        className="cursor-pointer transition-colors duration-150 inline-block rounded-[6px] px-1 py-0.5 -mx-1 -my-0.5 hover:bg-white/10 active:bg-white/15 text-white select-none"
                                                      >
                                                        @{l.replace(/^@+/, "")}
                                                      </span>
                                                    </Fragment>
                                                  ))}
                                                </span>
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </span>
                                      <span className="mt-0.5 block text-[12.5px] leading-4 text-zinc-400">
                                        {secondaryUsernames.length > 0
                                          ? t("Уникальные имена")
                                          : t("Уникальное имя")}
                                      </span>
                                    </>
                                  );
                                })()}
                              </span>
                            </button>
                            {!profileData.usernameHidden && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProfileSubView("qrcode");
                                }}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                                aria-label={t("QR код")} onPointerEnter={preloadChatQrPanel} onFocus={preloadChatQrPanel}
                              >
                                <QrCode size={19} />
                              </button>
                            )}
                          </div>}

                          {/* Bio Row */}
                          {profileData.description?.trim() ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (profileData.description?.trim()) {
                                  void navigator.clipboard?.writeText(profileData.description.trim());
                                  showAppToast({
                                    title: t("Описание скопировано"),
                                    type: "success",
                                    icon: "copy",
                                  });
                                }
                              }}
                              className="mx-0.5 w-[calc(100%-4px)] rounded-[16px] flex min-h-[52px] items-center gap-3.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99] cursor-pointer"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-400">
                                <Info size={21} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block whitespace-pre-wrap text-[15px] font-semibold text-white leading-5">
                                  {profileData.id === "system:importbot" ? t(profileData.description.trim()) : profileData.description.trim()}
                                </span>
                                <span className="mt-0.5 block text-[12.5px] leading-4 text-zinc-400">{t("О себе")}</span>
                              </span>
                            </button>
                          ) : null}

                          {/* Notifications Row */}
                          {(profileIsBot || profileIsSaved || profileData.id === selfId) && (<button
                            type="button"
                            onClick={() => toggleChatMutedState(profileData.link)}
                            className="mx-0.5 w-[calc(100%-4px)] rounded-[16px] flex min-h-[52px] items-center justify-between gap-3.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99] cursor-pointer"
                            aria-pressed={!mutedChatLinkSet.has(profileData.link)}
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-400">
                              <Bell size={21} />
                            </span>
                            <span className="min-w-0 flex-1 text-[15px] font-semibold text-white">
                              {t("Уведомления")}</span>
                            <span
                              className={cn(
                                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer",
                                mutedChatLinkSet.has(profileData.link) ? "bg-zinc-700" : "bg-[var(--ui-accent-solid,#38bdf8)]",
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-5 w-5 rounded-full shadow ring-0 transition duration-200 ease-in-out",
                                  mutedChatLinkSet.has(profileData.link)
                                    ? "translate-x-0 bg-white"
                                    : "translate-x-5 bg-zinc-950",
                                )}
                              />
                            </span>
                          </button>)}
                        </div>

                        {/* Tabs: Media, Files, Voice, Links, Music */}
                        <div className="py-2 px-4">
                          <ScrollableTabsBar>
                            {[
                              { id: "media", label: t("Медиа") },
                              { id: "files", label: t("Файлы") },
                              { id: "voice", label: t("Голосовые") },
                              { id: "links", label: t("Ссылки") },
                              { id: "music", label: t("Музыка") },
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setProfileActiveTab(tab.id as any)}
                                className={cn(
                                  "shrink-0 rounded-[16px] px-4 py-2 text-center text-[14px] font-semibold transition-all duration-200 cursor-pointer min-h-[38px] flex items-center justify-center",
                                  profileActiveTab === tab.id
                                    ? "bg-white/[0.10] text-white shadow-sm"
                                    : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                                )}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </ScrollableTabsBar>
                        </div>

                        {/* Tab Content */}
                        {!profileMediaVisible ? null : profileActiveTab === "files" ? (
                          <div>
                            {chatSharedFilesList.length === 0 ? (
                              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                                <img
                                  src="/gifs/thinking.gif"
                                  alt=""
                                  className="h-20 w-20 object-contain mb-3 select-none pointer-events-none drop-shadow-md"
                                />
                                <h4 className="text-[15.5px] font-semibold text-zinc-100">{t("Нет файлов")}</h4>
                                <p className="mt-1 max-w-[260px] text-[13px] text-zinc-400 leading-relaxed">
                                  {t("Документы и файлы из этого чата будут отображаться здесь")}</p>
                              </div>
                            ) : (
                              <div className="space-y-1 px-3 pb-16 pt-1">
                                {chatSharedFilesList.map((file) => {
                                  const ext = file.extension.toLowerCase();
                                  const isPdf = ext === "pdf";
                                  const isApk = ext === "apk";
                                  const isDoc = ext === "doc" || ext === "docx" || ext === "txt";
                                  const isZip = ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar";
                                  const badgeColor = isPdf
                                    ? "bg-red-500/90 text-white"
                                    : isApk
                                      ? "bg-emerald-500/90 text-white"
                                      : isDoc
                                        ? "bg-blue-500/90 text-white"
                                        : isZip
                                          ? "bg-amber-500/90 text-white"
                                          : "bg-indigo-500/90 text-white";

                                  return (
                                    <a
                                      key={file.id}
                                      href={file.src || undefined} aria-disabled={!file.src}
                                      download={file.name}
                                      className="flex items-center gap-3.5 rounded-[18px] p-2 transition-colors hover:bg-white/[0.04] active:scale-[0.99] cursor-pointer group"
                                    >
                                      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[12px] font-bold uppercase shadow-sm tracking-wider", badgeColor)}>
                                        {ext.slice(0, 4)}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-[14.5px] font-semibold text-white group-hover:text-white transition-colors">
                                          {file.name}
                                        </p>
                                        <p className="mt-0.5 truncate text-[12.5px] text-zinc-400">
                                          {formatSharedFileSize(file.size)} • {file.dateText}
                                        </p>
                                      </div>
                                      <Download size={18} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1" />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : profileActiveTab === "voice" ? (
                          <div>
                            {chatSharedVoiceList.length === 0 ? (
                              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                                <img
                                  src="/gifs/thinking.gif"
                                  alt=""
                                  className="h-20 w-20 object-contain mb-3 select-none pointer-events-none drop-shadow-md"
                                />
                                <h4 className="text-[15.5px] font-semibold text-zinc-100">{t("Нет голосовых сообщений")}</h4>
                                <p className="mt-1 max-w-[260px] text-[13px] text-zinc-400 leading-relaxed">
                                  {t("Голосовые записи из этого чата будут отображаться здесь")}</p>
                              </div>
                            ) : (
                              <div className="space-y-1 px-3 pb-16 pt-1">
                                {chatSharedVoiceList.map((voice) => {
                                  const isPlaying = profilePlayingAudioUrl === voice.src;
                                  return (
                                    <div
                                      key={voice.id}
                                      className="flex items-center gap-3.5 rounded-[18px] p-2 transition-colors hover:bg-white/[0.04]"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isPlaying) {
                                            setProfilePlayingAudioUrl(null);
                                          } else {
                                            setProfilePlayingAudioUrl(voice.src);
                                            const audio = new Audio(voice.src);
                                            audio.play().catch(() => undefined);
                                            audio.onended = () => setProfilePlayingAudioUrl(null);
                                          }
                                        }}
                                        disabled={!voice.src} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast,#ffffff)] hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
                                      >
                                        {isPlaying ? <Pause size={18} fill="currentColor" strokeWidth={0} /> : <Play size={18} fill="currentColor" strokeWidth={0} className="translate-x-0.5" />}
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-[14.5px] font-semibold text-white">
                                          {voice.authorName}
                                        </p>
                                        <p className="mt-0.5 truncate text-[12.5px] text-zinc-400">
                                          {formatDurationFromSeconds(Math.round((voice.durationMs ?? 0) / 1000))}
                                        </p>
                                      </div>
                                      <span className="text-[12px] text-zinc-500 shrink-0 pr-1">{voice.timeText}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : profileActiveTab === "links" ? (
                          <div>
                            {chatSharedLinksList.length === 0 ? (
                              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                                <img
                                  src="/gifs/thinking.gif"
                                  alt=""
                                  className="h-20 w-20 object-contain mb-3 select-none pointer-events-none drop-shadow-md"
                                />
                                <h4 className="text-[15.5px] font-semibold text-zinc-100">{t("Нет ссылок")}</h4>
                                <p className="mt-1 max-w-[260px] text-[13px] text-zinc-400 leading-relaxed">
                                  {t("Отправленные ссылки из этого чата будут отображаться здесь")}</p>
                              </div>
                            ) : (
                              <div className="space-y-1 px-3 pb-16 pt-1">
                                {chatSharedLinksList.map((link) => (
                                  <button
                                    key={link.id}
                                    type="button"
                                    onClick={() => openExternalLinkPrompt(link.url)}
                                    className="flex w-full items-start gap-3.5 rounded-[18px] p-2.5 text-left transition-colors hover:bg-white/[0.04] cursor-pointer group"
                                  >
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--ui-accent-solid,#38bdf8)]/18 text-[color:var(--ui-accent-solid,#38bdf8)] font-bold text-[16px] shadow-sm uppercase mt-0.5">
                                      {link.domain.slice(0, 1) || "L"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-[14.5px] font-semibold text-white group-hover:text-white transition-colors">
                                          {link.domain}
                                        </p>
                                        <span className="text-[11.5px] text-zinc-500 shrink-0">{link.dateText}</span>
                                      </div>
                                      {link.snippet ? (
                                        <p className="mt-0.5 line-clamp-2 text-[12.5px] text-zinc-300 leading-snug">
                                          {link.snippet}
                                        </p>
                                      ) : null}
                                      <p className="mt-0.5 truncate text-[12.5px] text-sky-400/90 font-medium">
                                        {link.url}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : profileActiveTab === "music" ? (
                          <div>
                            {chatSharedMusicList.length === 0 ? (
                              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                                <img
                                  src="/gifs/thinking.gif"
                                  alt=""
                                  className="h-20 w-20 object-contain mb-3 select-none pointer-events-none drop-shadow-md"
                                />
                                <h4 className="text-[15.5px] font-semibold text-zinc-100">{t("Нет музыки")}</h4>
                                <p className="mt-1 max-w-[260px] text-[13px] text-zinc-400 leading-relaxed">
                                  {t("Аудиозаписи и треки из этого чата будут отображаться здесь")}</p>
                              </div>
                            ) : (
                              <div className="space-y-1 px-3 pb-16 pt-1">
                                {chatSharedMusicList.map((track) => {
                                  const isPlaying = profilePlayingAudioUrl === track.url;
                                  return (
                                    <div
                                      key={track.id}
                                      className="flex items-center gap-3.5 rounded-[18px] p-2 transition-colors hover:bg-white/[0.04]"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          window.dispatchEvent(
                                            new CustomEvent("eclipse:music-play", {
                                              detail: {
                                                url: track.url,
                                                title: track.title,
                                                author: track.author,
                                                coverUrl: track.coverUrl,
                                                userInitiated: true,
                                              },
                                            }),
                                          );
                                        }}
                                        disabled={!track.url} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-zinc-800 text-white overflow-hidden shadow-sm cursor-pointer group disabled:cursor-wait"
                                      >
                                        {track.coverUrl ? (
                                          <ProfileMediaThumb src={track.coverUrl} className="object-cover" />
                                        ) : (
                                          <Music2 size={20} className="text-zinc-400" />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 grid place-items-center">
                                          {isPlaying ? <Pause size={16} fill="currentColor" strokeWidth={0} /> : <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-0.5" />}
                                        </div>
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-[14.5px] font-semibold text-white">
                                          {track.title}
                                        </p>
                                        <p className="mt-0.5 truncate text-[12.5px] text-zinc-400">
                                          {track.durationMs ? `${formatDurationFromSeconds(Math.round(track.durationMs / 1000))} • ` : ""}{track.author} • {track.dateText}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {chatSharedMediaList.length === 0 ? (
                              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                                <img
                                  src="/gifs/thinking.gif"
                                  alt=""
                                  className="h-20 w-20 object-contain mb-3 select-none pointer-events-none drop-shadow-md"
                                />
                                <h4 className="text-[15.5px] font-semibold text-zinc-100">{t("Нет медиафайлов")}</h4>
                                <p className="mt-1 max-w-[260px] text-[13px] text-zinc-400 leading-relaxed">
                                  {t("Фотографии и видео из этого чата будут отображаться здесь")}</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-0.5 p-1 pb-16">
                                {chatSharedMediaList.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      if (item.kind === "video") {
                                        setVideoViewer({
                                          src: item.src,
                                          caption: item.caption || "",
                                          timeText: item.timeText,
                                          dateText: item.dateText,
                                          messageId: item.messageId,
                                          authorName: item.authorName,
                                          authorAvatarUrl: item.authorAvatarUrl,
                                          authorLink: item.authorLink,
                                          canDelete: item.canDelete,
                                          isMine: item.isMine,
                                        });
                                      } else {
                                        setImageViewer({
                                          src: item.src,
                                          caption: item.caption || "",
                                          timeText: item.timeText,
                                          dateText: item.dateText,
                                          messageId: item.messageId,
                                          authorName: item.authorName,
                                          authorAvatarUrl: item.authorAvatarUrl,
                                          authorLink: item.authorLink,
                                          canDelete: item.canDelete,
                                          isMine: item.isMine,
                                        });
                                      }
                                    }}
                                    className="group relative aspect-square overflow-hidden bg-zinc-900 focus:outline-none cursor-pointer"
                                  >
                                    {item.kind === "video" ? (
                                      <>
                                        <ProfileMediaThumb src={item.src} preview={item.preview} video className="object-cover transition-transform duration-200 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-black/15 transition-opacity group-hover:bg-black/0" />
                                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-[6px] bg-black/60 px-1.5 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">
                                          <Play size={10} className="fill-white" />
                                          <span>{formatDurationFromSeconds(Math.round((item.durationMs ?? 0) / 1000))}</span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <ProfileMediaThumb src={item.src} preview={item.preview} alt={item.caption || ""} className="object-cover transition-transform duration-200 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-white/5" />
                                      </>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </PanelNavigation>
                ) : (
                  <div className="px-4 py-8 text-sm text-red-400">{profileError || t("Не удалось загрузить профиль")}</div>
                )
              ) : effectiveDetailsChatType === "group" ? (
                groupModalLoading ? (
                  <CommunityDetailsSkeleton withMembers />
                ) : groupModalData?.group ? (
                  <div className={cn("relative min-h-full flex flex-col", groupSubView === "qrcode" ? "h-full pb-0 flex-1" : "pb-32")}>
                    <PanelNavigation direction={groupNavDirection} className={groupSubView === "qrcode" ? "min-h-0 flex-1 h-full" : ""}>
                      {groupSubView === "reactions" ? renderCommunityReactions("group", false) : groupSubView === "type" ? renderCommunityType("group", false) : groupSubView === "settings" ? (
                        /* Group Settings View */
                        <motion.div
                          key="group-details-settings"
                          custom={groupNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col"
                        >
                          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">{renderCommunitySettings("group")}</div>
                        </motion.div>
                      ) : groupSubView === "admins" ? (
                        /* Group Admins View */
                        <motion.div
                          key="group-details-admins"
                          custom={groupNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0"
                        >
                          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 overflow-hidden">
                            <div className="space-y-1 overflow-y-auto no-scrollbar py-2 flex-1 min-h-0">
                              {(() => {
                                const admins = (groupModalData.members || []).filter(
                                  (m) => m.role === "admin" || m.id === groupModalData.group.ownerId
                                );
                                return admins.map((member) => {
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
                                          <p className={cn("mt-0.5 truncate text-[12px] font-normal leading-normal", onlineUserIds.has(member.id) ? "text-[var(--ui-accent-solid,#38bdf8)]" : "text-zinc-400")}>
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
                                        ) : null}

                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </motion.div>
                      ) : groupSubView === "members" ? (
                        /* Group Members View */
                        <motion.div
                          key="group-details-members"
                          custom={groupNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0"
                        >
                          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 overflow-hidden">

                            <div className="pb-2 pt-0 px-1 shrink-0">
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
                                      className={cn(
                                        "mx-1 w-[calc(100%-8px)] rounded-[16px] px-3.5 py-2 hover:bg-white/[0.05] active:scale-[0.99] transition-all duration-200 flex items-center justify-between",
                                        member.link && "cursor-pointer"
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
                                          <p className={cn("mt-0.5 truncate text-[12px] font-normal leading-normal", onlineUserIds.has(member.id) ? "text-[var(--ui-accent-solid,#38bdf8)]" : "text-zinc-400")}>
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
                                        ) : null}

                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </motion.div>
                      ) : groupSubView === "add_members" ? (
                        /* Group Add Members View */
                        <motion.div
                          key="group-details-add-members"
                          custom={groupNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0"
                        >
                          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 pb-4 overflow-hidden">
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
                                        <div className="min-w-0 flex-1">
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
                        /* Group QR Code View */
                        <motion.div
                          key="group-details-qrcode"
                          custom={groupNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0 relative overflow-hidden"
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
                          key="group-details-main"
                          custom={groupNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col px-4 pt-7"
                        >
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
                                "cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
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
                            <p className="mt-4 max-w-full truncate text-[20px] font-semibold text-white"><VerifiedTitle showDetails kind="group" link={groupModalData!.group.link}>{groupNameDraft}</VerifiedTitle></p>
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

                          {/* Group Community Media, Files, Voice, Links, Music */}
                          <div className="mt-3">
                            {renderCommunitySharedTabs(true)}
                          </div>
                        </motion.div>
                      )}
                    </PanelNavigation>
                  </div>
                ) : (
                  <div className="px-4 py-8 text-sm text-red-400">{groupModalError || t("Не удалось загрузить группу")}</div>
                )
              ) : effectiveDetailsChatType === "channel" ? (
                channelModalLoading ? (
                  <CommunityDetailsSkeleton />
                ) : channelModalData?.channel ? (
                  <div className={cn("relative min-h-full flex flex-col", channelSubView === "qrcode" ? "h-full pb-0 flex-1" : "pb-32")}>
                    <PanelNavigation direction={channelNavDirection} className={channelSubView === "qrcode" ? "min-h-0 flex-1 h-full" : ""}>
                      {channelSubView === "reactions" ? renderCommunityReactions("channel", false) : channelSubView === "type" ? renderCommunityType("channel", false) : channelSubView === "settings" ? (
                        /* Channel Settings View */
                        <motion.div
                          key="channel-details-settings"
                          custom={channelNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col"
                        >

                          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">{renderCommunitySettings("channel")}</div>
                        </motion.div>

                      ) : channelSubView === "subscribers" ? (
                        /* Channel Subscribers View */
                        <motion.div
                          key="channel-details-subscribers"
                          custom={channelNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0"
                        >
                          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 overflow-hidden">

                            <div className="pb-2 pt-0 px-1 shrink-0">
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

                            <div className="space-y-1 overflow-y-auto no-scrollbar py-2 flex-1 min-h-0">
                              {(() => {
                                const query = memberSearchQuery.trim().toLowerCase();
                                const allSubs = channelModalData.subscribers || channelModalData.members || [];
                                const filtered = allSubs.filter((sub) => {
                                  if (!query) return true;
                                  const name = (sub.displayName || sub.link || "").toLowerCase();
                                  return name.includes(query);
                                });
                                if (filtered.length === 0) {
                                  return <p className="text-sm text-zinc-500 text-center py-4">{t("Подписчики не найдены")}</p>;
                                }
                                return filtered.slice(0, 100).map((sub) => {
                                  const isOwner = sub.id === channelModalData.channel.ownerId;
                                  const isAdmin = sub.role === "admin";
                                  const isClickable = (channelModalData.channel.isOwner || channelModalData.channel.myCanManageAdmins) && !isOwner;

                                  return (
                                    <div
                                      key={sub.id}
                                      role="button"
                                      tabIndex={0}
                                      {...memberLongPress(sub, "channel")}
                                      onClick={() => openCommunityProfile(sub)}
                                      onKeyDown={(event) => {
                                        if (event.target !== event.currentTarget) return;
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          openCommunityProfile(sub);
                                        }
                                      }}
                                      className="mx-1 w-[calc(100%-8px)] cursor-pointer rounded-[16px] px-3.5 py-2 hover:bg-white/[0.05] active:scale-[0.99] transition-all duration-200 flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <MediaAvatar
                                          src={sub.avatarUrl ?? undefined}
                                          alt={sub.displayName}
                                          className="h-10 w-10 rounded-full"
                                          fallbackText={sub.displayName.slice(0, 1)}
                                          autoPlay
                                        />
                                        <div className="min-w-0">
                                          <p className="truncate text-[14.5px] font-semibold text-zinc-100">{sub.displayName}</p>
                                          <p className={cn("mt-0.5 truncate text-[12px] font-normal leading-normal", onlineUserIds.has(sub.id) ? "text-[var(--ui-accent-solid,#38bdf8)]" : "text-zinc-400")}>
                                            {t(getPresenceStatusText(
                                              sub.id,
                                              onlineUserIds,
                                              lastOfflineAtByUserId,
                                              presenceNowTs,
                                              sub.id === selfId || readProfileFromCache(sub.id)?.presenceVisibility !== "none",
                                              sub.id === selfId || readProfileFromCache(sub.id)?.lastSeenVisibility !== "none",
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
                                            {(sub.roleLabel?.trim() || t("админ")).slice(0, 28)}
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
                      ) : channelSubView === "admins" ? (
                        /* Channel Admins View / "Выберите участника" list view */
                        <motion.div
                          key="channel-details-admins"
                          custom={channelNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0"
                        >

                          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 overflow-hidden">

                            <div className="pb-2 pt-0 px-1 shrink-0">
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
                                const allSubs = channelModalData.subscribers || channelModalData.members || [];
                                const filtered = allSubs.filter((sub) => {
                                  if (!query) return true;
                                  const name = (sub.displayName || sub.link || "").toLowerCase();
                                  return name.includes(query);
                                });
                                if (filtered.length === 0) {
                                  return <p className="text-sm text-zinc-500 text-center py-4">{t("Участники не найдены")}</p>;
                                }
                                return filtered.slice(0, 100).map((sub) => {
                                  const isOwner = sub.id === channelModalData.channel.ownerId;
                                  const isAdmin = sub.role === "admin";
                                  const isClickable = (channelModalData.channel.isOwner || channelModalData.channel.myCanManageAdmins) && !isOwner;

                                  return (
                                    <div
                                      key={sub.id}
                                      role="button"
                                      tabIndex={0}
                                      {...memberLongPress(sub, "channel")}
                                      onClick={() => openCommunityProfile(sub)}
                                      onKeyDown={(event) => {
                                        if (event.target !== event.currentTarget) return;
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          openCommunityProfile(sub);
                                        }
                                      }}
                                      className={cn(
                                        "mx-1 w-[calc(100%-8px)] rounded-[16px] px-3.5 py-2 hover:bg-white/[0.05] active:scale-[0.99] transition-all duration-200 flex items-center justify-between",
                                        sub.link && "cursor-pointer"
                                      )}
                                    >
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <MediaAvatar
                                          src={sub.avatarUrl ?? undefined}
                                          alt={sub.displayName}
                                          className="h-10 w-10 rounded-full"
                                          fallbackText={sub.displayName.slice(0, 1)}
                                          autoPlay
                                        />
                                        <div className="min-w-0">
                                          <p className="truncate text-[14.5px] font-semibold text-zinc-100">{sub.displayName}</p>
                                          <p className={cn("mt-0.5 truncate text-[12px] font-normal leading-normal", onlineUserIds.has(sub.id) ? "text-[var(--ui-accent-solid,#38bdf8)]" : "text-zinc-400")}>
                                            {t(getPresenceStatusText(
                                              sub.id,
                                              onlineUserIds,
                                              lastOfflineAtByUserId,
                                              presenceNowTs,
                                              sub.id === selfId || readProfileFromCache(sub.id)?.presenceVisibility !== "none",
                                              sub.id === selfId || readProfileFromCache(sub.id)?.lastSeenVisibility !== "none",
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
                                            {(sub.roleLabel?.trim() || t("админ")).slice(0, 28)}
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
                      ) : channelSubView === "add_subscribers" ? (
                        /* Channel Add Subscribers View */
                        <motion.div
                          key="channel-details-add-subscribers"
                          custom={channelNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0"
                        >
                          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 pb-4 overflow-hidden">
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
                                    const isNotMember = channelModalData
                                      ? !(channelModalData.subscribers ?? channelModalData.members ?? []).some((sub: any) => sub.id === contact.id)
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
                      ) : channelSubView === "qrcode" ? (
                        /* Channel QR Code View */
                        <motion.div
                          key="channel-details-qrcode"
                          custom={channelNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col flex-1 h-full min-h-0 relative overflow-hidden"
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
                          key="channel-details-main"
                          custom={channelNavDirection}
                          variants={telegramSubViewVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex flex-col px-4 pt-7"
                        >
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
                                "cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
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

                          {/* Channel Media, Files, Voice, Links, Music */}
                          <div className="mt-3">
                            {renderCommunitySharedTabs(true)}
                          </div>
                        </motion.div>
                      )}
                    </PanelNavigation>
                  </div>
                ) : (
                  <div className="px-4 py-8 text-sm text-red-400">{channelModalError || t("Не удалось загрузить канал")}</div>
                )
              ) : null}
            </div>
          </div>
          </Fragment></AnimatePresence>
    </motion.aside>
  );
}

export const DesktopDetailsPanel = memo(function DesktopDetailsPanel(props: DesktopDetailsPanelProps) {
  return <div data-details-reveal className="relative hidden min-w-0 overflow-visible md:block" aria-hidden={!props.desktopDetailsPanelOpen} inert={!props.desktopDetailsPanelOpen}>
    <AnimatePresence>
      {props.desktopDetailsPanelOpen && <DesktopDetailsPanelSurface key="desktop-details" {...props} />}
    </AnimatePresence>
  </div>;
}, (previous, next) => {
  // A closed panel contains only its inert layout slot. Keep its exit animation
  // mounted, but don't revisit the whole profile tree for each composer change.
  if (!previous.desktopDetailsPanelOpen && !next.desktopDetailsPanelOpen) return true;
  return Object.keys(next).every(key => Object.is(
    previous[key as keyof DesktopDetailsPanelProps], next[key as keyof DesktopDetailsPanelProps],
  ));
});
