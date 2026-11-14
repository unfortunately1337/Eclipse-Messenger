"use client";

import { customThemeMessageBackground, customThemeTextColor } from "@/lib/client/custom-chat-theme";

import { type CSSProperties, useCallback, useMemo } from "react";

import { getPanelVisualStyle, getChatHeaderVisualStyle, getComposerVisualStyle } from "@/lib/client/panel-visual";

import { getReplyLineColor } from "@/lib/reply-colors";

import {
  getMineMessageGradientByPreset,
  getMineMessageSolidSurfaceByPreset,
  getReplyPreviewSurfaceByPreset,
  getUnreadBadgeStyleByPreset,
  getMineReactionSurfaceByPreset,
  getComposerSendSurfaceByPreset,
  getUiAccentTokensByPreset
} from "../theme";

import { renderCommunityBannersView } from "../chat-lifecycle";

import type { ChatPageStateModel } from "./useChatPageState";

export interface ChatAppearanceSources {
  page: Pick<ChatPageStateModel, "activeCustomTheme" | "transparentVisual" | "t"> & {
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "messageThemeEnabled" | "liveBackgroundPreset" | "liveBackgroundOpacity">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;

  };
}

export interface ChatAppearanceModel {
  mineMessageGradientStyle: React.CSSProperties | undefined;
  mineMessageClassName: "text-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.04]" | "bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.18)]";
  incomingMessageClassName: "bg-[var(--incoming-message-background,#212121)] text-[color:var(--incoming-message-text,#fafafa)] shadow-[0_1px_2px_rgba(0,0,0,0.24)] border-0";
  mineReplyPreviewThemeStyle: React.CSSProperties | undefined;
  unreadBadgeThemeStyle: React.CSSProperties | undefined;
  composerSendButtonStyle: React.CSSProperties;
  composerSendButtonToneClassName: "bg-white text-zinc-950 hover:!bg-[#e4e4e7] active:!bg-[#d4d4d8] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-colors duration-150" | "text-white hover:brightness-90 hover:saturate-110 active:brightness-75 shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-[filter,transform] duration-150";
  uiAccentStyle: React.CSSProperties;
  chatActionPanelThemeStyle: React.CSSProperties | undefined;
  composerInputThemeStyle: React.CSSProperties;
  emptyChatPanelThemeStyle: React.CSSProperties;
  dateSeparatorThemeStyle: React.CSSProperties;
  renderCommunityBanners: () => React.JSX.Element | null;
  chatHeaderThemeStyle: React.CSSProperties;
  chatProfileSectionThemeStyle: React.CSSProperties | undefined;
  themedModalBackdropClassName: "bg-black/75" | "bg-black/28 backdrop-blur-[2px]";
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatAppearance(sources: ChatAppearanceSources): ChatAppearanceModel {
  const { activeCustomTheme, transparentVisual, t } = sources.page;
  const { messageThemeEnabled, liveBackgroundPreset, liveBackgroundOpacity } = sources.page.notificationAndContacts;
  const { activeConversation } = sources.page.conversation;
  const { selfId, selfProfile } = sources.page.account;
  const { isDesktop } = sources.page.panels;

  const mineMessageGradientStyle = useMemo<CSSProperties | undefined>(() => {
    if (activeCustomTheme) return { background: customThemeMessageBackground(activeCustomTheme, messageThemeEnabled), color: customThemeTextColor(activeCustomTheme) };
    if (liveBackgroundPreset === "none") {
      return undefined;
    }
    if (messageThemeEnabled) {
      const gradient = getMineMessageGradientByPreset(liveBackgroundPreset);
      if (gradient) {
        return {
          backgroundImage: gradient,
        };
      }
    }
    return getMineMessageSolidSurfaceByPreset(liveBackgroundPreset);
  }, [liveBackgroundPreset, messageThemeEnabled, activeCustomTheme]);

  const mineMessageClassName = activeCustomTheme || liveBackgroundPreset !== "none"
    ? "text-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.04]"
    : "bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.18)]";

  const incomingMessageClassName = "bg-[var(--incoming-message-background,#212121)] text-[color:var(--incoming-message-text,#fafafa)] shadow-[0_1px_2px_rgba(0,0,0,0.24)] border-0";

  const mineReplyPreviewThemeStyle = useMemo<CSSProperties | undefined>(() => {
    return getReplyPreviewSurfaceByPreset(liveBackgroundPreset);
  }, [liveBackgroundPreset, activeCustomTheme]);

  const unreadBadgeThemeStyle = useMemo<CSSProperties | undefined>(() => {
    return getUnreadBadgeStyleByPreset(liveBackgroundPreset);
  }, [liveBackgroundPreset]);

  const mineReactionThemeStyle = useMemo<CSSProperties | undefined>(() => {
    return getMineReactionSurfaceByPreset(liveBackgroundPreset);
  }, [liveBackgroundPreset]);

  const composerSendButtonStyle = useMemo<CSSProperties>(() => {
    if (liveBackgroundPreset === "none") {
      return {
        boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
      };
    }
    return {
      ...getComposerSendSurfaceByPreset(liveBackgroundPreset, messageThemeEnabled),
      boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
    };
  }, [liveBackgroundPreset, messageThemeEnabled]);

  const composerSendButtonToneClassName =
    liveBackgroundPreset === "none"
      ? "bg-white text-zinc-950 hover:!bg-[#e4e4e7] active:!bg-[#d4d4d8] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-colors duration-150"
      : "text-white hover:brightness-90 hover:saturate-110 active:brightness-75 shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-[filter,transform] duration-150";

  const uiAccentStyle = useMemo<CSSProperties>(() => {
    const accent = getUiAccentTokensByPreset(liveBackgroundPreset);
    const outgoingBackground = String(mineMessageGradientStyle?.backgroundImage || mineMessageGradientStyle?.background || mineMessageGradientStyle?.backgroundColor || "#ffffff");
    return {
      "--incoming-message-background": activeCustomTheme?.incoming || "#212121",
      "--incoming-message-text": activeCustomTheme ? customThemeTextColor({ ...activeCustomTheme, outgoingTop: activeCustomTheme.incoming || "#212121", outgoingBottom: activeCustomTheme.incoming || "#212121" }) : "#fafafa",
      "--voice-control-accent": activeCustomTheme?.outgoingBottom || accent.solid,
      "--voice-control-contrast": activeCustomTheme ? customThemeTextColor({ ...activeCustomTheme, outgoingTop: activeCustomTheme.outgoingBottom }) : accent.contrast,
      "--reply-preview-background": activeCustomTheme?.replyBackground,
      "--reply-preview-line-incoming": getReplyLineColor(activeCustomTheme?.replyBackground || activeCustomTheme?.incoming || "#212121", activeCustomTheme?.replyLine),
      "--reply-preview-line-outgoing": getReplyLineColor(activeCustomTheme?.replyBackground || outgoingBackground, activeCustomTheme?.replyLine),
      "--reply-preview-text": activeCustomTheme?.replyBackground ? customThemeTextColor({ ...activeCustomTheme, outgoingTop: activeCustomTheme.replyBackground, outgoingBottom: activeCustomTheme.replyBackground }) : undefined,
      "--call-ambient-background": outgoingBackground,
      "--ui-accent-text": accent.text,
      "--ui-accent-solid": accent.solid,
      "--ui-accent-contrast": accent.contrast,
      "--ui-accent-bg": accent.surface,
      "--ui-accent-bg-strong": accent.surfaceStrong,
      "--ui-accent-ring": accent.ring,
      "--ui-accent-glow": accent.glow,
    } as CSSProperties;
  }, [liveBackgroundPreset, activeCustomTheme, mineMessageGradientStyle]);

  const chatActionPanelThemeStyle = useMemo<CSSProperties | undefined>(() => {
    return getPanelVisualStyle(transparentVisual);
  }, [transparentVisual]);

  const composerInputThemeStyle = useMemo<CSSProperties>(() => getComposerVisualStyle(transparentVisual), [transparentVisual]);

  const emptyChatPanelThemeStyle = useMemo<CSSProperties>(() => {
    return {
      backgroundColor: "rgba(24, 24, 24, 0.72)",
      borderColor: "rgba(255,255,255,0.08)",
      boxShadow: "0 14px 34px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.055)",
      backdropFilter: "blur(16px) saturate(1.05)",
      WebkitBackdropFilter: "blur(16px) saturate(1.05)",
      ...getPanelVisualStyle(transparentVisual),
    };
  }, [transparentVisual]);

  const dateSeparatorThemeStyle = useMemo<CSSProperties>(() => ({
    ...composerInputThemeStyle,
    border: transparentVisual ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
    boxShadow: transparentVisual ? "0 3px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.055)" : "0 3px 12px rgba(0,0,0,0.18)",
  }), [composerInputThemeStyle, transparentVisual]);

  const renderCommunityBanners = useCallback(() => {
    return renderCommunityBannersView({ activeConversation, selfId, selfProfile, t, dateSeparatorThemeStyle });
  }, [activeConversation, selfId, selfProfile, t, dateSeparatorThemeStyle]);

  const chatHeaderThemeStyle = useMemo<CSSProperties>(() => {
    return getChatHeaderVisualStyle(transparentVisual);
  }, [transparentVisual]);

  const profileLiveBackgroundVeilStyle = useMemo<CSSProperties | undefined>(() => {
    if (liveBackgroundPreset === "none") return undefined;
    const topAlpha = Math.max(0.02, Math.min(0.08, 0.06 - liveBackgroundOpacity * 0.015));
    const bottomAlpha = Math.max(0.08, Math.min(0.16, 0.12 - liveBackgroundOpacity * 0.02));
    return {
      background: `linear-gradient(180deg, rgba(7,10,16,${topAlpha}), rgba(7,10,16,${bottomAlpha}))`,
    };
  }, [isDesktop, liveBackgroundOpacity, liveBackgroundPreset]);

  const chatProfileSectionThemeStyle = useMemo<CSSProperties | undefined>(() => {
    return {
      backgroundColor: transparentVisual ? "rgba(255, 255, 255, 0.05)" : "#252527",
      borderColor: "rgba(255,255,255,0.07)",
      backdropFilter: transparentVisual ? "blur(14px) saturate(1.04)" : "none",
      WebkitBackdropFilter: transparentVisual ? "blur(14px) saturate(1.04)" : "none",
    };
  }, [transparentVisual]);

  const themedModalBackdropClassName =
    liveBackgroundPreset === "none" ? "bg-black/75" : "bg-black/28 backdrop-blur-[2px]";

  return {
    mineMessageGradientStyle,
    mineMessageClassName,
    incomingMessageClassName,
    mineReplyPreviewThemeStyle,
    unreadBadgeThemeStyle,
    composerSendButtonStyle,
    composerSendButtonToneClassName,
    uiAccentStyle,
    chatActionPanelThemeStyle,
    composerInputThemeStyle,
    emptyChatPanelThemeStyle,
    dateSeparatorThemeStyle,
    renderCommunityBanners,
    chatHeaderThemeStyle,
    chatProfileSectionThemeStyle,
    themedModalBackdropClassName
  };
}
