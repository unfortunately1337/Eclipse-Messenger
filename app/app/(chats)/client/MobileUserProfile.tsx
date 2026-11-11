"use client";
import { panelPropsEquality } from "@/lib/client/panel-props-equality";

/* eslint-disable @next/next/no-img-element */
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type ProfilePreview, type StoryFeedGroup, type SelfProfile, type ChatImageGalleryItem } from "../types";
import { VerifiedTitle } from "../components/common/VerifiedTitle";
import { PanelNavigation } from "../components/common/PanelNavigation";
import { CSSProperties, Fragment, UIEvent, memo } from "react";
import { ArrowLeft, AtSign, Bell, Check, Download, Image as ImageIcon, Info, Lock, MoreVertical, Music2, Pause, Play, X } from "lucide-react";
import { PiQrCodeBold as QrCode } from "react-icons/pi";
import { MdEdit } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import { MediaAvatar, MediaBanner, isRealMediaAvatar } from "@/components/ui/media";
import { Spinner } from "@/components/ui/spinner";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { showAppToast } from "@/lib/client/app-toast";
import { EclipseBotAvatar, EclipseVerifiedTitle } from "../EclipseChatUi";
import { cn } from "@/lib/utils";
import { SavedMessagesAvatar } from "../components/common/Avatars";
import ChatQrPanel, { preloadChatQrPanel } from "@/components/ChatQrPanel";
import { getEffectiveProfileGradient, getEffectiveProfileAccentColor, isMediaBackgroundUrl } from "@/lib/profile-gradients";
import { splitContactAliasParts } from "../helpers";
import { ProfileMusicCaption } from "../components/common/ProfileMusicCaption";
import { StoryAvatarRing } from "../components/story/StoryAvatarRing";
import { telegramSubViewVariants } from "./config";
import { ScrollableTabsBar } from "./profile-primitives";
import { formatSharedFileSize } from "./media-thumbnails";
import { ProfileMediaThumb } from "./ProfileMediaThumb";
import { formatDurationFromSeconds } from "./media-recording";

export interface MobileUserProfileProps {
  isDesktop: boolean;
  profileModalOpen: boolean;
  setProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  detailsPanelMotion: { initial: { opacity: number; y: string | number; x?: undefined; } | { opacity: number; x: string | number; y?: undefined; }; onAnimationStart: (() => void) | undefined; animate: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; exit: { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; y: string | number; x?: undefined; } | { opacity: number; transition: { duration: number; ease: readonly [0.2, 0.72, 0.25, 1]; }; x: string | number; y?: undefined; }; };
  desktopDetailsPanelThemeStyle: React.CSSProperties | undefined;
  profileLoading: boolean;
  renderProfileDetailsSkeleton: () => React.JSX.Element;
  profileError: string | null;
  profileData: ProfilePreview | null;
  profileNavDirection: "forward" | "backward";
  profileSubView: "qrcode" | "contact_editor" | "secret_chat" | null;
  contactExists: boolean;
  contactDraftDisplayName: string;
  setProfileSubView: React.Dispatch<React.SetStateAction<"qrcode" | "contact_editor" | "secret_chat" | null>>;
  saveContact: () => Promise<void>;
  contactSaving: boolean;
  renderContactEditorContent: () => React.JSX.Element | null;
  renderSecretChatPanelContent: () => React.JSX.Element;
  profileScrollTop: number;
  profileHeaderStatusText: string;
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
  contactMessage: string | null;
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
}

