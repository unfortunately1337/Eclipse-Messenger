"use client";
import { getReplyLineColor } from "@/lib/reply-colors";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation, useLanguage } from "@/components/LocaleProvider";

import { preload } from "react-dom";
import { EmojiStatusControl } from "@/components/EmojiStatusControl";
import { PanelNavigation } from "./PanelNavigation";
import { VerifiedTitle } from "./VerifiedTitle";
import { FaLock, FaKey } from "react-icons/fa";
import { MessageBubbleTail } from "./MessageBubbles";
import { getMessageTailColor } from "@/lib/message-surface";
import { getUiAccentTokensByPreset } from "@/lib/client/theme-accent";

import React, { useState, useEffect, useCallback, useMemo, useRef, ChangeEvent, CSSProperties, ReactNode } from "react";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PANEL_SUBVIEW_VARIANTS, PANEL_TRANSITION, panelOverlayMotion } from "@/lib/client/panel-motion";
import {
  ArrowLeft, Trash, Trash2, Download, QrCode, Camera, Music, LogOut, KeySquare, X,
  Mail, Lock, ChevronRight, User, Laptop, Tablet, Monitor, Check,
  AtSign, Bell, Database, Settings, Pencil, MoreVertical, Palette,
  Sliders, RefreshCw, Eye, EyeOff, Sparkles, AlertCircle,
  Smartphone, Globe, Info, ShieldAlert, CheckCircle2, Image as ImageIcon,
  Fingerprint, KeyRound, MonitorSmartphone, Ban, Copy, Gem, Crown, Zap, Star, BadgeCheck,
  Send, CreditCard, Search, Plus, ImagePlus, UserPlus, UserX, UserCheck, Users
} from "lucide-react";
import { TbShieldLock as ShieldLock } from "react-icons/tb";
import { MdOutlinePrivacyTip, MdOutlineDevices, MdEdit, MdDelete } from "react-icons/md";
import { IoLogoWindows, IoPhonePortrait } from "react-icons/io5";
import { FaLinux } from "react-icons/fa";
import { RiMacbookLine } from "react-icons/ri";

import { cn } from "@/lib/utils";
import { changePasswordWithE2EBackup } from "@/lib/client/e2e-password-change";
import { apiRequest } from "@/lib/client/http";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaAvatar, MediaBanner, isRealMediaAvatar } from "@/components/ui/media";
import { AvatarMediaViewerModal } from "./AvatarMediaViewerModal";
import { CollectibleUsernameModal } from "./CollectibleUsernameModal";
import SessionQrScanner from "./SessionQrScanner";
import { showAppToast } from "@/lib/client/app-toast";
import { broadcastSelfProfileUpdated } from "@/lib/client/local-updates";
import { StoryAvatarRing } from "../story/StoryAvatarRing";
import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";
import { compressImageFile } from "@/lib/client/media-compression";

import {
  type SettingsPanelView,
  type SettingsProfileDetails,
  type SettingsEditDraft,
  type SettingsPrivacyState,
  type SettingsPrivacyUser,
  type SettingsPrivacyDetail,
  type SettingsSessionItem,
  type SelfProfile,
  type LiveBackgroundSettings
} from "../../types";

import {
  DEFAULT_SETTINGS_PRIVACY,
  SETTINGS_PRIVACY_DETAIL_TITLES,
  SETTINGS_LIVE_PRESETS
} from "../../constants";

import {
  deriveSettingsDeviceName,
  deriveSettingsOS,
  deriveSettingsBrowser,
  formatSettingsSessionTime
} from "../../helpers";

import ProfileQrPanel from "@/components/ProfileQrPanel";
import { ProfileMusicCaption } from "./ProfileMusicCaption";
import { LottieSticker, preloadLottieSticker } from "./LottieSticker";
import { MonkeyPasswordAnimation } from "@/components/auth/AuthAnimation";
import { fetchStickerAnimationData } from "@/lib/client/stickers";
import { MessageStatusTicks } from "./MessageStatus";
import { ChatThemeCard } from "./ChatThemeCard";
import { ReplyQuote } from "./ReplyQuote";
import { CustomChatThemeEditor } from "./CustomChatThemeEditor";
import { DEFAULT_CUSTOM_CHAT_THEME, customThemeMessageBackground, customThemeChatBackground, customThemeTextColor, customThemeReactionSurface } from "@/lib/client/custom-chat-theme";

import { THEME_BACKDROP_MAP, THEME_DOODLE_GRADIENT_MAP, THEME_SVG_MAP, THEME_SOLID_COLOR_MAP } from "./TelegramDoodleWallpaper";
import {
  PROFILE_GRADIENT_PRESETS,
  getEffectiveProfileGradient,
  getEffectiveProfileAccentColor,
  getDefaultProfilePresetId,
  getDefaultProfileGradient,
  isMediaBackgroundUrl
} from "@/lib/profile-gradients";

const settingsSubViewVariants = PANEL_SUBVIEW_VARIANTS;


function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
        checked ? "bg-white" : "bg-white/15"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5 bg-zinc-950" : "translate-x-0 bg-white"
        )}
      />
    </button>
  );
}

function SettingsRadioIndicator({ selected }: { selected: boolean }) {
  const t = useTranslation();
  return (
    <span
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-all duration-200",
        selected
          ? "border-[color:var(--ui-accent-solid,#38bdf8)]"
          : "border-white/20"
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full transition-transform duration-200",
          selected
            ? "scale-100 bg-[var(--ui-accent-solid,#38bdf8)]"
            : "scale-0 bg-transparent"
        )}
      />
    </span>
  );
}

function TotpQrCanvas({
  value,
  fallbackUrl,
  size = 200,
}: {
  value: string;
  fallbackUrl?: string | null;
  size?: number;
}) {
  const t = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!value && !fallbackUrl) return;
    let active = true;

    const drawRoundedRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
      }
      ctx.closePath();
    };

    const drawQr = (QRCode: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const canvasSize = 512;
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      try {
        const qrSource = value || fallbackUrl || "";
        const qr = QRCode.create(qrSource, { errorCorrectionLevel: "M" });
        const { size: qrSize, data } = qr.modules;
        const margin = 2;
        const totalModules = qrSize + margin * 2;
        const moduleSize = canvasSize / totalModules;
        const offsetX = margin * moduleSize;
        const offsetY = margin * moduleSize;

        // Clear canvas with crisp white
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // 1. Draw modules as refined rounded squaricles (smooth modern QR modules)
        ctx.fillStyle = "#09090b";
        const moduleRadius = moduleSize * 0.28;
        const pad = moduleSize * 0.05;

        for (let r = 0; r < qrSize; r++) {
          for (let c = 0; c < qrSize; c++) {
            const isDark = data[r * qrSize + c] === 1;
            if (!isDark) continue;

            const isTopLeftFinder = r < 7 && c < 7;
            const isTopRightFinder = r < 7 && c >= qrSize - 7;
            const isBottomLeftFinder = r >= qrSize - 7 && c < 7;

            if (isTopLeftFinder || isTopRightFinder || isBottomLeftFinder) {
              continue;
            }

            const x = offsetX + c * moduleSize;
            const y = offsetY + r * moduleSize;
            drawRoundedRect(
              ctx,
              x + pad,
              y + pad,
              moduleSize - pad * 2,
              moduleSize - pad * 2,
              moduleRadius
            );
            ctx.fill();
          }
        }

        // 2. Draw unified rounded finder patterns
        const drawFinderPattern = (startX: number, startY: number) => {
          const w = 7 * moduleSize;
          const h = 7 * moduleSize;
          const radius = 1.75 * moduleSize;

          ctx.fillStyle = "#09090b";
          drawRoundedRect(ctx, startX, startY, w, h, radius);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          drawRoundedRect(
            ctx,
            startX + moduleSize,
            startY + moduleSize,
            w - 2 * moduleSize,
            h - 2 * moduleSize,
            radius * 0.72
          );
          ctx.fill();

          ctx.fillStyle = "#09090b";
          drawRoundedRect(
            ctx,
            startX + 2 * moduleSize,
            startY + 2 * moduleSize,
            w - 4 * moduleSize,
            h - 4 * moduleSize,
            radius * 0.44
          );
          ctx.fill();
        };

        drawFinderPattern(offsetX, offsetY);
        drawFinderPattern(offsetX + (qrSize - 7) * moduleSize, offsetY);
        drawFinderPattern(offsetX, offsetY + (qrSize - 7) * moduleSize);
      } catch (err) {
        console.error("QR drawing error, using fallback image:", err);
        setUseFallback(true);
      }
    };

    import("qrcode")
      .then((QRCodeLib) => {
        if (!active) return;
        const QRCode = QRCodeLib.default || QRCodeLib;
        drawQr(QRCode);
      })
      .catch(() => {
        if (!active) return;
        setUseFallback(true);
      });

    return () => {
      active = false;
    };
  }, [value, fallbackUrl]);

  if (useFallback && fallbackUrl) {
    return (
      <img
        src={fallbackUrl}
        alt="2FA QR Code"
        style={{ width: size, height: size }}
        className="block rounded-[16px] object-contain select-none"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, maxWidth: "100%" }}
      className="block rounded-[16px] select-none"
    />
  );
}

function SixDigitCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
  error?: boolean;
}) {
  const t = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.split("");

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="relative flex flex-col items-center cursor-pointer select-none py-1"
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(clean);
          if (clean.length === 6 && onComplete) {
            setTimeout(() => onComplete(), 60);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.length === 6 && onComplete) {
            e.preventDefault();
            onComplete();
          }
        }}
        disabled={disabled}
        className="absolute inset-0 opacity-0 pointer-events-auto cursor-pointer"
        autoFocus
      />

      <div className="flex items-center gap-2 sm:gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const digit = digits[index] || "";
          const isFocused = value.length === index;
          const isLastAndFull = index === 5 && value.length === 6;

          return (
            <React.Fragment key={index}>
              {index === 3 ? (
                <span className="text-zinc-600 font-bold select-none px-0.5">—</span>
              ) : null}
              <div
                className={cn(
                  "h-12 w-10 sm:w-11 rounded-[14px] bg-white/[0.05] border flex items-center justify-center font-mono text-[20px] font-bold text-white transition-all select-none",
                  error
                    ? "border-red-500/50 bg-red-500/10 text-red-300"
                    : isFocused || isLastAndFull
                    ? "border-white/40 ring-2 ring-white/10 bg-white/[0.1] scale-105"
                    : digit
                    ? "border-white/[0.16] bg-white/[0.08]"
                    : "border-white/[0.08]"
                )}
              >
                {digit ? (
                  <span className="animate-in zoom-in-50 duration-100">{digit}</span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function PrivacySection({
  title,
  children,
  card = true,
}: {
  title: string;
  children: ReactNode;
  card?: boolean;
}) {
  const t = useTranslation();
  return (
    <section className="space-y-1.5">
      <p className="px-2 pb-0.5 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">{t(title)}</p>
      {card ? (
        <div className="overflow-hidden rounded-[20px] bg-white/[0.04] p-1.5 shadow-md space-y-1">
          {children}
        </div>
      ) : (
        <div className="space-y-1">
          {children}
        </div>
      )}
    </section>
  );
}

function PrivacyNavigationRow({
  icon: Icon,
  label,
  value,
  onClick,
  disabled,
  showChevron = true,
}: {
  icon?: any;
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
  showChevron?: boolean;
}) {
  const t = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mx-1 w-[calc(100%-8px)] rounded-[14px] flex min-h-[48px] items-center gap-3.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer disabled:opacity-50"
    >
      {Icon ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-300">
          <Icon size={22} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-zinc-100">{t(label)}</span>
        {value ? <span className="block mt-0.5 text-[13px] text-zinc-400 leading-normal">{value}</span> : null}
      </div>
      {showChevron ? <ChevronRight size={17} className="shrink-0 text-zinc-500" /> : null}
    </button>
  );
}

function PrivacyToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon?: any;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTranslation();
  return (
    <div className="mx-1 w-[calc(100%-8px)] rounded-[14px] flex min-h-[48px] items-center justify-between gap-3.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]">
      {Icon ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-300">
          <Icon size={22} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-zinc-100">{t(label)}</span>
        {description ? <span className="block mt-0.5 text-[12px] text-zinc-400 leading-normal">{t(description)}</span> : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function getSessionDeviceIconComponent(userAgent?: string | null) {
  const ua = (userAgent || "").toLowerCase();
  // 1. Phone (iPhone, Android mobile)
  if (ua.includes("iphone") || ua.includes("android") || ua.includes("mobile") || ua.includes("phone")) {
    return IoPhonePortrait;
  }
  // 2. Windows PC
  if (ua.includes("windows")) {
    return IoLogoWindows;
  }
  // 3. Linux
  if (ua.includes("linux") || ua.includes("ubuntu") || ua.includes("fedora") || ua.includes("arch") || ua.includes("debian")) {
    return FaLinux;
  }
  // 4. Laptop / macOS / iPad / default
  return RiMacbookLine;
}

function SettingsSessionIcon({ userAgent }: { userAgent?: string | null }) {
  const t = useTranslation();
  const Icon = getSessionDeviceIconComponent(userAgent);
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/[0.06] text-zinc-200 border-0 outline-none">
      <Icon size={20} />
    </span>
  );
}

function SettingsSessionIconLarge({ userAgent }: { userAgent?: string | null }) {
  const t = useTranslation();
  const Icon = getSessionDeviceIconComponent(userAgent);
  return <Icon size={32} className="text-zinc-200" />;
}

function formatSessionLocation(ip?: string | null) {
  if (!ip) return t("Не определено");
  const clean = ip.replace("::ffff:", "").trim();
  if (clean === "127.0.0.1" || clean === "localhost" || clean === "::1" || clean.startsWith("192.168.") || clean.startsWith("10.")) {
    return t("Локальная сеть");
  }
  return t("Не определено");
}

export type SettingsDrawerProps = {
  isOpen: boolean;
  onTransitionComplete?: () => void;
  onClose: () => void;
  selfProfile?: SelfProfile | null;
  setSelfProfile?: React.Dispatch<React.SetStateAction<SelfProfile | null>>;
  settingsProfileDetails?: SettingsProfileDetails | null;
  setSettingsProfileDetails?: React.Dispatch<React.SetStateAction<SettingsProfileDetails | null>>;
  settingsPanelView?: SettingsPanelView;
  setSettingsPanelView?: React.Dispatch<React.SetStateAction<SettingsPanelView>>;
  settingsEditDraft?: SettingsEditDraft;
  setSettingsEditDraft?: React.Dispatch<React.SetStateAction<SettingsEditDraft>>;
  settingsPrivacy?: SettingsPrivacyState;
  setSettingsPrivacy?: React.Dispatch<React.SetStateAction<SettingsPrivacyState>>;
  settingsPrivacyDetail?: SettingsPrivacyDetail | null;
  setSettingsPrivacyDetail?: React.Dispatch<React.SetStateAction<SettingsPrivacyDetail | null>>;
  settingsSessions?: SettingsSessionItem[];
  settingsCurrentSessionId?: string | null;
  settingsSessionsLoading?: boolean;
  settingsEndingSessionId?: string | null;
  settingsLogoutLoading?: boolean;
  logoutFromSettings?: () => Promise<void>;
  saveSettingsProfile?: () => Promise<void>;
  uploadSettingsAvatar?: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  settingsAvatarUploading?: boolean;
  settingsProfileSaving?: boolean;
  loadSettingsPrivacy?: () => Promise<void>;
  updateSettingsPrivacy?: (partial: Partial<SettingsPrivacyState>) => Promise<void>;
  loadSettingsSessions?: () => Promise<void>;
  endSettingsSession?: (id: string) => Promise<void>;
  loadSettingsTotp?: () => Promise<void>;
  toggleSettingsTotp?: () => Promise<void>;
  settingsTotpEnabled?: boolean;
  settingsTotpLoading?: boolean;
  settingsTotpQrUrl?: string | null;
  uiAccentStyle?: CSSProperties;
  liveBackgroundSettings?: LiveBackgroundSettings;
  onUpdateLiveBackgroundSettings?: (settings: Partial<LiveBackgroundSettings>) => void;
  mobileChatOpen?: boolean;
  uploadMediaFile?: any;
  clearChatMemoryCaches?: any;
  setChatListMenuOpen?: any;
  requestedSettingsParam?: string | null;
};

export function SettingsDrawer(props: any) {
  const t = useTranslation();
  const { locale, setLocale } = useLanguage();
  const reducedMotion = useReducedMotion();
  const showCustomThemeEditor = () => { setSettingsPanelView("custom-theme"); };
  const { isOpen, onClose, selfProfile, uiAccentStyle, selfStoryGroup, onOpenStory, animateStoryRing } = props;
  useEffect(() => {
    if (!isOpen) return;
    preload("/gifs/lock-key.gif", { as: "image", fetchPriority: "high" });
    void preloadLottieSticker("/tgs/two-factor-setup-intro.tgs").catch(() => {});
    void preloadLottieSticker("/tgs/two-factor-setup-done.tgs").catch(() => {});
  }, [isOpen]);

  const [internalPanelView, setInternalPanelView] = useState<SettingsPanelView>("main");
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<SettingsSessionItem | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [endingAllSessions, setEndingAllSessions] = useState(false);
  const [confirmEndAllSessions, setConfirmEndAllSessions] = useState(false);
  const [collectibleModalUsername, setCollectibleModalUsername] = useState<string | null>(null);
  const [passwordVerifiedUntil, setPasswordVerifiedUntil] = useState<number>(0);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState("");
  const [verifyPasswordError, setVerifyPasswordError] = useState<string | null>(null);
  const [verifyPasswordLoading, setVerifyPasswordLoading] = useState(false);
  const [showVerifyPasswordText, setShowVerifyPasswordText] = useState(false);
  const [showDisableTotpModal, setShowDisableTotpModal] = useState(false);
  const [disablePasswordInput, setDisablePasswordInput] = useState("");
  const [disablePasswordError, setDisablePasswordError] = useState<string | null>(null);
  const [disablePasswordLoading, setDisablePasswordLoading] = useState(false);
  const [showDisablePasswordText, setShowDisablePasswordText] = useState(false);
  const settingsPanelView = props.settingsPanelView ?? internalPanelView;
  const setSettingsPanelView = props.setSettingsPanelView ?? setInternalPanelView;

  const [settingsNavDirection, setSettingsNavDirection] = useState<"forward" | "backward">("forward");
  const prevSettingsViewRef = useRef<{ view: string; detail: any; security: any }>({
    view: "main",
    detail: null,
    security: null,
  });

  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [internalTotpUri, setInternalTotpUri] = useState<string | null>(null);
  const [internalTotpSecret, setInternalTotpSecret] = useState<string | null>(null);
  const latestSelectedGradientRef = useRef<string | null | undefined>(undefined);
  const gradientSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [localThemePreset, setLocalThemePreset] = useState<LiveBackgroundSettings["neatPreset"]>(props.liveBackgroundSettings?.neatPreset ?? "none");
  const themePresetTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    setLocalThemePreset(props.liveBackgroundSettings?.neatPreset ?? "none");
  }, [props.liveBackgroundSettings?.neatPreset]);
  useEffect(() => () => {
    if (themePresetTimerRef.current) clearTimeout(themePresetTimerRef.current);
  }, []);
  const handleSelectThemePreset = useCallback((presetId: LiveBackgroundSettings["neatPreset"]) => {
    setLocalThemePreset(presetId);
    if (themePresetTimerRef.current) clearTimeout(themePresetTimerRef.current);
    themePresetTimerRef.current = null;
    React.startTransition(() => props.onUpdateLiveBackgroundSettings?.({ neatPreset: presetId, customThemeEnabled: false }));
  }, [props.onUpdateLiveBackgroundSettings]);

  const [internalEditDraft, setInternalEditDraft] = useState<SettingsEditDraft>({
    displayName: selfProfile?.displayName ?? "",
    link: selfProfile?.link ?? "",
    description: selfProfile?.description ?? "",
    avatarUrl: selfProfile?.avatarUrl ?? null,
    backgroundUrl: selfProfile?.backgroundUrl ?? null,
    musicUrl: selfProfile?.musicUrl ?? null,
    musicTitle: selfProfile?.musicTitle ?? "",
    musicAuthor: selfProfile?.musicAuthor ?? "",
    musicCoverUrl: selfProfile?.musicCoverUrl ?? null,
  });

  useEffect(() => {
    return () => {
      if (gradientSaveTimerRef.current) {
        clearTimeout(gradientSaveTimerRef.current);
        const target = latestSelectedGradientRef.current;
        if (target !== undefined) {
          apiRequest("/api/settings/profile", {
            method: "PATCH",
            body: JSON.stringify({ backgroundUrl: target }),
          }).catch(() => {});
        }
      }
    };
  }, []);

  useEffect(() => {
    if (selfProfile && settingsPanelView !== "edit") {
      setInternalEditDraft({
        displayName: selfProfile.displayName ?? "",
        link: selfProfile.link ?? "",
        description: selfProfile.description ?? "",
        avatarUrl: selfProfile.avatarUrl ?? null,
        backgroundUrl: selfProfile.backgroundUrl ?? null,
        musicUrl: selfProfile.musicUrl ?? null,
        musicTitle: selfProfile.musicTitle ?? "",
        musicAuthor: selfProfile.musicAuthor ?? "",
        musicCoverUrl: selfProfile.musicCoverUrl ?? null,
        usernameHidden: Boolean(selfProfile.usernameHidden),
      });
    }
  }, [selfProfile, settingsPanelView]);

  useEffect(() => {
    if (isOpen && props.requestedSettingsParam) {
      const validViews: SettingsPanelView[] = ["main", "edit", "privacy", "security", "security-totp", "security-password", "chats", "sessions", "qr", "scan-qr", "storage", "language"];
      if (validViews.includes(props.requestedSettingsParam as SettingsPanelView)) {
        setSettingsPanelView(props.requestedSettingsParam as SettingsPanelView);
      }
    }
  }, [isOpen, props.requestedSettingsParam]);

  const handleOpenEditProfile = () => {
    if (selfProfile) {
      setInternalEditDraft({
        displayName: selfProfile.displayName ?? "",
        link: selfProfile.link ?? "",
        description: selfProfile.description ?? "",
        avatarUrl: selfProfile.avatarUrl ?? null,
        backgroundUrl: selfProfile.backgroundUrl ?? null,
        musicUrl: selfProfile.musicUrl ?? null,
        musicTitle: selfProfile.musicTitle ?? "",
        musicAuthor: selfProfile.musicAuthor ?? "",
        musicCoverUrl: selfProfile.musicCoverUrl ?? null,
        usernameHidden: Boolean(selfProfile.usernameHidden),
      });
    }
    setSettingsPanelView("edit");
  };

  const settingsEditDraft = props.settingsEditDraft ?? internalEditDraft;
  const setSettingsEditDraft = props.setSettingsEditDraft ?? setInternalEditDraft;

  const [internalPrivacy, setInternalPrivacy] = useState<SettingsPrivacyState>(DEFAULT_SETTINGS_PRIVACY);
  const settingsPrivacy = props.settingsPrivacy ?? internalPrivacy;

  const [internalPrivacyDetail, setInternalPrivacyDetail] = useState<SettingsPrivacyDetail | null>(null);
  const settingsPrivacyDetail = props.settingsPrivacyDetail ?? internalPrivacyDetail;
  const setSettingsPrivacyDetail = props.setSettingsPrivacyDetail ?? setInternalPrivacyDetail;

  const [internalSessions, setInternalSessions] = useState<SettingsSessionItem[]>([]);
  const [internalCurrentSessionId, setInternalCurrentSessionId] = useState<string | null>(null);
  const [internalSessionsLoading, setInternalSessionsLoading] = useState(false);
  const [internalEndingSessionId, setInternalEndingSessionId] = useState<string | null>(null);
  const sessionsRequestIdRef = useRef(0);
  const sessionsAccountIdRef = useRef(selfProfile?.id);
  useEffect(() => {
    if (sessionsAccountIdRef.current === selfProfile?.id) return;
    sessionsAccountIdRef.current = selfProfile?.id;
    sessionsRequestIdRef.current++;
    setInternalSessions([]); setInternalCurrentSessionId(null); setInternalSessionsLoading(false);
    setSelectedSessionDetail(null); setSessionsError(null);
  }, [selfProfile?.id]);

  const settingsSessions = props.settingsSessions ?? internalSessions;
  const settingsCurrentSessionId = props.settingsCurrentSessionId ?? internalCurrentSessionId;
  const settingsSessionsLoading = props.settingsSessionsLoading ?? internalSessionsLoading;
  const settingsEndingSessionId = endingAllSessions ? "all" : props.settingsEndingSessionId ?? internalEndingSessionId;

  const isSessionOnline = useCallback((session?: SettingsSessionItem | null) => {
    if (!session) return false;
    if (session.id === settingsCurrentSessionId) return true;
    const lastSeen = session.lastSeenAt || session.createdAt;
    if (!lastSeen) return false;
    const lastSeenMs = Date.parse(lastSeen);
    if (Number.isNaN(lastSeenMs)) return false;
    // Considered online if activity was within the last 3 minutes (180,000 ms)
    return Date.now() - lastSeenMs < 3 * 60 * 1000;
  }, [settingsCurrentSessionId]);

  const [internalTotpEnabled, setInternalTotpEnabled] = useState(false);
  const [internalTotpLoading, setInternalTotpLoading] = useState(false);
  const [internalTotpQrUrl, setInternalTotpQrUrl] = useState<string | null>(null);
  const [totpCodeInput, setTotpCodeInput] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);

  const settingsTotpEnabled = props.settingsTotpEnabled ?? internalTotpEnabled;
  const settingsTotpLoading = props.settingsTotpLoading ?? internalTotpLoading;
  const settingsTotpQrUrl = props.settingsTotpQrUrl ?? internalTotpQrUrl;

  const [settingsSecurityPanel, setSettingsSecurityPanel] = useState<"main" | "totp" | "password" | "email" | null>(null);
  useEffect(() => {
    const getSettingsDepth = (view: string, detail: any, security: any) => {
      if (view === "main") return 0;
      if (detail === "lastSeenExceptions") return 3;
      if (detail || security || view === "security-totp" || view === "security-password" || view === "scan-qr" || view === "custom-theme") return 2;
      return 1;
    };
    const currentDepth = getSettingsDepth(settingsPanelView, settingsPrivacyDetail, settingsSecurityPanel);
    const prevDepth = getSettingsDepth(
      prevSettingsViewRef.current.view,
      prevSettingsViewRef.current.detail,
      prevSettingsViewRef.current.security
    );

    if (currentDepth !== prevDepth) {
      setSettingsNavDirection(currentDepth > prevDepth ? "forward" : "backward");
    }

    prevSettingsViewRef.current = {
      view: settingsPanelView,
      detail: settingsPrivacyDetail,
      security: settingsSecurityPanel,
    };
  }, [settingsPanelView, settingsPrivacyDetail, settingsSecurityPanel]);
  const [settingsMoreOpen, setSettingsMoreOpen] = useState(false);
  const [settingsMusicUploading, setSettingsMusicUploading] = useState(false);
  const [settingsCoverUploading, setSettingsCoverUploading] = useState(false);
  const [settingsBackgroundUploading, setSettingsBackgroundUploading] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);

  const [oldPasswordInput, setOldPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [internalAvatarUploading, setInternalAvatarUploading] = useState(false);
  const settingsAvatarUploading = props.settingsAvatarUploading ?? internalAvatarUploading;
  const [internalProfileSaving, setInternalProfileSaving] = useState(false);
  const settingsProfileSaving = props.settingsProfileSaving ?? internalProfileSaving;

  const settingsAvatarInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const musicCoverInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const pendingUploadsRef = useRef<{
    avatar?: Promise<string | null>;
    music?: Promise<string | null>;
    musicCover?: Promise<string | null>;
    background?: Promise<string | null>;
  }>({});

  const linkDraft = (settingsEditDraft?.link ?? "").trim().replace(/^@+/, "").toLowerCase();
  const currentLink = (selfProfile?.link ?? "").trim().replace(/^@+/, "").toLowerCase();
  const isLinkChanged = linkDraft !== currentLink;
  const linkRegexValid = /^[a-z][a-z0-9_]{2,30}[a-z0-9]$/.test(linkDraft);
  const linkInvalid = isLinkChanged && (!linkDraft || linkDraft.length < 4 || !linkRegexValid);
  const nameInvalid = !settingsEditDraft?.displayName?.trim();
  const settingsEditInvalid = Boolean(nameInvalid || linkInvalid);
  const isAnyMediaUploading = Boolean(
    settingsAvatarUploading ||
    settingsMusicUploading ||
    settingsCoverUploading ||
    settingsBackgroundUploading
  );

  // Internal API Fetchers
  const [exceptionSearchQuery, setExceptionSearchQuery] = useState("");
  const [exceptionCandidates, setExceptionCandidates] = useState<SettingsPrivacyUser[]>([]);
  const [exceptionCandidatesLoading, setExceptionCandidatesLoading] = useState(false);

  const loadPrivacyInternal = async () => {
    try {
      if (props.loadSettingsPrivacy) {
        await props.loadSettingsPrivacy();
      } else {
        const res = await apiRequest<SettingsPrivacyState>("/api/settings/privacy", { method: "GET" });
        if (res) {
          setInternalPrivacy({
            ...DEFAULT_SETTINGS_PRIVACY,
            ...res,
            presenceExceptionUsers: res.presenceExceptionUsers || [],
          });
        }
      }
    } catch (err) {
      console.error("Failed to load privacy settings:", err);
    }
  };

  const updatePrivacyInternal = async (partial: Partial<SettingsPrivacyState>) => {
    const updated = { ...settingsPrivacy, ...partial };
    setInternalPrivacy(updated);
    if (props.setSettingsPrivacy) props.setSettingsPrivacy(updated);
    try {
      if (props.updateSettingsPrivacy) {
        await props.updateSettingsPrivacy(partial);
      } else {
        const res = await apiRequest<SettingsPrivacyState>("/api/settings/privacy", {
          method: "PATCH",
          body: JSON.stringify(partial),
        });
        if (res && res.presenceExceptionUsers) {
          setInternalPrivacy((prev) => ({
            ...prev,
            presenceExceptionUsers: res.presenceExceptionUsers,
          }));
          if (props.setSettingsPrivacy) {
            props.setSettingsPrivacy((prev: any) => ({
              ...prev,
              presenceExceptionUsers: res.presenceExceptionUsers,
            }));
          }
        }
      }
    } catch (err) {
      console.error("Failed to update privacy settings:", err);
    }
  };

  const openExceptionsSubView = async () => {
    setExceptionSearchQuery("");
    setSettingsPrivacyDetail("lastSeenExceptions");
    setExceptionCandidatesLoading(true);

    try {
      const res = await apiRequest<{
        contacts: Array<{ id: string; link: string; alias: string; avatarUrl?: string | null; displayName?: string }>;
      }>("/api/contacts?acquaintances=true", { method: "GET" });

      const loadedList: SettingsPrivacyUser[] = (res?.contacts || [])
        .filter((c) => c.id !== selfProfile?.id)
        .map((c) => ({
          id: c.id,
          link: c.link,
          displayName: c.alias || c.displayName || c.link,
          avatarUrl: c.avatarUrl || null,
        }));

      const combined = [...loadedList];
      (settingsPrivacy.presenceExceptionUsers || []).forEach((u: SettingsPrivacyUser) => {
        if (!combined.some((c) => c.id === u.id)) {
          combined.unshift(u);
        }
      });
      setExceptionCandidates(combined);
    } catch (err) {
      console.error("Failed to load contacts for exceptions:", err);
      setExceptionCandidates(settingsPrivacy.presenceExceptionUsers || []);
    } finally {
      setExceptionCandidatesLoading(false);
    }
  };

  useEffect(() => {
    if (settingsPrivacyDetail !== "lastSeenExceptions" || !exceptionSearchQuery.trim()) return;
    const query = exceptionSearchQuery.trim().replace(/^@+/, "");
    if (query.length < 2) return;

    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{
          users: Array<{ id: string; link: string; displayName: string; avatarUrl?: string | null }>;
        }>(`/api/users/search?q=${encodeURIComponent(query)}`, { method: "GET" });

        if (res?.users && res.users.length > 0) {
          setExceptionCandidates((prev) => {
            const next = [...prev];
            res.users.forEach((u) => {
              if (!next.some((item) => item.id === u.id) && u.id !== selfProfile?.id) {
                next.push({
                  id: u.id,
                  link: u.link,
                  displayName: u.displayName || u.link,
                  avatarUrl: u.avatarUrl || null,
                });
              }
            });
            return next;
          });
        }
      } catch {
        // best effort search
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [exceptionSearchQuery, settingsPrivacyDetail, selfProfile?.id]);

  const handleToggleException = async (user: SettingsPrivacyUser) => {
    const currentIds = settingsPrivacy.presenceExceptionUserIds || [];
    const currentUsers = settingsPrivacy.presenceExceptionUsers || [];
    const isPresent = currentIds.includes(user.id);

    let nextIds: string[];
    let nextUsers: SettingsPrivacyUser[];

    if (isPresent) {
      nextIds = currentIds.filter((id: string) => id !== user.id);
      nextUsers = currentUsers.filter((u: SettingsPrivacyUser) => u.id !== user.id);
    } else {
      nextIds = [...currentIds, user.id];
      nextUsers = [...currentUsers.filter((u: SettingsPrivacyUser) => u.id !== user.id), user];
    }

    await updatePrivacyInternal({
      presenceExceptionUserIds: nextIds,
      presenceExceptionUsers: nextUsers,
    });
  };

  const removeExceptionDirectly = async (userId: string) => {
    const nextIds = (settingsPrivacy.presenceExceptionUserIds || []).filter((id: string) => id !== userId);
    const nextUsers = (settingsPrivacy.presenceExceptionUsers || []).filter((u: SettingsPrivacyUser) => u.id !== userId);
    await updatePrivacyInternal({
      presenceExceptionUserIds: nextIds,
      presenceExceptionUsers: nextUsers,
    });
  };

  const loadSessionsInternal = async () => {
    const requestId = ++sessionsRequestIdRef.current;
    try {
      setSessionsError(null);
      if (props.loadSettingsSessions) {
        await props.loadSettingsSessions();
      } else {
        setInternalSessionsLoading(true);
        const res = await apiRequest<{ currentSessionId: string; sessions: SettingsSessionItem[] }>("/api/settings/sessions", { method: "GET" });
        if (res && requestId === sessionsRequestIdRef.current) {
          setInternalSessions(res.sessions || []);
          setSelectedSessionDetail(previous => previous ? res.sessions.find(session => session.id === previous.id) ?? null : null);
          setInternalCurrentSessionId(res.currentSessionId || null);
        }
      }
    } catch (err) {
      if (requestId === sessionsRequestIdRef.current) setSessionsError(err instanceof Error ? err.message : t("Не удалось загрузить устройства. Попробуйте снова."));
    } finally {
      if (requestId === sessionsRequestIdRef.current) setInternalSessionsLoading(false);
    }
  };

  const endSessionInternal = async (id: string) => {
    if (id === settingsCurrentSessionId || sessionsAccountIdRef.current !== selfProfile?.id) return false;
    const accountId = selfProfile?.id;
    sessionsRequestIdRef.current++;
    setInternalSessionsLoading(false);
    try {
      setSessionsError(null);
      if (props.endSettingsSession) {
        await props.endSettingsSession(id);
      } else {
        setInternalEndingSessionId(id);
        await apiRequest("/api/settings/sessions", {
          method: "DELETE",
          body: JSON.stringify({ sessionId: id }),
        });
        if (sessionsAccountIdRef.current !== accountId) return false;
        sessionsRequestIdRef.current++;
        setInternalSessionsLoading(false);
        setInternalSessions((prev: any) => prev.filter((s: any) => s.id !== id));
      }
      return true;
    } catch (err) {
      if (sessionsAccountIdRef.current === accountId) setSessionsError(err instanceof Error ? err.message : t("Не удалось завершить сеанс. Попробуйте снова."));
      return false;
    } finally {
      setInternalEndingSessionId(null);
    }
  };

  const endAllOtherSessionsInternal = async () => {
    if (endingAllSessions || settingsEndingSessionId) return;
    setConfirmEndAllSessions(false);
    setEndingAllSessions(true);
    const others = settingsSessions.filter((s: any) => s.id !== settingsCurrentSessionId);
    try { for (const s of others) if (!await endSessionInternal(s.id)) break; }
    finally { setEndingAllSessions(false); }
  };

  const loadTotpInternal = async () => {
    try {
      if (props.loadSettingsTotp) {
        await props.loadSettingsTotp();
      } else {
        setInternalTotpLoading(true);
        const res = await apiRequest<{ enabled: boolean }>("/api/settings/totp", { method: "GET" });
        if (res) setInternalTotpEnabled(res.enabled);
      }
    } catch (err) {
      console.error("Failed to load TOTP:", err);
    } finally {
      setInternalTotpLoading(false);
    }
  };

  const startTotpSetupInternal = async () => {
    try {
      setInternalTotpLoading(true);
      setTotpError(null);
      const res = await apiRequest<{ qrDataUrl: string; manualKey?: string; uri?: string }>("/api/settings/totp", { method: "PATCH" });
      if (res?.qrDataUrl) {
        setInternalTotpQrUrl(res.qrDataUrl);
      }
      if (res?.uri) {
        setInternalTotpUri(res.uri);
      }
      if (res?.manualKey) {
        setInternalTotpSecret(res.manualKey);
      }
    } catch (err: any) {
      setTotpError(err?.message || t("Не удалось сгенерировать QR-код"));
    } finally {
      setInternalTotpLoading(false);
    }
  };

  const confirmTotpCodeInternal = async () => {
    if (!totpCodeInput.trim() || totpCodeInput.trim().length !== 6) return;
    try {
      setInternalTotpLoading(true);
      setTotpError(null);
      await apiRequest("/api/settings/totp", {
        method: "POST",
        body: JSON.stringify({ code: totpCodeInput.trim() }),
      });
      setInternalTotpEnabled(true);
      setInternalTotpQrUrl(null);
      setTotpCodeInput("");
    } catch (err: any) {
      setTotpError(err?.message || t("Неверный код подтверждения"));
    } finally {
      setInternalTotpLoading(false);
    }
  };

  const disableTotpInternal = async () => {
    if (!totpCodeInput.trim() || totpCodeInput.trim().length !== 6) return;
    try {
      setInternalTotpLoading(true);
      setTotpError(null);
      await apiRequest("/api/settings/totp", {
        method: "DELETE",
        body: JSON.stringify({ code: totpCodeInput.trim() }),
      });
      setInternalTotpEnabled(false);
      setTotpCodeInput("");
    } catch (err: any) {
      setTotpError(err?.message || t("Неверный код 2FA"));
    } finally {
      setInternalTotpLoading(false);
    }
  };

  const verifyPasswordForTotp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!verifyPasswordInput) return;
    try {
      setVerifyPasswordLoading(true);
      setVerifyPasswordError(null);
      const res = await apiRequest<{ verified: boolean }>("/api/settings/verify-password", {
        method: "POST",
        body: JSON.stringify({ password: verifyPasswordInput }),
      });
      if (res?.verified) {
        setPasswordVerifiedUntil(Date.now() + 5 * 60 * 1000);
        setVerifyPasswordInput("");
        if (!settingsTotpEnabled && !settingsTotpQrUrl) {
          void startTotpSetupInternal();
        }
      }
    } catch (err: any) {
      setVerifyPasswordError(err?.message || t("Неверный пароль"));
    } finally {
      setVerifyPasswordLoading(false);
    }
  };

  const handleDisableTotpWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!disablePasswordInput) return;
    try {
      setDisablePasswordLoading(true);
      setDisablePasswordError(null);
      await apiRequest("/api/settings/totp", {
        method: "DELETE",
        body: JSON.stringify({ password: disablePasswordInput }),
      });
      setInternalTotpEnabled(false);
      setShowDisableTotpModal(false);
      setDisablePasswordInput("");
      setShowDisablePasswordText(false);
      setInternalTotpQrUrl(null);
    } catch (err: any) {
      setDisablePasswordError(err?.message || t("Неверный пароль"));
    } finally {
      setDisablePasswordLoading(false);
    }
  };

  const changePasswordInternal = async () => {
    if (!oldPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setPasswordError(t("Заполните все поля"));
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError(t("Новые пароли не совпадают"));
      return;
    }
    if (newPasswordInput.length < 10) {
      setPasswordError(t("Новый пароль должен содержать не менее 10 символов"));
      return;
    }
    try {
      setPasswordLoading(true);
      setPasswordError(null);
      setPasswordSuccess(null);
      await changePasswordWithE2EBackup(oldPasswordInput, newPasswordInput, confirmPasswordInput);
      setPasswordSuccess(t("Пароль успешно изменен!"));
      setOldPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
    } catch (err: any) {
      setPasswordError(err?.message || t("Не удалось изменить пароль"));
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (settingsPanelView === "main" && settingsSessions.length === 0) {
      void loadSessionsInternal();
    }
    if (settingsPanelView === "privacy") {
      void loadPrivacyInternal();
    }
    if (settingsPanelView === "security" || settingsPanelView === "security-totp") void loadTotpInternal();
    if (settingsPanelView === "sessions") void loadSessionsInternal();
  }, [isOpen, settingsPanelView]);

  useEffect(() => {
    if (!isOpen || settingsPanelView !== "sessions") return;
    const refresh = () => { if (!document.hidden) void loadSessionsInternal(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [isOpen, settingsPanelView]);

  const settingsViewTitle: Record<SettingsPanelView, string> = {
    language: t("Язык"),
    main: t("Настройки"),
    edit: t("Изменить профиль"),
    privacy: t("Приватность и безопасность"),
    security: t("Безопасность"),
    "security-totp": t("2FA Аутентификация"),
    "security-password": t("Смена пароля"),
    chats: t("Оформление"),
    sessions: t("Устройства"),
    qr: t("Мой QR-код"),
    "scan-qr": t("Сканировать QR-код"),
    storage: t("Данные и память"),

    "custom-theme": t("Своя тема"),
  };

  const settingsPanelTitle =
    settingsPanelView === "privacy" && settingsPrivacyDetail === "lastSeenExceptions"
      ? settingsPrivacy.lastSeenVisibility === "all"
        ? t("Никогда не показывать")
        : settingsPrivacy.lastSeenVisibility === "none"
          ? t("Всегда показывать")
          : t("Исключения")
      : settingsPanelView === "privacy" && settingsPrivacyDetail
      ? SETTINGS_PRIVACY_DETAIL_TITLES[settingsPrivacyDetail] || t("Настройка")
      : settingsPanelView === "security" && settingsSecurityPanel
      ? settingsSecurityPanel === "totp"
        ? t("Двухфакторная авторизация")
        : settingsSecurityPanel === "password"
        ? t("Смена пароля")
        : t("Почта")
      : (settingsViewTitle as any)[settingsPanelView] || "";

  const settingsMainItems = [
    { label: t("Приватность и безопасность"), icon: MdOutlinePrivacyTip, view: "privacy" as SettingsPanelView },
    { label: t("Оформление"), icon: Palette, view: "chats" as SettingsPanelView },
    { label: t("Данные и память"), icon: Database, view: "storage" as SettingsPanelView },
    { label: t("Устройства"), icon: MdOutlineDevices, view: "sessions" as SettingsPanelView },
    { label: t("Язык"), icon: Globe, view: "language" as SettingsPanelView },
  ];

  const [internalLoggingOut, setInternalLoggingOut] = useState(false);
  const loggingOut = Boolean(props.settingsLogoutLoading ?? internalLoggingOut);

  const logoutFromSettings = props.logoutFromSettings ?? (async () => {
    try {
      const data = await apiRequest<{ redirectTo?: string; switchedToRemaining?: boolean }>("/api/auth/logout", { method: "POST" });
      try {
        window.sessionStorage.clear();
        window.localStorage.removeItem("eclipse:connected-accounts");
        if (typeof props.clearChatMemoryCaches === "function") {
          props.clearChatMemoryCaches();
        }
        if (!data?.switchedToRemaining) {
          window.localStorage.removeItem("eclipse:active-user-id");
          window.localStorage.removeItem("eclipse:cache:self-profile:last:v2");
          document.cookie = "eclipse.active_user_id=; path=/; max-age=0; SameSite=Lax";
        }
      } catch {}
      window.location.href = data?.redirectTo || "/login";
    } catch {
      setInternalLoggingOut(false);
    }
  });

  // Storage & Cache State (Telegram style)
  const [storageTotalMb, setStorageTotalMb] = useState(825.6);
  const [storagePercentOfDevice, setStoragePercentOfDevice] = useState(5.6);
  const [storageCleaning, setStorageCleaning] = useState(false);
  const [storageCleaned, setStorageCleaned] = useState(false);
  const [cleaningProgressModal, setCleaningProgressModal] = useState(false);
  const [cleaningProgressPercent, setCleaningProgressPercent] = useState(0);
  const [storageCategories, setStorageCategories] = useState([
    { id: "other", label: "Другое", percent: 67.0, sizeMb: 553.3, color: "#f59e0b", icon: Database, checked: true },
    { id: "video", label: "Видео", percent: 23.3, sizeMb: 193.0, color: "#3b82f6", icon: Monitor, checked: true },
    { id: "stickers", label: "Стикеры", percent: 4.9, sizeMb: 40.4, color: "#8b5cf6", icon: Sparkles, checked: true },
    { id: "photos", label: "Фотографии", percent: 2.6, sizeMb: 22.1, color: "#06b6d4", icon: ImageIcon, checked: true },
    { id: "voice", label: "Прочее", percent: 2.0, sizeMb: 16.6, color: "#f97316", icon: Info, checked: true },
  ]);

  // Load real storage usage when entering the storage panel
  useEffect(() => {
    if (settingsPanelView !== "storage" || storageCleaned) return;
    let isMounted = true;
    (async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
          const estimate = await navigator.storage.estimate();
          const usedBytes = estimate.usage || 0;
          const quotaBytes = estimate.quota || (100 * 1024 * 1024 * 1024);
          const usedMb = Math.max(0, +(usedBytes / (1024 * 1024)).toFixed(1));
          const percent = Math.max(0, +((usedBytes / quotaBytes) * 100).toFixed(2));
          if (!isMounted) return;
          setStorageTotalMb(usedMb);
          setStoragePercentOfDevice(percent);
          const other    = +(usedMb * 0.670).toFixed(1);
          const video    = +(usedMb * 0.233).toFixed(1);
          const stickers = +(usedMb * 0.049).toFixed(1);
          const photos   = +(usedMb * 0.026).toFixed(1);
          const voice    = +Math.max(0, usedMb - other - video - stickers - photos).toFixed(1);
          setStorageCategories([
            { id: "other",    label: t("Другое"),    percent: 67.0, sizeMb: other,    color: "#f59e0b", icon: Database,  checked: true },
            { id: "video",    label: t("Видео"),      percent: 23.3, sizeMb: video,    color: "#3b82f6", icon: Monitor,   checked: true },
            { id: "stickers", label: t("Стикеры"),    percent: 4.9,  sizeMb: stickers, color: "#8b5cf6", icon: Sparkles,  checked: true },
            { id: "photos",   label: t("Фотографии"), percent: 2.6,  sizeMb: photos,   color: "#06b6d4", icon: ImageIcon, checked: true },
            { id: "voice",    label: t("Прочее"),     percent: 2.0,  sizeMb: voice,    color: "#f97316", icon: Info,      checked: true },
          ]);
        }
      } catch (e) {
        console.error("Storage estimation error", e);
      }
    })();
    // Preload Utya duck animation so modal renders instantly
    void fetchStickerAnimationData("/stickers/utyan-cache.json").catch(() => {});
    return () => { isMounted = false; };
  }, [settingsPanelView, storageCleaned, t]);

  const selectedStorageSize = storageCategories
    .filter((c) => c.checked)
    .reduce((acc, c) => acc + c.sizeMb, 0);

  async function handleCleanStorageCache() {
    if (storageCleaning) return;
    setStorageCleaning(true);
    setCleaningProgressPercent(0);
    setCleaningProgressModal(true);

    try {
      // 3-second smooth cleaning progress animation
      const startTime = Date.now();
      const duration = 2800;

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
          setCleaningProgressPercent(progress);
          if (progress >= 100) {
            clearInterval(interval);
            resolve();
          }
        }, 40);
      });

      if (typeof window !== "undefined" && "caches" in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (!name.includes("e2e") && !name.includes("auth")) {
            await caches.delete(name);
          }
        }
      }

      const freedMb = selectedStorageSize;
      setStorageTotalMb(0.0);
      setStorageCleaned(true);
      setStorageCategories((prev) => prev.map((c) => ({ ...c, sizeMb: 0.0, percent: 0 })));

      await new Promise((r) => setTimeout(r, 250));
      setCleaningProgressModal(false);

      showAppToast({
        title: t("Кэш очищен"),
        description: t("Освобождено {0} МБ на устройстве.", { 0: freedMb.toFixed(1) }),
        type: "success",
      });

    } catch {
      setCleaningProgressModal(false);
      showAppToast({
        title: t("Ошибка"),
        description: t("Не удалось полностью очистить кэш."),
        type: "error",
      });
    } finally {
      setStorageCleaning(false);
    }
  }

  const saveSettingsProfile = props.saveSettingsProfile ?? (async () => {
    try {
      setInternalProfileSaving(true);

      // 1. Wait for any active uploads in flight concurrently so blob: URLs are replaced with the uploaded server URLs
      let effectiveAvatar = settingsEditDraft?.avatarUrl;
      let effectiveMusic = settingsEditDraft?.musicUrl;
      let effectiveMusicCover = settingsEditDraft?.musicCoverUrl;
      let effectiveBackground = settingsEditDraft?.backgroundUrl;

      const [finalAv, finalMus, finalCov, finalBg] = await Promise.all([
        pendingUploadsRef.current.avatar ? pendingUploadsRef.current.avatar.catch(() => null) : Promise.resolve(null),
        pendingUploadsRef.current.music ? pendingUploadsRef.current.music.catch(() => null) : Promise.resolve(null),
        pendingUploadsRef.current.musicCover ? pendingUploadsRef.current.musicCover.catch(() => null) : Promise.resolve(null),
        pendingUploadsRef.current.background ? pendingUploadsRef.current.background.catch(() => null) : Promise.resolve(null),
      ]);

      if (finalAv) effectiveAvatar = finalAv;
      if (finalMus) effectiveMusic = finalMus;
      if (finalCov) effectiveMusicCover = finalCov;
      if (finalBg) effectiveBackground = finalBg;

      const sanitizeUrl = (url: string | null | undefined, fallback: string | null | undefined) => {
        if (!url || typeof url !== "string") return null;
        if (url.startsWith("blob:")) return fallback ?? null;
        return url;
      };

      const finalAvatar = sanitizeUrl(effectiveAvatar, selfProfile?.avatarUrl);
      const finalMusic = sanitizeUrl(effectiveMusic, selfProfile?.musicUrl);
      const finalCover = sanitizeUrl(effectiveMusicCover, selfProfile?.musicCoverUrl);
      const finalBackground = sanitizeUrl(effectiveBackground, selfProfile?.backgroundUrl);

      const payload = {
        displayName: settingsEditDraft.displayName?.trim() || selfProfile?.displayName || "User",
        link: settingsEditDraft.link?.trim() || selfProfile?.link || "user",
        description: settingsEditDraft.description !== undefined ? (settingsEditDraft.description?.trim() || null) : (selfProfile?.description ?? null),
        avatarUrl: finalAvatar,
        backgroundUrl: finalBackground !== undefined ? finalBackground : (selfProfile?.backgroundUrl ?? null),
        musicUrl: finalMusic,
        musicTitle: settingsEditDraft.musicTitle !== undefined ? (settingsEditDraft.musicTitle?.trim() || null) : (selfProfile?.musicTitle ?? null),
        musicAuthor: settingsEditDraft.musicAuthor !== undefined ? (settingsEditDraft.musicAuthor?.trim() || null) : (selfProfile?.musicAuthor ?? null),
        musicCoverUrl: finalCover,
        usernameHidden: Boolean(settingsEditDraft.usernameHidden),
      };

      const res = await apiRequest<any>("/api/settings/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (res) {
        if (props.setSelfProfile) {
          props.setSelfProfile((prev: any) => prev ? { ...prev, ...res } : prev);
        }
        setInternalEditDraft((prev) => ({ ...prev, ...res }));
        try {
          if (typeof window !== "undefined" && res.id) {
            const cacheKey = `eclipse:cache:self-profile:${res.id}`;
            const lastKey = `eclipse:cache:self-profile:last:v2`;
            const snapshot = { savedAt: Date.now(), me: res };
            window.localStorage.setItem(cacheKey, JSON.stringify(snapshot));
            window.localStorage.setItem(lastKey, res.id);
          }
          broadcastSelfProfileUpdated(res);
        } catch {}

        showAppToast({
          title: t("Профиль успешно сохранен"),
          type: "success",
        });
        setSettingsPanelView("main");
      }
    } catch (err: any) {
      console.error("Save profile error:", err);
      showAppToast({
        title: t("Ошибка при сохранении профиля"),
        description: err?.message || t("Не удалось сохранить профиль"),
        type: "error",
      });
    } finally {
      setInternalProfileSaving(false);
    }
  });

  const uploadSettingsAvatar = props.uploadSettingsAvatar ?? (async (e: ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    const prevAvatar = settingsEditDraft?.avatarUrl ?? selfProfile?.avatarUrl ?? null;
    const previewUrl = URL.createObjectURL(rawFile);
    setSettingsEditDraft((prev: any) => ({ ...prev, avatarUrl: previewUrl }));
    setInternalAvatarUploading(true);

    const doUpload = async (): Promise<string | null> => {
      try {
        let fileToUpload = rawFile;
        try {
          const compressed = await compressImageFile(rawFile, { maxWidth: 512, maxHeight: 512, quality: 0.85 });
          fileToUpload = compressed.file;
        } catch {}

        let uploadedUrl = "";
        if (props.uploadMediaFile) {
          const res = await props.uploadMediaFile(fileToUpload, "image");
          uploadedUrl = res?.url ?? "";
        } else {
          const formData = new FormData();
          formData.append("file", fileToUpload);
          formData.append("kind", "image");
          const res = await apiRequest<{ id: string; url: string }>("/api/media", { method: "POST", body: formData });
          uploadedUrl = res?.url ?? "";
        }
        if (uploadedUrl) {
          setSettingsEditDraft((prev: any) => ({ ...prev, avatarUrl: uploadedUrl }));
          return uploadedUrl;
        } else {
          setSettingsEditDraft((prev: any) => ({ ...prev, avatarUrl: prevAvatar }));
          return null;
        }
      } catch (err) {
        console.error("Avatar upload failed:", err);
        setSettingsEditDraft((prev: any) => ({ ...prev, avatarUrl: prevAvatar }));
        showAppToast({
          title: t("Не удалось загрузить аватар"),
          description: err instanceof Error ? err.message : undefined,
          type: "error",
        });
        return null;
      } finally {
        setInternalAvatarUploading(false);
        if (settingsAvatarInputRef.current) {
          settingsAvatarInputRef.current.value = "";
        }
      }
    };

    const promise = doUpload();
    pendingUploadsRef.current.avatar = promise;
    await promise;
  });

  const uploadSettingsMusic = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cleanFileName = file.name.replace(/\.[^/.]+$/, "").trim() || t("Аудиозапись");
    const previewUrl = URL.createObjectURL(file);
    const prevDraft = settingsEditDraft;
    setSettingsEditDraft((prev: any) => ({
      ...prev,
      musicUrl: previewUrl,
      musicTitle: prev?.musicTitle?.trim() ? prev.musicTitle : cleanFileName,
      musicAuthor: prev?.musicAuthor?.trim() ? prev.musicAuthor : t("Аудиозапись"),
    }));
    setSettingsMusicUploading(true);

    const doUpload = async (): Promise<string | null> => {
      try {
        let uploadedUrl = "";
        if (props.uploadMediaFile) {
          const res = await props.uploadMediaFile(file, "audio");
          uploadedUrl = res?.url ?? "";
        } else {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("kind", "audio");
          const res = await apiRequest<{ id: string; url: string }>("/api/media", {
            method: "POST",
            body: formData,
          });
          uploadedUrl = res?.url ?? "";
        }
        if (uploadedUrl) {
          setSettingsEditDraft((prev: any) => ({
            ...prev,
            musicUrl: uploadedUrl,
          }));
          showAppToast({
            title: t("Трек загружен"),
            description: t("Нажмите «Сохранить», чтобы применить изменения в профиле."),
            type: "success",
          });
          return uploadedUrl;
        } else {
          setSettingsEditDraft((prev: any) => ({
            ...prev,
            musicUrl: prevDraft?.musicUrl ?? null,
            musicTitle: prevDraft?.musicTitle ?? "",
            musicAuthor: prevDraft?.musicAuthor ?? "",
          }));
          return null;
        }
      } catch (err) {
        console.error("Music upload failed:", err);
        setSettingsEditDraft((prev: any) => ({
          ...prev,
          musicUrl: prevDraft?.musicUrl ?? null,
          musicTitle: prevDraft?.musicTitle ?? "",
          musicAuthor: prevDraft?.musicAuthor ?? "",
        }));
        showAppToast({
          title: t("Не удалось загрузить трек"),
          description: err instanceof Error ? err.message : undefined,
          type: "error",
        });
        return null;
      } finally {
        setSettingsMusicUploading(false);
        if (musicInputRef.current) {
          musicInputRef.current.value = "";
        }
      }
    };

    const promise = doUpload();
    pendingUploadsRef.current.music = promise;
    await promise;
  };

  const uploadSettingsMusicCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    const prevCover = settingsEditDraft?.musicCoverUrl ?? null;
    const previewUrl = URL.createObjectURL(rawFile);
    setSettingsEditDraft((prev: any) => ({
      ...prev,
      musicCoverUrl: previewUrl,
    }));
    setSettingsCoverUploading(true);

    const doUpload = async (): Promise<string | null> => {
      try {
        let fileToUpload = rawFile;
        try {
          const compressed = await compressImageFile(rawFile, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
          fileToUpload = compressed.file;
        } catch {}

        let uploadedUrl = "";
        if (props.uploadMediaFile) {
          const res = await props.uploadMediaFile(fileToUpload, "image");
          uploadedUrl = res?.url ?? "";
        } else {
          const formData = new FormData();
          formData.append("file", fileToUpload);
          formData.append("kind", "image");
          const res = await apiRequest<{ id: string; url: string }>("/api/media", {
            method: "POST",
            body: formData,
          });
          uploadedUrl = res?.url ?? "";
        }
        if (uploadedUrl) {
          setSettingsEditDraft((prev: any) => ({
            ...prev,
            musicCoverUrl: uploadedUrl,
          }));
          return uploadedUrl;
        } else {
          setSettingsEditDraft((prev: any) => ({
            ...prev,
            musicCoverUrl: prevCover,
          }));
          return null;
        }
      } catch (err) {
        console.error("Music cover upload failed:", err);
        setSettingsEditDraft((prev: any) => ({
          ...prev,
          musicCoverUrl: prevCover,
        }));
        showAppToast({
          title: t("Не удалось загрузить обложку"),
          description: err instanceof Error ? err.message : undefined,
          type: "error",
        });
        return null;
      } finally {
        setSettingsCoverUploading(false);
        if (musicCoverInputRef.current) {
          musicCoverInputRef.current.value = "";
        }
      }
    };

    const promise = doUpload();
    pendingUploadsRef.current.musicCover = promise;
    await promise;
  };

  const handleSelectProfileGradient = (gradientId: string | null) => {
    latestSelectedGradientRef.current = gradientId;
    setInternalEditDraft((prev: any) => ({
      ...prev,
      backgroundUrl: gradientId,
    }));
    setSettingsEditDraft((prev: any) => ({
      ...prev,
      backgroundUrl: gradientId,
    }));
    if (props.setSelfProfile) {
      props.setSelfProfile((prev: any) => (prev ? { ...prev, backgroundUrl: gradientId } : prev));
    }

    if (gradientSaveTimerRef.current) {
      clearTimeout(gradientSaveTimerRef.current);
    }

    gradientSaveTimerRef.current = setTimeout(async () => {
      const targetGradient = latestSelectedGradientRef.current;
      try {
        const res = await apiRequest<{
          id?: string;
          link?: string;
          displayName?: string;
          backgroundUrl?: string | null;
          description?: string | null;
          musicUrl?: string | null;
          musicTitle?: string | null;
          musicAuthor?: string | null;
          musicCoverUrl?: string | null;
        }>("/api/settings/profile", {
          method: "PATCH",
          body: JSON.stringify({
            backgroundUrl: targetGradient,
          }),
        });
        if (res && latestSelectedGradientRef.current === targetGradient) {
          if (props.setSelfProfile) {
            props.setSelfProfile((prev: any) => (prev ? { ...prev, ...res, backgroundUrl: targetGradient } : prev));
          }
          setInternalEditDraft((prev: any) => ({ ...prev, ...res, backgroundUrl: targetGradient }));
        }
      } catch (err) {
        console.error("Failed to update profile gradient:", err);
      }
    }, 350);
  };

  const handleBackgroundFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(file.name);
    const isGif = file.type === "image/gif" || /\.gif(\?|#|$)/i.test(file.name);

    // Limit file size: up to 20MB for video, 15MB for image
    const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
    const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (file.size > maxBytes) {
      showAppToast({
        title: isVideo
          ? t("Размер видео не должен превышать 20 МБ")
          : t("Размер изображения не должен превышать 15 МБ"),
        type: "error",
      });
      return;
    }

    // Check video duration: must be short (<= 30 seconds)
    if (isVideo) {
      try {
        const duration = await new Promise<number>((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => {
            URL.revokeObjectURL(v.src);
            resolve(v.duration);
          };
          v.onerror = () => {
            URL.revokeObjectURL(v.src);
            resolve(0);
          };
          v.src = URL.createObjectURL(file);
        });

        if (duration > 30) {
          showAppToast({
            title: t("Видео должно быть коротким (до 30 сек)"),
            type: "error",
          });
          return;
        }
      } catch {}
    }

    let fileToUpload: File = file;
    if (!isVideo && !isGif && file.type.startsWith("image/")) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.88 });
        if (compressed?.file) {
          fileToUpload = compressed.file;
        }
      } catch {}
    }

    setSettingsBackgroundUploading(true);
    try {
      const kind = isVideo ? "video" : "image";
      let uploadedUrl = "";
      if (props.uploadMediaFile) {
        const res = await props.uploadMediaFile(fileToUpload, kind);
        uploadedUrl = res?.url ?? "";
      } else {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("kind", kind);
        const res = await apiRequest<{ id: string; url: string }>("/api/media", {
          method: "POST",
          body: formData,
        });
        uploadedUrl = res?.url ?? "";
      }

      if (uploadedUrl) {
        latestSelectedGradientRef.current = uploadedUrl;
        setInternalEditDraft((prev: any) => ({ ...prev, backgroundUrl: uploadedUrl }));
        setSettingsEditDraft((prev: any) => ({ ...prev, backgroundUrl: uploadedUrl }));
        if (props.setSelfProfile) {
          props.setSelfProfile((prev: any) => (prev ? { ...prev, backgroundUrl: uploadedUrl } : prev));
        }

        broadcastSelfProfileUpdated({
          ...(selfProfile || {}),
          id: selfProfile?.id,
          link: selfProfile?.link || "",
          displayName: selfProfile?.displayName || "",
          backgroundUrl: uploadedUrl,
        });

        await apiRequest("/api/settings/profile", {
          method: "PATCH",
          body: JSON.stringify({ backgroundUrl: uploadedUrl }),
        });

        showAppToast({
          title: isVideo ? t("Видео-фон профиля установлен") : t("Фон профиля установлен"),
          type: "success",
        });
      }
    } catch (err: any) {
      console.error("Failed to upload custom profile background:", err);
      showAppToast({
        title: t("Не удалось загрузить фон профиля"),
        type: "error",
      });
    } finally {
      setSettingsBackgroundUploading(false);
    }
  };

  const liveBg = props.liveBackgroundSettings ?? {
    neatPreset: "none",
    opacity: 0.28,
    motionSpeed: 0.3,
    messageThemeEnabled: true,
    transparentVisual: true,
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
          key="settings-drawer-backdrop"
          type="button"
          className="fixed inset-0 z-[135] bg-black/35 md:bg-black/12"
          onClick={onClose}
          aria-label={t("Закрыть настройки")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      )}
      {isOpen && (
        <motion.div
          key="settings-drawer-content"
          data-app-panel
          className="fixed inset-y-0 left-0 z-[145] flex w-full flex-col overflow-hidden bg-[#1b1b1b] text-zinc-50 shadow-[18px_0_42px_rgba(0,0,0,0.28)] md:w-[350px] lg:w-[370px] md:inset-y-2 md:left-2 md:rounded-2xl"
          {...panelOverlayMotion(reducedMotion, "left")}
          onAnimationComplete={(target) => {
            // Exit retains the last open render; never hide the sidebar when exit finishes.
            if (isOpen && typeof target === "object" && "x" in target && target.x === 0) props.onTransitionComplete?.();
          }}
          style={{ ...uiAccentStyle, ...props.panelThemeStyle }}
        >
        <PanelNavigation direction={settingsNavDirection} className="h-full min-h-0">
          <motion.div
            key={`${settingsPanelView}-${settingsPrivacyDetail ?? settingsSecurityPanel ?? "root"}`}
            custom={settingsNavDirection}
            variants={settingsSubViewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex h-full min-h-0 flex-col"
          >
            {/* Header (when not main and not qr) */}
            {settingsPanelView !== "main" && settingsPanelView !== "qr" && settingsPanelView !== "custom-theme" ? (
              <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                <button
                  type="button"
                  onClick={() => {
                    if (settingsPanelView === "privacy" && settingsPrivacyDetail === "lastSeenExceptions") {
                      setSettingsPrivacyDetail("lastSeenVisibility");
                    } else if (settingsPanelView === "privacy" && settingsPrivacyDetail) {
                      setSettingsPrivacyDetail(null);
                    } else if (settingsPanelView === "security" && settingsSecurityPanel) {
                      setSettingsSecurityPanel(null);
                    } else if (settingsPanelView === "security-totp" || settingsPanelView === "security-password" || settingsPanelView === "security") {
                      setSettingsPanelView("privacy");
                    } else if (settingsPanelView === "scan-qr") {
                      setSettingsPanelView("sessions");
                    } else {
                      setSettingsPanelView("main");
                      setSettingsPrivacyDetail(null);
                      setSettingsSecurityPanel(null);
                      setSettingsMoreOpen(false);
                    }
                  }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
                  aria-label={t("Назад")}
                >
                  <ArrowLeft size={23} />
                </button>
                <h2 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-none">
                  {t(settingsPanelTitle ?? "")}
                </h2>
                {settingsPanelView === "edit" ? (
                  <button
                    type="button"
                    onClick={() => void saveSettingsProfile()}
                    disabled={settingsEditInvalid || settingsProfileSaving}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-50 cursor-pointer"
                    aria-label={t("Сохранить профиль")}
                  >
                    {settingsProfileSaving ? <Spinner className="h-5 w-5 text-zinc-300 animate-spin" /> : <Check size={22} />}
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Main Content */}
            <div className={cn("min-h-0 flex-1 overflow-y-auto no-scrollbar", settingsPanelView === "edit" ? "pb-24" : "", (settingsPanelView === "qr" || settingsPanelView === "custom-theme") ? "h-full w-full flex flex-col overflow-hidden" : "")}>
              {settingsPanelView === "main" ? (
                <div className="pb-6">
                  {/* Top Unified Gradient Profile Header Block matching desktop & mobile references */}
                  {(() => {
                    const effectiveGradient = getEffectiveProfileGradient(
                      selfProfile?.backgroundUrl,
                      selfProfile?.displayName,
                      selfProfile?.link
                    );
                    const effectiveAccent = getEffectiveProfileAccentColor(
                      selfProfile?.backgroundUrl,
                      selfProfile?.displayName,
                      selfProfile?.link
                    );

                    return (
                      <div
                        className="shrink-0 flex flex-col justify-between transition-all duration-300 relative overflow-hidden mb-3"
                        style={{
                          background: effectiveGradient || "transparent",
                        }}
                      >
                        {isMediaBackgroundUrl(selfProfile?.backgroundUrl) ? <>
                          <MediaBanner src={selfProfile.backgroundUrl!} className="absolute inset-0" mediaClassName="object-cover" autoPlay alt={t("Фон профиля")} />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/25" />
                        </> : null}
                        {/* Top Navbar Row */}
                        <div className="relative z-30 flex h-14 shrink-0 items-center justify-between px-4">
                          <button
                            type="button"
                            onClick={onClose}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                            aria-label={t("Закрыть")}
                          >
                            <ArrowLeft size={23} />
                          </button>
                          <h2 className="min-w-0 flex-1 text-left px-1.5 truncate text-[20px] font-bold text-white drop-shadow-sm leading-none">
                            {t("Настройки")}</h2>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSettingsPanelView("qr")}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                              aria-label={t("QR-код профиля")}
                            >
                              <QrCode size={21} />
                            </button>
                            <button
                              type="button"
                              onClick={handleOpenEditProfile}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                              aria-label={t("Редактировать профиль")}
                            >
                              <MdEdit size={22} />
                            </button>
                            <div className="relative z-50">
                              <button
                                type="button"
                                onClick={() => setSettingsMoreOpen((v) => !v)}
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                                aria-label={t("Еще")}
                              >
                                <MoreVertical size={22} />
                              </button>
                              <AnimatePresence>
                                {settingsMoreOpen ? (
                                  <motion.div
                                    className="absolute right-0 top-11 z-[100] w-36 overflow-hidden rounded-[18px] bg-[#1e1e1e]/95 p-1 shadow-[0_18px_38px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.08] backdrop-blur-2xl"
                                    initial={{ opacity: 0, scale: 0.9, y: -4, transformOrigin: "top right" }}
                                    animate={{ opacity: 1, scale: 1, y: 0, transformOrigin: "top right" }}
                                    exit={{ opacity: 0, scale: 0.9, y: -4, transformOrigin: "top right" }}
                                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSettingsMoreOpen(false);
                                        setShowLogoutConfirmModal(true);
                                      }}
                                      className="flex h-9 w-full items-center gap-2.5 rounded-[13px] px-3 text-left text-[13.5px] font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08] active:scale-[0.98] cursor-pointer"
                                    >
                                      <LogOut size={16} className="text-white" />
                                      <span>{t("Выйти")}</span>
                                    </button>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        {/* Avatar, Display Name, Status */}
                        <div className="relative z-10 flex flex-col items-center px-4 pt-3 pb-6 sm:pb-7 text-center">
                          <div className="relative w-[124px] h-[124px] sm:w-[118px] sm:h-[118px] flex items-center justify-center">
                            {/* Subtle elegant white radial halo behind avatar like in Telegram */}
                            {effectiveGradient ? (
                              <div
                                className="pointer-events-none absolute -inset-6 rounded-full opacity-35 blur-xl select-none"
                                style={{
                                  background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.12) 45%, transparent 70%)",
                                }}
                              />
                            ) : null}
                            <AnimatePresence mode="wait">
                              {selfStoryGroup && selfStoryGroup.stories.length > 0 ? (
                                <motion.button
                                  key="settings-story-avatar"
                                  type="button"
                                  onClick={(event) => {
                                    if (onOpenStory) {
                                      onOpenStory(event.currentTarget);
                                    } else if (isRealMediaAvatar(selfProfile?.avatarUrl)) {
                                      setShowAvatarViewer(true);
                                    }
                                  }}
                                  className="group relative flex items-center justify-center shrink-0 cursor-pointer rounded-full transition-transform active:scale-[0.98]"
                                  title={t("Просмотреть историю")}
                                  aria-label={t("Просмотреть свою историю")}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.22, ease: "easeOut" }}
                                >
                                  <StoryAvatarRing
                                    seen={!selfStoryGroup.hasUnviewed}
                                    stories={selfStoryGroup.stories}
                                    animateOnMount={animateStoryRing}
                                    className="w-[124px] h-[124px] p-[8px] sm:w-[118px] sm:h-[118px] sm:p-[7px]"
                                  >
                                    <MediaAvatar
                                      src={selfProfile?.avatarUrl ?? undefined}
                                      alt={selfProfile?.displayName ?? "U"}
                                      className="h-full w-full bg-zinc-700 text-white shadow-[0_14px_36px_rgba(0,0,0,0.32)] border-0 ring-0 outline-none"
                                      fallbackText={(selfProfile?.displayName ?? "U").slice(0, 1)}
                                      autoPlay
                                    />
                                  </StoryAvatarRing>
                                </motion.button>
                              ) : (
                                <motion.button
                                  key="settings-plain-avatar"
                                  type="button"
                                  onClick={() => {
                                    if (isRealMediaAvatar(selfProfile?.avatarUrl)) {
                                      setShowAvatarViewer(true);
                                    }
                                  }}
                                  className={cn(
                                    "group relative w-[108px] h-[108px] sm:w-[104px] sm:h-[104px] flex items-center justify-center shrink-0 rounded-full",
                                    isRealMediaAvatar(selfProfile?.avatarUrl)
                                      ? "cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                      : "cursor-default"
                                  )}
                                  title={isRealMediaAvatar(selfProfile?.avatarUrl) ? t("Нажмите, чтобы просмотреть фотографию") : undefined}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.22, ease: "easeOut" }}
                                >
                                  <MediaAvatar
                                    src={selfProfile?.avatarUrl ?? undefined}
                                    alt={selfProfile?.displayName ?? "U"}
                                    className="h-[108px] w-[108px] sm:h-[104px] sm:w-[104px] bg-zinc-700 text-white shadow-[0_14px_36px_rgba(0,0,0,0.32)] border-0 ring-0 outline-none"
                                    fallbackText={(selfProfile?.displayName ?? "U").slice(0, 1)}
                                    autoPlay
                                  />
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </div>
                          <p className="mt-2 max-w-full truncate text-[20px] font-semibold leading-tight text-white tracking-tight">
                            <VerifiedTitle showDetails kind="user" link={selfProfile?.link ?? ""}>{selfProfile?.displayName ?? t("Профиль")}</VerifiedTitle>
                          </p>
                          <span
                            className="relative mt-0.5 inline-flex items-center rounded-full px-2.5 py-0 text-[13px] font-medium text-white/80 select-none cursor-default"
                          >
                            <span>{t("в сети")}</span>
                          </span>
                        </div>

                        {/* Flush Edge-to-Edge Music Bar */}
                        {selfProfile?.musicUrl ? (
                          <div className="w-full relative z-10 mt-1">
                            <ProfileMusicCaption
                              url={selfProfile.musicUrl}
                              title={selfProfile.musicTitle}
                              author={selfProfile.musicAuthor}
                              coverUrl={selfProfile.musicCoverUrl}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Username Card */}
                  <div className="mx-5 mt-1 overflow-hidden rounded-[20px] bg-white/[0.04] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (selfProfile?.link) {
                          const cleanLink = `@${selfProfile.link.replace(/^@+/, "")}`;
                          void navigator.clipboard?.writeText(cleanLink);
                          showAppToast({
                            title: t("Уникальное имя скопировано"),
                            type: "success",
                            icon: "copy",
                          });
                        }
                      }}
                      className="mx-0.5 w-[calc(100%-4px)] rounded-[14px] flex min-h-[48px] items-center gap-3.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-400">
                        <AtSign size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-white break-words">
                          {selfProfile?.link ? `@${selfProfile.link.replace(/^@+/, "")}` : "username"}
                          {selfProfile?.secondaryLinks && selfProfile.secondaryLinks.length > 0 && (
                            <span className="block text-[13.5px] font-normal text-zinc-400 mt-0.5">
                              {t("а также")}{" "}
                              <span className="text-white font-semibold">
                                {selfProfile.secondaryLinks.map((l: string, idx: number) => (
                                  <React.Fragment key={l}>
                                    {idx > 0 && ", "}
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCollectibleModalUsername(l);
                                      }}
                                      className="cursor-pointer transition-colors duration-150 inline-block rounded-[6px] px-1 py-0.5 -mx-1 -my-0.5 hover:bg-white/10 active:bg-white/15 text-white select-none"
                                    >
                                      @{l.replace(/^@+/, "")}
                                    </span>
                                  </React.Fragment>
                                ))}
                              </span>
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-zinc-400">
                          {selfProfile?.secondaryLinks && selfProfile.secondaryLinks.length > 0
                            ? t("Уникальные имена")
                            : t("Уникальное имя")}
                        </span>
                      </span>
                    </button>
                    {selfProfile?.description ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (selfProfile.description) {
                            void navigator.clipboard?.writeText(selfProfile.description);
                            showAppToast({
                              title: t("Описание скопировано"),
                              type: "success",
                              icon: "copy",
                            });
                          }
                        }}
                        className="mx-0.5 w-[calc(100%-4px)] rounded-[14px] flex min-h-[48px] items-center gap-3.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-400">
                          <Info size={20} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-white">
                            {selfProfile.description}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-zinc-400">{t("О себе")}</span>
                        </span>
                      </button>
                    ) : null}
                  </div>

                  {/* Categories */}
                  <div className="mx-5 mt-2 overflow-hidden rounded-[20px] bg-white/[0.04] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-0.5">
                    {settingsMainItems.map((item) => {
                      const Icon = item.icon;
                      const sessionCountLabel = item.view === "sessions" && Array.isArray(settingsSessions) && settingsSessions.length > 0 ? String(settingsSessions.length) : null;
                      return (
                        <button
                          key={item.view}
                          type="button"
                          onClick={() => setSettingsPanelView(item.view)}
                          className="mx-0.5 w-[calc(100%-4px)] rounded-[14px] flex min-h-[44px] items-center gap-3.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center text-zinc-400">
                            <Icon size={19} />
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="block truncate text-[15px] font-medium text-zinc-100">
                              {t(item.label ?? "")}
                            </span>
                            {sessionCountLabel ? (
                              <span className="ml-auto shrink-0 text-[13px] font-semibold text-zinc-400">
                                {sessionCountLabel}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : settingsPanelView === "edit" ? (
                <div className="pb-5 space-y-4">
                  {/* Avatar Uploader */}
                  <div className="flex justify-center px-5 py-4">
                    <button
                      type="button"
                      disabled={settingsAvatarUploading}
                      onClick={() => !settingsAvatarUploading && settingsAvatarInputRef.current?.click()}
                      className="relative grid h-[130px] w-[130px] place-items-center overflow-hidden rounded-full bg-zinc-800 text-white group cursor-pointer border-0 ring-0 outline-none disabled:opacity-85"
                      title={t("Выбрать новую фотографию")}
                    >
                      <Avatar className="h-[130px] w-[130px] border-0 ring-0 outline-none">
                        <AvatarImage className="object-cover border-0 ring-0 outline-none" src={settingsEditDraft?.avatarUrl ?? selfProfile?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-3xl font-bold bg-zinc-800 border-0 ring-0">{(selfProfile?.displayName ?? "U").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      {/* Camera with Plus overlay or Spinner */}
                      <span className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/50">
                        {settingsAvatarUploading ? (
                          <Spinner className="h-8 w-8 text-white animate-spin" />
                        ) : (
                          <div className="relative flex items-center justify-center">
                            <Camera size={44} className="text-white drop-shadow-md stroke-[2.2]" />
                            <div className="absolute -bottom-2.5 -right-2.5 flex items-center justify-center">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                <path
                                  d="M12 4v16m-8-8h16"
                                  stroke="currentColor"
                                  strokeWidth="3.6"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                      </span>
                    </button>
                    <input
                      ref={settingsAvatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void uploadSettingsAvatar(e)}
                    />
                  </div>

                  {/* Profile Edit Inputs */}
                  <div className="space-y-3.5">
                    {/* Name and Bio Card */}
                    <div className="mx-5 overflow-hidden rounded-[24px] bg-white/[0.04] p-4 space-y-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                      <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5">
                        <input
                          type="text"
                          value={settingsEditDraft?.displayName ?? ""}
                          onChange={(e) => setSettingsEditDraft((prev: any) => ({ ...prev, displayName: e.target.value }))}
                          className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500"
                          placeholder={t("Имя")}
                          maxLength={64}
                        />
                      </div>

                      <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3">
                        <textarea
                          value={settingsEditDraft?.description ?? ""}
                          onChange={(e) => setSettingsEditDraft((prev: any) => ({ ...prev, description: e.target.value }))}
                          className="min-h-[46px] w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500 resize-none leading-relaxed"
                          placeholder={t("О себе (необязательно)")}
                          maxLength={256}
                        />
                      </div>
                    </div>
                    <p className="px-7 text-[12.5px] text-zinc-500 leading-snug">


                      {t("Расскажите немного о себе, своих увлечениях или проектах.")}<br />{t("Пример: 20 лет, музыкант, пишу треки и создаю визуальный арт")}</p>

                    {/* Unique Name (Username) Card with Hide Function */}
                    <div className="mx-5 overflow-hidden rounded-[24px] bg-white/[0.04] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[14px] font-medium text-zinc-300">
                          {t("Уникальное имя")}</span>
                        <button
                          type="button"
                          onClick={() => setSettingsEditDraft((prev: any) => ({ ...prev, usernameHidden: !prev?.usernameHidden }))}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors cursor-pointer select-none",
                            settingsEditDraft?.usernameHidden
                              ? "bg-white/15 text-white"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                          )}
                          title={settingsEditDraft?.usernameHidden
                            ? t("Уникальное имя скрыто")
                            : t("Скрывать уникальное имя")}
                        >
                          {settingsEditDraft?.usernameHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span>{settingsEditDraft?.usernameHidden
                            ? t("Скрыто")
                            : t("Скрывать")}</span>
                        </button>
                      </div>
                      <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5">
                        <input
                          type="text"
                          value={settingsEditDraft?.link ?? ""}
                          onChange={(e) => setSettingsEditDraft((prev: any) => ({ ...prev, link: e.target.value }))}
                          className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500"
                          placeholder="username"
                          maxLength={32}
                        />
                      </div>
                      {linkInvalid ? (
                        <p className="px-2 pt-1 text-[12px] font-medium text-red-400">


                          {t("Уникальное имя должно содержать 4–32 символа (латиница a–z, 0–9, _)")}</p>
                      ) : null}
                    </div>

                    {/* Explanatory notes matching Telegram/Eclipse style */}
                    <div className="space-y-2.5 px-7 text-[12.5px] text-zinc-500 leading-relaxed">
                      <p>



                        {t("Вы можете выбрать уникальное имя в ")}<strong className="font-semibold text-zinc-300">Eclipse</strong>{t(". В этом случае другие пользователи смогут найти вас по этому имени и связаться с вами.")}</p>
                      <p>


                        {t("Если уникальное имя скрыто, оно не будет отображаться в вашем публичном профиле для других пользователей.")}</p>
                      <p>



                        {t("Можно использовать символы ")}<strong className="font-semibold text-zinc-300">a–z</strong>, <strong className="font-semibold text-zinc-300">0–9</strong> {t(" и знак подчеркивания. Минимальная длина — ")}<strong className="font-semibold text-zinc-300">4</strong> {t(" символа.")}</p>
                    </div>

                    {/* Music Upload Card */}
                    <div className="mx-5 overflow-hidden rounded-[24px] bg-white/[0.04] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="grid h-7 w-7 shrink-0 place-items-center text-zinc-400">
                            <Music size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold text-white">{t("Музыка в профиле")}</span>
                            <span className="block text-[12px] text-zinc-400">
                              {settingsMusicUploading ? t("Загрузка аудиофайла...") : settingsEditDraft?.musicUrl ? t("Трек загружен") : t("Загрузите трек (MP3, WAV)")}
                            </span>
                          </div>
                        </div>

                        {settingsEditDraft?.musicUrl ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void saveSettingsProfile()}
                              disabled={settingsProfileSaving || settingsEditInvalid}
                              className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                              title={t("Сохранить изменения")}
                              aria-label={t("Сохранить")}
                            >
                              {settingsProfileSaving || settingsMusicUploading ? <Spinner className="h-4 w-4 text-zinc-200 animate-spin" /> : <Check size={18} />}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSettingsEditDraft((prev: any) => ({
                                  ...prev,
                                  musicUrl: null,
                                  musicTitle: "",
                                  musicAuthor: "",
                                  musicCoverUrl: null,
                                }))
                              }
                              className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-red-400 hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                              title={t("Удалить аудиофайл")}
                              aria-label={t("Удалить файл")}
                            >
                              <Trash size={17} />
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {settingsEditDraft?.musicUrl ? (
                        <div className="space-y-3 pt-0.5">
                          {/* Track Info & Cover Row */}
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => !settingsCoverUploading && musicCoverInputRef.current?.click()}
                              className="relative h-[96px] w-[96px] shrink-0 cursor-pointer overflow-hidden rounded-[18px] bg-white/[0.06] border border-white/[0.08] hover:border-white/20 transition-all group flex items-center justify-center select-none shadow-sm"
                              title={t("Нажмите, чтобы изменить обложку")}
                            >
                              {settingsEditDraft.musicCoverUrl ? (
                                <img
                                  src={settingsEditDraft.musicCoverUrl}
                                  alt={t("Обложка")}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-zinc-400 gap-1 p-2 text-center">
                                  <Music size={24} className="group-hover:scale-110 transition-transform duration-200" />
                                  <span className="text-[10px] text-zinc-400 font-medium leading-tight">{t("Обложка")}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera size={18} className="text-white mb-0.5" />
                                <span className="text-[10px] font-semibold text-white">{t("Изменить")}</span>
                              </div>
                              {settingsCoverUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/65">
                                  <Spinner className="h-5 w-5 text-white animate-spin" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-3.5 py-2">
                                <input
                                  type="text"
                                  value={settingsEditDraft.musicTitle ?? ""}
                                  onChange={(e) =>
                                    setSettingsEditDraft((prev: any) => ({ ...prev, musicTitle: e.target.value }))
                                  }
                                  placeholder={t("Название трека")}
                                  className="w-full bg-transparent text-[14.5px] font-normal text-white outline-none placeholder:text-zinc-500"
                                  maxLength={64}
                                />
                              </div>

                              <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-3.5 py-2">
                                <input
                                  type="text"
                                  value={settingsEditDraft.musicAuthor ?? ""}
                                  onChange={(e) =>
                                    setSettingsEditDraft((prev: any) => ({ ...prev, musicAuthor: e.target.value }))
                                  }
                                  placeholder={t("Исполнитель")}
                                  className="w-full bg-transparent text-[14.5px] font-normal text-white outline-none placeholder:text-zinc-500"
                                  maxLength={64}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={settingsMusicUploading}
                          onClick={() => musicInputRef.current?.click()}
                          className="w-full h-10 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm gap-2 border-0 shadow-none outline-none cursor-pointer"
                        >
                          {settingsMusicUploading ? <Spinner className="h-4 w-4 animate-spin" /> : <><Music size={16} /> {t(" Выбрать аудиофайл")}</>}
                        </Button>
                      )}

                      <input
                        ref={musicInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={uploadSettingsMusic}
                      />
                      <input
                        ref={musicCoverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={uploadSettingsMusicCover}
                      />
                    </div>

                  </div>
                </div>
              ) : settingsPanelView === "privacy" || settingsPanelView === "security" ? (
                settingsPrivacyDetail ? (
                  /* Detail Sub-Screen for selected Privacy item */
                  settingsPrivacyDetail === "lastSeenExceptions" ? (
                    <div className="p-4 space-y-4">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        <input
                          type="text"
                          value={exceptionSearchQuery}
                          onChange={(e) => setExceptionSearchQuery(e.target.value)}
                          placeholder={t("Поиск по контактам и @username...")}
                          className="w-full h-10 pl-9 pr-9 rounded-[14px] bg-white/[0.06] border-0 text-[14px] text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                        />
                        {exceptionSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => setExceptionSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <X size={15} />
                          </button>
                        ) : null}
                      </div>

                      {/* Current Exceptions list */}
                      {(settingsPrivacy.presenceExceptionUsers || []).length > 0 ? (
                        <PrivacySection title={t("В исключениях ({0})", { 0: (settingsPrivacy.presenceExceptionUsers || []).length })}>
                          <div className="space-y-0.5">
                            {(settingsPrivacy.presenceExceptionUsers || []).map((excUser: SettingsPrivacyUser) => (
                              <div
                                key={excUser.id}
                                className="w-full rounded-[14px] flex min-h-[56px] items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <MediaAvatar
                                    src={excUser.avatarUrl ?? undefined}
                                    alt={excUser.displayName || excUser.link}
                                    className="h-9 w-9 rounded-full shrink-0"
                                    fallbackText={(excUser.displayName || excUser.link || "?").slice(0, 1)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[14.5px] font-medium text-zinc-100 truncate">
                                      {excUser.displayName || excUser.link}
                                    </p>
                                    {excUser.link ? (
                                      <p className="text-[12px] text-zinc-400 truncate">@{excUser.link}</p>
                                    ) : null}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void removeExceptionDirectly(excUser.id)}
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-zinc-400 hover:text-red-400 hover:bg-white/[0.1] transition-colors cursor-pointer"
                                  title={t("Удалить из исключений")} aria-label={t("Удалить из исключений")}
                                >
                                  <X size={15} strokeWidth={2} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </PrivacySection>
                      ) : null}

                      {/* Add from Contacts / Search results */}
                      <PrivacySection title={exceptionSearchQuery ? t("Результаты поиска") : t("Добавить из контактов")}>
                        {exceptionCandidatesLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Spinner className="h-5 w-5 text-zinc-400 animate-spin" />
                          </div>
                        ) : (() => {
                          const query = exceptionSearchQuery.toLowerCase().trim().replace(/^@+/, "");
                          const filtered = exceptionCandidates.filter((cand) => {
                            if (!query) return true;
                            return (
                              cand.displayName.toLowerCase().includes(query) ||
                              cand.link.toLowerCase().includes(query)
                            );
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="py-6 text-center text-[13px] text-zinc-500">
                                {exceptionSearchQuery ? t("Пользователи не найдены") : t("Нет контактов для добавления")}
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-0.5">
                              {filtered.map((cand) => {
                                const isAdded = (settingsPrivacy.presenceExceptionUserIds || []).includes(cand.id);
                                return (
                                  <button type="button"
                                    key={cand.id}
                                    onClick={() => void handleToggleException(cand)}
                                    className={cn(
                                      "w-full rounded-[14px] flex min-h-[56px] items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer transition-colors",
                                      isAdded ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                                    )}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <MediaAvatar
                                        src={cand.avatarUrl ?? undefined}
                                        alt={cand.displayName || cand.link}
                                        className="h-9 w-9 rounded-full shrink-0"
                                        fallbackText={(cand.displayName || cand.link || "?").slice(0, 1)}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[14.5px] font-medium text-zinc-100 truncate">
                                          {cand.displayName || cand.link}
                                        </p>
                                        {cand.link ? (
                                          <p className="text-[12px] text-zinc-400 truncate">@{cand.link}</p>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="shrink-0 pl-2">
                                      {isAdded ? (
                                        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-zinc-950">
                                          <Check size={15} strokeWidth={2.5} />
                                        </span>
                                      ) : (
                                        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-zinc-300">
                                          <Plus size={15} strokeWidth={2} />
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </PrivacySection>
                    </div>
                  ) : (
                  <div className="p-4 space-y-4">
                    <PrivacySection title={SETTINGS_PRIVACY_DETAIL_TITLES[settingsPrivacyDetail] || t("Настройка")}>
                      {settingsPrivacyDetail === "lastSeenVisibility" || settingsPrivacyDetail === "onlineVisibility" ? (
                        <>
                          {[
                            { value: "all", label: t("Все") },
                            { value: "contacts", label: t("Мои контакты") },
                            { value: "none", label: t("Никто") },
                          ].map((opt) => {
                            const currentVal = settingsPrivacy.lastSeenVisibility;
                            const selected = currentVal === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => void updatePrivacyInternal({ lastSeenVisibility: opt.value as any, onlineVisibility: opt.value as any })}
                                className={cn(
                                  "mx-0.5 w-[calc(100%-4px)] rounded-[14px] flex min-h-[48px] items-center justify-between px-3.5 py-2.5 text-left transition-all hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer",
                                  selected ? "bg-white/[0.06]" : ""
                                )}
                              >
                                <span className="text-[15px] font-medium text-zinc-100">{opt.label}</span>
                                <SettingsRadioIndicator selected={selected} />
                              </button>
                            );
                          })}
                        </>
                      ) : settingsPrivacyDetail === "firstMessagePolicy" ? (
                        <>
                          {[
                            { value: "all", label: t("Все пользователи") },
                            { value: "contacts", label: t("Только контакты") },
                            { value: "none", label: t("Никто (запретить новые диалоги)") },
                          ].map((opt) => {
                            const selected = settingsPrivacy.firstMessagePolicy === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => void updatePrivacyInternal({ firstMessagePolicy: opt.value as any })}
                                className={cn(
                                  "mx-0.5 w-[calc(100%-4px)] rounded-[14px] flex min-h-[48px] items-center justify-between px-3.5 py-2.5 text-left transition-all hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer",
                                  selected ? "bg-white/[0.06]" : ""
                                )}
                              >
                                <span className="text-[15px] font-medium text-zinc-100">{opt.label}</span>
                                <SettingsRadioIndicator selected={selected} />
                              </button>
                            );
                          })}
                        </>
                      ) : settingsPrivacyDetail === "newChatAutoDeleteDays" ? (
                        <>
                          {[
                            { value: null, label: t("Выключено") },
                            { value: 1, label: t("Через 1 день") },
                            { value: 7, label: t("Через 7 дней") },
                            { value: 30, label: t("Через 30 дней") },
                          ].map((opt) => {
                            const selected = settingsPrivacy.newChatAutoDeleteDays === opt.value;
                            return (
                              <button
                                key={String(opt.value)}
                                type="button"
                                onClick={() => void updatePrivacyInternal({ newChatAutoDeleteDays: opt.value as any })}
                                className={cn(
                                  "mx-0.5 w-[calc(100%-4px)] rounded-[14px] flex min-h-[48px] items-center justify-between px-3.5 py-2.5 text-left transition-all hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer",
                                  selected ? "bg-white/[0.06]" : ""
                                )}
                              >
                                <span className="text-[15px] font-medium text-zinc-100">{opt.label}</span>
                                <SettingsRadioIndicator selected={selected} />
                              </button>
                            );
                          })}
                        </>
                      ) : null}
                    </PrivacySection>

                    {settingsPrivacyDetail === "lastSeenVisibility" || settingsPrivacyDetail === "onlineVisibility" ? (
                      <PrivacySection title={t("Исключения")}>
                        <button type="button"
                          onClick={() => void openExceptionsSubView()}
                          className="mx-1 w-[calc(100%-8px)] rounded-[14px] flex min-h-[48px] items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer"
                        >
                          {/* Left: Icon and Text */}
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <span className="grid h-9 w-9 shrink-0 place-items-center text-zinc-300">
                              {settingsPrivacy.lastSeenVisibility === "all" ? (
                                <UserX size={22} />
                              ) : settingsPrivacy.lastSeenVisibility === "none" ? (
                                <UserCheck size={22} />
                              ) : (
                                <Users size={22} />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="block text-[15px] font-medium text-zinc-100">
                                {settingsPrivacy.lastSeenVisibility === "all"
                                  ? t("Никогда не показывать")
                                  : settingsPrivacy.lastSeenVisibility === "none"
                                  ? t("Всегда показывать")
                                  : t("Исключения")}
                              </span>
                              <span className="block mt-0.5 text-[12px] text-zinc-400 leading-normal">
                                {settingsPrivacy.lastSeenVisibility === "all"
                                  ? t("Скрыть активность от выбранных")
                                  : settingsPrivacy.lastSeenVisibility === "none"
                                  ? t("Показывать только выбранным")
                                  : t("Исключения из правил")}
                              </span>
                            </div>
                          </div>

                          {/* Right: Exception count and right arrow */}
                          <div className="flex items-center gap-2 shrink-0 pl-1 text-zinc-400">
                            <span className="text-[14px] font-normal">
                              {(settingsPrivacy.presenceExceptionUserIds || []).length}
                            </span>
                            <ChevronRight size={17} className="shrink-0 text-zinc-500" />
                          </div>
                        </button>
                      </PrivacySection>
                    ) : null}

                    {settingsPrivacyDetail === "lastSeenVisibility" ? (
                      <PrivacySection title={t("Индикатор активности")}>
                        <PrivacyToggleRow
                          icon={EyeOff}
                          label={t("Скрыть статус ввода")}
                          description={t("Скрывает всю вашу активность")}
                          checked={!settingsPrivacy.showTyping}
                          onChange={(val) => void updatePrivacyInternal({ showTyping: !val, showMediaActivity: !val })}
                        />
                      </PrivacySection>
                    ) : null}
                  </div>
                )) : (
                  /* Main Privacy & Security Overview */
                  <div className="p-4 space-y-4">
                    <PrivacySection title={t("Приватность")}>
                      <PrivacyNavigationRow
                        label={t("Кто видит мою активность")}
                        value={settingsPrivacy.lastSeenVisibility === "all" ? t("Все") : settingsPrivacy.lastSeenVisibility === "contacts" ? t("Контакты") : t("Никто")}
                        onClick={() => setSettingsPrivacyDetail("lastSeenVisibility")}
                      />
                      <PrivacyToggleRow
                        label={t("Прочтение сообщений")}
                        description={t("Скрывать отметку о прочтении сообщений")}
                        checked={!settingsPrivacy.showReadReceipts}
                        onChange={(val) => void updatePrivacyInternal({ showReadReceipts: !val })}
                      />
                      <PrivacyToggleRow
                        label={t("Поиск по username")}
                        description={t("Разрешить поиск вашей учетной записи по уникальному имени")}
                        checked={settingsPrivacy.allowUsernameSearch}
                        onChange={(val) => void updatePrivacyInternal({ allowUsernameSearch: val })}
                      />
                      <PrivacyToggleRow
                        label={t("Добавление в группы")}
                        description={t("Разрешить другим добавлять вас в группы")}
                        checked={settingsPrivacy.allowGroupAdd}
                        onChange={(val) => void updatePrivacyInternal({ allowGroupAdd: val })}
                      />
                      <PrivacyNavigationRow
                        label={t("Новые сообщения")}
                        value={settingsPrivacy.firstMessagePolicy === "all" ? t("Все") : settingsPrivacy.firstMessagePolicy === "contacts" ? t("Контакты") : t("Никто")}
                        onClick={() => setSettingsPrivacyDetail("firstMessagePolicy")}
                      />
                      <PrivacyNavigationRow
                        label={t("Автоудаление новых чатов")}
                        value={settingsPrivacy.newChatAutoDeleteDays ? t("Через {0}д", { 0: settingsPrivacy.newChatAutoDeleteDays }) : t("Выключено")}
                        onClick={() => setSettingsPrivacyDetail("newChatAutoDeleteDays")}
                      />
                    </PrivacySection>

                    <PrivacySection title={t("Безопасность")}>
                      <PrivacyNavigationRow
                        icon={FaLock}
                        label={t("Двухфакторная аутентификация (2FA)")}
                        value={settingsTotpEnabled ? t("Включено") : t("Выключено")}
                        onClick={() => {
                          setSettingsPanelView("security-totp");
                          if (Date.now() < passwordVerifiedUntil && !settingsTotpEnabled && !settingsTotpQrUrl) {
                            void startTotpSetupInternal();
                          }
                        }}
                      />
                      <PrivacyNavigationRow
                        icon={FaKey}
                        label={t("Сменить пароль")}
                        value={t("Изменение пароля аккаунта")}
                        onClick={() => setSettingsPanelView("security-password")}
                      />
                    </PrivacySection>
                  </div>
                )
              ) : settingsPanelView === "chats" ? (
                /* Customization / Appearance Panel */
                <div className="p-4 space-y-4 pb-8">
                  {/* Profile Color Customization matching Telegram & screenshots */}
                  {(() => {
                    const currentBg = settingsEditDraft?.backgroundUrl !== undefined ? settingsEditDraft.backgroundUrl : (selfProfile?.backgroundUrl ?? null);
                    const isCustomMediaBg = isMediaBackgroundUrl(currentBg);
                    const previewGradient = getEffectiveProfileGradient(
                      currentBg,
                      selfProfile?.displayName,
                      selfProfile?.link
                    );
                    const previewAccent = getEffectiveProfileAccentColor(
                      currentBg,
                      selfProfile?.displayName,
                      selfProfile?.link
                    );
                    const defaultPresetId = getDefaultProfilePresetId(
                      selfProfile?.displayName,
                      selfProfile?.link
                    );

                    return (
                      <section className="space-y-1.5">
                        <p className="px-2 pb-0.5 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">{t("Фон профиля")}</p>
                        <div className="overflow-hidden rounded-[20px] bg-white/[0.04] shadow-md flex flex-col">
                          {/* Live Preview Header (Touches Top, Left and Right seamlessly) */}
                          <div
                            className="relative w-full px-4 pt-6 pb-5 text-center flex flex-col items-center justify-center min-h-[200px] overflow-hidden select-none"
                            style={{
                              background: previewGradient || "transparent",
                            }}
                          >
                            {isCustomMediaBg ? (
                              <>
                                <MediaBanner
                                  src={currentBg}
                                  className="absolute inset-0"
                                  mediaClassName="object-cover"
                                  autoPlay
                                  alt={t("Фон профиля")}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/25 pointer-events-none" />
                              </>
                            ) : null}
                            <div className="relative w-[114px] h-[114px] shrink-0 aspect-square flex items-center justify-center">
                              {/* Subtle elegant white radial halo behind avatar like in Telegram */}
                              {(previewGradient || isCustomMediaBg) ? (
                                <div
                                  className="pointer-events-none absolute -inset-5 rounded-full opacity-30 blur-xl select-none"
                                  style={{
                                    background: "radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 45%, transparent 70%)",
                                  }}
                                />
                              ) : null}
                              {selfStoryGroup && selfStoryGroup.stories.length > 0 ? (
                                <StoryAvatarRing
                                  seen={!selfStoryGroup.hasUnviewed}
                                  stories={selfStoryGroup.stories}
                                  className="w-[114px] h-[114px] p-[6px] shrink-0 aspect-square"
                                >
                                  <MediaAvatar
                                    src={selfProfile?.avatarUrl ?? undefined}
                                    alt={selfProfile?.displayName ?? "Avatar"}
                                    className="h-full w-full shrink-0 aspect-square rounded-full bg-zinc-700 text-white shadow-[0_12px_32px_rgba(0,0,0,0.32)] border-0 ring-0 outline-none"
                                    imgClassName="aspect-square size-full object-cover rounded-full"
                                    fallbackText={(selfProfile?.displayName ?? "U").slice(0, 1)}
                                  />
                                </StoryAvatarRing>
                              ) : (
                                <MediaAvatar
                                  src={selfProfile?.avatarUrl ?? undefined}
                                  alt={selfProfile?.displayName ?? "Avatar"}
                                  className="h-[104px] w-[104px] shrink-0 aspect-square rounded-full bg-zinc-700 text-white shadow-[0_12px_32px_rgba(0,0,0,0.32)] border-0 ring-0 outline-none"
                                  imgClassName="aspect-square size-full object-cover rounded-full"
                                  fallbackText={(selfProfile?.displayName ?? "U").slice(0, 1)}
                                />
                              )}
                            </div>

                            <div className="relative z-10 mt-2.5 flex max-w-full items-center justify-center gap-[5px] px-3">
                              <p className="min-w-0 truncate text-[19px] font-semibold leading-tight text-white tracking-tight">
                                <VerifiedTitle showEmojiStatus={false} kind="user" link={selfProfile?.link ?? ""}>{selfProfile?.displayName ?? t("Профиль")}</VerifiedTitle>
                              </p>
                              <EmojiStatusControl value={selfProfile?.emojiStatusId ?? null} glass={liveBg.transparentVisual}
                                onChange={async emojiStatusId => {
                                  const saved = await apiRequest<{ emojiStatusId: string | null }>("/api/settings/profile", {
                                    method: "PATCH", body: JSON.stringify({ emojiStatusId }),
                                  });
                                  props.setSelfProfile?.((prev: SelfProfile | null) => prev ? { ...prev, emojiStatusId: saved.emojiStatusId } : prev);
                                  props.setSettingsProfileDetails?.((prev: SettingsProfileDetails | null) => prev ? { ...prev, emojiStatusId: saved.emojiStatusId } : prev);
                                  if (selfProfile) broadcastSelfProfileUpdated({ ...selfProfile, emojiStatusId: saved.emojiStatusId });
                                }} />
                            </div>
                            <span
                              className="relative z-10 mt-0.5 inline-flex items-center rounded-full px-2.5 py-0 text-[12.5px] font-medium text-white/80"
                            >
                              <span>{t("в сети")}</span>
                            </span>
                          </div>

                          {/* Bottom Controls Panel */}
                          <div className="p-4 pt-3.5 space-y-3 bg-black/20">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
                                {t("Градиент или медиа")}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSelectProfileGradient("none")}
                                  title={t("Без фона")}
                                  aria-label={t("Без фона")}
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-full transition-all duration-200 cursor-pointer select-none",
                                    (!currentBg || currentBg === "none")
                                      ? "text-white bg-white/20 shadow-sm scale-105"
                                      : "text-zinc-400 hover:text-white hover:bg-white/10"
                                  )}
                                >
                                  <Ban size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => backgroundInputRef.current?.click()}
                                  disabled={settingsBackgroundUploading}
                                  title={t("Загрузить фото или видео фон")}
                                  aria-label={t("Загрузить фон")}
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-full transition-all duration-200 cursor-pointer select-none",
                                    isCustomMediaBg
                                      ? "text-white bg-white/20 shadow-sm scale-105"
                                      : "text-zinc-400 hover:text-white hover:bg-white/10"
                                  )}
                                >
                                  {settingsBackgroundUploading ? (
                                    <Spinner className="size-4 text-white animate-spin" />
                                  ) : (
                                    <ImagePlus size={16} />
                                  )}
                                </button>
                                <input
                                  ref={backgroundInputRef}
                                  type="file"
                                  accept="image/*,video/mp4,video/webm,video/quicktime"
                                  className="hidden"
                                  onChange={handleBackgroundFileChange}
                                />
                              </div>
                            </div>

                            <div className="space-y-2.5">
                              {/* Row 1: 8 Stock Colors */}
                              <div className="flex items-center justify-between w-full">
                                {PROFILE_GRADIENT_PRESETS.filter((p) => !p.isDuoTone).map((preset) => {
                                  const isSelected = currentBg === preset.id;

                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() => handleSelectProfileGradient(preset.id)}
                                      title={t(preset.name ?? "")}
                                      aria-label={t(preset.name ?? "")}
                                      className={cn(
                                        "h-8 w-8 shrink-0 aspect-square rounded-full cursor-pointer transition-all duration-200 relative shadow-sm outline-none",
                                        isSelected
                                          ? "scale-[1.12] ring-2 ring-white ring-offset-2 ring-offset-[#1b1c20] shadow-[0_4px_12px_rgba(0,0,0,0.35)] z-10"
                                          : "opacity-90 hover:opacity-100 hover:scale-105 active:scale-95"
                                      )}
                                      style={{
                                        background: preset.gradient,
                                      }}
                                    >
                                      {isSelected ? (
                                        <span className="absolute inset-0 grid place-items-center">
                                          <Check size={13} strokeWidth={2.8} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                                        </span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Row 2: 8 Duotone Diagonal Gradients */}
                              <div className="flex items-center justify-between w-full">
                                {PROFILE_GRADIENT_PRESETS.filter((p) => p.isDuoTone).map((preset) => {
                                  const isSelected = currentBg === preset.id;

                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() => handleSelectProfileGradient(preset.id)}
                                      title={t(preset.name ?? "")}
                                      aria-label={t(preset.name ?? "")}
                                      className={cn(
                                        "h-8 w-8 shrink-0 aspect-square rounded-full cursor-pointer transition-all duration-200 relative shadow-sm overflow-hidden outline-none",
                                        isSelected
                                          ? "scale-[1.12] ring-2 ring-white ring-offset-2 ring-offset-[#1b1c20] shadow-[0_4px_12px_rgba(0,0,0,0.35)] z-10"
                                          : "opacity-90 hover:opacity-100 hover:scale-105 active:scale-95"
                                      )}
                                      style={{
                                        background: preset.gradient,
                                      }}
                                    >
                                      {isSelected ? (
                                        <span className="absolute inset-0 grid place-items-center">
                                          <Check size={13} strokeWidth={2.8} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                                        </span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  <PrivacySection title={t("Цветовая тема")}>
                    {(() => {
                      const activePreset = SETTINGS_LIVE_PRESETS.find((p) => p.id === localThemePreset) || SETTINGS_LIVE_PRESETS[0];
                      const customTheme = liveBg.customThemeEnabled ? liveBg.customTheme : null;
                      const activeBackdrop = customTheme ? customThemeChatBackground(customTheme) : (THEME_BACKDROP_MAP[activePreset.id] || THEME_BACKDROP_MAP.none);
                      const activeSvg = customTheme?.backgroundMode === "image" ? null : (THEME_SVG_MAP[activePreset.id] || "/chat-bg-official.svg");
                      const activeDoodleGradient = customTheme ? "none" : (THEME_DOODLE_GRADIENT_MAP[activePreset.id] || THEME_DOODLE_GRADIENT_MAP.none);
                      const activeThemeColor = customTheme ? customThemeTextColor(customTheme) : "var(--ui-accent-solid, #38bdf8)";

                      return (
                        <div className="p-2 space-y-3">
                          {/* Live Interactive Chat Theme Preview Card matching Eclipse Messenger */}
                          <div
                            className="relative overflow-hidden rounded-[24px] p-3.5 sm:p-4 flex flex-col justify-center gap-2.5 shadow-md border border-white/8 min-h-[176px] select-none"
                            style={{
                              background: activeBackdrop,
                            }}
                          >
                            {/* Live Theme Doodle Vector Layer */}
                            {activeSvg && (
                              <div
                                className="absolute inset-0 pointer-events-none opacity-35"
                                style={{
                                  background: activeDoodleGradient,
                                  WebkitMaskImage: `url('${activeSvg}')`,
                                  maskImage: `url('${activeSvg}')`,
                                  WebkitMaskRepeat: "repeat",
                                  maskRepeat: "repeat",
                                  WebkitMaskPosition: "center top",
                                  maskPosition: "center top",
                                  WebkitMaskSize: activePreset.id === "none" ? "140px auto" : "70px auto",
                                  maskSize: activePreset.id === "none" ? "140px auto" : "70px auto",
                                }}
                              />
                            )}

                            {/* Message 1 (Incoming from another user with Reply Quote and Reaction from us) */}
                            <div className="relative z-10 self-start max-w-[88%] sm:max-w-[80%] rounded-[16px] rounded-bl-none p-2.5 sm:px-3 sm:py-2 flex flex-col gap-1" style={{ background: customTheme?.incoming || "#212121", color: customTheme ? customThemeTextColor({ ...customTheme, outgoingTop: customTheme.incoming || "#212121", outgoingBottom: customTheme.incoming || "#212121" }) : "#fafafa" }}>
                              <MessageBubbleTail isMine={false} hasTail fillColor={customTheme?.incoming || "#212121"} />
                              <ReplyQuote
                                author={t("Александр")}
                                preview={t("Оцени новую тему оформления")}
                                background={customTheme?.replyBackground || "rgba(255,255,255,0.12)"}
                                lineColor={getReplyLineColor(customTheme?.replyBackground || customTheme?.incoming || "#212121", customTheme?.replyLine)}
                                authorColor={customTheme?.replyBackground ? customThemeTextColor({ ...customTheme, outgoingTop: customTheme.replyBackground, outgoingBottom: customTheme.replyBackground }) : activeThemeColor}
                                previewColor={customTheme?.replyBackground ? customThemeTextColor({ ...customTheme, outgoingTop: customTheme.replyBackground, outgoingBottom: customTheme.replyBackground }) : "#d4d4d8"}
                              />

                              <div className="text-[13.5px] leading-snug">
                                {t("Как тебе такой дизайн чата?")}</div>

                              {/* Bottom Row: Reaction Pill on Left, Time on Right (Same horizontal level) */}
                              <div className="flex items-center justify-between gap-4 -mb-0.5 mt-0.5">
                                <div
                                  className="inline-flex h-[24px] items-center justify-center gap-1 px-2 rounded-full bg-white/20 backdrop-blur-md text-[12px] font-semibold text-white shadow-sm"
                                  style={customTheme ? customThemeReactionSurface(customTheme, false, true, liveBg.messageThemeEnabled) : undefined}
                                >
                                  <span className="text-[13.5px] leading-none">✨</span>
                                  <span>2</span>
                                </div>

                                <span className="text-[10.5px] text-zinc-400 font-medium select-none">
                                  12:45
                                </span>
                              </div>
                            </div>

                            {/* Message 2 (Outgoing from Us in Theme Colors, without reply quote and without reactions) */}
                            {(() => {
                              const isWhitePreset = !customTheme && activePreset.id === "none";
                              const useThemeColors = liveBg.messageThemeEnabled !== false;
                              const outgoingBg = customTheme
                                ? customThemeMessageBackground(customTheme, useThemeColors)
                                : useThemeColors
                                  ? activePreset.colors
                                  : (THEME_SOLID_COLOR_MAP[activePreset.id] || "var(--ui-accent-solid, #38bdf8)");

                              return (
                                <div
                                  className={cn(
                                    "relative z-10 self-end max-w-[88%] sm:max-w-[78%] rounded-[16px] rounded-br-none px-3.5 pt-2.5 pb-1.5 flex flex-col gap-1",
                                    isWhitePreset
                                      ? "text-zinc-950"
                                      : "text-white"
                                  )}
                                  style={{
                                    background: outgoingBg,
                                  }}
                                >
                                  <div className="flex items-end justify-between gap-3 text-[14px] leading-snug">
                                    <MessageBubbleTail isMine hasTail fillColor={getMessageTailColor({ background: outgoingBg })} />
                                    <span className="font-normal">{t("Выглядит очень стильно и плавно!")}</span>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1 shrink-0 select-none text-[10.5px] font-medium opacity-90 pb-0.5",
                                        isWhitePreset
                                          ? "text-zinc-800"
                                          : "text-white"
                                      )}
                                    >
                                      <span>12:46</span>
                                      <MessageStatusTicks read={true} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Horizontal Theme Swatches List (with onWheel for PC scrolling) */}
                          <div
                            onWheel={(e) => {
                              if (e.deltaY !== 0) {
                                e.currentTarget.scrollLeft += e.deltaY;
                              }
                            }}
                            className="flex items-start gap-2.5 overflow-x-auto px-1 py-1.5 no-scrollbar snap-x scroll-smooth cursor-grab active:cursor-grabbing scroll-pl-1"
                          >
                            <ChatThemeCard create label={t("Создать")} onClick={showCustomThemeEditor} />
                            <AnimatePresence initial={false}>
                              {liveBg.customTheme && (
                                <motion.div
                                  key="custom-theme-card"
                                  className="relative shrink-0 snap-start overflow-hidden"
                                  initial={{ width: 0, height: 112, opacity: 0, marginRight: -10 }}
                                  animate={{ width: 82, height: 156, opacity: 1, marginRight: 0 }}
                                  exit={{ width: 0, height: 112, opacity: 0, marginRight: -10 }}
                                  transition={{ ...PANEL_TRANSITION, duration: PANEL_TRANSITION.duration }}
                                >
                                  <div className="w-[82px]">
                                    <ChatThemeCard
                                      pattern={liveBg.customTheme.backgroundMode === "image" ? null : undefined}
                                      label={liveBg.customTheme.name}
                                      incoming={liveBg.customTheme.incoming}
                                      background={customThemeChatBackground(liveBg.customTheme)}
                                      outgoing={customThemeMessageBackground(liveBg.customTheme, liveBg.messageThemeEnabled)}
                                      selected={!!liveBg.customThemeEnabled}
                                      onClick={() => props.onUpdateLiveBackgroundSettings?.({ customThemeEnabled: true })}
                                    />
                                    <div className="mt-1 flex w-full items-center justify-center">
                                      <button
                                        type="button"
                                        aria-label={t("Редактировать свою тему")}
                                        onClick={showCustomThemeEditor}
                                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                      >
                                        <MdEdit size={22} />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={t("Удалить свою тему")}
                                        onClick={() => {
                                          if (themePresetTimerRef.current) {
                                            clearTimeout(themePresetTimerRef.current);
                                            themePresetTimerRef.current = null;
                                          }
                                          if (liveBg.customThemeEnabled) setLocalThemePreset("none");
                                          props.onUpdateLiveBackgroundSettings?.({
                                            customTheme: null,
                                            customThemeEnabled: false,
                                            ...(liveBg.customThemeEnabled ? { neatPreset: "none" as const } : {}),
                                          });
                                        }}
                                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                      >
                                        <MdDelete size={22} />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {SETTINGS_LIVE_PRESETS.map((preset) => (
                              <ChatThemeCard
                                key={preset.id}
                                label={t(preset.label ?? "")}
                                background={THEME_BACKDROP_MAP[preset.id]}
                                selected={!liveBg.customThemeEnabled && localThemePreset === preset.id}
                                outgoing={liveBg.messageThemeEnabled !== false ? preset.colors : THEME_SOLID_COLOR_MAP[preset.id]}
                                onClick={() => handleSelectThemePreset(preset.id)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()}</PrivacySection>











                  <PrivacySection title={t("Темы сообщений")}>
                    <PrivacyToggleRow
                      label={t("Прозрачный визуал")}
                      description={t("Прозрачные панели с мягким размытием фона. Выключите, чтобы использовать сплошную серую заливку.")}
                      checked={liveBg.transparentVisual}
                      onChange={(val) => props.onUpdateLiveBackgroundSettings?.({ transparentVisual: val })}
                    />

                    <PrivacyToggleRow
                      label={t("Градиенты сообщений")}
                      description={t("Применять цветовую схему темы к облачкам сообщений")}
                      checked={liveBg.messageThemeEnabled}
                      onChange={(val) => props.onUpdateLiveBackgroundSettings?.({ messageThemeEnabled: val })}
                    />
                  </PrivacySection>
                </div>
              ) : settingsPanelView === "custom-theme" ? (
                <CustomChatThemeEditor
                  initial={liveBg.customTheme || { ...DEFAULT_CUSTOM_CHAT_THEME, name: t(DEFAULT_CUSTOM_CHAT_THEME.name) }}
                  onCancel={() => setSettingsPanelView("chats")}
                  onSave={(theme) => {
                    props.onUpdateLiveBackgroundSettings?.({ customTheme: theme, customThemeEnabled: true });
                    setSettingsPanelView("chats");
                  }}
                />
              ) : settingsPanelView === "security-totp" ? (
                <div className={cn("p-4 pb-8 flex flex-col", Date.now() >= passwordVerifiedUntil ? "min-h-[calc(100vh-140px)] justify-center" : "space-y-4")}>
                  {Date.now() >= passwordVerifiedUntil ? (
                    /* Step 1: Password Challenge Screen (Centered in the middle of the screen) */
                    <div className="my-auto flex flex-col items-center text-center px-2 py-4 w-full max-w-[360px] mx-auto">
                      <div className="mx-auto flex items-center justify-center my-1">
                        <MonkeyPasswordAnimation
                          hasPassword={verifyPasswordInput.length > 0}
                          showPassword={showVerifyPasswordText}
                          size={120}
                        />
                      </div>
                      <h3 className="text-[18px] font-bold text-white tracking-tight mt-1">{t("Введите пароль")}</h3>
                      <p className="text-[13px] text-zinc-400 max-w-[280px] mt-1.5 leading-snug">
                        {t("Для управления двухфакторной аутентификацией подтвердите ваш текущий пароль")}</p>

                      <form onSubmit={(e) => void verifyPasswordForTotp(e)} className="w-full mt-6 space-y-3">
                        <div className="relative rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5 flex items-center">
                          <input
                            type={showVerifyPasswordText ? "text" : "password"}
                            value={verifyPasswordInput}
                            onChange={(e) => setVerifyPasswordInput(e.target.value)}
                            placeholder={t("Введите текущий пароль")}
                            autoFocus
                            className="w-full pr-8 bg-transparent text-[15px] font-normal text-white placeholder:text-zinc-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowVerifyPasswordText(!showVerifyPasswordText)}
                            className="absolute right-3.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {showVerifyPasswordText ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>

                        {verifyPasswordError ? (
                          <p className="text-xs font-semibold text-red-400 text-left px-1">{t(verifyPasswordError ?? "")}</p>
                        ) : null}

                        <Button
                          type="submit"
                          disabled={verifyPasswordLoading || !verifyPasswordInput}
                          className="w-full h-11 rounded-[16px] bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm transition-all shadow-md active:scale-98 cursor-pointer"
                        >
                          {verifyPasswordLoading ? <Spinner className="h-4 w-4 text-zinc-950 animate-spin" /> : t("Продолжить")}
                        </Button>
                      </form>
                    </div>
                  ) : !settingsTotpEnabled ? (
                    /* Step 2: 2FA Setup Screen (when disabled) */
                    <div className="space-y-4 -mt-1 pb-2">
                      <div className="flex flex-col items-center text-center px-2 pt-0 pb-0.5">
                        <div className="mx-auto w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center my-1">
                          <div role="img" aria-label={t("Настройка защиты аккаунта")} className="h-full w-full"><LottieSticker src="/tgs/two-factor-setup-intro.tgs" className="h-full w-full" /></div>
                        </div>
                        <h3 className="text-[17.5px] font-bold text-white tracking-tight">{t("Настройка 2FA")}</h3>
                        <p className="text-[13px] text-zinc-400 max-w-[290px] mt-1 leading-snug">
                          {t("Отсканируйте QR-код в любом TOTP-приложении, например — Google Authenticator")}</p>
                      </div>

                      {settingsTotpQrUrl || internalTotpUri ? (
                        <div className="space-y-4">
                          {/* Minimalist Centered QR Card */}
                          <div className="flex flex-col items-center">
                            <div className="relative w-fit mx-auto rounded-[24px] bg-white p-3.5 sm:p-4 shadow-[0_16px_36px_rgba(0,0,0,0.35)] flex items-center justify-center">
                              <TotpQrCanvas
                                value={internalTotpUri || settingsTotpQrUrl || ""}
                                fallbackUrl={settingsTotpQrUrl}
                                size={190}
                              />
                            </div>

                            {/* Minimalist key pill for manual entry */}
                            {internalTotpSecret ? (
                              <div className="flex flex-col items-center gap-1.5 mt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                                      void navigator.clipboard.writeText(internalTotpSecret);
                                      showAppToast({
                                        title: t("Ключ скопирован"),
                                        type: "success",
                                        icon: "copy",
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition-all px-3.5 py-1.5 text-zinc-300 hover:text-white border border-white/[0.07] cursor-pointer group"
                                  title={t("Нажмите, чтобы скопировать ключ")}
                                >
                                  <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors">{t("Ключ:")}</span>
                                  <span className="font-mono text-[12px] font-semibold tracking-wider text-zinc-200 group-hover:text-white transition-colors">
                                    {internalTotpSecret.match(/.{1,4}/g)?.join(" ") || internalTotpSecret}
                                  </span>
                                  <Copy size={12} className="text-zinc-400 group-hover:text-white transition-colors shrink-0 ml-0.5" />
                                </button>
                              </div>
                            ) : null}
                          </div>

                          {/* 6-Digit Code Input Section */}
                          <div className="space-y-3 pt-1">
                            <p className="text-[12.5px] text-zinc-400 text-center font-medium">
                              {t("Введите 6-значный код из приложения:")}</p>

                            <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder={t("Код подтверждения")}
                                maxLength={6}
                                value={totpCodeInput}
                                onChange={(e) => {
                                  setTotpCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                                  if (totpError) setTotpError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && totpCodeInput.trim().length === 6) {
                                    e.preventDefault();
                                    void confirmTotpCodeInternal();
                                  }
                                }}
                                autoFocus
                                className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500"
                              />
                            </div>

                            {totpError ? (
                              <p className="text-xs font-semibold text-red-400 text-center animate-in fade-in">
                                {t(totpError ?? "")}
                              </p>
                            ) : null}

                            <Button
                              type="button"
                              disabled={settingsTotpLoading || totpCodeInput.trim().length !== 6}
                              onClick={() => void confirmTotpCodeInternal()}
                              className="w-full h-11 rounded-[16px] bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm transition-all shadow-md active:scale-98 disabled:opacity-40 cursor-pointer mt-2"
                            >
                              {settingsTotpLoading ? (
                                <Spinner className="h-4 w-4 text-zinc-950 animate-spin" />
                              ) : (
                                t("Подтвердить")
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center py-8">
                          <Spinner className="h-6 w-6 text-zinc-400 animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Step 3: 2FA Active Screen (when enabled) */
                    <div className="flex flex-col items-center text-center px-2 py-4">
                      <div className="mx-auto w-24 h-24 flex items-center justify-center my-2">
                        <div role="img" aria-label={t("Двухфакторная защита включена")} className="h-full w-full"><LottieSticker src="/tgs/two-factor-setup-done.tgs" className="h-full w-full" /></div>
                      </div>
                      <h3 className="text-[17px] font-bold text-white mt-1">{t("2FA включена")}</h3>
                      <p className="text-[13px] text-zinc-400 max-w-[280px] mt-1.5 leading-snug">
                        {t("Ваш аккаунт защищен. При входе с новых устройств потребуется код из Authenticator.")}</p>

                      <div className="w-full mt-8">
                        <Button
                          type="button"
                          onClick={() => {
                            setDisablePasswordError(null);
                            setDisablePasswordInput("");
                            setShowDisablePasswordText(false);
                            setShowDisableTotpModal(true);
                          }}
                          className="w-full h-11 rounded-[16px] bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold text-sm transition-all border-0 shadow-none"
                        >
                          {t("Отключить двухфакторную аутентификацию")}</Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : settingsPanelView === "security-password" ? (
                /* Dedicated Password Change Screen */
                <div className="p-4 space-y-4 pb-8">
                  <div className="flex flex-col items-center text-center px-2 py-2">
                    <div className="mx-auto w-28 h-28 flex items-center justify-center -my-1">
                      <img src="/gifs/lock-key.gif" alt="🔐" width={112} height={112} loading="eager" decoding="async" fetchPriority="high" className="h-full w-full select-none object-contain" draggable={false} />
                    </div>
                    <h3 className="text-[16.5px] font-bold text-white mt-1">{t("Смена пароля")}</h3>
                    <p className="text-[12.5px] text-zinc-400 max-w-[280px] mt-1 leading-snug">
                      {t("Придумайте надежный пароль длиной не менее 8 символов")}</p>
                  </div>

                  <div className="overflow-hidden rounded-[20px] bg-white/[0.04] p-4 space-y-3 shadow-md">
                    <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5">
                      <input
                        type="password"
                        value={oldPasswordInput}
                        onChange={(e) => setOldPasswordInput(e.target.value)}
                        placeholder={t("Текущий пароль")}
                        className="w-full bg-transparent text-[15px] font-normal text-white placeholder:text-zinc-500 outline-none"
                      />
                    </div>

                    <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5">
                      <input
                        type="password"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder={t("Новый пароль")}
                        className="w-full bg-transparent text-[15px] font-normal text-white placeholder:text-zinc-500 outline-none"
                      />
                    </div>

                    <div className="rounded-[18px] border border-white/[0.08] bg-transparent focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5">
                      <input
                        type="password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder={t("Повторите новый пароль")}
                        className="w-full bg-transparent text-[15px] font-normal text-white placeholder:text-zinc-500 outline-none"
                      />
                    </div>

                    {passwordError ? <p className="text-xs font-semibold text-red-400 px-1">{t(passwordError ?? "")}</p> : null}
                    {passwordSuccess ? <p className="text-xs font-semibold text-green-400 px-1">{passwordSuccess}</p> : null}

                    <Button
                      type="button"
                      disabled={passwordLoading || !oldPasswordInput || !newPasswordInput || !confirmPasswordInput}
                      onClick={() => void changePasswordInternal()}
                      className="w-full h-11 rounded-[16px] bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm mt-2 transition-all shadow-md active:scale-98"
                    >
                      {passwordLoading ? <Spinner className="h-4 w-4 text-zinc-950" /> : t("Обновить пароль")}
                    </Button>
                  </div>
                </div>
              ) : settingsPanelView === "sessions" ? (
                <div data-settings-sessions className="p-4 space-y-4 pb-8">
                  {/* Top Banner + Connect Desktop Device */}
                  <div className="flex flex-col items-center text-center px-4 pt-3 pb-1">
                    <div className="mx-auto w-24 h-24 flex items-center justify-center">
                      <img
                        src="/gifs/guy-with-laptop-1.gif"
                        alt={t("Сеансы")}
                        className="w-full h-full object-contain pointer-events-none select-none"
                        loading="eager"
                        decoding="async"
                      />
                    </div>
                    <p className="text-[13px] text-zinc-300 font-medium text-center max-w-[280px] mx-auto mt-2 leading-snug select-none">
                      {t("Вы можете зайти в приложение Eclipse для компьютера или браузера с помощью QR-кода")}</p>
                    <Button
                      type="button"
                      onClick={() => setSettingsPanelView("scan-qr")}
                      className="mt-4 h-11 w-full rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-[14px] transition-colors shadow-none active:scale-[0.98]"
                    >
                      {t("Подключить устройство")}</Button>
                  </div>

                  {/* Current Session Section Merged with End Other Sessions */}
                  {(() => {
                    const current = settingsSessions.find((s: any) => s.id === settingsCurrentSessionId);
                    const others = settingsSessions.filter((s: any) => s.id !== (current?.id ?? settingsCurrentSessionId));
                    return (
                      <>
                        {current ? (
                          <PrivacySection title={t("Текущий сеанс")}>
                            <button type="button"
                              onClick={() => setSelectedSessionDetail(current)}
                              className="flex w-full text-left h-[62px] items-center gap-3.5 px-4 cursor-pointer hover:bg-white/[0.04] transition-colors rounded-t-[18px]"
                            >
                              <SettingsSessionIcon userAgent={current.userAgent} />
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-[14.5px] font-semibold text-zinc-100">
                                  {deriveSettingsDeviceName(current.userAgent)}
                                </span>
                                <span className="block truncate text-[12px] text-zinc-400">
                                  {deriveSettingsOS(current.userAgent)} • {formatSessionLocation(current.ip)} {t(" • В сети")}</span>
                              </div>
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                                {t("Это устройство")}</span>
                            </button>
                            {others.length > 0 ? (
                              <>
                                <div className="mx-4 my-0.5 h-[1px] bg-white/[0.04]" />
                                <button
                                  type="button"
                                  disabled={Boolean(settingsEndingSessionId)}
                                  onClick={() => setConfirmEndAllSessions(true)}
                                  className="flex h-11 w-full items-center justify-center gap-2 rounded-b-[18px] text-[13.5px] font-semibold text-red-400 transition-colors hover:bg-white/[0.04] active:scale-[0.99] border-0 outline-none disabled:opacity-50 cursor-pointer"
                                >
                                  {endingAllSessions ? t("Завершаем сеансы…") : t("Завершить все другие сеансы")}
                                </button>
                              </>
                            ) : null}
                          </PrivacySection>
                        ) : null}

                        {settingsSessionsLoading ? (
                          <div className="flex h-20 items-center justify-center">
                            <Spinner className="h-5 w-5 text-zinc-400" />
                          </div>
                        ) : others.length > 0 ? (
                          <PrivacySection title={t("Активные сеансы")}>
                            {others.map((session: any) => {
                              const online = isSessionOnline(session);
                              return (
                                <button type="button"
                                  key={session.id}
                                  onClick={() => setSelectedSessionDetail(session)}
                                  className="flex w-full text-left h-[60px] items-center gap-3.5 px-4 cursor-pointer hover:bg-white/[0.04] transition-colors rounded-[14px]"
                                >
                                  <SettingsSessionIcon userAgent={session.userAgent} />
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-[14px] font-semibold text-zinc-100">
                                      {deriveSettingsDeviceName(session.userAgent)}
                                    </span>
                                    <span className="block truncate text-[12px] text-zinc-400">
                                      {deriveSettingsOS(session.userAgent)} • {formatSessionLocation(session.ip)} • {online ? (
                                        <span className="text-emerald-400 font-medium">{t("В сети")}</span>
                                      ) : (
                                        formatSettingsSessionTime(session.lastSeenAt ?? session.createdAt)
                                      )}
                                    </span>
                                  </div>
                                  <ChevronRight size={17} className="shrink-0 text-zinc-500" />
                                </button>
                              );
                            })}
                          </PrivacySection>
                        ) : null}
                      </>
                    );
                  })()}
                  {sessionsError && <div role="alert" className="rounded-[20px] bg-white/[0.04] px-4 py-3 text-[13px] leading-5 text-zinc-300">
                    {t(sessionsError ?? "")}<button type="button" onClick={() => void loadSessionsInternal()} className="mt-2 block font-semibold text-white cursor-pointer">{t("Обновить список")}</button>
                  </div>}
                </div>
              ) : settingsPanelView === "qr" ? (
                <ProfileQrPanel selfProfile={selfProfile ?? null} onBack={() => setSettingsPanelView("main")} onClose={() => setSettingsPanelView("main")} />
              ) : settingsPanelView === "scan-qr" ? (
                <SessionQrScanner
                  onSuccess={() => {
                    void loadSessionsInternal();
                    setSettingsPanelView("sessions");
                  }}
                />
              ) : settingsPanelView === "storage" ? (
                /* Sleek Minimalist Storage & Data Screen */
                <div className="flex flex-col p-4 space-y-4 pb-32 sm:pb-12 select-none overflow-y-auto no-scrollbar">
                  {/* Top Donut Chart Hero */}
                  <div className="flex flex-col items-center text-center px-2 pt-2">
                    {/* SVG Donut Chart with glowing segments - Larger size */}
                    <div className="relative w-48 h-48 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                        {/* Background track */}
                        <circle
                          cx="70"
                          cy="70"
                          r="52"
                          className="stroke-white/[0.06]"
                          strokeWidth="15"
                          fill="transparent"
                        />
                        {/* Segment slices */}
                        {(() => {
                          const circumference = 2 * Math.PI * 52;
                          const activeCategories = storageCategories.filter((c) => c.sizeMb > 0);
                          const totalSum = activeCategories.reduce((acc, c) => acc + c.sizeMb, 0) || 1;
                          let accumulatedLength = 0;

                          return activeCategories.map((cat) => {
                            const ratio = storageTotalMb > 0 ? cat.sizeMb / totalSum : 0;
                            const strokeLength = ratio * circumference;
                            const offset = accumulatedLength;
                            accumulatedLength += strokeLength;

                            return (
                              <circle
                                key={cat.id}
                                cx="70"
                                cy="70"
                                r="52"
                                stroke={cat.color}
                                strokeWidth="15"
                                strokeDasharray={`${Math.max(0, strokeLength - 0.8)} ${circumference}`}
                                strokeDashoffset={-offset}
                                strokeLinecap="butt"
                                fill="transparent"
                                className="transition-all duration-700 ease-out"
                              />
                            );
                          });
                        })()}
                      </svg>

                      {/* Donut Center text - clean only */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[23px] sm:text-[25px] font-bold text-white tracking-tight leading-none">
                          {storageTotalMb > 0 ? t("{0} МБ", { 0: storageTotalMb.toFixed(1) }) : t("0.0 МБ")}
                        </span>
                      </div>
                    </div>

                    <h3 className="mt-3.5 text-[18px] font-semibold text-white tracking-tight">
                      {t("Использование памяти")}</h3>

                    <p className="mt-1 text-[13px] text-zinc-400 max-w-[280px] leading-normal font-normal">
                      {t("Eclipse занимает ")}{storagePercentOfDevice}{t("% свободного места на устройстве.")}</p>
                  </div>

                  {/* Categories Breakdown Card - Smooth Solid/Glass, No harsh borders */}
                  <div className="rounded-[24px] bg-white/[0.04] p-1.5 shadow-md space-y-0.5">
                    {storageCategories.map((cat) => {
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setStorageCategories((prev) =>
                              prev.map((item) => (item.id === cat.id ? { ...item, checked: !item.checked } : item))
                            );
                          }}
                          className="flex items-center justify-between p-3 rounded-[16px] transition-colors hover:bg-white/[0.04] active:scale-[0.99] cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Round Checkbox */}
                            <div
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white transition-all shadow-sm"
                              style={{
                                backgroundColor: cat.checked ? cat.color : "rgba(255,255,255,0.12)",
                              }}
                            >
                              {cat.checked && <Check size={13} strokeWidth={3} />}
                            </div>

                            <div className="min-w-0">
                              <span className="text-[14.5px] font-medium text-white">
                                {t(cat.label ?? "")}
                                <span className="font-normal text-zinc-400 text-[13px] ml-1.5">
                                  {cat.percent.toFixed(cat.percent % 1 === 0 ? 0 : 1)}%
                                </span>
                              </span>
                            </div>
                          </div>

                          <span className="text-[14px] font-normal text-zinc-300">
                            {cat.sizeMb.toFixed(1)} {t(" МБ")}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Primary Clear Cache Action Button */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      disabled={storageCleaning || selectedStorageSize <= 0}
                      onClick={handleCleanStorageCache}
                      className="w-full flex items-center justify-center h-11 rounded-[14px] bg-white text-zinc-950 hover:bg-white/90 active:scale-[0.985] font-semibold text-[14.5px] shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      {storageCleaning ? (
                        <Spinner className="h-5 w-5 text-zinc-950 animate-spin" />
                      ) : (
                        <span>
                          {selectedStorageSize > 0
                            ? t("Очистить весь кэш {0} МБ", { 0: selectedStorageSize.toFixed(1) })
                            : t("Кэш пуст")}
                        </span>
                      )}
                    </button>

                    <p className="px-4 text-center text-[12px] text-zinc-400 leading-relaxed">
                      {t("Все медиа останутся на сервере Eclipse, при необходимости Вы сможете загрузить их снова.")}</p>
                  </div>
                </div>
              ) : settingsPanelView === "language" ? (
                /* Telegram-styled Language Screen */
                <div className="flex flex-col p-4 space-y-4 pb-32 sm:pb-12 select-none overflow-y-auto no-scrollbar">
                  <div className="overflow-hidden rounded-[20px] bg-white/[0.04] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)] space-y-0.5">
                    {[
                      { id: "ru" as const, name: "Русский", sub: "Russian" },
                      { id: "en" as const, name: "English", sub: "English" },
                    ].map((langItem) => {
                      const isSelected = locale === langItem.id;
                      return (
                        <button
                          key={langItem.id}
                          type="button"
                          onClick={() => setLocale(langItem.id)}
                          className={cn(
                            "w-full rounded-[14px] flex min-h-[56px] items-center gap-3.5 px-3.5 py-2.5 text-left transition-colors cursor-pointer",
                            isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.04] active:scale-[0.99]"
                          )}
                        >
                          {/* Telegram-style Radio Button linked to active theme accent */}
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                              isSelected
                                ? "border-[color:var(--ui-accent-solid,#38bdf8)]"
                                : "border-zinc-600"
                            )}
                          >
                            <div
                              className={cn(
                                "h-2.5 w-2.5 rounded-full transition-transform",
                                isSelected
                                  ? "scale-100 bg-[var(--ui-accent-solid,#38bdf8)]"
                                  : "scale-0 bg-transparent"
                              )}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-white leading-snug">
                              {langItem.name}
                            </span>
                            <span className="block truncate text-[12.5px] text-zinc-400 leading-snug">
                              {langItem.sub}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </PanelNavigation>
      </motion.div>
    )}
    </AnimatePresence>

      {/* Disable TOTP Password Modal */}
      <AnimatePresence>
        {showDisableTotpModal ? (
          <motion.div
            className="fixed inset-0 z-[330] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDisableTotpModal(false);
                setShowDisablePasswordText(false);
              }
            }}
          >
            <motion.div
              data-app-panel className="relative w-full sm:max-w-[360px] rounded-t-[32px] sm:rounded-[28px] border-0 ring-0 bg-[#1c1c1e] sm:bg-[#1c1c1e]/95 p-6 pb-8 sm:pb-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl flex flex-col gap-3.5 text-center"
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={PANEL_TRANSITION}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto flex items-center justify-center -my-1">
                <MonkeyPasswordAnimation
                  hasPassword={disablePasswordInput.length > 0}
                  showPassword={showDisablePasswordText}
                  size={105}
                />
              </div>

              <div className="flex flex-col gap-1 mt-0.5">
                <h3 className="text-[18px] font-bold text-white tracking-tight">{t("Отключить 2FA")}</h3>
                <p className="text-[13px] text-zinc-400 max-w-[280px] mx-auto leading-snug">
                  {t("Для отключения защиты подтвердите ваш текущий пароль")}</p>
              </div>

              <form onSubmit={(e) => void handleDisableTotpWithPassword(e)} className="space-y-3 mt-1.5 text-left">
                <div className="relative rounded-[18px] border border-white/[0.08] bg-white/[0.03] focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all px-4 py-3.5 flex items-center">
                  <input
                    type={showDisablePasswordText ? "text" : "password"}
                    value={disablePasswordInput}
                    onChange={(e) => {
                      setDisablePasswordInput(e.target.value);
                      if (disablePasswordError) setDisablePasswordError(null);
                    }}
                    placeholder={t("Текущий пароль")}
                    autoFocus
                    className="w-full pr-8 bg-transparent text-[15px] font-normal text-white placeholder:text-zinc-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDisablePasswordText(!showDisablePasswordText)}
                    className="absolute right-3.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    aria-label={showDisablePasswordText ? t("Скрыть пароль") : t("Показать пароль")}
                  >
                    {showDisablePasswordText ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {disablePasswordError ? (
                  <p className="text-xs font-semibold text-red-400 px-1">{t(disablePasswordError ?? "")}</p>
                ) : null}

                <div className="pt-1.5">
                  <Button
                    type="submit"
                    disabled={disablePasswordLoading || !disablePasswordInput}
                    className="w-full h-11 rounded-[16px] bg-white hover:bg-zinc-200 text-zinc-950 text-[13.5px] font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                  >
                    {disablePasswordLoading ? <Spinner className="h-4 w-4 text-zinc-950 animate-spin" /> : t("Отключить")}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Detailed Session Info Modal / Bottom Sheet on Mobile */}
      <AnimatePresence>
        {selectedSessionDetail ? (
          <motion.div
            className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-[3px] select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedSessionDetail(null);
            }}
          >
            <motion.div
              role="dialog" aria-modal="true" aria-label={t("Информация о сеансе")}
              data-app-panel className="relative w-full sm:max-w-[380px] rounded-t-[32px] sm:rounded-[28px] bg-[#1c1c1f]/95 border-0 ring-0 p-6 pb-8 sm:pb-6 text-white flex flex-col gap-4"
              initial={{ y: reducedMotion ? 0 : 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: reducedMotion ? 0 : 32, opacity: 0 }}
              transition={PANEL_TRANSITION}
              onClick={(e) => e.stopPropagation()}
            >

              <div className="flex flex-col items-center text-center mt-1 mb-1">
                <div className="grid h-16 w-16 place-items-center rounded-[18px] bg-white/[0.08] text-zinc-100 border-0 outline-none shadow-sm mb-3">
                  <SettingsSessionIconLarge userAgent={selectedSessionDetail.userAgent} />
                </div>
                <h4 className="text-[17px] font-bold text-white">
                  {deriveSettingsDeviceName(selectedSessionDetail.userAgent)}
                </h4>
                <p className="text-[12.5px] text-zinc-400 font-normal mt-0.5">
                  {isSessionOnline(selectedSessionDetail) ? t("в сети") : t("не в сети")}
                </p>
              </div>

              <div className="overflow-hidden rounded-[20px] bg-white/[0.04] p-3.5 shadow-inner space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">{t("Операционная система")}</span>
                  <span className="font-semibold text-zinc-100">
                    {deriveSettingsOS(selectedSessionDetail.userAgent)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">{t("Браузер / Клиент")}</span>
                  <span className="font-semibold text-zinc-100">
                    {deriveSettingsBrowser(selectedSessionDetail.userAgent)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">{t("Местоположение")}</span>
                  <span className="font-semibold text-zinc-100">
                    {formatSessionLocation(selectedSessionDetail.ip)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">{t("IP-адрес")}</span>
                  <span className="font-semibold font-mono text-zinc-300 text-[12px]">
                    {selectedSessionDetail.ip ? selectedSessionDetail.ip.replace("::ffff:", "") : t("Неизвестен")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">{t("Время входа")}</span>
                  <span className="font-semibold text-zinc-100 text-[12.5px]">
                    {formatSettingsSessionTime(selectedSessionDetail.createdAt)}
                  </span>
                </div>
                {selectedSessionDetail.lastSeenAt ? (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">{t("Последняя активность")}</span>
                    <span className="font-semibold text-zinc-100 text-[12.5px]">
                      {isSessionOnline(selectedSessionDetail)
                        ? t("в сети")
                        : formatSettingsSessionTime(selectedSessionDetail.lastSeenAt)}
                    </span>
                  </div>
                ) : null}
              </div>

              {selectedSessionDetail.id !== settingsCurrentSessionId ? (
                <Button
                  type="button"
                  disabled={settingsEndingSessionId === selectedSessionDetail.id}
                  onClick={async () => {
                    if (await endSessionInternal(selectedSessionDetail.id)) setSelectedSessionDetail(null);
                  }}
                  className="mt-1 w-full h-11 rounded-[16px] bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold text-[13.5px] transition-all border-0 shadow-none cursor-pointer"
                >
                  {settingsEndingSessionId === selectedSessionDetail.id ? <Spinner className="h-4 w-4 text-red-400 animate-spin" /> : t("Завершить сеанс")}
                </Button>
              ) : null}
              {sessionsError && <p role="alert" className="text-[13px] leading-5 text-zinc-300">{t(sessionsError ?? "")}</p>}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>



      {/* Logout Confirmation Modal */}
      <ConfirmationSheet open={confirmEndAllSessions} onOpenChange={setConfirmEndAllSessions}
        title={t("Завершить другие сеансы?")} description={t("Другие устройства выйдут из аккаунта. Этот сеанс останется активным.")}
        actionLabel={t("Завершить сеансы")} actionIcon={LogOut} onAction={() => void endAllOtherSessionsInternal()}
        actionDisabled={Boolean(settingsEndingSessionId)} zIndex={340} />
      <ConfirmationSheet
        open={showLogoutConfirmModal}
        onOpenChange={setShowLogoutConfirmModal}
        title={t("Выйти из аккаунта?")}
        description={t("Вы действительно хотите завершить текущую сессию и выйти?")}
        actionLabel={loggingOut ? t("Выход...") : t("ВЫЙТИ")}
        actionIcon={LogOut}
        actionDisabled={loggingOut}
        cancelLabel={t("ОТМЕНА")}
        onAction={async () => {
          setShowLogoutConfirmModal(false);
          await logoutFromSettings();
        }}
        zIndex={300}
      />

      {/* Avatar Media Viewer Modal (Telegram-style Lightbox) */}
      <AvatarMediaViewerModal
        open={Boolean(showAvatarViewer && isRealMediaAvatar(selfProfile?.avatarUrl))}
        onClose={() => setShowAvatarViewer(false)}
        mediaUrl={selfProfile?.avatarUrl}
        title={selfProfile?.displayName ?? t("Профиль")}
        timestamp={selfProfile?.avatarUploadedAt || selfProfile?.updatedAt || selfProfile?.createdAt}
        fallbackText={(selfProfile?.displayName ?? "U").slice(0, 1)}
        isDeleting={deletingAvatar}
        onDelete={async () => {
          try {
            setDeletingAvatar(true);
            await apiRequest("/api/settings/profile", {
              method: "PATCH",
              body: JSON.stringify({ avatarUrl: null }),
            });
            setSettingsEditDraft((prev: any) => ({ ...prev, avatarUrl: null }));
            if (props.setSelfProfile) {
              props.setSelfProfile((prev: any) => prev ? { ...prev, avatarUrl: null } : prev);
            }
            if (props.onSaveProfile) {
              await props.onSaveProfile({ avatarUrl: null });
            }
            setShowAvatarViewer(false);
            showAppToast({
              title: t("Фотография профиля удалена"),
              type: "success",
            });
          } catch (err) {
            console.error("Failed to delete avatar:", err);
            showAppToast({
              title: t("Не удалось удалить фотографию"),
              type: "error",
            });
          } finally {
            setDeletingAvatar(false);
          }
        }}
        zIndex={350}
      />

      <CollectibleUsernameModal
        isOpen={Boolean(collectibleModalUsername)}
        username={collectibleModalUsername}
        onClose={() => setCollectibleModalUsername(null)}
        showToast={showAppToast}
        isSelf={true}
        ownerName={t("вам")}
      />

      {/* Telegram Duck Cache Cleaning Modal (Centered on Desktop, Bottom Sheet on Mobile) */}
      <AnimatePresence>
        {cleaningProgressModal ? (
          <motion.div
            className="fixed inset-0 z-[360] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-md select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              data-app-panel className="relative w-full sm:max-w-[340px] rounded-t-[32px] sm:rounded-[32px] bg-[#1c1c1e] p-6 pb-8 border-0 ring-0 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl text-white flex flex-col items-center text-center"
              initial={{ y: 60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              transition={PANEL_TRANSITION}
            >
              {/* Real Telegram Utya duck with broom (Lottie) */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                <LottieSticker
                  src="/stickers/utyan-cache.json"
                  className="w-full h-full"
                />
              </div>

              {/* Progress Percentage */}
              <div className="mt-3">
                <span className="text-[22px] font-bold text-white tracking-tight leading-none">
                  {cleaningProgressPercent}%
                </span>
              </div>

              {/* Description */}
              <p className="mt-2 text-[13px] text-zinc-400 max-w-[240px] leading-relaxed font-normal">
                {t("Пожалуйста, не закрывайте это окно до завершения очистки кэша.")}</p>

              {/* Bottom Slim Progress Bar */}
              <div className="mt-6 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-75 ease-out"
                  style={{ width: `${cleaningProgressPercent}%` }}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </>
  );
}
