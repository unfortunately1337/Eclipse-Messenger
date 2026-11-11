"use client";

import { PANEL_TRANSITION } from "@/lib/client/panel-motion";

import { Check, CircleAlert, Copy, KeySquare } from "lucide-react";

import { MdDelete } from "react-icons/md";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";

import { CallRoomPanel } from "../lazy-panels";

import type { ChatPagePresentationModel } from "../controllers/useChatPagePresentation";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatRealtimeModel } from "../controllers/useChatRealtime";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";

import { ChatWorkspace, type ChatWorkspaceSources } from "./ChatWorkspace";
import { MediaOverlays, type MediaOverlaysSources } from "./MediaOverlays";
import { ProfileOverlays, type ProfileOverlaysSources } from "./ProfileOverlays";
import { CommunityDialogs, type CommunityDialogsSources } from "./CommunityDialogs";
import { CreationDialogs, type CreationDialogsSources } from "./CreationDialogs";
import { AccountOverlays, type AccountOverlaysSources } from "./AccountOverlays";

export interface ChatPageViewOwnSources {
  readonly view: Pick<ChatPagePresentationModel, "inviteArrivalRef">;
  readonly presentation: Pick<ConversationPresentationModel, "mobileChatOpen">;
  readonly appearance: Pick<ChatAppearanceModel, "uiAccentStyle" | "chatActionPanelThemeStyle">;
  readonly page: Pick<ChatPageStateModel, "transparentVisual" | "t"> & {
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "wallpaperFileInputRef">;
    account: Pick<ChatPageStateModel["account"], "selfId">;
    panels: Pick<ChatPageStateModel["panels"], "chatActionPanel">;

  };
  readonly realtime: Pick<ChatRealtimeModel, "handleWallpaperUpload">;
  readonly active: Pick<ActiveConversationModel, "calls" | "activeChat">;
}

export type ChatPageViewSources = ChatPageViewOwnSources & ChatWorkspaceSources & MediaOverlaysSources & ProfileOverlaysSources & CommunityDialogsSources & CreationDialogsSources & AccountOverlaysSources;

export function ChatPageView({ sources }: { sources: ChatPageViewSources }) {
  const { inviteArrivalRef } = sources.view;
  const { mobileChatOpen } = sources.presentation;
  const { uiAccentStyle, chatActionPanelThemeStyle } = sources.appearance;
  const { transparentVisual, t } = sources.page;
  const { wallpaperFileInputRef } = sources.page.wallpaperUpload;
  const { selfId } = sources.page.account;
  const { chatActionPanel } = sources.page.panels;
  const { handleWallpaperUpload } = sources.realtime;
  const { calls, activeChat } = sources.active;
  return (
    <MotionConfig transition={PANEL_TRANSITION} reducedMotion="user">
      <div
        ref={inviteArrivalRef}
        className={`w-full max-w-full px-0 overflow-x-hidden ${mobileChatOpen ? "h-[100dvh] overflow-hidden" : "h-[100dvh]"}`}
        style={uiAccentStyle}
      >
        <input
          ref={wallpaperFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleWallpaperUpload(f);
            e.target.value = "";
          }}
        />
        {calls.presentation && selfId && <CallRoomPanel key={`${selfId}:${calls.presentationKey}`} call={calls.presentation} selfId={selfId} glass={transparentVisual} busy={calls.busy} onJoin={calls.join} onLeave={calls.leave} />}
        <ChatWorkspace sources={sources} />

        <MediaOverlays sources={sources} />

        <ProfileOverlays sources={sources} />

        <CommunityDialogs sources={sources} />

        <CreationDialogs sources={sources} />

        {!activeChat && (
          <AnimatePresence>
            {chatActionPanel ? (
              <motion.div
                key={chatActionPanel.id}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={PANEL_TRANSITION}
                className="pointer-events-none fixed bottom-[max(env(safe-area-inset-bottom),20px)] left-1/2 z-[9999] w-full max-w-[420px] -translate-x-1/2 px-3"
              >
                <div
                  className={`pointer-events-auto mx-auto flex w-full items-center gap-2.5 rounded-[24px] border px-4 py-2 text-white shadow-[0_22px_52px_rgba(0,0,0,0.5)] backdrop-blur-md ${chatActionPanelThemeStyle ? "" : "border-white/4 bg-zinc-950/96"
                    }`}
                  style={chatActionPanelThemeStyle}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center text-white/92">
                    {chatActionPanel.icon === "copy" ? (
                      <Copy size={15} />
                    ) : chatActionPanel.icon === "trash" ? (
                      <MdDelete size={17} />
                    ) : chatActionPanel.icon === "error" ? (
                      <CircleAlert size={15} />
                    ) : chatActionPanel.icon === "success" ? (
                      <Check size={15} className="text-emerald-400" />
                    ) : (
                      <KeySquare size={15} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-[13px] font-medium leading-4 text-white/94">
                    {t(chatActionPanel.message)}
                  </div>
                  {chatActionPanel.actionLabel && chatActionPanel.onAction ? (
                    <button
                      type="button"
                      onClick={chatActionPanel.onAction}
                      className="shrink-0 text-[12px] font-semibold text-white/92 transition-colors hover:text-white"
                    >
                      {chatActionPanel.actionLabel}
                    </button>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        <AccountOverlays sources={sources} />

        <style jsx global>{`
        @keyframes profile-music-bounce {
          0%,
          20% {
            transform: translateX(0);
          }
          80%,
          100% {
            transform: translateX(var(--overflow-shift, 0px));
          }
        }
      `}</style>
      </div>
    </MotionConfig>
  );
}