export const MobileUserProfile = memo(function MobileUserProfile({ isDesktop, profileModalOpen, setProfileModalOpen, t, detailsPanelMotion, desktopDetailsPanelThemeStyle, profileLoading, renderProfileDetailsSkeleton, profileError, profileData, profileNavDirection, profileSubView, contactExists, contactDraftDisplayName, setProfileSubView, saveContact, contactSaving, renderContactEditorContent, renderSecretChatPanelContent, profileScrollTop, profileHeaderStatusText, profileIsBot, profileIsSaved, selfId, setContactEditorTarget, setContactFirstName, setContactLastName, setProfileMoreOpen, profileMoreOpen, wallpaperTargetRef, wallpaperFileInputRef, uploadingWallpaper, openSecretChatFromProfile, handleProfileScroll, storyGroupByAuthorId, openStoryViewerByAuthorId, openAvatarViewer, profileIsEclipse, selfProfile, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, renderUserProfileActions, setCollectibleModalUsername, toggleChatMutedState, mutedChatLinkSet, contactMessage, setProfileActiveTab, profileActiveTab, profileMediaVisible, chatSharedFilesList, chatSharedVoiceList, profilePlayingAudioUrl, setProfilePlayingAudioUrl, chatSharedLinksList, openExternalLinkPrompt, chatSharedMusicList, chatSharedMediaList, setVideoViewer, setImageViewer }: MobileUserProfileProps) {
  return (
    <AnimatePresence>
      {!isDesktop && profileModalOpen ? (
        <motion.div
          className="fixed inset-0 z-[90] flex justify-end md:hidden"
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setProfileModalOpen(false)}
            aria-label={t("Закрыть")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />

          <motion.div
            {...detailsPanelMotion}
            className="relative flex h-full w-full flex-col overflow-hidden bg-[#171719] text-zinc-100 shadow-[-18px_0_42px_rgba(0,0,0,0.36)]"
            data-app-panel style={desktopDetailsPanelThemeStyle}
          >
            <AnimatePresence initial={false}><Fragment key="profile-content">
            {profileLoading ? (
              renderProfileDetailsSkeleton()
            ) : profileError ? (
              <div className="p-6 text-sm text-red-500">{t(profileError ?? "")}</div>
            ) : profileData ? (
              <PanelNavigation direction={profileNavDirection} className="min-h-0 flex-1 h-full grid-rows-[minmax(0,1fr)]">
                {profileSubView === "qrcode" ? (
                  <motion.div
                    key="profile-modal-qrcode"
                    custom={profileNavDirection}
                    variants={telegramSubViewVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full relative overflow-hidden"
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
                    key="profile-modal-contact-editor"
                    custom={profileNavDirection}
                    variants={telegramSubViewVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full relative bg-transparent"
                  >
                    <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 z-20 bg-transparent text-white">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => setProfileSubView(null)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                          aria-label={t("Назад")}
                        >
                          <ArrowLeft size={22} />
                        </button>
                        <h2 className="truncate text-[20px] font-semibold leading-tight text-zinc-100">
                          {contactExists ? t("Контакт") : t("Новый контакт")}
                        </h2>
                      </div>
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
                    </div>
                    {renderContactEditorContent()}
                  </motion.div>
                ) : profileSubView === "secret_chat" ? (
                  <motion.div
                    key="profile-modal-secret-chat"
                    custom={profileNavDirection}
                    variants={telegramSubViewVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full relative bg-transparent"
                  >
                    <div className="flex h-14 shrink-0 items-center gap-3 px-4 z-20 bg-transparent text-white">
                      <button
                        type="button"
                        onClick={() => setProfileSubView(null)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white cursor-pointer"
                        aria-label={t("Назад")}
                      >
                        <ArrowLeft size={22} />
                      </button>
                      <h2 className="truncate text-[20px] font-semibold leading-tight text-zinc-100">
                        {t("Секретный чат")}</h2>
                    </div>
                    {renderSecretChatPanelContent()}
                  </motion.div>
                ) : (
                  <motion.div
                    key="profile-modal-main"
                    custom={profileNavDirection}
                    variants={telegramSubViewVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="relative z-[1] flex h-full min-h-0 flex-col"
                  >
                    {/* Floating Header on top of gradient */}
                    <div
                      style={profileScrollTop > 140 ? (isDesktop ? desktopDetailsPanelThemeStyle : undefined) : undefined}
                      className={cn(
                        "absolute top-0 left-0 right-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 transition-[background-color] duration-150 ease-out border-0",
                        profileScrollTop > 140 ? "bg-[#1c1c1e] text-white border-0 shadow-none" : "bg-transparent text-white"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setProfileModalOpen(false)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                        aria-label={t("Закрыть")}
                      >
                        <X size={22} />
                      </button>
                      <div className={cn("flex flex-col min-w-0 flex-1", profileScrollTop > 140 && "pointer-events-none absolute left-16 right-16 items-center text-center")}>
                        <h2 className="min-w-0 max-w-full truncate text-[17px] font-bold leading-tight text-white drop-shadow-sm transition-opacity duration-150">
                          {profileScrollTop > 140
                            ? (contactExists && contactDraftDisplayName ? contactDraftDisplayName : profileData.displayName)
                            : t("Информация")}
                        </h2>
                        {profileScrollTop > 140 ? (
                          <span className="text-[12px] text-zinc-300/85 truncate leading-tight mt-0.5 transition-opacity duration-150">
                            {profileHeaderStatusText}
                          </span>
                        ) : null}
                      </div>
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
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                          aria-label={contactExists ? t("Редактировать контакт") : t("Добавить контакт")}
                        >
                          <MdEdit size={21} />
                        </button>
                      )}
                      {(profileIsBot || profileIsSaved || profileData.id === selfId) && (<div className="relative">
                        <button
                          type="button"
                          onClick={() => setProfileMoreOpen((value) => !value)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                          aria-label={t("Опции")}
                        >
                          <MoreVertical size={22} />
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
                    </div>

                    <div key={profileData.id || profileData.link} onScroll={handleProfileScroll} className="min-h-0 flex-1 overflow-y-auto no-scrollbar pb-6">
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
                                  autoPlay
                                  alt={t("Фон профиля")}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/25 pointer-events-none" />
                              </>
                            ) : null}
                            <div className={cn("relative z-10 flex flex-col items-center px-5", effectiveGradient || isMediaBg || profileData.musicUrl?.trim() ? "pb-3" : "pb-2")}>
                              <div className="relative">
                                <div className="relative w-[112px] h-[112px] flex items-center justify-center">
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
                                        key="other-mobile-story-avatar"
                                        type="button"
                                        onClick={(event) => openStoryViewerByAuthorId(profileData.id, event.currentTarget)}
                                        aria-label={t("Открыть историю {0}", { 0: profileData.displayName })}
                                        className="relative w-[112px] h-[112px] flex items-center justify-center shrink-0 focus:outline-none cursor-pointer"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.22, ease: "easeOut" }}
                                      >
                                        <StoryAvatarRing
                                          seen={!storyGroupByAuthorId.get(profileData.id)?.group.hasUnviewed}
                                          stories={storyGroupByAuthorId.get(profileData.id)?.group.stories}
                                          className="w-full h-full p-[6px]"
                                        >
                                          <MediaAvatar
                                            src={profileData.avatarUrl ?? undefined}
                                            alt={profileData.displayName}
                                            className="h-full w-full bg-zinc-800 text-[36px] text-white shadow-[0_16px_38px_rgba(0,0,0,0.3)] border-0"
                                            fallbackText={profileData.displayName.slice(0, 1)}
                                            autoPlay
                                          />
                                        </StoryAvatarRing>
                                      </motion.button>
                                    ) : (
                                      <motion.div
                                        key="other-mobile-plain-avatar"
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
                                          "relative w-[104px] h-[104px] flex items-center justify-center",
                                          isRealMediaAvatar(profileData.avatarUrl) && "cursor-pointer transition-transform active:scale-[0.97]"
                                        )}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.22, ease: "easeOut" }}
                                      >
                                        {profileIsEclipse ? <EclipseBotAvatar className="h-[104px] w-[104px]" /> : profileIsSaved ? <SavedMessagesAvatar className="h-[104px] w-[104px]" seedLink={selfProfile?.link} /> : (<MediaAvatar
                                          src={profileData.avatarUrl ?? undefined}
                                          alt={profileData.displayName}
                                          className="h-[104px] w-[104px] bg-zinc-800 text-[36px] text-white shadow-[0_16px_38px_rgba(0,0,0,0.3)] border-0 ring-0 outline-none"
                                          fallbackText={profileData.displayName.slice(0, 1)}
                                          autoPlay
                                        />)}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>

                              <h3 className="mt-3.5 max-w-full truncate text-[20px] font-semibold leading-tight text-white tracking-tight">
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

                      {contactMessage && (contactMessage.includes("Не удалось") || contactMessage.includes("Укажите")) ? (
                        <p className="px-6 pt-4 text-[13px] text-red-400">{contactMessage}</p>
                      ) : null}

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
                                        {formatDurationFromSeconds(Math.round((track.durationMs ?? 0) / 1000))} • {track.author} • {track.dateText}
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

                    </div>
                  </motion.div>
                )}
              </PanelNavigation>
            ) : null}
            </Fragment></AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}, panelPropsEquality<MobileUserProfileProps>(props => props.isDesktop || !props.profileModalOpen, props => String(props.selfId) + ':' + props.isDesktop));
