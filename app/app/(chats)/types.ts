import type { ReactionPolicy } from "@/lib/reaction-policy";
import type { BotReplyMarkup } from "@/lib/bot-api";
import type { CSSProperties, ReactNode } from "react";
import type { EclipseSystemPayload } from "@/lib/eclipse-system";
import type { LiveBackgroundNeatPreset, LiveBackgroundSettings } from "@/lib/client/live-background";
import type { StoryOverlay, StoryMediaTransform, StoryOverlayStroke, StoryOverlayTextLayer } from "@/lib/story-overlay";
import type { E2EIdentity } from "@/lib/client/e2e";

// Re-export imported types so other files can import them from this central hub
export type {
  EclipseSystemPayload,
  LiveBackgroundNeatPreset,
  LiveBackgroundSettings,
  StoryOverlay,
  StoryMediaTransform,
  StoryOverlayStroke,
  StoryOverlayTextLayer,
  E2EIdentity
};

export type ConversationChatType = "direct" | "group" | "channel" | "saved" | "eclipse";

export type ChatSummary = {
  lastMessageIsService?: boolean;
  contactAlias?: string | null;
  canSendMessages?: boolean;
  isBot?: boolean;
  secondaryLinks?: string[];
  chatType?: ConversationChatType;
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  avatarUrl?: string | null;
  membersCount?: string;
  subscribersCount?: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  contactTag?: string | null;
  contactTagVariant?: "default" | "secondary" | "destructive" | "outline";
  lastMessageCipherText?: string | null;
  lastMessageIv?: string | null;
  lastMessageEncryptedKey?: string | null;
  lastMessageKeyVersion?: number | null;
  lastMessageSenderId?: string | null;
  lastMessageSenderAlias?: string | null;
  peerReadAt?: string | null;
  unreadCount?: number;
  isGroupOwner?: boolean;
  isSystem?: boolean;
  isVerified?: boolean;
  statusText?: string;
  systemPayload?: any;
  isTemporary?: boolean;
  isCreator?: boolean;
  isApproved?: boolean;
  ownerId?: string;
  isChannelOwner?: boolean;
  creatorId?: string | null;
  expiresAt?: string | null;
  wallpaperUrl?: string | null;
  wallpaperPosY?: number | null;
};

export type ChatSearchScope = "all" | "chats" | "users" | "groups" | "channels";

export type ChatSearchUser = {
  isBot?: boolean;
  id: string;
  link: string;
  secondaryLinks?: string[];
  displayName: string;
  avatarUrl?: string | null;
};

export type ChatSearchGroup = {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
  membersCount?: string;
};

export type ChatSearchChannel = {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
  subscribersCount?: string;
};

export type ChatSearchSaved = {
  id: string;
  link: string;
  title: string;
  avatarUrl?: string | null;
};

export type ChatSearchEclipse = {
  id: string;
  link: string;
  title: string;
  avatarUrl?: string | null;
  isSystem: true;
  isVerified: true;
};

export type ChatSearchResponse = {
  users: ChatSearchUser[];
  groups: ChatSearchGroup[];
  channels: ChatSearchChannel[];
  saved?: ChatSearchSaved[];
  eclipse?: ChatSearchEclipse[];
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
  avatarUrl?: string | null;
};

export type MessageReadViewer = {
  id: string;
  link: string;
  displayName: string;
  avatarUrl?: string | null;
  readAt: string;
};

export type EncryptedMessage = {
  botReplyMarkup?: BotReplyMarkup;
  id: string;
  senderId: string;
  text?: string | null;
  cipherText: string;
  iv: string;
  encryptedKey: string;
  replyToMessageId?: string | null;
  createdAt: string;
  reactions?: ReactionSummary[];
};

export type GroupMessagePayload = {
  id: string;
  senderId: string;
  text?: string | null;
  cipherText?: string | null;
  iv?: string | null;
  keyVersion?: number | null;
  replyToMessageId?: string | null;
  createdAt: string;
  senderDisplayName?: string;
  reactions?: ReactionSummary[];
  readBy?: MessageReadViewer[];
};

export type ChannelMessagePayload = {
  id: string;
  senderId: string;
  text?: string | null;
  cipherText?: string | null;
  iv?: string | null;
  keyVersion?: number | null;
  replyToMessageId?: string | null;
  createdAt: string;
  viewsCount: string;
  reactions?: ReactionSummary[];
};

