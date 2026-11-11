"use client";

import { type ConversationChatType, type ChatSummary, type ProfilePreview, type ConversationResponse, type DecryptedMessage, type PendingAlbumItem, type PendingImagePayload, type PendingVideoPayload, type PendingAudioPayload, type PendingFilePayload } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { readAudioFileMetadata } from "@/lib/client/audio-file-metadata";
import { makeMediaPreviewDetails } from "@/lib/client/media-preview";
import { compressImageFile, verifyFileMagicBytes } from "@/lib/client/media-compression";
import { ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT } from "../chat-message-transport";
import { decryptedPayloadFailureCache } from "./chat-cache";
import { HEIC_IMAGE_TYPES, SUPPORTED_IMAGE_TYPES, isAudioFile, AUDIO_MAX_BYTES, AUDIO_MAX_DURATION_MS, FILE_MAX_BYTES } from "./media-files";
import { convertHeicToJpeg, canPlayVideoFile, getVideoDurationMs, getAudioDurationMs } from "./media-recording";
import { IMAGE_MAX_BYTES, CHAT_VIDEO_MAX_BYTES } from "./config";

export interface ResetConversationViewportContext {
  selectedLink: string | null;
  bottomScrollAnimationRef: React.RefObject<{ viewport: HTMLElement; cancel(): void; } | null>;
  isScrollingToBottomRef: React.RefObject<boolean>;
  programmaticScrollRef: React.RefObject<boolean>;
  lastHandledSelectedLinkRef: React.RefObject<string | null>;
  chatScrollRef: React.RefObject<{ key: string; link: string; initial: boolean; lastMessageId?: string | undefined; requestedBefore?: string | undefined; } | null>;
  setHasMoreMessagesBefore: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingOlderMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setShowScrollToBottomButton: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSearchTargetRef: React.RefObject<{ link: string; chatType: ConversationChatType; isBot?: boolean | undefined; } | null>;
  selectedChat: ChatSummary | null;
  requestedChatType: "direct" | "group" | "channel" | "saved" | "eclipse" | null;
  selfId: string | null;
  currentUserIdRef: React.RefObject<string | null>;
  chatReadingPositionsRef: React.RefObject<Map<string, { messageId: string; offset: number; top: number; createdAt: string; }>>;
  setProfileData: React.Dispatch<React.SetStateAction<ProfilePreview | null>>;
  setContactEditorTarget: React.Dispatch<React.SetStateAction<{ link: string; displayName: string; avatarUrl?: string | null | undefined; } | null>>;
  setDesktopDetailsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userScrolledUpRef: React.RefObject<boolean>;
  userSentMessageRef: React.RefObject<boolean>;
  lastObservedMessagesScrollTopRef: React.RefObject<number>;
  lastCommittedMessagesScrollTopRef: React.RefObject<number>;
  setMessagesScrollTop: React.Dispatch<React.SetStateAction<number>>;
  messagesAtBottomRef: React.RefObject<boolean>;
  preservingHistoryScrollRef: React.RefObject<boolean>;
  prependScrollSnapshotRef: React.RefObject<{ previousHeight: number; previousTop: number; } | null>;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  setStickerPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAttachmentMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setDecryptingConversation: React.Dispatch<React.SetStateAction<boolean>>;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
}

