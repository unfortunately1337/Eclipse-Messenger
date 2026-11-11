"use client";

import { SecretChatInfoDialog } from "../../components/common/SecretChatInfoDialog";

import { AnimatePresence, motion } from "framer-motion";
import { isRealMediaAvatar } from "@/components/ui/media";
import { AvatarMediaViewerModal } from "../../components/common/AvatarMediaViewerModal";
import { CollectibleUsernameModal } from "../../components/common/CollectibleUsernameModal";

import { showAppToast } from "@/lib/client/app-toast";

import ProfileQrPanel from "@/components/ProfileQrPanel";

import { clearChatMemoryCaches } from "../chat-cache";

import { SettingsDrawer } from "../lazy-panels";

import { ProfileLinkEditor } from "../ProfileLinkEditor";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatPagePresentationModel } from "../controllers/useChatPagePresentation";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatStoriesModel } from "../controllers/useChatStories";

import { bindProfileLinkEditor, type ProfileLinkEditorSources } from "../bindings/ProfileLinkEditor";

export interface AccountOverlaysOwnSources {
  readonly page: Pick<ChatPageStateModel, "settingsPanelOpen" | "settingsDrawerLoaded" | "liveBackgroundLayerSettings" | "setChatListMenuOpen" | "requestedSettingsParam" | "avatarViewerData" | "setAvatarViewerData" | "profileData" | "contactDraftDisplayName"> & {
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "qrModalProfile" | "setQrModalProfile">;
    account: Pick<ChatPageStateModel["account"], "selfProfile" | "setSelfProfile" | "selfId">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "animateSelfStoryRing">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "secretChatInfoOpen" | "setSecretChatInfoOpen">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "collectibleModalUsername" | "setCollectibleModalUsername" | "contactExists">;

  };
  readonly view: Pick<ChatPagePresentationModel, "handleSettingsTransitionComplete" | "closeSettingsPanel" | "handleSettingsThemeUpdate" | "uploadSettingsMedia" | "openSettingsStory">;
  readonly appearance: Pick<ChatAppearanceModel, "uiAccentStyle">;
  readonly active: Pick<ActiveConversationModel, "leftSidebarThemeStyle" | "chatProfileModalThemeStyle">;
  readonly presentation: Pick<ConversationPresentationModel, "mobileChatOpen">;
  readonly stories: Pick<ChatStoriesModel, "selfStoryGroup">;
}

export type AccountOverlaysSources = AccountOverlaysOwnSources & ProfileLinkEditorSources;

export function AccountOverlays({ sources }: { sources: AccountOverlaysSources }) {
  const { settingsPanelOpen, settingsDrawerLoaded, liveBackgroundLayerSettings, setChatListMenuOpen, requestedSettingsParam, avatarViewerData, setAvatarViewerData, profileData, contactDraftDisplayName } = sources.page;
  const { qrModalProfile, setQrModalProfile } = sources.page.profileNavigation;
  const { selfProfile, setSelfProfile, selfId } = sources.page.account;
  const { animateSelfStoryRing } = sources.page.storyDraft;
  const { secretChatInfoOpen, setSecretChatInfoOpen } = sources.page.secretChatDraft;
  const { isDesktop } = sources.page.panels;
  const { collectibleModalUsername, setCollectibleModalUsername, contactExists } = sources.page.contactEditor;
  const { handleSettingsTransitionComplete, closeSettingsPanel, handleSettingsThemeUpdate, uploadSettingsMedia, openSettingsStory } = sources.view;
  const { uiAccentStyle } = sources.appearance;
  const { leftSidebarThemeStyle, chatProfileModalThemeStyle } = sources.active;
  const { mobileChatOpen } = sources.presentation;
  const { selfStoryGroup } = sources.stories;
  return (
    <>
      <AnimatePresence>
        {qrModalProfile ? (
          <motion.div
            className="fixed inset-0 z-[160] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer"
              onClick={() => setQrModalProfile(null)}
            />
            <motion.div
              className="relative z-10 flex h-[min(740px,calc(100dvh-24px))] w-[calc(100%-24px)] max-w-sm overflow-hidden rounded-[28px]"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <ProfileQrPanel selfProfile={qrModalProfile} onBack={() => setQrModalProfile(null)} onClose={() => setQrModalProfile(null)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <ProfileLinkEditor {...bindProfileLinkEditor(sources)} />
      {(settingsPanelOpen || settingsDrawerLoaded) && <SettingsDrawer
        isOpen={settingsPanelOpen}
        onTransitionComplete={handleSettingsTransitionComplete}
        onClose={closeSettingsPanel}
        selfProfile={selfProfile}
        setSelfProfile={setSelfProfile}
        liveBackgroundSettings={liveBackgroundLayerSettings}
        onUpdateLiveBackgroundSettings={handleSettingsThemeUpdate}
        uiAccentStyle={uiAccentStyle}
        panelThemeStyle={leftSidebarThemeStyle}
        mobileChatOpen={mobileChatOpen}
        uploadMediaFile={uploadSettingsMedia}
        clearChatMemoryCaches={clearChatMemoryCaches}
        setChatListMenuOpen={setChatListMenuOpen}
        requestedSettingsParam={requestedSettingsParam}
        selfStoryGroup={selfStoryGroup}
        animateStoryRing={animateSelfStoryRing}
        onOpenStory={openSettingsStory}
      />}
      <AvatarMediaViewerModal
        open={Boolean(avatarViewerData?.open && isRealMediaAvatar(avatarViewerData?.mediaUrl))}
        onClose={() => setAvatarViewerData(null)}
        mediaUrl={avatarViewerData?.mediaUrl}
        title={avatarViewerData?.title ?? ""}
        subtitle={avatarViewerData?.subtitle}
        timestamp={avatarViewerData?.timestamp}
        showUploadTimestamp={avatarViewerData?.showUploadTimestamp}
        fallbackText={avatarViewerData?.fallbackText}
        zIndex={350}
      />
      <SecretChatInfoDialog open={secretChatInfoOpen} onOpenChange={setSecretChatInfoOpen} desktop={isDesktop} panelStyle={chatProfileModalThemeStyle} />
      <CollectibleUsernameModal
        isOpen={Boolean(collectibleModalUsername)}
        username={collectibleModalUsername}
        onClose={() => setCollectibleModalUsername(null)}
        showToast={showAppToast}
        isSelf={Boolean(profileData && profileData.id === selfId)}
        ownerName={contactExists && contactDraftDisplayName ? contactDraftDisplayName : profileData?.displayName}
      />
    </>
  );
}
