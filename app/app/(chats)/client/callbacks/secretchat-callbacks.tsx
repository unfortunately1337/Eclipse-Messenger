"use client";

import { savePublicLinkChangeAction, acceptSecretChatAction, declineSecretChatAction, openSecretChatFromProfileAction, submitCreateSecretChatAction } from "../secret-chat-actions";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface SecretChatCallbackSources {
  readonly page: Pick<ChatPageStateModel, "setErrorText" | "t" | "profileData" | "profileIsBot" | "profileIsSaved" | "secretChatCheckPendingRef" | "profileDataRef" | "contactDraftDisplayName" | "setChatListMenuOpen" | "setProfileModalOpen"> & {
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "linkEditorTarget" | "linkEditorValue" | "linkEditorSaving" | "linkEditorStatus" | "setLinkEditorTarget" | "setLinkEditorSaving" | "setProfileMoreOpen" | "setProfileSubView">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "setSelectedLink">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "setActiveConversation" | "setChats" | "setMessages" | "chats">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "setAcceptingSecretChat" | "setSecretChatExpiresAt" | "setSecretChatSelectedUserIds" | "setSecretChatTitle" | "setSecretChatLifetimePreset" | "setSecretChatLifetimeDays" | "setSecretChatLifetimeHours" | "setSecretChatLifetimeMinutes" | "setSecretChatCodeword" | "setSecretChatCreateOpen" | "setSecretChatCreateStep" | "setSecretChatSearchQuery" | "setSecretChatCreating" | "secretChatCreating" | "secretChatSelectedUserIds" | "secretChatLifetimeDays" | "secretChatLifetimeHours" | "secretChatLifetimeMinutes" | "secretChatTitle" | "secretChatCodeword">;
    account: Pick<ChatPageStateModel["account"], "selfId">;
    panels: Pick<ChatPageStateModel["panels"], "setDesktopDetailsPanelOpen">;

  };
  readonly callbacks: Pick<ChatPageCallbacks, "openChannelModal" | "openGroupModal" | "ensureCreateChatContacts">;
  readonly bootstrap: Pick<ChatBootstrapModel, "loadSecretChatsRef">;
}