export type DecryptedMessage = {
  botReplyMarkup?: BotReplyMarkup;
  id: string;
  localId?: string;
  senderId: string;
  text: string;
  systemPayload?: EclipseSystemPayload;
  replyToMessageId?: string | null;
  createdAt: string;
  senderDisplayName?: string;
  viewsCount?: string;
  reactions?: ReactionSummary[];
  readBy?: MessageReadViewer[];
  pending?: boolean;
};

export type SelfProfile = {
  emojiStatusId?: string | null;
  id: string;
  link: string;
  displayName: string;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  musicUrl?: string | null;
  musicTitle?: string | null;
  musicAuthor?: string | null;
  musicCoverUrl?: string | null;
  email?: string | null;
  description?: string | null;
  presenceVisibility?: "all" | "none";
  lastSeenVisibility?: "all" | "none";
  usernameHidden?: boolean;
  secondaryLinks?: string[];
};

export type SettingsPanelView = "main" | "edit" | "privacy" | "security" | "security-totp" | "security-password" | "chats" | "sessions" | "qr" | "scan-qr" | "storage" | "custom-theme" | "language";

export type SettingsProfileDetails = SelfProfile & {
  description?: string | null;
  musicUrl?: string | null;
  musicTitle?: string | null;
  musicAuthor?: string | null;
  musicCoverUrl?: string | null;
};

export type SettingsEditDraft = {
  displayName: string;
  link: string;
  description: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  musicUrl: string | null;
  musicTitle: string;
  musicAuthor: string;
  musicCoverUrl: string | null;
  usernameHidden?: boolean;
};

export type SettingsPrivacyUser = {
  id: string;
  displayName: string;
  link: string;
  avatarUrl: string | null;
};

export type SettingsPrivacyState = {
  onlineVisibility: "all" | "contacts" | "none";
  lastSeenVisibility: "all" | "contacts" | "none";
  showTyping: boolean;
  showMediaActivity: boolean;
  showReadReceipts: boolean;
  allowUsernameSearch: boolean;
  showInGlobalSearch: boolean;
  allowProfileLink: boolean;
  allowGroupAdd: boolean;
  firstMessagePolicy: "all" | "contacts" | "none";
  newChatAutoDeleteDays: 1 | 7 | 30 | null;
  autoDeleteReadMessages: boolean;
  hideUsername: boolean;
  presenceExceptionUserIds: string[];
  presenceExceptionUsers?: SettingsPrivacyUser[];
};

export type SettingsPrivacyDetail =
  | "onlineVisibility"
  | "lastSeenVisibility"
  | "lastSeenExceptions"
  | "showTyping"
  | "showMediaActivity"
  | "showReadReceipts"
  | "allowUsernameSearch"
  | "showInGlobalSearch"
  | "allowProfileLink"
  | "allowGroupAdd"
  | "firstMessagePolicy"
  | "newChatAutoDeleteDays"
  | "autoDeleteReadMessages";

export type SettingsSessionItem = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string | null;
};

export type AppBootstrapResponse = {
  sessionId?: string | null;
  me: SelfProfile;
  chats?: ChatSummary[];
  hasMoreChats?: boolean;
  chatsCursor?: string | null;
  stories?: StoryFeedGroup[];
};

export type StoryFeedItem = {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  durationMs?: number | null;
  caption: string | null;
  overlay?: StoryOverlay | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
  isMine: boolean;
  viewsCount: number;
  viewersPreview: StoryViewerItem[];
  likedByMe: boolean;
  likesCount: number;
};

export type StoryViewerItem = {
  id: string;
  link: string;
  displayName: string;
  avatarUrl?: string | null;
  viewedAt: string;
  liked?: boolean;
};

export type StoryViewerStats = {
  storyId: string;
  viewsCount: number;
  viewers: StoryViewerItem[];
};

export type StoryReplyTarget = {
  storyId: string;
  chatLink?: string;
  authorName: string;
  previewText: string;
  isOwn: boolean;
};

