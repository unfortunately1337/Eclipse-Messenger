"use client";

import { AnimatePresence } from "framer-motion";

import { StoryCamera, StoryEditor, StoryViewer } from "../lazy-panels";

import { ConversationVideoViewer } from "../ConversationVideoViewer";
import { ConversationImageViewer } from "../ConversationImageViewer";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatStoriesModel } from "../controllers/useChatStories";
import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";
import { bindConversationVideoViewer, type ConversationVideoViewerSources } from "../bindings/ConversationVideoViewer";
import { bindConversationImageViewer, type ConversationImageViewerSources } from "../bindings/ConversationImageViewer";

export interface MediaOverlaysOwnSources {
  readonly page: {
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyCameraOpen" | "setStoryCameraOpen" | "storyDraft" | "setStoryDraft" | "storyUploading" | "storyViewer" | "storyViewerOrigin" | "storyViewerMoreOpen" | "setStoryViewerMoreOpen" | "storyViewerStatsOpen" | "setStoryViewerStatsOpen" | "storyViewerStats" | "storyViewerStatsFullLoading" | "storyLikePendingId">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    account: Pick<ChatPageStateModel["account"], "selfId">;

  };
  readonly callbacks: Pick<ChatPageCallbacks, "prepareStoryDraft" | "createStoryFromSelection" | "submitStoryDraft">;
  readonly stories: Pick<ChatStoriesModel, "closeStoryDraft" | "activeStory" | "activeStoryGroup" | "closeStoryViewer" | "loadActiveStoryViewers" | "deleteActiveStory" | "stepStoryViewer" | "holdStoryViewer" | "releaseStoryViewer" | "openStoryAuthorDirect" | "toggleActiveStoryLike" | "markStoryMediaReady">;
  readonly elements: {
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "storyViewerProgressRef" | "storyViewerVideoRef">;

  };
}

export type MediaOverlaysSources = MediaOverlaysOwnSources & ConversationVideoViewerSources & ConversationImageViewerSources;

export function MediaOverlays({ sources }: { sources: MediaOverlaysSources }) {
  const { storyCameraOpen, setStoryCameraOpen, storyDraft, setStoryDraft, storyUploading, storyViewer, storyViewerOrigin, storyViewerMoreOpen, setStoryViewerMoreOpen, storyViewerStatsOpen, setStoryViewerStatsOpen, storyViewerStats, storyViewerStatsFullLoading, storyLikePendingId } = sources.page.storyDraft;
  const { isDesktop } = sources.page.panels;
  const { selfId } = sources.page.account;
  const { prepareStoryDraft, createStoryFromSelection, submitStoryDraft } = sources.callbacks;
  const { closeStoryDraft, activeStory, activeStoryGroup, closeStoryViewer, loadActiveStoryViewers, deleteActiveStory, stepStoryViewer, holdStoryViewer, releaseStoryViewer, openStoryAuthorDirect, toggleActiveStoryLike, markStoryMediaReady } = sources.stories;
  const { storyViewerProgressRef, storyViewerVideoRef } = sources.elements.storyAndViewport;
  return (
    <>
      <ConversationVideoViewer {...bindConversationVideoViewer(sources)} />
      <ConversationImageViewer {...bindConversationImageViewer(sources)} />
      {storyCameraOpen && !isDesktop ? (
        <StoryCamera
          isOpen={storyCameraOpen}
          onClose={() => setStoryCameraOpen(false)}
          onCapture={prepareStoryDraft}
          onSelectFromFile={createStoryFromSelection}
        />
      ) : null}
      <AnimatePresence>
        {storyDraft && !isDesktop ? (
          <StoryEditor
            isOpen={Boolean(storyDraft && !isDesktop)}
            isDesktop={isDesktop}
            storyDraft={storyDraft}
            setStoryDraft={setStoryDraft}
            closeStoryDraft={closeStoryDraft}
            storyUploading={storyUploading}
            submitStoryDraft={submitStoryDraft}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {storyViewer && activeStory && activeStoryGroup ? (
          <StoryViewer
            isOpen={Boolean(storyViewer && activeStory && activeStoryGroup)}
            storyViewer={storyViewer}
            origin={storyViewerOrigin}
            activeStory={activeStory}
            activeStoryGroup={activeStoryGroup}
            progressRef={storyViewerProgressRef}
            selfId={selfId}
            storyViewerVideoRef={storyViewerVideoRef}
            storyViewerMoreOpen={storyViewerMoreOpen}
            setStoryViewerMoreOpen={setStoryViewerMoreOpen}
            storyViewerStatsOpen={storyViewerStatsOpen}
            setStoryViewerStatsOpen={setStoryViewerStatsOpen}
            storyViewerStats={storyViewerStats}
            storyViewerStatsFullLoading={storyViewerStatsFullLoading}

            storyLikePendingId={storyLikePendingId}
            closeStoryViewer={closeStoryViewer}
            loadActiveStoryViewers={loadActiveStoryViewers}
            deleteActiveStory={deleteActiveStory}
            stepStoryViewer={stepStoryViewer}
            holdStoryViewer={holdStoryViewer}
            releaseStoryViewer={releaseStoryViewer}
            openStoryAuthorDirect={openStoryAuthorDirect}
            toggleActiveStoryLike={toggleActiveStoryLike}
            onMediaLoaded={markStoryMediaReady}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