export function resetConversationViewport({ selectedLink, bottomScrollAnimationRef, isScrollingToBottomRef, programmaticScrollRef, lastHandledSelectedLinkRef, chatScrollRef, setHasMoreMessagesBefore, setLoadingOlderMessages, setShowScrollToBottomButton, selectedSearchTargetRef, selectedChat, requestedChatType, selfId, currentUserIdRef, chatReadingPositionsRef, setProfileData, setContactEditorTarget, setDesktopDetailsPanelOpen, userScrolledUpRef, userSentMessageRef, lastObservedMessagesScrollTopRef, lastCommittedMessagesScrollTopRef, setMessagesScrollTop, messagesAtBottomRef, preservingHistoryScrollRef, prependScrollSnapshotRef, setMessageHelperId, setStickerPickerOpen, setAttachmentMenuOpen, setActiveConversation, setMessages, setDecryptingConversation, openConversationRef }: ResetConversationViewportContext): void {
  if (!selectedLink) {
    bottomScrollAnimationRef.current?.cancel();
    bottomScrollAnimationRef.current = null;
    isScrollingToBottomRef.current = false;
    programmaticScrollRef.current = false;
    lastHandledSelectedLinkRef.current = null;
    chatScrollRef.current = null;
    setHasMoreMessagesBefore(false);
    setLoadingOlderMessages(false);
    setShowScrollToBottomButton(false);
    return;
  }

  const chatType = (selectedSearchTargetRef.current?.link === selectedLink ? selectedSearchTargetRef.current.chatType : undefined) ?? selectedChat?.chatType ?? requestedChatType ?? undefined;
  const accountId = selfId ?? currentUserIdRef.current ?? "";
  const key = `${accountId}:${chatType ?? "direct"}:${selectedLink}`;
  if (lastHandledSelectedLinkRef.current === selectedLink) {
    const scroll = chatScrollRef.current;
    if (accountId && scroll?.key.startsWith(":")) {
      const position = chatReadingPositionsRef.current.get(scroll.key);
      chatReadingPositionsRef.current.delete(scroll.key);
      scroll.key = key;
      if (position) chatReadingPositionsRef.current.set(key, position);
    }
    return;
  }
  bottomScrollAnimationRef.current?.cancel();
  bottomScrollAnimationRef.current = null;
  isScrollingToBottomRef.current = false;
  programmaticScrollRef.current = false;
  lastHandledSelectedLinkRef.current = selectedLink;

  setProfileData(null);
  setContactEditorTarget(null);
  setDesktopDetailsPanelOpen(false);

  chatScrollRef.current = { key, link: selectedLink, initial: true };
  const position = chatReadingPositionsRef.current.get(key);
  userScrolledUpRef.current = Boolean(position);
  userSentMessageRef.current = false;
  lastObservedMessagesScrollTopRef.current = 0;
  lastCommittedMessagesScrollTopRef.current = 0;
  setMessagesScrollTop(position?.top ?? Number.MAX_SAFE_INTEGER);
  messagesAtBottomRef.current = !position;
  preservingHistoryScrollRef.current = false;
  prependScrollSnapshotRef.current = null;
  setShowScrollToBottomButton(false);
  setMessageHelperId(null);
  setStickerPickerOpen(false);
  setAttachmentMenuOpen(false);
  setActiveConversation(null);
  setMessages([]);
  setDecryptingConversation(false);
  void openConversationRef.current(selectedLink, { chatType, revalidate: true });
}

export interface RetryConversationDecryptionContext {
  selectedLink: string | null;
  e2eIdentityReady: boolean;
  loadingConversation: boolean;
  decryptingConversation: boolean;
  messages: DecryptedMessage[];
  activeConversation: ConversationResponse | null;
  conversationDecryptRetryRef: React.RefObject<Record<string, { fingerprint: string; attempts: number; lastAttemptAt: number; }>>;
  selectedLinkRef: React.RefObject<string | null>;
  sharedKeyServerCacheRef: React.RefObject<Map<string, { expiresAt: number; value: { version: number; keyBase64: string; createdAt: number; } | null; }>>;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
}

export function retryConversationDecryption({ selectedLink, e2eIdentityReady, loadingConversation, decryptingConversation, messages, activeConversation, conversationDecryptRetryRef, selectedLinkRef, sharedKeyServerCacheRef, openConversationRef }: RetryConversationDecryptionContext): (() => void) | undefined {
  if (!selectedLink) return;
  if (!e2eIdentityReady) return;
  if (loadingConversation || decryptingConversation) return;
  if (messages.length === 0) return;

  const chatType = activeConversation?.chatType;
  if (chatType !== "direct" && chatType !== "group" && chatType !== "channel") return;

  const shared = chatType === "group" || chatType === "channel";
  const placeholderCount = messages.reduce((acc, message) => (message.text === "Сообщение" || (shared && message.text === ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT) ? acc + 1 : acc), 0);
  if (placeholderCount === 0) return;

  const last = messages[messages.length - 1];
  const fingerprint = `${chatType}:${placeholderCount}:${messages.length}:${last?.id ?? ""}:${last?.createdAt ?? ""}`;
  const current = conversationDecryptRetryRef.current[selectedLink];
  const now = Date.now();
  if (current?.fingerprint === fingerprint) {
    if (current.attempts >= (shared ? 12 : 2)) return;
  }

  conversationDecryptRetryRef.current[selectedLink] = {
    fingerprint,
    attempts: current?.fingerprint === fingerprint ? current.attempts + 1 : 1,
    lastAttemptAt: now,
  };

  const timer = window.setTimeout(() => {
    if (selectedLinkRef.current !== selectedLink) return;
    if (shared) {
      decryptedPayloadFailureCache.clear();
      for (const [key, entry] of sharedKeyServerCacheRef.current) if (!entry.value) sharedKeyServerCacheRef.current.delete(key);
    }
    void openConversationRef.current(selectedLink, { force: true, chatType });
  }, shared ? 2500 : 1500);
  return () => window.clearTimeout(timer);
}

export interface PositionMessageContextMenuContext {
  messageHelperId: string | null;
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  isCoarsePointer: boolean;
  setMessageHelperHorizontalPlacement: React.Dispatch<React.SetStateAction<"outside-left" | "outside-right">>;
}

