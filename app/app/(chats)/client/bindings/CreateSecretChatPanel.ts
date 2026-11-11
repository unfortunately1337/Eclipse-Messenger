

import { type CreateSecretChatPanel } from "../CreateSecretChatPanel";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface CreateSecretChatPanelSources {
  readonly page: Pick<ChatPageStateModel, "t" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs" | "handleSecretChatPresetSelect"> & {
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "secretChatCreateOpen" | "secretChatCreateStep" | "setSecretChatCreateOpen" | "secretChatSearchQuery" | "setSecretChatSearchQuery" | "setSecretChatSelectedUserIds" | "setSecretChatTitle" | "setSecretChatCreateStep" | "secretChatLifetimePreset" | "secretChatLifetimeDays" | "setSecretChatLifetimeDays" | "secretChatLifetimeHours" | "setSecretChatLifetimeHours" | "secretChatLifetimeMinutes" | "setSecretChatLifetimeMinutes" | "secretChatCreating" | "secretChatSelectedUserIds">;
    settingsControls: Pick<ChatPageStateModel["settingsControls"], "createChatContactsLoading">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "contactsForAdd">;
    account: Pick<ChatPageStateModel["account"], "selfId">;

  };
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache">;
  readonly callbacks: Pick<ChatPageCallbacks, "submitCreateSecretChat">;
}

/** Projects only the props this memoized view consumes. */
export function bindCreateSecretChatPanel(sources: CreateSecretChatPanelSources): React.ComponentProps<typeof CreateSecretChatPanel> {
  const { t, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, handleSecretChatPresetSelect } = sources.page;
  const { secretChatCreateOpen, secretChatCreateStep, setSecretChatCreateOpen, secretChatSearchQuery, setSecretChatSearchQuery, setSecretChatSelectedUserIds, setSecretChatTitle, setSecretChatCreateStep, secretChatLifetimePreset, secretChatLifetimeDays, setSecretChatLifetimeDays, secretChatLifetimeHours, setSecretChatLifetimeHours, secretChatLifetimeMinutes, setSecretChatLifetimeMinutes, secretChatCreating, secretChatSelectedUserIds } = sources.page.secretChatDraft;
  const { createChatContactsLoading } = sources.page.settingsControls;
  const { contactsForAdd } = sources.page.mediaAndChannel;
  const { selfId } = sources.page.account;
  const { readProfileFromCache } = sources.bootstrap;
  const { submitCreateSecretChat } = sources.callbacks;
  return {
    "secretChatCreateOpen": secretChatCreateOpen,
    "secretChatCreateStep": secretChatCreateStep,
    "setSecretChatCreateOpen": setSecretChatCreateOpen,
    "t": t,
    "secretChatSearchQuery": secretChatSearchQuery,
    "setSecretChatSearchQuery": setSecretChatSearchQuery,
    "createChatContactsLoading": createChatContactsLoading,
    "contactsForAdd": contactsForAdd,
    "readProfileFromCache": readProfileFromCache,
    "onlineUserIds": onlineUserIds,
    "lastOfflineAtByUserId": lastOfflineAtByUserId,
    "presenceNowTs": presenceNowTs,
    "selfId": selfId,
    "setSecretChatSelectedUserIds": setSecretChatSelectedUserIds,
    "setSecretChatTitle": setSecretChatTitle,
    "setSecretChatCreateStep": setSecretChatCreateStep,
    "handleSecretChatPresetSelect": handleSecretChatPresetSelect,
    "secretChatLifetimePreset": secretChatLifetimePreset,
    "secretChatLifetimeDays": secretChatLifetimeDays,
    "setSecretChatLifetimeDays": setSecretChatLifetimeDays,
    "secretChatLifetimeHours": secretChatLifetimeHours,
    "setSecretChatLifetimeHours": setSecretChatLifetimeHours,
    "secretChatLifetimeMinutes": secretChatLifetimeMinutes,
    "setSecretChatLifetimeMinutes": setSecretChatLifetimeMinutes,
    "submitCreateSecretChat": submitCreateSecretChat,
    "secretChatCreating": secretChatCreating,
    "secretChatSelectedUserIds": secretChatSelectedUserIds
  };
}
