"use client";

import { type ChangeEvent } from "react";

import { apiRequest } from "@/lib/client/http";

import { showAppToast } from "@/lib/client/app-toast";

import { type GroupMember, type CreateChatKind, type CreateChatStep } from "../../types";

import { splitContactAliasParts } from "../../helpers";

import { CONTACTS_FOR_ADD_CACHE_TTL_MS } from "../config";

import { HEIC_IMAGE_TYPES } from "../media-files";
import { convertHeicToJpeg } from "../media-recording";

import { openProfileModalAction, openGroupModalAction, openAddMembersModalAction, toggleCreateChatContactAction, submitCreateChatAction } from "../profile-actions";

import { saveContactAction, removeContactAction } from "../contact-actions";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { MessageEncryptionModel } from "../controllers/useMessageEncryption";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface ProfileCallbackSources {
  readonly page: Pick<ChatPageStateModel, "setProfileModalOpen" | "detailsTargetRef" | "setProfileData" | "t" | "setProfileError" | "setChatListMenuOpen" | "setErrorText" | "router" | "profileData"> & {
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "setInviteModalKind" | "setInviteModalLink" | "setInviteModalOpen" | "setGroupModalOpen" | "groupMembersReturnViewRef" | "setGroupNameEditing" | "setGroupModalError" | "setGroupSubView" | "setGroupModalData" | "setGroupNameDraft" | "setGroupDescriptionDraft" | "setGroupAvatarDraft" | "setGroupIsPublicDraft" | "setGroupLinkDraft" | "setGroupModalLoading" | "groupSubView" | "groupModalData">;
    panels: Pick<ChatPageStateModel["panels"], "setInspectedDetailsEntity" | "setDesktopDetailsPanelOpen">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "setChannelModalOpen" | "groupAddMembersReturnViewRef" | "channelSubView" | "channelAddMembersReturnViewRef" | "setChannelSubView" | "setAddMembersContactQuery" | "setAddMembersTargetKind" | "setSelectedContactIds" | "setContactsForAdd" | "setAddMembersContactsLoading" | "addingMembers" | "setAddMembersModalOpen" | "contactsForAdd" | "channelModalData">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "chats" | "setChats" | "setActiveConversation" | "setMessages">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "setProfileOpenedExternally" | "setProfileSubView" | "setProfileMoreOpen">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "setContactEditorOpen" | "setContactEditorTarget" | "setContactExists" | "setContactFirstName" | "setContactLastName" | "setContactEditorInitial" | "setContactMessage" | "contactEditorTarget" | "contactSaving" | "contactFirstName" | "contactLastName" | "setContactSaving">;
    userDetails: Pick<ChatPageStateModel["userDetails"], "setProfileActiveTab" | "setProfileLoading">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    settingsControls: Pick<ChatPageStateModel["settingsControls"], "setCreateChatContactsLoading" | "setCreateChatKind" | "setCreateChatStep" | "setCreateChatDraft" | "setCreateChatSelectedIds" | "setCreateChatContactQuery" | "createChatCreating" | "createChatKind" | "createChatDraft" | "createChatSelectedIds" | "setCreateChatCreating">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "setSelectedLink">;

  };
  readonly active: Pick<ActiveConversationModel, "activeChat">;
  readonly elements: {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "groupModalCacheRef" | "groupDetailsInFlightRef" | "contactsForAddCacheRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "openConversationRef">;

  };
  readonly bootstrap: Pick<ChatBootstrapModel, "activeGroupModalSeed">;
  readonly callbacks: Pick<ChatPageCallbacks, "uploadMediaFile">;
  readonly encryption: Pick<MessageEncryptionModel, "rotateSharedKey">;
}