export type StoryFeedGroup = {
  author: {
    id: string;
    link: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  hasUnviewed: boolean;
  stories: StoryFeedItem[];
};

export type StoryDraft = {
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
  durationMs: number;
  caption: string;
  ttlHours: 6 | 12 | 24 | 48;
  overlay: StoryOverlay;
};

export type StoryOverlayTool = "none" | "draw";

export type EclipseSystemMessagePayload = {
  id: string;
  senderId: string;
  senderType: "system";
  systemPayload: EclipseSystemPayload;
  createdAt: string;
  reactions?: ReactionSummary[];
};

export type ConversationResponse = {
  secretCrypto?: { version: number; ownKeyId: string | null; ownPublicKey: string | null };
  chatType?: ConversationChatType;
  conversationId: string | null;
  expiresAt?: string;
  readReceiptAt?: string | null;
  hasMoreBefore?: boolean;
  isApproved?: boolean;
  isCreator?: boolean;
  creatorId?: string;
  wallpaperUrl?: string | null;
  wallpaperPosY?: number | null;
  saved?: {
    id: string;
    link: string;
    title: string;
    avatarUrl?: string | null;
  };
  eclipse?: {
    id: string;
    link: string;
    title: string;
    avatarUrl?: string | null;
    isSystem: true;
    isVerified: true;
    statusText: string;
  };
  peer?: {
    contactAlias?: string | null;
    isBot?: boolean;
    id: string;
    link: string;
    secondaryLinks?: string[];
    displayName: string;
    avatarUrl?: string | null;
    publicKey: string | null;
  };
  group?: ReactionPolicy & {
    id: string;
    link: string;
    name: string;
    avatarUrl?: string | null;
    ownerId?: string;
    myRole?: string;
    myCanChangeReactions?: boolean;
    myCanPinMessages?: boolean;
    createdAt?: string;
    myJoinedAt?: string;
  };
  channel?: ReactionPolicy & {
    id: string;
    link: string;
    name: string;
    avatarUrl?: string | null;
    ownerId: string;
    isOwner?: boolean;
    isSubscribed: boolean;
    myRole?: string;
    myRoleLabel?: string | null;
    myCanChangeAvatar?: boolean;
    myCanChangeName?: boolean;
    myCanChangeReactions?: boolean;
    myCanPinMessages?: boolean;
    myCanPostMessages?: boolean;
    myCanEditForeignMessages?: boolean;
    myCanDeleteForeignMessages?: boolean;
    myCanAddMembers?: boolean;
    myCanGenerateInviteLink?: boolean;
    myCanManageAdmins?: boolean;
    subscribersCount: string;
    createdAt?: string;
    myJoinedAt?: string | null;
  };
  members?: GroupMember[];
  messages: Array<EncryptedMessage | GroupMessagePayload | ChannelMessagePayload | EclipseSystemMessagePayload>;
};

export type GroupMember = {
  id: string;
  link: string;
  displayName: string;
  avatarUrl?: string | null;
  role?: string;
  roleLabel?: string | null;
  canChangeAvatar?: boolean;
  canChangeName?: boolean;
  canChangeReactions?: boolean;
  canPinMessages?: boolean;
  canDeleteForeignMessages?: boolean;
  canAddMembers?: boolean;
  isContact?: boolean;
  contactAlias?: string | null;
  contactTag?: string | null;
  contactTagVariant?: "default" | "secondary" | "destructive" | "outline";
};

export type GroupModalGroup = ReactionPolicy & {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
  avatarUploadedAt?: string | null;
  description?: string | null;
  isPublic?: boolean;
  ownerId?: string;
  myRole?: string;
  myCanAddMembers?: boolean;
  myCanChangeName?: boolean;
  myCanChangeReactions?: boolean;
  myCanPinMessages?: boolean;
  myCanChangeAvatar?: boolean;
  myCanManageAdmins?: boolean;
  myCanGenerateInviteLink?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type GroupModalData = {
  group: GroupModalGroup;
  members: GroupMember[];
};

export type ChannelModalData = {
  channel: ReactionPolicy & {
    id: string;
    link: string;
    name: string;
    avatarUrl?: string | null;
    avatarUploadedAt?: string | null;
    ownerId: string;
    isOwner: boolean;
    isSubscribed: boolean;
    subscribersCount: string;
    description?: string | null;
    isPublic?: boolean;
    myRole?: string;
    myRoleLabel?: string | null;
    myCanChangeAvatar?: boolean;
    myCanChangeName?: boolean;
    myCanChangeReactions?: boolean;
    myCanPinMessages?: boolean;
    myCanPostMessages?: boolean;
    myCanEditForeignMessages?: boolean;
    myCanDeleteForeignMessages?: boolean;
    myCanAddMembers?: boolean;
    myCanGenerateInviteLink?: boolean;
    myCanManageAdmins?: boolean;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  };
  members?: any[];
  subscribers?: any[];
};

export type ProfilePreview = {
  isBot?: boolean;
  id: string;
  link: string;
  displayName: string;
  description: string | null;
  avatarUrl?: string | null;
  avatarUploadedAt?: string | null;
  backgroundUrl?: string | null;
  presenceVisibility?: "all" | "none";
  lastSeenVisibility?: "all" | "none";
  usernameHidden?: boolean;
  musicUrl?: string | null;
  musicTitle?: string | null;
  musicAuthor?: string | null;
  musicCoverUrl?: string | null;
  secondaryLinks?: string[];
  createdAt: string;
  updatedAt?: string;
};

export type ProfileBatchItem = {
  id: string;
  link: string;
  secondaryLinks?: string[];
  displayName: string;
  avatarUrl?: string | null;
  presenceVisibility?: "all" | "none";
  lastSeenVisibility?: "all" | "none";
  usernameHidden?: boolean;
  createdAt?: string;
};

export type PendingVideoPayload = {
  previewUrl: string;
  file: File;
  durationMs: number;
};

export type PendingImagePayload = {
  previewUrl: string;
  file: File;
};

export type PendingAlbumItem = {
  previewUrl: string;
  file: File;
  kind: "image" | "video";
  durationMs?: number;
};

export type PendingAudioPayload = {
  file: File;
  durationMs: number;
  name: string;
  title?: string;
  author?: string;
  cover?: Blob;
};

export type PendingFilePayload = {
  file: File;
  name: string;
  size: number;
  mimeType: string;
};

export type ChatImageGalleryItem = {
  src: string;
  caption: string;
  timeText: string;
  dateText: string;
  messageId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorLink?: string | null;
  isMine?: boolean;
  canDelete: boolean;
};

export type ContactResponse = {
  exists: boolean;
  contact: {
    alias: string;
    updatedAt: string;
  } | null;
};

export type RealtimeMessagePayload = {
  chatType?: ConversationChatType;
  id: string;
  senderId: string;
  fromLink: string;
  groupLink?: string;
  fromDisplayName?: string;
  cipherText?: string | null;
  iv?: string | null;
  encryptedKey?: string | null;
  keyVersion?: number | null;
  text?: string | null;
  systemPayload?: EclipseSystemPayload;
  replyToMessageId?: string | null;
  viewsCount?: string | null;
  createdAt: string;
  reactions?: ReactionSummary[];
};

export type RealtimeMessageEditedPayload = {
  chatType?: ConversationChatType;
  id: string;
  senderId: string;
  fromLink: string;
  groupLink?: string;
  fromDisplayName?: string;
  cipherText?: string | null;
  iv?: string | null;
  encryptedKey?: string | null;
  keyVersion?: number | null;
  text?: string | null;
  isSystemMessage?: boolean;
  systemPayload?: EclipseSystemPayload;
  replyToMessageId?: string | null;
  viewsCount?: string | null;
  createdAt: string;
};

export type RealtimeTypingPayload = {
  chatType?: ConversationChatType;
  fromUserId: string;
  fromLink: string;
  fromDisplayName?: string;
  groupLink?: string;
  isTyping: boolean;
  at: string;
};

export type RealtimeRecordingPayload = {
  chatType?: ConversationChatType;
  fromUserId: string;
  fromLink: string;
  fromDisplayName?: string;
  groupLink?: string;
  mode: "voice" | "video";
  isRecording: boolean;
  at: string;
};

export type RealtimeSendingPayload = {
  chatType?: ConversationChatType;
  fromUserId: string;
  fromLink: string;
  fromDisplayName?: string;
  groupLink?: string;
  kind: "image" | "video" | "music" | "file" | "voice" | "video_note";
  isSending: boolean;
  at: string;
};

export type RealtimeMessageDeletedPayload = {
  chatType?: ConversationChatType;
  id: string;
  fromUserId: string;
  fromLink: string;
  groupLink?: string;
};

export type RealtimeGroupAddedPayload = {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  previewText?: string;
};

export type RealtimeChannelAddedPayload = {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  previewText?: string;
};

export type RealtimeGroupUpdatedPayload = ReactionPolicy & {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
  ownerId?: string;
};

export type RealtimeChannelUpdatedPayload = ReactionPolicy & {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
};

export type RealtimeMessageReadPayload = {
  chatType?: "direct" | "group";
  fromUserId: string;
  fromLink: string;
  fromDisplayName?: string;
  fromAvatarUrl?: string | null;
  groupLink?: string;
  messageIds: string[];
  at: string;
};

export type RealtimeReactionPayload = {
  chatType?: ConversationChatType;
  messageId: string;
  reactions: ReactionSummary[];
  groupLink?: string;
  fromUserId?: string;
};

export type RealtimeChatDeletedPayload = {
  chatType?: "direct";
  fromUserId: string;
  fromLink: string;
};

export type ChatUiSettings = {
  animateMessages: boolean;
  sendOnEnter: boolean;
  autoFollowLatest: boolean;
};

export type CreateChatKind = "group" | "channel";
export type CreateChatStep = "intro" | "details" | "settings" | "members";
export type CreateChatDraft = {
  name: string;
  link: string;
  isPublic: boolean;
  photoDataUrl: string | null;
  description?: string;
};

export type EditTarget = {
  id: string;
  kind: "text" | "image" | "video" | "music" | "file";
  src?: string;
  durationMs?: number;
  mode?: "note" | "file";
  url?: string;
  title?: string;
  author?: string;
  coverUrl?: string;
  name?: string;
  size?: number;
  mimeType?: string;
};

export type PusherFactory = new (
  key: string,
  options: Record<string, unknown>,
) => {
  subscribe: (name: string) => {
    bind: (eventName: string, callback: (payload: unknown) => void) => void;
    members?: { each: (fn: (member: { id: string }) => void) => void };
  };
  disconnect: () => void;
  connection?: { state?: string };
};

export type ParsedMessageContent =
  | { kind: "text"; text: string; isSingleEmoji?: boolean; isOnlyEmojis?: boolean; emojiCount?: number }
  | { kind: "story_reply"; text: string; authorName: string; storyId?: string; previewText?: string; isOwn?: boolean }
  | { kind: "image"; src: string; caption: string }
  | { kind: "poll"; question: string; options: string[]; quizMode: boolean; correctOptionIndex: number | null; expiresAt: string | null }
  | { kind: "album"; items: Array<{ src: string; kind: "image" | "video"; durationMs?: number; mode?: string }>; caption: string }
  | { kind: "sticker"; src: string; source?: "greeting_button" | "picker"; emoji?: string }
  | { kind: "voice"; src: string; durationMs: number; waveform?: number[] }
  | { kind: "video"; src: string; durationMs: number; caption: string; mode: "note" | "file" }
  | { kind: "file"; src: string; name: string; size: number; mimeType: string; caption: string }
  | { kind: "music"; url: string; title: string; caption: string; author?: string; coverUrl?: string; durationMs?: number };

export type MessageTextSegment =
  | { kind: "text"; text: string }
  | { kind: "url"; text: string; url: string };

export type ChatListPreviewMeta = {
  kind: "image" | "album" | "music" | "video" | "video_note" | "voice" | "sticker" | "file" | "poll" | "text";
  text: string;
  thumbUrl?: string | null;
};

export type LottiePlayerApi = {
  loadAnimation: (params: {
    container: Element;
    renderer: "svg";
    loop: boolean;
    autoplay: boolean;
    animationData: unknown;
  }) => { destroy: () => void };
};

export interface Window {
  Pusher?: PusherFactory;
  stickerLottieInstances?: Record<string, LottiePlayerApi>;
  isLottieScriptLoading?: boolean;
}

export type MessageStatusState = "sent" | "read";

export type DissolveParticle = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  delay: number;
  rot?: number;
  variant?: "primary" | "light" | "sparkle";
  isRound?: boolean;
};

export type ChatsListCacheSnapshot = {
  savedAt: number;
  chats: ChatSummary[];
  unreadByLink: Record<string, number>;
  hasMoreChats: boolean;
  chatsCursor: string | null;
  selectedLink: string | null;
  selfId?: string;
};

export type ConversationCacheSnapshot = {
  savedAt: number;
  conversation: ConversationResponse;
  messages: DecryptedMessage[];
  selfId?: string;
};

export type StoryFeedCacheSnapshot = {
  savedAt: number;
  stories: StoryFeedGroup[];
};

export type BooleanPrivacyDetail = Exclude<SettingsPrivacyDetail, "onlineVisibility" | "lastSeenVisibility" | "firstMessagePolicy" | "newChatAutoDeleteDays">;
export type BooleanPrivacyField = keyof Pick<SettingsPrivacyState, "showTyping" | "showMediaActivity" | "showReadReceipts" | "allowUsernameSearch" | "showInGlobalSearch" | "allowProfileLink" | "allowGroupAdd" | "autoDeleteReadMessages">;

export type ActivityIndicatorKind = "typing" | "pulse";
export type ChatActionPanelIcon = "copy" | "error" | "trash" | "success";
export type ChatActionPanelState = {
  id: number;
  icon: ChatActionPanelIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type ChatListHelperState = {
  link: string;
  chatType: ConversationChatType;
  dangerAction: "leave" | "delete" | null;
  displayName: string;
  x: number;
  y: number;
  touch: boolean;
  anchorRect?: { left: number; top: number; width: number; height: number } | null;
};

export type ChatListMenuPosition = {
  left: number;
  top: number;
};

export type ContactForAddItem = {
  id: string;
  link: string;
  alias: string;
  avatarUrl?: string | null;
  displayName?: string;
};