export function positionMessageContextMenu({ messageHelperId, messagesViewportRef, isCoarsePointer, setMessageHelperHorizontalPlacement }: PositionMessageContextMenuContext): void {
  if (!messageHelperId) return;
  const viewport = messagesViewportRef.current;
  if (!viewport) return;

  if (isCoarsePointer) return;

  const anchor = viewport.querySelector<HTMLElement>(
    `[data-message-id="${messageHelperId}"] [data-message-helper-anchor="true"]`,
  );
  if (!anchor) return;

  const viewportRect = viewport.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const isMine = anchor.dataset.messageMine === "true";
  const helperWidth = 250;
  const spaceLeft = anchorRect.left - viewportRect.left;
  const spaceRight = viewportRect.right - anchorRect.right;

  const preferredOutside = isMine ? "outside-left" : "outside-right";
  const oppositeOutside = isMine ? "outside-right" : "outside-left";
  const preferredSpace = isMine ? spaceLeft : spaceRight;
  const oppositeSpace = isMine ? spaceRight : spaceLeft;
  if (preferredSpace >= helperWidth || preferredSpace >= oppositeSpace) {
    setMessageHelperHorizontalPlacement(preferredOutside);
    return;
  }
  setMessageHelperHorizontalPlacement(oppositeOutside);
}

export interface ProcessPickedFilesActionContext {
  pendingMediaBatch: PendingAlbumItem[] | null;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  pendingImage: PendingImagePayload | null;
  pendingVideo: PendingVideoPayload | null;
  setPendingMediaBatch: React.Dispatch<React.SetStateAction<PendingAlbumItem[] | null>>;
  setPendingImage: React.Dispatch<React.SetStateAction<PendingImagePayload | null>>;
  setPendingVideo: React.Dispatch<React.SetStateAction<PendingVideoPayload | null>>;
  setPendingAudio: React.Dispatch<React.SetStateAction<PendingAudioPayload | null>>;
  setPendingFile: React.Dispatch<React.SetStateAction<PendingFilePayload | null>>;
}