/** Creates render-snapshot callbacks without reading models during construction. */
export function createProfileCallbacks(sources: ProfileCallbackSources): Pick<ChatPageCallbacks, "openInviteModal" | "showDetailsPanel" | "openProfileModal" | "openGroupModal" | "openAddMembersModal" | "closeAddMembersView" | "ensureCreateChatContacts" | "openCreateChat" | "closeCreateChat" | "pickCreateChatPhoto" | "toggleCreateChatContact" | "continueCreateChatDetails" | "submitCreateChat" | "openCommunityProfile" | "openContactEditorForMember" | "saveContact" | "removeContact"> {
  function openInviteModal(kind: "group" | "channel", link: string): ReturnType<ChatPageCallbacks["openInviteModal"]> {
    const { setInviteModalKind, setInviteModalLink, setInviteModalOpen } = sources.page.groupDetails;

    if (!link) return;
    setInviteModalKind(kind);
    setInviteModalLink(link);
    setInviteModalOpen(true);
  }

  function showDetailsPanel(kind: "direct" | "group" | "channel", link: string): ReturnType<ChatPageCallbacks["showDetailsPanel"]> {
    const { setProfileModalOpen } = sources.page;
    const { setInspectedDetailsEntity, setDesktopDetailsPanelOpen } = sources.page.panels;
    const { setGroupModalOpen } = sources.page.groupDetails;
    const { setChannelModalOpen } = sources.page.mediaAndChannel;

    const desktop = window.matchMedia("(min-width: 768px)").matches;
    setInspectedDetailsEntity(desktop ? { type: kind, link } : null);
    setDesktopDetailsPanelOpen(desktop);
    setProfileModalOpen(!desktop && kind === "direct");
    setGroupModalOpen(!desktop && kind === "group");
    setChannelModalOpen(!desktop && kind === "channel");
  }

  async function openProfileModal(link: string, external = true): ReturnType<ChatPageCallbacks["openProfileModal"]> {
    const { detailsTargetRef, setProfileData, t, setProfileError, setProfileModalOpen } = sources.page;
    const { activeConversation, chats, setChats } = sources.page.conversation;
    const { setProfileOpenedExternally, setProfileSubView, setProfileMoreOpen } = sources.page.profileNavigation;
    const { setContactEditorOpen, setContactEditorTarget, setContactExists, setContactFirstName, setContactLastName, setContactEditorInitial, setContactMessage } = sources.page.contactEditor;
    const { setProfileActiveTab, setProfileLoading } = sources.page.userDetails;
    const { selfId } = sources.page.account;
    const { setInspectedDetailsEntity, setDesktopDetailsPanelOpen } = sources.page.panels;
    const { activeChat } = sources.active;

    return openProfileModalAction({ activeConversation, activeChat, detailsTargetRef, setProfileOpenedExternally, showDetailsPanel, setContactEditorOpen, setContactEditorTarget, setProfileSubView, setProfileActiveTab, setContactExists, setContactFirstName, setContactLastName, setContactEditorInitial, setProfileData, t, setProfileLoading, setProfileError, setProfileMoreOpen, selfId, chats, setContactMessage, setInspectedDetailsEntity, setChats, setDesktopDetailsPanelOpen, setProfileModalOpen }, link, external);
  }

  async function openGroupModal(link: string, options?: { forceRefresh?: boolean }): ReturnType<ChatPageCallbacks["openGroupModal"]> {
    const { detailsTargetRef, t } = sources.page;
    const { groupMembersReturnViewRef, setGroupNameEditing, setGroupModalError, setGroupSubView, setGroupModalData, setGroupNameDraft, setGroupDescriptionDraft, setGroupAvatarDraft, setGroupIsPublicDraft, setGroupLinkDraft, setGroupModalLoading } = sources.page.groupDetails;
    const { setContactEditorOpen, setContactMessage } = sources.page.contactEditor;
    const { setProfileActiveTab } = sources.page.userDetails;
    const { chats } = sources.page.conversation;
    const { groupModalCacheRef, groupDetailsInFlightRef } = sources.elements.conversationElement;
    const { activeGroupModalSeed } = sources.bootstrap;

    return openGroupModalAction({ detailsTargetRef, groupMembersReturnViewRef, showDetailsPanel, setGroupNameEditing, setContactEditorOpen, setGroupModalError, setContactMessage, setGroupSubView, setProfileActiveTab, groupModalCacheRef, activeGroupModalSeed, chats, setGroupModalData, setGroupNameDraft, setGroupDescriptionDraft, setGroupAvatarDraft, setGroupIsPublicDraft, setGroupLinkDraft, setGroupModalLoading, groupDetailsInFlightRef, t }, link, options);
  }

  async function openAddMembersModal(kind: "group" | "channel" = "group"): ReturnType<ChatPageCallbacks["openAddMembersModal"]> {
    const { groupSubView, setGroupSubView } = sources.page.groupDetails;
    const { groupAddMembersReturnViewRef, channelSubView, channelAddMembersReturnViewRef, setChannelSubView, setAddMembersContactQuery, setAddMembersTargetKind, setSelectedContactIds, setContactsForAdd, setAddMembersContactsLoading } = sources.page.mediaAndChannel;
    const { contactsForAddCacheRef } = sources.elements.conversationElement;

    return openAddMembersModalAction({ groupSubView, groupAddMembersReturnViewRef, setGroupSubView, channelSubView, channelAddMembersReturnViewRef, setChannelSubView, setAddMembersContactQuery, setAddMembersTargetKind, setSelectedContactIds, contactsForAddCacheRef, setContactsForAdd, setAddMembersContactsLoading }, kind);
  }

  function closeAddMembersView(kind: "group" | "channel"): ReturnType<ChatPageCallbacks["closeAddMembersView"]> {
    const { addingMembers, groupAddMembersReturnViewRef, setChannelSubView, channelAddMembersReturnViewRef, setSelectedContactIds, setAddMembersContactQuery, setAddMembersModalOpen } = sources.page.mediaAndChannel;
    const { setGroupSubView } = sources.page.groupDetails;

    if (addingMembers) return;
    if (kind === "group") {
      setGroupSubView(groupAddMembersReturnViewRef.current);
    } else {
      setChannelSubView(channelAddMembersReturnViewRef.current);
    }
    setSelectedContactIds([]);
    setAddMembersContactQuery("");
    setAddMembersModalOpen(false);
  }

  async function ensureCreateChatContacts(force?: boolean): ReturnType<ChatPageCallbacks["ensureCreateChatContacts"]> {
    const { contactsForAddCacheRef } = sources.elements.conversationElement;
    const { setContactsForAdd } = sources.page.mediaAndChannel;
    const { setCreateChatContactsLoading } = sources.page.settingsControls;

    const cached = contactsForAddCacheRef.current;
    const isFresh = cached && !force ? Date.now() - cached.savedAt <= CONTACTS_FOR_ADD_CACHE_TTL_MS : false;
    if (cached) {
      setContactsForAdd(cached.contacts);
    }
    if (cached && isFresh) return;
    setCreateChatContactsLoading(true);
    try {
      const data = await apiRequest<{

        contacts: Array<{
          id: string;
          link: string;
          alias: string;
          avatarUrl?: string | null;
          displayName?: string

        }>;

      }>("/api/contacts", { method: "GET" });
      contactsForAddCacheRef.current = { savedAt: Date.now(), contacts: data.contacts };
      setContactsForAdd(data.contacts);
    } catch {
      if (!cached || !isFresh) {
        setContactsForAdd([]);
      }
    } finally {
      setCreateChatContactsLoading(false);
    }
  }

  function openCreateChat(kind: CreateChatKind): ReturnType<ChatPageCallbacks["openCreateChat"]> {
    const { setChatListMenuOpen } = sources.page;
    const { setCreateChatKind, setCreateChatStep, setCreateChatDraft, setCreateChatSelectedIds, setCreateChatContactQuery } = sources.page.settingsControls;

    setChatListMenuOpen(false);
    setCreateChatKind(kind);
    const startStep: CreateChatStep = kind === "group" ? "members" : "details";
    setCreateChatStep(startStep);
    setCreateChatDraft({
      name: "",
      link: "",
      isPublic: kind === "channel",
      photoDataUrl: null,
    });
    setCreateChatSelectedIds(new Set());
    setCreateChatContactQuery("");
    void ensureCreateChatContacts();
  }

  function closeCreateChat(): ReturnType<ChatPageCallbacks["closeCreateChat"]> {
    const { createChatCreating, setCreateChatKind, setCreateChatSelectedIds, setCreateChatContactQuery } = sources.page.settingsControls;

    if (createChatCreating) return;
    setCreateChatKind(null);
    setCreateChatSelectedIds(new Set());
    setCreateChatContactQuery("");
  }

  async function pickCreateChatPhoto(event: ChangeEvent<HTMLInputElement>): ReturnType<ChatPageCallbacks["pickCreateChatPhoto"]> {
    const { setErrorText, t } = sources.page;
    const { setCreateChatDraft } = sources.page.settingsControls;
    const { uploadMediaFile } = sources.callbacks;

    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorText(t("Выберите изображение для аватара."));
      return;
    }
    try {
      let uploadFile = file;
      if (HEIC_IMAGE_TYPES.has(uploadFile.type)) {
        uploadFile = await convertHeicToJpeg(uploadFile);
      }
      const localPreview = URL.createObjectURL(uploadFile);
      setCreateChatDraft((prev) => ({ ...prev, photoDataUrl: localPreview }));
      const uploaded = await uploadMediaFile(uploadFile, "image");
      setCreateChatDraft((prev) => ({ ...prev, photoDataUrl: uploaded.url }));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("Не удалось загрузить фото."));
    }
  }

  function toggleCreateChatContact(id: string): ReturnType<ChatPageCallbacks["toggleCreateChatContact"]> {
    const { t } = sources.page;
    const { setCreateChatSelectedIds, createChatKind, setCreateChatDraft } = sources.page.settingsControls;
    const { contactsForAdd } = sources.page.mediaAndChannel;
    const { selfProfile } = sources.page.account;

    return toggleCreateChatContactAction({ setCreateChatSelectedIds, createChatKind, contactsForAdd, selfProfile, t, setCreateChatDraft }, id);
  }

  function continueCreateChatDetails(): ReturnType<ChatPageCallbacks["continueCreateChatDetails"]> {
    const { setErrorText, t } = sources.page;
    const { createChatKind, createChatDraft, setCreateChatDraft, setCreateChatContactQuery, setCreateChatStep } = sources.page.settingsControls;

    if (!createChatKind) return;
    const normalizedName = createChatDraft.name.trim();
    const normalizedLink = createChatDraft.link.trim().replace(/^@+/, "").toLowerCase();
    const isLinkValid = /^[a-z][a-z0-9_]{3,30}[a-z0-9]$/.test(normalizedLink);
    if (normalizedName.length < 2 || (createChatDraft.isPublic && !isLinkValid)) {
      setErrorText(
        createChatDraft.isPublic
          ? t("Введите название и корректное уникальное имя.")
          : t("Введите название."),
      );
      return;
    }
    setCreateChatDraft((prev) => ({ ...prev, name: normalizedName, link: normalizedLink }));
    setCreateChatContactQuery("");
    setCreateChatStep("members");
    void ensureCreateChatContacts();
  }

  async function submitCreateChat(): ReturnType<ChatPageCallbacks["submitCreateChat"]> {
    const { setErrorText, t, router } = sources.page;
    const { createChatKind, createChatCreating, createChatDraft, setCreateChatStep, createChatSelectedIds, setCreateChatCreating, setCreateChatKind, setCreateChatSelectedIds, setCreateChatContactQuery } = sources.page.settingsControls;
    const { setChats, setActiveConversation, setMessages } = sources.page.conversation;
    const { selectedLinkRef, setSelectedLink } = sources.page.selection;
    const { rotateSharedKey } = sources.encryption;
    const { openConversationRef } = sources.elements.conversationRequest;

    return submitCreateChatAction({ createChatKind, createChatCreating, createChatDraft, setErrorText, t, setCreateChatStep, createChatSelectedIds, setCreateChatCreating, rotateSharedKey, setChats, setCreateChatKind, setCreateChatSelectedIds, setCreateChatContactQuery, setActiveConversation, setMessages, selectedLinkRef, setSelectedLink, router, openConversationRef });
  }

  function openCommunityProfile(member: {
    id: string;
    link: string

  }): ReturnType<ChatPageCallbacks["openCommunityProfile"]> {
    const { t } = sources.page;
    const { selfId } = sources.page.account;

    if (member.id === selfId) {
      showAppToast({ title: t("Это вы"), type: "info" });
      return;
    }
    if (member.link) void openProfileModal(member.link);
  }

  function openContactEditorForMember(member: GroupMember): ReturnType<ChatPageCallbacks["openContactEditorForMember"]> {
    const { t } = sources.page;
    const { selfId } = sources.page.account;
    const { setContactEditorTarget, setContactFirstName, setContactLastName, setContactEditorInitial, setContactExists, setContactMessage } = sources.page.contactEditor;
    const { setProfileSubView } = sources.page.profileNavigation;

    if (member.id === selfId) {
      showAppToast({ title: t("Это вы"), type: "info" });
      return;
    }
    setContactEditorTarget({ link: member.link, displayName: member.displayName, avatarUrl: member.avatarUrl ?? null });
    const draftParts = splitContactAliasParts(member.contactAlias ?? member.displayName);
    setContactFirstName(draftParts.firstName);
    setContactLastName(draftParts.lastName);
    setContactEditorInitial({
      firstName: draftParts.firstName.trim(),
      lastName: draftParts.lastName.trim(),
    });
    setContactExists(Boolean(member.isContact));
    setContactMessage(null);
    void openProfileModal(member.link);
    setProfileSubView("contact_editor");
  }

  async function saveContact(): ReturnType<ChatPageCallbacks["saveContact"]> {
    const { t, profileData } = sources.page;
    const { contactEditorTarget, contactSaving, contactFirstName, contactLastName, setContactMessage, setContactSaving, setContactExists, setContactEditorOpen } = sources.page.contactEditor;
    const { chats, activeConversation, setChats, setActiveConversation } = sources.page.conversation;
    const { groupModalData, setGroupModalData } = sources.page.groupDetails;
    const { selfId } = sources.page.account;
    const { channelModalData, contactsForAdd, setContactsForAdd } = sources.page.mediaAndChannel;
    const { groupModalCacheRef, contactsForAddCacheRef } = sources.elements.conversationElement;

    return saveContactAction({ contactEditorTarget, contactSaving, contactFirstName, contactLastName, setContactMessage, t, chats, activeConversation, groupModalData, selfId, profileData, setChats, setActiveConversation, setGroupModalData, groupModalCacheRef, channelModalData, contactsForAdd, setContactsForAdd, contactsForAddCacheRef, setContactSaving, setContactExists, setContactEditorOpen, openGroupModal });
  }

  async function removeContact(): ReturnType<ChatPageCallbacks["removeContact"]> {
    const { profileData, t } = sources.page;
    const { contactEditorTarget, contactSaving, setContactExists, setContactFirstName, setContactLastName, setContactSaving, setContactMessage, setContactEditorOpen } = sources.page.contactEditor;
    const { chats, activeConversation, setChats, setActiveConversation } = sources.page.conversation;
    const { groupModalData, setGroupModalData } = sources.page.groupDetails;
    const { selfId } = sources.page.account;
    const { setContactsForAdd } = sources.page.mediaAndChannel;
    const { groupModalCacheRef, contactsForAddCacheRef } = sources.elements.conversationElement;

    return removeContactAction({ contactEditorTarget, contactSaving, chats, activeConversation, groupModalData, selfId, profileData, setContactExists, setContactFirstName, setContactLastName, setChats, setActiveConversation, setGroupModalData, groupModalCacheRef, setContactsForAdd, contactsForAddCacheRef, setContactSaving, setContactMessage, t, setContactEditorOpen, openGroupModal });
  }

  return { openInviteModal, showDetailsPanel, openProfileModal, openGroupModal, openAddMembersModal, closeAddMembersView, ensureCreateChatContacts, openCreateChat, closeCreateChat, pickCreateChatPhoto, toggleCreateChatContact, continueCreateChatDetails, submitCreateChat, openCommunityProfile, openContactEditorForMember, saveContact, removeContact };
}
