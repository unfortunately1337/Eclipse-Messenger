"use client";

import { type ChangeEvent } from "react";

import { showAppToast } from "@/lib/client/app-toast";

import { type StoryDraft } from "../../types";

import { uploadMediaFileAction, prepareStoryDraftAction, submitStoryDraftAction } from "../story-actions";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ChatStoriesModel } from "../controllers/useChatStories";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface StoryCallbackSources {
  readonly page: Pick<ChatPageStateModel, "t" | "setErrorText" | "setChatListMenuOpen"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversationRef">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile" | "storyAccountRef">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyUploading" | "setStoryCameraOpen" | "setStoryDraft" | "storyDraft" | "pendingStoryUploadRef" | "setPendingStory" | "setStoryUploading" | "setAnimateSelfStoryRing" | "setStoryFeed" | "visibleStoryIdRef">;
    directoryMenu: Pick<ChatPageStateModel["directoryMenu"], "setChatListMenuPosition" | "setChatListMenuOrigin" | "setMenuShowMore">;

  };
  readonly elements: {
    mediaRecorder: Pick<ChatElementStateModel["mediaRecorder"], "voiceRecordedMimeTypeRef" | "videoRecordedMimeTypeRef">;

  };
  readonly stories: Pick<ChatStoriesModel, "selfStoryGroup" | "closeStoryDraft" | "closeStoryViewer">;
}

/** Creates render-snapshot callbacks without reading models during construction. */
export function createStoryCallbacks(sources: StoryCallbackSources): Pick<ChatPageCallbacks, "uploadChatMediaFile" | "uploadMediaFile" | "prepareStoryDraft" | "createStoryFromSelection" | "submitStoryDraft" | "toggleChatListMenuFromButton"> {
  async function uploadChatMediaFile(file: Blob, kind: "image" | "video" | "voice" | "video_note" | "audio" | "file", durationMs?: number): ReturnType<ChatPageCallbacks["uploadChatMediaFile"]> {
    const { t } = sources.page;
    const { activeConversationRef } = sources.page.conversation;
    const { selectedLink } = sources.page.selection;
    const { selfId } = sources.page.account;

    const conversation = activeConversationRef.current;
    if (!conversation) throw new Error(t("Чат недоступен"));
    if (conversation.chatType === "eclipse") {
      throw new Error(t("Системный бот принимает команды текстом. Для аватара бота выберите изображение в меню создания бота."));
    }
    const scopeType = selectedLink?.startsWith("secret-") ? "secret"
      : conversation.group ? "group" : conversation.channel ? "channel"
        : conversation.chatType === "saved" ? "saved" : "direct";
    const scopeId = scopeType === "secret" ? selectedLink!.slice(7)
      : conversation.group?.id ?? conversation.channel?.id
      ?? (scopeType === "saved" ? selfId : conversation.peer?.id);
    if (!scopeId) throw new Error(t("Чат недоступен"));
    return uploadMediaFile(file, kind, durationMs, { scopeType, scopeId, bot: scopeType === "direct" && Boolean(conversation.peer?.isBot) });
  }

  async function uploadMediaFile(
    file: Blob,
    kind: "image" | "video" | "voice" | "video_note" | "audio" | "file",
    durationMs?: number,
    scope?: {
      scopeType: string;
      scopeId: string;
      bot?: boolean

    },
  ): ReturnType<ChatPageCallbacks["uploadMediaFile"]> {
    const { voiceRecordedMimeTypeRef, videoRecordedMimeTypeRef } = sources.elements.mediaRecorder;

    return uploadMediaFileAction({ voiceRecordedMimeTypeRef, videoRecordedMimeTypeRef }, file, kind, durationMs, scope);
  }

  async function prepareStoryDraft(file: File, mediaType: "image" | "video", recordedDurationMs?: number): ReturnType<ChatPageCallbacks["prepareStoryDraft"]> {
    const { t, setErrorText } = sources.page;
    const { storyUploading, setStoryCameraOpen, setStoryDraft } = sources.page.storyDraft;

    return prepareStoryDraftAction({ storyUploading, setStoryCameraOpen, t, setErrorText, setStoryDraft }, file, mediaType, recordedDurationMs);
  }

  async function createStoryFromSelection(event: ChangeEvent<HTMLInputElement>): ReturnType<ChatPageCallbacks["createStoryFromSelection"]> {
    const { t } = sources.page;

    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      showAppToast({ title: t("Истории поддерживают только фото и видео."), type: "error" });
      return;
    }
    await prepareStoryDraft(file, isVideo ? "video" : "image");
  }

  async function submitStoryDraft(editedDraft?: StoryDraft): ReturnType<ChatPageCallbacks["submitStoryDraft"]> {
    const { setErrorText, t } = sources.page;
    const { storyDraft, pendingStoryUploadRef, setPendingStory, setStoryUploading, setAnimateSelfStoryRing, setStoryFeed, visibleStoryIdRef, setStoryDraft } = sources.page.storyDraft;
    const { selfProfile, storyAccountRef } = sources.page.account;
    const { selfStoryGroup, closeStoryDraft, closeStoryViewer } = sources.stories;

    return submitStoryDraftAction({ storyDraft, selfProfile, pendingStoryUploadRef, selfStoryGroup, setErrorText, t, setPendingStory, closeStoryDraft, setStoryUploading, setAnimateSelfStoryRing, uploadMediaFile, storyAccountRef, setStoryFeed, visibleStoryIdRef, closeStoryViewer, setStoryDraft }, editedDraft);
  }

  function toggleChatListMenuFromButton(event: React.MouseEvent<HTMLButtonElement>): ReturnType<ChatPageCallbacks["toggleChatListMenuFromButton"]> {
    const { setChatListMenuOpen } = sources.page;
    const { setChatListMenuPosition, setChatListMenuOrigin, setMenuShowMore } = sources.page.directoryMenu;

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = Math.min(window.innerWidth * 0.72, 272);
    const left = Math.max(10, Math.min(rect.left - 2, window.innerWidth - menuWidth - 10));
    const top = Math.max(10, rect.bottom + 3);
    const btnCenterX = rect.left + rect.width / 2;
    const btnCenterY = rect.top + rect.height / 2;
    const relX = btnCenterX - left;
    const relY = btnCenterY - top;
    setChatListMenuPosition({ left, top });
    setChatListMenuOrigin(`${relX}px ${relY}px`);
    setMenuShowMore(false);
    setChatListMenuOpen((prev) => !prev);
  }

  return { uploadChatMediaFile, uploadMediaFile, prepareStoryDraft, createStoryFromSelection, submitStoryDraft, toggleChatListMenuFromButton };
}
