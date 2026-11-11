

export interface ChatPageCallbacks {
  savePublicLinkChange: () => Promise<void>;
  acceptSecretChat: () => Promise<void>;
  declineSecretChat: () => Promise<void>;
  openSecretChatFromProfile: () => Promise<void>;
  openSecretChatCreate: () => void;
  submitCreateSecretChat: () => Promise<void>;
  sendReadReceipt: (link: string, chatType: import("@/app/app/(chats)/types").ConversationChatType, messageIds: string[]) => Promise<void>;
  processPickedFiles: (files: File[]) => Promise<void>;
  onPickMedia: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  startActiveBot: () => Promise<boolean>;
  sendMessage: () => Promise<void>;
  sendWelcomeSticker: () => Promise<void>;
  sendStickerFromPicker: (src: string, emoji?: string | undefined) => Promise<void>;
  sendPollMessage: (question: string, options: string[], quizMode: boolean, correctOptionIndex: number | null, expiresInHours: number | null) => Promise<void>;
  openForwardAuthorProfile: (author: import("@/lib/client/message-forwarding").ForwardAuthor) => void;
  beginForwardMessages: (source: import("@/app/app/(chats)/types").DecryptedMessage[]) => void;
  chooseForwardRecipient: (recipient: import("@/app/app/(chats)/components/common/ForwardRecipientPicker").ForwardRecipient) => void;
  deleteMessage: (messageId: string) => Promise<void>;
  buildEditTarget: (message: import("@/app/app/(chats)/types").DecryptedMessage, parsed: import("@/app/app/(chats)/types").ParsedMessageContent) => import("@/app/app/(chats)/types").EditTarget | null;
  beginEditMessage: (message: import("@/app/app/(chats)/types").DecryptedMessage, parsed: import("@/app/app/(chats)/types").ParsedMessageContent) => void;
  cancelEditMode: () => void;
  isEditDraftValid: (target: import("@/app/app/(chats)/types").EditTarget | null, draft: string) => boolean;
  saveEditedMessage: () => Promise<void>;
  copyMessageText: (value: string) => Promise<void>;
  openInviteModal: (kind: "group" | "channel", link: string) => void;
  showDetailsPanel: (kind: "direct" | "group" | "channel", link: string) => void;
  openProfileModal: (link: string, external?: boolean) => Promise<void>;
  openGroupModal: (link: string, options?: {
    forceRefresh?: boolean | undefined;

  } | undefined) => Promise<void>;
  openAddMembersModal: (kind?: "group" | "channel") => Promise<void>;
  closeAddMembersView: (kind: "group" | "channel") => void;
  ensureCreateChatContacts: (force?: boolean | undefined) => Promise<void>;
  openCreateChat: (kind: import("@/app/app/(chats)/types").CreateChatKind) => void;
  closeCreateChat: () => void;
  pickCreateChatPhoto: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  toggleCreateChatContact: (id: string) => void;
  continueCreateChatDetails: () => void;
  submitCreateChat: () => Promise<void>;
  openCommunityProfile: (member: {
    id: string;
    link: string;

  }) => void;
  openContactEditorForMember: (member: import("@/app/app/(chats)/types").GroupMember) => void;
  saveContact: () => Promise<void>;
  removeContact: () => Promise<void>;
  addMembersToGroup: () => Promise<void>;
  addSubscribersToChannel: () => Promise<void>;
  submitAddCommunityMembers: () => void;
  onGroupAvatarSelected: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  onChannelAvatarSelected: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  openChannelModal: (link: string, options?: {
    forceRefresh?: boolean | undefined;

  } | undefined) => Promise<void>;
  subscribeToActiveChannel: () => Promise<void>;
  joinActiveGroup: () => Promise<void>;
  saveChannelSettings: () => Promise<void>;
  leaveChannel: () => Promise<void>;
  deleteChannel: () => Promise<void>;
  confirmChannelDangerAction: () => Promise<void>;
  saveGroupSettings: () => Promise<void>;
  removeMemberFromGroup: (memberId: string) => Promise<void>;
  removeSubscriberFromChannel: (memberId: string) => Promise<void>;
  openRoleEditor: (member: any, kind?: "group" | "channel") => void;
  saveMemberRole: () => Promise<void>;
  leaveGroup: () => Promise<void>;
  deleteGroup: () => Promise<void>;
  confirmGroupDangerAction: () => Promise<void>;
  openActiveDetails: () => void;
  memberLongPress: (member: any, kind: "group" | "channel") => React.HTMLAttributes<HTMLDivElement>;
  uploadChatMediaFile: (file: Blob, kind: "image" | "voice" | "video" | "file" | "video_note" | "audio", durationMs?: number | undefined) => Promise<{
    id: string;
    url: string;
    expiresAt?: string | null | undefined;

  }>;
  uploadMediaFile: (file: Blob, kind: "image" | "voice" | "video" | "file" | "video_note" | "audio", durationMs?: number | undefined, scope?: {
    scopeType: string;
    scopeId: string;
    bot?: boolean | undefined;

  } | undefined) => Promise<{
    id: string;
    url: string;
    expiresAt?: string | null | undefined;

  }>;
  prepareStoryDraft: (file: File, mediaType: "image" | "video", recordedDurationMs?: number | undefined) => Promise<void>;
  createStoryFromSelection: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  submitStoryDraft: (editedDraft?: import("@/app/app/(chats)/types").StoryDraft | undefined) => Promise<void>;
  toggleChatListMenuFromButton: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  renderCommunitySettings: (kind: "group" | "channel") => React.JSX.Element | null;
  openCommunityReactions: (kind: "group" | "channel") => void;
  saveCommunityReactions: (kind: "group" | "channel") => Promise<void>;
  renderCommunityReactions: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  renderCommunityType: (kind: "group" | "channel", mobile: boolean) => React.JSX.Element;
  openCommunityType: (kind: "group" | "channel") => void;
  saveCommunityType: (kind: "group" | "channel") => Promise<void>;
}
