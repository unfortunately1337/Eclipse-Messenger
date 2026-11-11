"use client";

import { useRef, useState } from "react";
import { type LiveBackgroundNeatPreset, type LiveBackgroundSettings } from "@/lib/client/live-background";
import { type ConversationChatType, type SelfProfile, type ChatUiSettings, type CreateChatKind, type CreateChatStep, type CreateChatDraft } from "../../types";
import { DEFAULT_CHAT_UI_SETTINGS } from "../../constants";
import { createCryptoDiagnosticLogger } from "@/lib/client/e2e-decrypt-pipeline";

export function useChatAccountState() {
  const [activeUnreadCount, setActiveUnreadCount] = useState(0);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());
  const suppressMessageEntranceRef = useRef(true);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfProfile, setSelfProfile] = useState<SelfProfile | null>(null);
  const storyAccountRef = useRef(selfId);
  return {
    activeUnreadCount,
    setActiveUnreadCount,
    animatedMessageIdsRef,
    suppressMessageEntranceRef,
    selfId,
    setSelfId,
    selfProfile,
    setSelfProfile,
    storyAccountRef
  };
}

export function useChatIdentityState() {
  const [selfPublicKey, setSelfPublicKey] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [e2eBootstrapCompleted, setE2EBootstrapCompleted] = useState(false);
  const [e2eIdentityReady, setE2EIdentityReady] = useState(false);
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const cryptoDiagnosticRef = useRef(createCryptoDiagnosticLogger("chats-page"));
  return {
    selfPublicKey,
    setSelfPublicKey,
    privateKey,
    setPrivateKey,
    e2eBootstrapCompleted,
    setE2EBootstrapCompleted,
    e2eIdentityReady,
    setE2EIdentityReady,
    privateKeyRef,
    cryptoDiagnosticRef
  };
}

export function useSettingsControlsState() {
  const settingsAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const settingsMusicInputRef = useRef<HTMLInputElement | null>(null);
  const [showRotationTimePicker, setShowRotationTimePicker] = useState(false);
  const [createChatKind, setCreateChatKind] = useState<CreateChatKind | null>(null);
  const [createChatStep, setCreateChatStep] = useState<CreateChatStep>("intro");
  const [createChatDraft, setCreateChatDraft] = useState<CreateChatDraft>({
    name: "",
    link: "",
    isPublic: false,
    photoDataUrl: null,
  });
  const [createChatSelectedIds, setCreateChatSelectedIds] = useState<Set<string>>(new Set());
  const [createChatContactQuery, setCreateChatContactQuery] = useState("");
  const [createChatContactsLoading, setCreateChatContactsLoading] = useState(false);
  const [createChatCreating, setCreateChatCreating] = useState(false);
  return {
    settingsAvatarInputRef,
    settingsMusicInputRef,
    showRotationTimePicker,
    setShowRotationTimePicker,
    createChatKind,
    setCreateChatKind,
    createChatStep,
    setCreateChatStep,
    createChatDraft,
    setCreateChatDraft,
    createChatSelectedIds,
    setCreateChatSelectedIds,
    createChatContactQuery,
    setCreateChatContactQuery,
    createChatContactsLoading,
    setCreateChatContactsLoading,
    createChatCreating,
    setCreateChatCreating
  };
}

export function useNotificationAndContactsState() {
  const [mutedChatLinkSet, setMutedChatLinkSet] = useState<Set<string>>(new Set());
  const [pinnedChatLinkSet, setPinnedChatLinkSet] = useState<Set<string>>(new Set());
  const [chatListHelper, setChatListHelper] = useState<{
    link: string;
    chatType: ConversationChatType;
    dangerAction: "leave" | "delete" | null;
    displayName: string;
    x: number;
    y: number;
    touch: boolean;
    anchorRect?: { left: number; top: number; width: number; height: number } | null;
  } | null>(null);
  const [directChatDeleteConfirm, setDirectChatDeleteConfirm] = useState<{ link: string; displayName: string } | null>(null);
  const [liveBackgroundPreset, setLiveBackgroundPreset] = useState<LiveBackgroundNeatPreset>("none");
  const [liveBackgroundOpacity, setLiveBackgroundOpacity] = useState<LiveBackgroundSettings["opacity"]>(0.28);
  const [liveBackgroundMotionSpeed, setLiveBackgroundMotionSpeed] = useState<LiveBackgroundSettings["motionSpeed"]>(1);
  const [messageThemeEnabled, setMessageThemeEnabled] = useState<LiveBackgroundSettings["messageThemeEnabled"]>(true);
  const [customTheme, setCustomTheme] = useState<LiveBackgroundSettings["customTheme"]>(null);
  const [customThemeEnabled, setCustomThemeEnabled] = useState(false);
  return {
    mutedChatLinkSet,
    setMutedChatLinkSet,
    pinnedChatLinkSet,
    setPinnedChatLinkSet,
    chatListHelper,
    setChatListHelper,
    directChatDeleteConfirm,
    setDirectChatDeleteConfirm,
    liveBackgroundPreset,
    setLiveBackgroundPreset,
    liveBackgroundOpacity,
    setLiveBackgroundOpacity,
    liveBackgroundMotionSpeed,
    setLiveBackgroundMotionSpeed,
    messageThemeEnabled,
    setMessageThemeEnabled,
    customTheme,
    setCustomTheme,
    customThemeEnabled,
    setCustomThemeEnabled
  };
}

export function useChatAppearanceState() {
  const [chatUiSettings, setChatUiSettings] = useState<ChatUiSettings>(DEFAULT_CHAT_UI_SETTINGS);
  const [messageHelperId, setMessageHelperId] = useState<string | null>(null);
  const desktopMessageHelperRef = useRef<HTMLDivElement>(null);
  const [messageHelperAnchor, setMessageHelperAnchor] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
    isMine: boolean;
  } | null>(null);
  return {
    chatUiSettings,
    setChatUiSettings,
    messageHelperId,
    setMessageHelperId,
    desktopMessageHelperRef,
    messageHelperAnchor,
    setMessageHelperAnchor
  };
}

export function useAccountNavigationRefs() {
  const activeChatLinkRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const suppressRequestedChatSyncRef = useRef(false);
  const communityNavigationIdentityRef = useRef<string | null>(null);
  return {
    activeChatLinkRef,
    currentUserIdRef,
    currentSessionIdRef,
    suppressRequestedChatSyncRef,
    communityNavigationIdentityRef
  };
}