/** Creates render-snapshot callbacks without reading models during construction. */
export function createSecretChatCallbacks(sources: SecretChatCallbackSources): Pick<ChatPageCallbacks, "savePublicLinkChange" | "acceptSecretChat" | "declineSecretChat" | "openSecretChatFromProfile" | "openSecretChatCreate" | "submitCreateSecretChat"> {
  async function savePublicLinkChange(): ReturnType<ChatPageCallbacks["savePublicLinkChange"]> {
    const { setErrorText, t } = sources.page;
    const { linkEditorTarget, linkEditorValue, linkEditorSaving, linkEditorStatus, setLinkEditorTarget, setLinkEditorSaving } = sources.page.profileNavigation;
    const { selectedLink, setSelectedLink } = sources.page.selection;
    const { openChannelModal, openGroupModal } = sources.callbacks;

    return savePublicLinkChangeAction({ linkEditorTarget, linkEditorValue, linkEditorSaving, linkEditorStatus, setLinkEditorTarget, setLinkEditorSaving, openChannelModal, selectedLink, setSelectedLink, openGroupModal, setErrorText, t });
  }

  async function acceptSecretChat(): ReturnType<ChatPageCallbacks["acceptSecretChat"]> {
    const { t } = sources.page;
    const { activeConversation, setActiveConversation, setChats } = sources.page.conversation;
    const { setAcceptingSecretChat, setSecretChatExpiresAt } = sources.page.secretChatDraft;
    const { selfId } = sources.page.account;
    const { loadSecretChatsRef } = sources.bootstrap;

    return acceptSecretChatAction({ activeConversation, setAcceptingSecretChat, selfId, t, setActiveConversation, setSecretChatExpiresAt, setChats, loadSecretChatsRef });
  }

  async function declineSecretChat(): ReturnType<ChatPageCallbacks["declineSecretChat"]> {
    const { t } = sources.page;
    const { activeConversation, setActiveConversation, setMessages, setChats } = sources.page.conversation;
    const { setSelectedLink } = sources.page.selection;
    const { loadSecretChatsRef } = sources.bootstrap;

    return declineSecretChatAction({ activeConversation, t, setSelectedLink, setActiveConversation, setMessages, setChats, loadSecretChatsRef });
  }

  async function openSecretChatFromProfile(): ReturnType<ChatPageCallbacks["openSecretChatFromProfile"]> {
    const { profileData, profileIsBot, profileIsSaved, secretChatCheckPendingRef, profileDataRef, contactDraftDisplayName, t } = sources.page;
    const { setProfileMoreOpen, setProfileSubView } = sources.page.profileNavigation;
    const { chats } = sources.page.conversation;
    const { setSecretChatSelectedUserIds, setSecretChatTitle, setSecretChatLifetimePreset, setSecretChatLifetimeDays, setSecretChatLifetimeHours, setSecretChatLifetimeMinutes, setSecretChatCodeword } = sources.page.secretChatDraft;

    return openSecretChatFromProfileAction({ setProfileMoreOpen, profileData, profileIsBot, profileIsSaved, secretChatCheckPendingRef, chats, profileDataRef, setSecretChatSelectedUserIds, setSecretChatTitle, contactDraftDisplayName, setSecretChatLifetimePreset, setSecretChatLifetimeDays, setSecretChatLifetimeHours, setSecretChatLifetimeMinutes, setSecretChatCodeword, setProfileSubView, t });
  }

  function openSecretChatCreate(): ReturnType<ChatPageCallbacks["openSecretChatCreate"]> {
    const { setChatListMenuOpen } = sources.page;
    const { setSecretChatCreateOpen, setSecretChatCreateStep, setSecretChatTitle, setSecretChatSearchQuery, setSecretChatSelectedUserIds, setSecretChatLifetimeDays, setSecretChatLifetimeHours, setSecretChatLifetimeMinutes, setSecretChatLifetimePreset, setSecretChatCreating } = sources.page.secretChatDraft;
    const { ensureCreateChatContacts } = sources.callbacks;

    setChatListMenuOpen(false);
    setSecretChatCreateOpen(true);
    setSecretChatCreateStep("members");
    setSecretChatTitle("");
    setSecretChatSearchQuery("");
    setSecretChatSelectedUserIds(new Set());
    setSecretChatLifetimeDays(0);
    setSecretChatLifetimeHours(1);
    setSecretChatLifetimeMinutes(0);
    setSecretChatLifetimePreset('1h');
    setSecretChatCreating(false);
    void ensureCreateChatContacts(true);
  }

  async function submitCreateSecretChat(): ReturnType<ChatPageCallbacks["submitCreateSecretChat"]> {
    const { setErrorText, t, setProfileModalOpen } = sources.page;
    const { secretChatCreating, secretChatSelectedUserIds, secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, setSecretChatCreating, secretChatTitle, secretChatCodeword, setSecretChatCodeword, setSecretChatExpiresAt, setSecretChatCreateOpen } = sources.page.secretChatDraft;
    const { chats, setChats, setActiveConversation, setMessages } = sources.page.conversation;
    const { selfId } = sources.page.account;
    const { setProfileSubView } = sources.page.profileNavigation;
    const { setDesktopDetailsPanelOpen } = sources.page.panels;
    const { setSelectedLink } = sources.page.selection;

    return submitCreateSecretChatAction({ secretChatCreating, secretChatSelectedUserIds, setErrorText, t, chats, secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, setSecretChatCreating, selfId, secretChatTitle, secretChatCodeword, setSecretChatCodeword, setChats, setSecretChatExpiresAt, setSecretChatCreateOpen, setProfileSubView, setProfileModalOpen, setDesktopDetailsPanelOpen, setSelectedLink, setActiveConversation, setMessages });
  }

  return { savePublicLinkChange, acceptSecretChat, declineSecretChat, openSecretChatFromProfile, openSecretChatCreate, submitCreateSecretChat };
}
