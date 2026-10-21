"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { profileChatUrl } from "@/lib/client/deployment-url";
import React, { useEffect, useRef, useState } from "react";
import { Copy, Check, Share2, Sparkles, ArrowLeft } from "lucide-react";
import { showAppToast } from "@/lib/client/app-toast";
import { GiNestedEclipses } from "react-icons/gi";
import { ECLIPSE_DIALOG_LINK } from "@/lib/eclipse-system";
import { MediaAvatar } from "@/components/ui/media";

// Vibrant & atmospheric gradients
const CURATED_GRADIENTS = [
  {
    name: "Royal Purple",
    style: "linear-gradient(135deg, #3b0764 0%, #1e1b4b 50%, #4c1d95 100%)",
    blobs: ["rgba(168, 85, 247, 0.35)", "rgba(99, 102, 241, 0.28)", "rgba(217, 70, 239, 0.25)"]
  },
  {
    name: "Ocean Azure",
    style: "linear-gradient(135deg, #0c4a6e 0%, #082f49 50%, #0369a1 100%)",
    blobs: ["rgba(56, 189, 248, 0.35)", "rgba(14, 165, 233, 0.28)", "rgba(20, 184, 166, 0.25)"]
  },
  {
    name: "Sunset Rose",
    style: "linear-gradient(135deg, #831843 0%, #4c0519 50%, #701a75 100%)",
    blobs: ["rgba(244, 63, 94, 0.35)", "rgba(236, 72, 153, 0.28)", "rgba(168, 85, 247, 0.25)"]
  },
  {
    name: "Emerald Aurora",
    style: "linear-gradient(135deg, #064e3b 0%, #022c22 50%, #047857 100%)",
    blobs: ["rgba(52, 211, 153, 0.35)", "rgba(16, 185, 129, 0.28)", "rgba(45, 212, 191, 0.25)"]
  },
  {
    name: "Warm Amber",
    style: "linear-gradient(135deg, #78350f 0%, #451a03 50%, #9a3412 100%)",
    blobs: ["rgba(251, 146, 60, 0.35)", "rgba(245, 158, 11, 0.28)", "rgba(239, 68, 68, 0.25)"]
  },
  {
    name: "Deep Velvet",
    style: "linear-gradient(135deg, #1e1b29 0%, #0d0b12 50%, #312e81 100%)",
    blobs: ["rgba(129, 140, 248, 0.35)", "rgba(79, 70, 229, 0.25)", "rgba(192, 132, 252, 0.22)"]
  }
];

interface ProfileQrPanelProps {
  selfProfile?: {
    displayName?: string | null;
    link?: string | null;
    avatarUrl?: string | null;
    id?: string;
  } | null;
  displayName?: string | null;
  link?: string | null;
  avatarUrl?: string | null;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
}