export async function processPickedFilesAction({ pendingMediaBatch, setErrorText, t, pendingImage, pendingVideo, setPendingMediaBatch, setPendingImage, setPendingVideo, setPendingAudio, setPendingFile }: ProcessPickedFilesActionContext, files: File[]): Promise<void> {
  if (files.length === 0) return;
  const file = files[0];
  const hasExistingBatch = Boolean(pendingMediaBatch?.length);

  const appendSingleToExistingBatch =
    hasExistingBatch &&
    files.length === 1 &&
    (file.type.startsWith("image/") || file.type.startsWith("video/"));

  if (files.length > 1 || appendSingleToExistingBatch) {
    const existingBatch = appendSingleToExistingBatch ? (pendingMediaBatch ?? []) : [];
    if (existingBatch.length + files.length > 6) {
      setErrorText(t("Можно выбрать не более 6 фото/видео."));
      return;
    }
    if (!files.every((item) => item.type.startsWith("image/") || item.type.startsWith("video/"))) {
      setErrorText(t("Групповая отправка доступна только для фото и видео."));
      return;
    }

    const preparedItems: PendingAlbumItem[] = [];
    try {
      for (const original of files) {
        const magicCheck = await verifyFileMagicBytes(original);
        if (!magicCheck.isValid) {
          throw new Error(t("Недопустимый или поврежденный файл."));
        }

        if (original.type.startsWith("image/")) {
          let prepared = original;
          if (HEIC_IMAGE_TYPES.has(original.type)) {
            prepared = await convertHeicToJpeg(original);
          }
          if (!SUPPORTED_IMAGE_TYPES.has(prepared.type)) {
            throw new Error(t("Формат изображения не поддерживается."));
          }
          if (prepared.size > IMAGE_MAX_BYTES) {
            throw new Error(t("Одно из фото слишком большое."));
          }

          const compressed = await compressImageFile(prepared, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 });

          preparedItems.push({
            previewUrl: compressed.previewUrl,
            file: compressed.file,
            kind: "image",
          });
          continue;
        }

        if (!canPlayVideoFile(original)) {
          throw new Error(t("Один из видеофайлов не поддерживается."));
        }
        if (original.size > CHAT_VIDEO_MAX_BYTES) {
          throw new Error(t("Одно из видео слишком большое. Максимум 100 МБ."));
        }
        const previewUrl = URL.createObjectURL(original);
        const durationMs = await getVideoDurationMs(original);
        preparedItems.push({
          previewUrl,
          file: original,
          kind: "video",
          durationMs,
        });
      }
    } catch (error) {
      preparedItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
      return;
    }

    if (pendingImage?.previewUrl) {
      URL.revokeObjectURL(pendingImage.previewUrl);
    }
    if (pendingVideo?.previewUrl) {
      URL.revokeObjectURL(pendingVideo.previewUrl);
    }

    setPendingMediaBatch([...existingBatch, ...preparedItems]);
    setPendingImage(null);
    setPendingVideo(null);
    setPendingAudio(null);
    setPendingFile(null);
    setErrorText(null);
    return;
  }

  if (file.type.startsWith("image/")) {
    try {
      const magicCheck = await verifyFileMagicBytes(file);
      if (!magicCheck.isValid) {
        setErrorText(t("Недопустимый или поврежденный файл."));
        return;
      }

      let preparedFile = file;
      if (HEIC_IMAGE_TYPES.has(file.type)) {
        preparedFile = await convertHeicToJpeg(file);
      }
      if (!SUPPORTED_IMAGE_TYPES.has(preparedFile.type)) {
        setErrorText(t("Формат изображения не поддерживается."));
        return;
      }
      if (preparedFile.size > IMAGE_MAX_BYTES) {
        setErrorText(t("Фото слишком большое. Выберите изображение меньше."));
        return;
      }

      const compressed = await compressImageFile(preparedFile, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 });

      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      if (pendingVideo?.previewUrl) {
        URL.revokeObjectURL(pendingVideo.previewUrl);
      }
      if (pendingMediaBatch?.length) {
        pendingMediaBatch.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
      }
      setPendingMediaBatch(null);
      void makeMediaPreviewDetails(compressed.file, "image");
      setPendingImage({ previewUrl: compressed.previewUrl, file: compressed.file });
      setPendingVideo(null);
      setPendingAudio(null);
      setPendingFile(null);
      setPendingMediaBatch(null);
      setErrorText(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
    }
    return;
  }

  if (file.type.startsWith("video/")) {
    if (!canPlayVideoFile(file)) {
      setErrorText(t("Формат видео не поддерживается на этом устройстве."));
      return;
    }
    if (file.size > CHAT_VIDEO_MAX_BYTES) {
      setErrorText(t("Видео слишком большое. Выберите файл до 100 МБ."));
      return;
    }
    try {
      const previewUrl = URL.createObjectURL(file);
      void makeMediaPreviewDetails(file, "video");
      const durationMs = await getVideoDurationMs(file);

      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      if (pendingVideo?.previewUrl) {
        URL.revokeObjectURL(pendingVideo.previewUrl);
      }
      if (pendingMediaBatch?.length) {
        pendingMediaBatch.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
      }
      setPendingMediaBatch(null);
      setPendingVideo({ previewUrl, file, durationMs });
      setPendingImage(null);
      setPendingAudio(null);
      setPendingFile(null);
      setPendingMediaBatch(null);
      setErrorText(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
    }
    return;
  }

  if (isAudioFile(file)) {
    if (file.size > AUDIO_MAX_BYTES) {
      setErrorText(t("Музыка слишком большая. Максимум {0} МБ.", { 0: Math.round(AUDIO_MAX_BYTES / 1024 / 1024) }));
      return;
    }
    try {
      const [durationMs, metadata] = await Promise.all([getAudioDurationMs(file), readAudioFileMetadata(file)]);
      if (durationMs > AUDIO_MAX_DURATION_MS) {
        setErrorText(t("Музыка слишком длинная. Максимум 10 минут."));
        return;
      }
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      if (pendingVideo?.previewUrl) {
        URL.revokeObjectURL(pendingVideo.previewUrl);
      }
      if (pendingMediaBatch?.length) {
        pendingMediaBatch.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
      }
      setPendingMediaBatch(null);
      setPendingAudio({ file, durationMs, name: file.name, ...metadata });
      setPendingImage(null);
      setPendingVideo(null);
      setPendingFile(null);
      setPendingMediaBatch(null);
      setErrorText(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
    }
    return;
  }

  try {
    if (file.size > FILE_MAX_BYTES) {
      setErrorText(t("Файл слишком большой. Максимум {0} МБ.", { 0: Math.round(FILE_MAX_BYTES / 1024 / 1024) }));
      return;
    }
    if (pendingImage?.previewUrl) {
      URL.revokeObjectURL(pendingImage.previewUrl);
    }
    if (pendingVideo?.previewUrl) {
      URL.revokeObjectURL(pendingVideo.previewUrl);
    }
    if (pendingMediaBatch?.length) {
      pendingMediaBatch.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    }
    setPendingMediaBatch(null);
    setPendingFile({
      file,
      name: file.name || t("Файл"),
      size: file.size,
      mimeType: file.type || "application/octet-stream",
    });
    setPendingImage(null);
    setPendingVideo(null);
    setPendingAudio(null);
    setPendingMediaBatch(null);
    setErrorText(null);
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  }
}
