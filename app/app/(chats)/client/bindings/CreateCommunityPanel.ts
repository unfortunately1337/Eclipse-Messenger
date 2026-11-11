

import { type CreateCommunityPanel } from "../CreateCommunityPanel";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface CreateCommunityPanelSources {
  readonly page: Pick<ChatPageStateModel, "t" | "setErrorText" | "createChatNavDirection" | "filteredCreateChatContacts" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs"> & {
    settingsControls: Pick<ChatPageStateModel["settingsControls"], "createChatKind" | "createChatStep" | "setCreateChatStep" | "createChatSelectedIds" | "createChatDraft" | "setCreateChatContactQuery" | "createChatCreating" | "setCreateChatDraft" | "createChatContactQuery" | "createChatContactsLoading">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "liveBackgroundPreset">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "contactsForAdd">;
    account: Pick<ChatPageStateModel["account"], "selfId">;

  };
  readonly callbacks: Pick<ChatPageCallbacks, "closeCreateChat" | "submitCreateChat" | "ensureCreateChatContacts" | "pickCreateChatPhoto" | "toggleCreateChatContact">;
  readonly appearance: Pick<ChatAppearanceModel, "uiAccentStyle">;
  readonly active: Pick<ActiveConversationModel, "leftSidebarThemeStyle">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache">;
}

/** Projects only the props this memoized view consumes. */
export function bindCreateCommunityPanel(sources: CreateCommunityPanelSources): React.ComponentProps<typeof CreateCommunityPanel> {
  const { t, setErrorText, createChatNavDirection, filteredCreateChatContacts, onlineUserIds, lastOfflineAtByUserId, presenceNowTs } = sources.page;
  const { createChatKind, createChatStep, setCreateChatStep, createChatSelectedIds, createChatDraft, setCreateChatContactQuery, createChatCreating, setCreateChatDraft, createChatContactQuery, createChatContactsLoading } = sources.page.settingsControls;
  const { liveBackgroundPreset } = sources.page.notificationAndContacts;
  const { contactsForAdd } = sources.page.mediaAndChannel;
  const { selfId } = sources.page.account;
  const { closeCreateChat, submitCreateChat, ensureCreateChatContacts, pickCreateChatPhoto, toggleCreateChatContact } = sources.callbacks;
  const { uiAccentStyle } = sources.appearance;
  const { leftSidebarThemeStyle } = sources.active;
  const { readProfileFromCache } = sources.bootstrap;
  return {
    "createChatKind": createChatKind,
    "closeCreateChat": closeCreateChat,
    "t": t,
    "uiAccentStyle": uiAccentStyle,
    "leftSidebarThemeStyle": leftSidebarThemeStyle,
    "createChatStep": createChatStep,
    "setCreateChatStep": setCreateChatStep,
    "createChatSelectedIds": createChatSelectedIds,
    "setErrorText": setErrorText,
    "submitCreateChat": submitCreateChat,
    "createChatDraft": createChatDraft,
    "setCreateChatContactQuery": setCreateChatContactQuery,
    "ensureCreateChatContacts": ensureCreateChatContacts,
    "createChatCreating": createChatCreating,
    "createChatNavDirection": createChatNavDirection,
    "liveBackgroundPreset": liveBackgroundPreset,
    "pickCreateChatPhoto": pickCreateChatPhoto,
    "setCreateChatDraft": setCreateChatDraft,
    "createChatContactQuery": createChatContactQuery,
    "createChatContactsLoading": createChatContactsLoading,
    "contactsForAdd": contactsForAdd,
    "filteredCreateChatContacts": filteredCreateChatContacts,
    "readProfileFromCache": readProfileFromCache,
    "onlineUserIds": onlineUserIds,
    "lastOfflineAtByUserId": lastOfflineAtByUserId,
    "presenceNowTs": presenceNowTs,
    "selfId": selfId,
    "toggleCreateChatContact": toggleCreateChatContact
  };
}