export default function ProfileQrPanel({
  selfProfile,
  displayName: propDisplayName,
  link: propLink,
  avatarUrl: propAvatarUrl,
  title,
  onBack,
  onClose,
}: ProfileQrPanelProps) {
  const t = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [gradientIndex, setGradientIndex] = useState(0);

  const displayName = propDisplayName ?? selfProfile?.displayName ?? t("Пользователь");
  const rawLink = propLink ?? selfProfile?.link ?? "";
  const avatarUrl = propAvatarUrl ?? selfProfile?.avatarUrl ?? null;

  const normalizedLink = String(rawLink).trim().replace(/^@+/u, "").toLowerCase();
  const shareUrl = normalizedLink
    ? profileChatUrl(normalizedLink)
    : "";

  // Select a random gradient on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * CURATED_GRADIENTS.length);
    setGradientIndex(randomIndex);
  }, []);

  const activeGradient = CURATED_GRADIENTS[gradientIndex];

  // Helper to draw rounded rectangle in canvas safely
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

  useEffect(() => {
    if (!shareUrl) return;
    let active = true;

    const drawQr = (QRCode: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const canvasSize = 512;
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      try {
        const qr = QRCode.create(shareUrl, { errorCorrectionLevel: "M" });
        const { size, data } = qr.modules;
        const margin = 1.2;
        const totalModules = size + margin * 2;
        const moduleSize = canvasSize / totalModules;
        const offsetX = margin * moduleSize;
        const offsetY = margin * moduleSize;

        // Clear canvas with crisp white
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // 1. Draw modules as rounded circles
        ctx.fillStyle = "#111827";

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const isDark = data[r * size + c] === 1;
            if (!isDark) continue;

            const isTopLeftFinder = r < 7 && c < 7;
            const isTopRightFinder = r < 7 && c >= size - 7;
            const isBottomLeftFinder = r >= size - 7 && c < 7;

            if (isTopLeftFinder || isTopRightFinder || isBottomLeftFinder) {
              continue;
            }

            const cx = offsetX + c * moduleSize + moduleSize / 2;
            const cy = offsetY + r * moduleSize + moduleSize / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, (moduleSize / 2) * 0.82, 0, 2 * Math.PI);
            ctx.fill();
          }
        }

        // 2. Draw unified rounded finder patterns
        const drawFinderPattern = (startX: number, startY: number) => {
          const w = 7 * moduleSize;
          const h = 7 * moduleSize;
          const radius = 1.6 * moduleSize;

          ctx.fillStyle = "#111827";
          drawRoundedRect(ctx, startX, startY, w, h, radius);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          drawRoundedRect(
            ctx,
            startX + moduleSize,
            startY + moduleSize,
            w - 2 * moduleSize,
            h - 2 * moduleSize,
            radius * 0.75
          );
          ctx.fill();

          ctx.fillStyle = "#111827";
          drawRoundedRect(
            ctx,
            startX + 2 * moduleSize,
            startY + 2 * moduleSize,
            w - 4 * moduleSize,
            h - 4 * moduleSize,
            radius * 0.45
          );
          ctx.fill();
        };

        drawFinderPattern(offsetX, offsetY);
        drawFinderPattern(offsetX + (size - 7) * moduleSize, offsetY);
        drawFinderPattern(offsetX, offsetY + (size - 7) * moduleSize);

      } catch (err) {
        console.error("QR drawing error:", err);
      }
    };

    import("qrcode").then((QRCodeLib) => {
      if (!active) return;
      const QRCode = QRCodeLib.default || QRCodeLib;
      drawQr(QRCode);
    });

    return () => {
      active = false;
    };
  }, [shareUrl]);

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showAppToast({
      title: t("Ссылка скопирована"),
      type: "success",
      icon: "copy",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: displayName,
          url: shareUrl,
        });
      } catch (err) {}
    } else {
      handleCopy();
    }
  };

  const changeBackground = () => {
    setGradientIndex((prev) => (prev + 1) % CURATED_GRADIENTS.length);
  };

  return (
    <div
      data-profile-qr-panel
      className="relative flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden transition-all duration-700 ease-in-out select-none"
      style={{ background: activeGradient.style }}
    >
      {/* Top Header bar with Back / Close Button */}
      {(onBack || onClose) ? (
        <div data-qr-header className="relative z-30 flex h-14 shrink-0 items-center gap-3 px-4">
          <button
            type="button"
            onClick={onBack || onClose}
            aria-label={t("Назад")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
          >
            <ArrowLeft size={23} />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-none text-white drop-shadow-sm">
            {title || t("QR-код")}
          </h2>
        </div>
      ) : (
        <div data-qr-header className="relative z-30 flex h-14 shrink-0 items-center px-4">
          <h2 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-none text-white drop-shadow-sm">
            {title || t("QR-код")}
          </h2>
        </div>
      )}

      {/* Blurred Material Blobs */}
      <div
        className="absolute -top-20 -left-20 h-72 w-72 rounded-full blur-3xl opacity-70 transition-all duration-700 pointer-events-none"
        style={{ backgroundColor: activeGradient.blobs[0] }}
      />
      <div
        className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full blur-3xl opacity-60 transition-all duration-700 pointer-events-none"
        style={{ backgroundColor: activeGradient.blobs[1] }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full blur-3xl opacity-40 transition-all duration-700 pointer-events-none"
        style={{ backgroundColor: activeGradient.blobs[2] }}
      />

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="flex min-h-full w-full flex-col items-center justify-center px-4 pb-6 pt-12">
      {/* Reserve space above the card for the overlapping avatar. */}
      <div className="relative w-full max-w-[280px] shrink-0">

        {/* Avatar overlapping the top boundary of the QR card */}
        <div data-qr-avatar className="absolute -top-10 left-1/2 -translate-x-1/2 z-20">
          <div className="h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-white shadow-[0_10px_25px_rgba(0,0,0,0.18)] bg-indigo-500">
            {normalizedLink === ECLIPSE_DIALOG_LINK ? <div className="grid h-full w-full place-items-center bg-black text-white"><GiNestedEclipses className="h-[70%] w-[70%]" aria-hidden /></div> : <MediaAvatar
              src={avatarUrl ?? undefined}
              alt={displayName}
              className="h-full w-full object-cover"
              fallbackText={(displayName || "U").slice(0, 2).toUpperCase()}
              autoPlay
            />}
          </div>
        </div>

        {/* QR Code White Card */}
        <div className="relative w-full rounded-[28px] bg-white shadow-[0_24px_50px_rgba(0,0,0,0.22)] pt-10 pb-6 px-4 flex flex-col items-center">

          {/* Nickname (displayName) right below the avatar */}
          <h3 className="text-[16px] font-semibold text-zinc-900 leading-tight mb-4 mt-0.5 text-center truncate max-w-full px-2">
            {displayName}
          </h3>

          {/* QR Code Canvas directly on card without double white border */}
          <div className="relative flex w-full min-w-0 items-center justify-center">
            <canvas
              ref={canvasRef}
              aria-label={t("QR-код профиля")}
              className="block aspect-square h-auto w-full max-w-[210px]"
            />
          </div>
        </div>
      </div>

      {/* Minimalist Transparent Icon Buttons Container */}
      <div className="relative z-10 mt-6 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? t("Скопировано!") : t("Копировать")}
          aria-label={t("Копировать")}
          className="grid h-12 w-12 place-items-center rounded-full text-white/80 transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
        >
          {copied ? <Check size={22} className="text-emerald-300" /> : <Copy size={22} />}
        </button>

        <button
          type="button"
          onClick={handleShare}
          title={t("Поделиться")}
          aria-label={t("Поделиться")}
          className="grid h-12 w-12 place-items-center rounded-full text-white/80 transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Share2 size={22} />
        </button>

        <button
          type="button"
          onClick={changeBackground}
          title={t("Сменить фон")}
          aria-label={t("Сменить фон")}
          className="grid h-12 w-12 place-items-center rounded-full text-white/80 transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Sparkles size={22} />
        </button>
      </div>
      </div>
      </div>
    </div>
  );
}
