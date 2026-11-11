"use client";

import { customThemeChatBackground } from "@/lib/client/custom-chat-theme";
import { NAVIGATION_TRANSITION } from "@/lib/client/panel-motion";

import { AnimatedChatLayout } from "../../components/common/AnimatedChatLayout";

import { AnimatePresence, motion } from "framer-motion";

import { ForwardRecipientPicker } from "../../components/common/ForwardRecipientPicker";

import { TelegramDoodleWallpaper } from "../../components/common/TelegramDoodleWallpaper";

import { ChatSidebar } from "../ChatSidebar";

import { DesktopDetailsPanel } from "../DesktopDetailsPanel";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ConversationActionsModel } from "../controllers/useConversationActions";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";
import { bindChatSidebar, type ChatSidebarSources } from "../bindings/ChatSidebar";
import { ConversationScene, type ConversationSceneSources } from "./ConversationScene";
import { bindDesktopDetailsPanel, type DesktopDetailsPanelSources } from "../bindings/DesktopDetailsPanel";

export interface ChatWorkspaceOwnSources {
  readonly page: Pick<ChatPageStateModel, "activeCustomTheme" | "liveBgPresetColors" | "transparentVisual" | "t"> & {
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "liveBackgroundPreset" | "liveBackgroundOpacity">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "forwardPickerMessages" | "forwardPickerMode" | "setForwardPickerMessages">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop" | "desktopDetailsPanelOpen">;

  };
  readonly messageActions: Pick<ConversationActionsModel, "forwardRecipients">;
  readonly callbacks: Pick<ChatPageCallbacks, "chooseForwardRecipient">;
  readonly active: Pick<ActiveConversationModel, "currentChatWallpaper" | "currentChatWallpaperPosY">;
  readonly presentation: Pick<ConversationPresentationModel, "canUseDesktopDetailsPanel">;
}

export type ChatWorkspaceSources = ChatWorkspaceOwnSources & ChatSidebarSources & ConversationSceneSources & DesktopDetailsPanelSources;

export function ChatWorkspace({ sources }: { sources: ChatWorkspaceSources }) {
  const { activeCustomTheme, liveBgPresetColors, transparentVisual, t } = sources.page;
  const { liveBackgroundPreset, liveBackgroundOpacity } = sources.page.notificationAndContacts;
  const { forwardPickerMessages, forwardPickerMode, setForwardPickerMessages } = sources.page.messageInteraction;
  const { isDesktop, desktopDetailsPanelOpen } = sources.page.panels;
  const { forwardRecipients } = sources.messageActions;
  const { chooseForwardRecipient } = sources.callbacks;
  const { currentChatWallpaper, currentChatWallpaperPosY } = sources.active;
  const { canUseDesktopDetailsPanel } = sources.presentation;
  return (
    <div className="relative h-full min-h-0 w-full max-w-full overflow-hidden bg-[#0e0e10] dark:bg-[#0e0e10]">
      <TelegramDoodleWallpaper patternEnabled={activeCustomTheme?.backgroundMode !== "image"} backgroundOverride={activeCustomTheme ? customThemeChatBackground(activeCustomTheme) : undefined} presetColors={liveBgPresetColors} presetId={activeCustomTheme ? "none" : liveBackgroundPreset} opacity={liveBackgroundOpacity} />
      <AnimatePresence>{forwardPickerMessages && <ForwardRecipientPicker desktop={isDesktop} transparentVisual={transparentVisual} title={forwardPickerMode === "share" ? t("Отправить") : t("Переслать")} recipients={forwardRecipients} onClose={() => setForwardPickerMessages(null)} onSelect={chooseForwardRecipient} />}</AnimatePresence>
      {/* Full-screen Custom Chat Wallpaper Layer replacing doodle for the active chat */}
      <AnimatePresence>
        {currentChatWallpaper ? (
          <motion.div
            key={currentChatWallpaper}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={NAVIGATION_TRANSITION}
            className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
          >
            <img
              src={currentChatWallpaper}
              alt={t("Обои чата")}
              className="h-full w-full object-cover"
              style={{
                objectPosition: `50% ${currentChatWallpaperPosY}%`,
              }}
            />
            <div className="absolute inset-0 bg-black/25 pointer-events-none" />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatedChatLayout detailsOpen={canUseDesktopDetailsPanel && desktopDetailsPanelOpen}>
        <ChatSidebar {...bindChatSidebar(sources)} />

        <ConversationScene sources={sources} />
        <DesktopDetailsPanel {...bindDesktopDetailsPanel(sources)} desktopDetailsPanelOpen={canUseDesktopDetailsPanel && desktopDetailsPanelOpen} />
      </AnimatedChatLayout>
    </div>
  );
}
