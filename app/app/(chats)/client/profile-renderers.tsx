"use client";
import type { GroupMember } from "../types";

/* eslint-disable @next/next/no-img-element */
import { type ConversationChatType, type GroupModalData, type ConversationResponse, type ChatSummary, type ProfileBatchItem, type ChatImageGalleryItem, type ProfilePreview } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { Check, ClockFading, Download, Music2, Pause, Play, Plus, Search, X } from "lucide-react";
import { MdDelete } from "react-icons/md";
import { MediaAvatar } from "@/components/ui/media";
import { Spinner } from "@/components/ui/spinner";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { cn } from "@/lib/utils";
import { type LiveBackgroundNeatPreset } from "@/lib/client/live-background";
import { THEME_SOLID_COLOR_MAP } from "../components/common/TelegramDoodleWallpaper";
import { ScrollableTabsBar } from "./profile-primitives";
import { formatSharedFileSize } from "./media-thumbnails";
import { ProfileMediaThumb } from "./ProfileMediaThumb";
import { formatDurationFromSeconds } from "./media-recording";

export interface RenderCommunitySharedTabsViewContext {
  activeDetailsChatType: ConversationChatType | null;
  groupModalData: GroupModalData | null;
  groupModalOpen: boolean;
  activeConversation: ConversationResponse | null;
  activeChat: ChatSummary | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setProfileActiveTab: React.Dispatch<React.SetStateAction<"voice" | "music" | "members" | "media" | "files" | "links">>;
  profileActiveTab: "voice" | "music" | "members" | "media" | "files" | "links";
  profileMediaVisible: boolean;
  memberSearchQuery: string;
  setMemberSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  canManageGroup: boolean;
  openAddMembersModal: (kind?: "group" | "channel") => Promise<void>;
  groupModalLoading: boolean;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  selfId: string | null;
  memberLongPress: (member: GroupMember, kind: "group" | "channel") => React.HTMLAttributes<HTMLDivElement>;
  openCommunityProfile: (member: { id: string; link: string; }) => void;
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

export function renderCommunitySharedTabsView({ activeDetailsChatType, groupModalData, groupModalOpen, activeConversation, activeChat, t, setProfileActiveTab, profileActiveTab, profileMediaVisible, memberSearchQuery, setMemberSearchQuery, canManageGroup, openAddMembersModal, groupModalLoading, readProfileFromCache, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, selfId, memberLongPress, openCommunityProfile, chatSharedFilesList, chatSharedVoiceList, profilePlayingAudioUrl, setProfilePlayingAudioUrl, chatSharedLinksList, openExternalLinkPrompt, chatSharedMusicList, chatSharedMediaList, setVideoViewer, setImageViewer }: RenderCommunitySharedTabsViewContext, includeVoice = true): React.JSX.Element {
  const isGroup = Boolean(
    (activeDetailsChatType === "group" && groupModalData?.group) ||
    (groupModalOpen && groupModalData?.group) ||
    (activeConversation?.chatType === "group" && groupModalData?.group) ||
    (activeChat?.chatType === "group" && groupModalData?.group)
  );

  const tabs = [
    ...(isGroup ? [{ id: "members", label: t("Участники") }] : []),
    { id: "media", label: t("Медиа") },
    { id: "files", label: t("Файлы") },
    ...(includeVoice ? [{ id: "voice", label: t("Голосовые") }] : []),
    { id: "links", label: t("Ссылки") },
    { id: "music", label: t("Музыка") },
  ];

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="py-2 w-full">
        <ScrollableTabsBar>
          {tabs.map((tab) => (
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

      {!profileMediaVisible ? null : profileActiveTab === "members" && isGroup ? (
        <div className="flex flex-col w-full pt-1 pb-16">
          {(groupModalData?.members?.length ?? 0) > 4 && (
            <div className="pb-2.5 px-0.5 shrink-0 w-full">
              <div className="relative flex items-center rounded-[16px] bg-white/[0.045] px-3.5 py-2 focus-within:bg-white/[0.075] transition-all duration-200 w-full">
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
          )}

          <div className="w-full overflow-hidden rounded-[24px] bg-white/[0.04] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-0.5">
            {canManageGroup && (
              <button
                type="button"
                onClick={() => void openAddMembersModal("group")}
                className="flex h-[52px] w-full items-center gap-3 rounded-[16px] px-4 text-left text-zinc-100 outline-none transition-opacity duration-200 hover:opacity-75 focus-visible:bg-white/[0.05] cursor-pointer"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center text-white" aria-hidden="true">
                  <Plus size={21} strokeWidth={2} />
                </span>
                <span className="text-[15px] font-medium leading-5">{t("Добавить участников")}</span>
              </button>
            )}

            {groupModalLoading && (!groupModalData?.members || groupModalData.members.length === 0) ? (
              <div className="grid min-h-[120px] place-items-center">
                <Spinner className="h-6 w-6 text-zinc-400" />
              </div>
            ) : (() => {
              const query = memberSearchQuery.trim().toLowerCase();
              const filtered = (groupModalData?.members || []).filter((member) => {
                if (!query) return true;
                const name = (member.displayName || member.link || "").toLowerCase();
                return name.includes(query);
              });

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                    <p className="text-sm text-zinc-500">{t("Участники не найдены")}</p>
                  </div>
                );
              }

              return filtered.map((member) => {
                const isOwner = member.id === groupModalData?.group.ownerId;
                const isAdmin = member.role === "admin";
                const isClickableRole = canManageGroup && !isOwner;
                const cachedProfile = readProfileFromCache(member.id);
                const isOnline = onlineUserIds.has(member.id);
                const statusText = t(getPresenceStatusText(
                  member.id,
                  onlineUserIds,
                  lastOfflineAtByUserId,
                  presenceNowTs,
                  member.id === selfId || cachedProfile?.presenceVisibility !== "none",
                  member.id === selfId || cachedProfile?.lastSeenVisibility !== "none",
                ));

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
                      "flex min-h-[56px] w-full items-center justify-between rounded-[18px] px-3.5 py-2.5 transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.99]",
                      member.link && "cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                      <MediaAvatar
                        src={member.avatarUrl ?? undefined}
                        alt={member.displayName}
                        className="h-10 w-10 rounded-full shrink-0"
                        fallbackText={member.displayName.slice(0, 1)}
                        autoPlay
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-zinc-100 leading-snug">
                          {member.displayName}
                        </p>
                        <p className={cn("mt-0.5 truncate text-[12px] font-normal leading-normal", isOnline ? "text-[var(--ui-accent-solid,#38bdf8)]" : "text-zinc-400")}>
                          {statusText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
      ) : profileActiveTab === "files" ? (
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
            <div className="space-y-1 px-2 pb-16 pt-1">
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
                    <div className={cn("relative grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[12px] font-bold uppercase shadow-sm tracking-wider overflow-hidden", badgeColor)}>
                      <span className="transition-opacity duration-200 group-hover:opacity-0">
                        {ext.slice(0, 4)}
                      </span>
                      <Download size={20} className="absolute inset-0 m-auto text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold text-white transition-colors">
                        {file.name}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-zinc-400">
                        {formatSharedFileSize(file.size)} • {file.dateText}
                      </p>
                    </div>
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
            <div className="space-y-1 px-2 pb-16 pt-1">
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
            <div className="space-y-1 px-2 pb-16 pt-1">
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
            <div className="space-y-1 px-2 pb-16 pt-1">
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
                        if (isPlaying) {
                          setProfilePlayingAudioUrl(null);
                        } else {
                          setProfilePlayingAudioUrl(track.url);
                          const audio = new Audio(track.url);
                          audio.play().catch(() => undefined);
                          audio.onended = () => setProfilePlayingAudioUrl(null);
                        }
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
    </div>
  );
}

export interface RenderContactEditorContentViewContext {
  contactEditorTarget: { link: string; displayName: string; avatarUrl?: string | null | undefined; } | null;
  profileData: ProfilePreview | null;
  mutedChatLinkSet: Set<string>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  contactDraftDisplayName: string;
  contactFirstName: string;
  setContactFirstName: React.Dispatch<React.SetStateAction<string>>;
  contactLastName: string;
  setContactLastName: React.Dispatch<React.SetStateAction<string>>;
  toggleChatMutedState: (link: string) => void;
  liveBackgroundPreset: LiveBackgroundNeatPreset;
  contactExists: boolean;
  removeContact: () => Promise<void>;
  setProfileSubView: React.Dispatch<React.SetStateAction<"qrcode" | "contact_editor" | "secret_chat" | null>>;
  contactSaving: boolean;
  contactMessage: string | null;
}

export function renderContactEditorContentView({ contactEditorTarget, profileData, mutedChatLinkSet, t, contactDraftDisplayName, contactFirstName, setContactFirstName, contactLastName, setContactLastName, toggleChatMutedState, liveBackgroundPreset, contactExists, removeContact, setProfileSubView, contactSaving, contactMessage }: RenderContactEditorContentViewContext): React.JSX.Element | null {
  const target = contactEditorTarget || (profileData ? { link: profileData.link, displayName: profileData.displayName, avatarUrl: profileData.avatarUrl ?? null } : null);
  if (!target) return null;

  const isMuted = target.link ? mutedChatLinkSet.has(target.link) : false;

  return (
    <div className="relative flex flex-col h-full min-h-0 flex-1 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar pb-28 pt-3">
        {/* Centered Avatar Section */}
        <div className="flex flex-col items-center px-5 pb-5 pt-2 text-center">
          <MediaAvatar
            src={target.avatarUrl ?? profileData?.avatarUrl ?? undefined}
            alt={target.displayName}
            className="bg-zinc-800 text-white shadow-[0_16px_38px_rgba(0,0,0,0.3)] h-[104px] w-[104px] text-[36px]"
            fallbackText={(target.displayName || t("К")).slice(0, 1)}
            autoPlay
          />
          <h3 className="mt-3.5 max-w-full truncate text-[20px] font-bold leading-tight text-white">
            {contactDraftDisplayName || target.displayName}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-zinc-500 font-normal">{t("оригинальное имя")}</p>
        </div>

        {/* Combined Panel Card matching Image 3 */}
        <div className="mx-5 overflow-hidden rounded-[24px] bg-white/[0.04] p-4 space-y-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
          {/* First Name Input */}
          <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5 flex items-center">
            <input
              type="text"
              value={contactFirstName}
              onChange={(e) => setContactFirstName(e.target.value)}
              placeholder={t("Имя")}
              aria-label={t("Имя")}
              className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500"
              maxLength={40}
            />
          </div>

          {/* Last Name Input */}
          <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5 flex items-center">
            <input
              type="text"
              value={contactLastName}
              onChange={(e) => setContactLastName(e.target.value)}
              placeholder={t("Фамилия (необязательно)")}
              aria-label={t("Фамилия")}
              className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500"
              maxLength={60}
            />
          </div>

          {/* Notifications Row */}
          <button
            type="button"
            onClick={() => target.link && toggleChatMutedState(target.link)}
            className="flex items-center gap-3.5 px-2 py-1.5 text-left rounded-[16px] hover:bg-white/[0.04] transition-colors w-full cursor-pointer select-none"
          >
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-[6px] transition-colors",
                !isMuted
                  ? liveBackgroundPreset === "none"
                    ? "bg-white text-zinc-950"
                    : "bg-[var(--ui-accent-solid,#38bdf8)] text-white"
                  : "border border-zinc-600 bg-transparent text-transparent"
              )}
              style={
                !isMuted && liveBackgroundPreset !== "none" && THEME_SOLID_COLOR_MAP[liveBackgroundPreset]
                  ? { backgroundColor: THEME_SOLID_COLOR_MAP[liveBackgroundPreset] }
                  : undefined
              }
            >
              <Check size={16} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-white leading-tight">
                {t("Уведомления")}</span>
              <span className="block text-[13px] text-zinc-400 mt-0.5 leading-none">
                {!isMuted ? t("Включены") : t("Отключены")}
              </span>
            </div>
          </button>
        </div>

        {contactExists ? (
          <div className="mx-6 pt-4 flex items-center justify-center">
            <button
              type="button"
              onClick={async () => {
                await removeContact();
                setProfileSubView(null);
              }}
              disabled={contactSaving}
              className="flex items-center justify-center gap-2 text-[14px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/[0.08] active:scale-[0.98] px-4 py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              <MdDelete size={18} className="shrink-0" />
              <span>{t("Удалить контакт")}</span>
            </button>
          </div>
        ) : null}

        {contactMessage ? (
          <p className={cn("text-center text-[12.5px] font-medium pt-3", contactMessage.includes("Не удалось") || contactMessage.includes("Укажите") ? "text-red-400" : "text-zinc-400")}>
            {contactMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export interface RenderSecretChatTimerControlsViewContext {
  secretChatLifetimeDays: number;
  secretChatLifetimeHours: number;
  secretChatLifetimeMinutes: number;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setSecretChatLifetimeDays: React.Dispatch<React.SetStateAction<number>>;
  setSecretChatLifetimeHours: React.Dispatch<React.SetStateAction<number>>;
  setSecretChatLifetimeMinutes: React.Dispatch<React.SetStateAction<number>>;
  secretChatCodeword: string;
  setSecretChatCodeword: React.Dispatch<React.SetStateAction<string>>;
}

export function renderSecretChatTimerControlsView({ secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, t, setSecretChatLifetimeDays, setSecretChatLifetimeHours, setSecretChatLifetimeMinutes, secretChatCodeword, setSecretChatCodeword }: RenderSecretChatTimerControlsViewContext, isCompact = false): React.JSX.Element {
  const totalLifetimeSeconds =
    (secretChatLifetimeDays * 86400) +
    (secretChatLifetimeHours * 3600) +
    (secretChatLifetimeMinutes * 60);

  const formatTotalTime = () => {
    if (totalLifetimeSeconds <= 0) return t("Укажите время");
    const parts: string[] = [];
    if (secretChatLifetimeDays > 0) parts.push(t("{0} д.", { 0: secretChatLifetimeDays }));
    if (secretChatLifetimeHours > 0) parts.push(t("{0} ч.", { 0: secretChatLifetimeHours }));
    if (secretChatLifetimeMinutes > 0) parts.push(t("{0} мин.", { 0: secretChatLifetimeMinutes }));
    return parts.join(" ");
  };

  return (
    <div className="space-y-3">
      {/* Main Timer Config Card */}
      <div className="rounded-[22px] bg-white/[0.04] p-3.5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockFading size={17} className="text-[var(--ui-accent-solid,#38bdf8)]" />
            <span className="text-[14px] font-semibold text-zinc-100">{t("Таймер самоуничтожения")}</span>
          </div>
          <span className="text-[12px] font-semibold text-[var(--ui-accent-solid,#38bdf8)] bg-white/[0.06] px-2.5 py-0.5 rounded-full">
            {formatTotalTime()}
          </span>
        </div>

        {/* Quick presets */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {[
            { label: t("10 мин"), d: 0, h: 0, m: 10 },
            { label: t("1 час"), d: 0, h: 1, m: 0 },
            { label: t("12 часов"), d: 0, h: 12, m: 0 },
            { label: t("1 день"), d: 1, h: 0, m: 0 },
            { label: t("1 неделя"), d: 7, h: 0, m: 0 },
            { label: t("1 месяц"), d: 30, h: 0, m: 0 },
          ].map((p) => {
            const isMatch =
              secretChatLifetimeDays === p.d &&
              secretChatLifetimeHours === p.h &&
              secretChatLifetimeMinutes === p.m;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSecretChatLifetimeDays(p.d);
                  setSecretChatLifetimeHours(p.h);
                  setSecretChatLifetimeMinutes(p.m);
                }}
                className={cn(
                  "min-h-9 px-2 py-2 rounded-xl text-[12px] font-medium transition-colors active:scale-[0.97] cursor-pointer",
                  isMatch
                    ? "bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast,#ffffff)] shadow-sm"
                    : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09] hover:text-white"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Steppers / Direct Inputs */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {/* Days */}
          <div className="rounded-[16px] bg-white/[0.04] px-1 py-3 flex flex-col items-center gap-1.5 text-center">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{t("Дни")}</span>
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setSecretChatLifetimeDays((d) => Math.max(0, d - 1))}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-base leading-none select-none active:scale-95"
              >
                -
              </button>
              <span className="text-[15px] font-bold text-white min-w-[24px] text-center">
                {secretChatLifetimeDays}
              </span>
              <button
                type="button"
                onClick={() => setSecretChatLifetimeDays((d) => Math.min(30, d + 1))}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-base leading-none select-none active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Hours */}
          <div className="rounded-[16px] bg-white/[0.04] px-1 py-3 flex flex-col items-center gap-1.5 text-center">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{t("Часы")}</span>
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setSecretChatLifetimeHours((h) => Math.max(0, h - 1))}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-base leading-none select-none active:scale-95"
              >
                -
              </button>
              <span className="text-[15px] font-bold text-white min-w-[24px] text-center">
                {secretChatLifetimeHours}
              </span>
              <button
                type="button"
                onClick={() => setSecretChatLifetimeHours((h) => Math.min(23, h + 1))}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-base leading-none select-none active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Minutes */}
          <div className="rounded-[16px] bg-white/[0.04] px-1 py-3 flex flex-col items-center gap-1.5 text-center">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{t("Минуты")}</span>
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setSecretChatLifetimeMinutes((m) => Math.max(0, m - 5))}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-base leading-none select-none active:scale-95"
              >
                -
              </button>
              <span className="text-[15px] font-bold text-white min-w-[24px] text-center">
                {secretChatLifetimeMinutes}
              </span>
              <button
                type="button"
                onClick={() => setSecretChatLifetimeMinutes((m) => Math.min(59, m + 5))}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-base leading-none select-none active:scale-95"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Codeword Card */}
      <div className="rounded-[24px] bg-white/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[14px] font-medium text-zinc-300">{t("Кодовое слово")}</span>
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.035] focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5 flex items-center">
          <input
            type="text"
            aria-label={t("Кодовое слово")}
            value={secretChatCodeword}
            onChange={(e) => setSecretChatCodeword(e.target.value)}
            placeholder={t("Необязательно")}
            className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500"
          />
          {secretChatCodeword ? (
            <button
              type="button"
              onClick={() => setSecretChatCodeword("")}
              className="ml-2 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white transition-colors cursor-pointer active:scale-90"
              aria-label={t("Очистить кодовое слово")}
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
        <p className="px-1 text-[12px] text-zinc-400/85 leading-relaxed pt-0.5">
          {t("При отправке кодового слова в секретный чат, чат удаляется у обоих пользователей.")}</p>
      </div>
    </div>
  );
}
