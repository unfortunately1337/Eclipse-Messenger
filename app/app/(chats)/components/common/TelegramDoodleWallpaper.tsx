import React from "react";
import type { LiveBackgroundNeatPreset } from "../../types";

export const THEME_SVG_MAP: Record<LiveBackgroundNeatPreset, string> = {
  none: "/chat-bg-official.svg",
  neon: "/chat-bg-neon.svg",
  emerald: "/chat-bg-nature.svg",
  ocean: "/chat-bg-ocean.svg",
  midnight: "/chat-bg-space.svg",
  sunset: "/chat-bg-travel.svg",
  aurora: "/chat-bg-geometric.svg",
  violet: "/chat-bg-party.svg",
  crimson: "/chat-bg-food.svg",
  mono: "/chat-bg-minimal.svg",
  frost: "/chat-bg-winter.svg",
  lava: "/chat-bg-tech.svg",
};

export const THEME_BACKDROP_MAP: Record<LiveBackgroundNeatPreset, string> = {
  none: "radial-gradient(135% 115% at 50% 15%, #161822 0%, #0e1016 48%, #06070a 100%)",
  neon: "radial-gradient(135% 115% at 50% 15%, #241344 0%, #140a27 48%, #080310 100%)",
  emerald: "radial-gradient(135% 115% at 50% 15%, #0e2d20 0%, #071b12 48%, #020c08 100%)",
  ocean: "radial-gradient(135% 115% at 50% 15%, #0c2740 0%, #071829 48%, #030b14 100%)",
  midnight: "radial-gradient(135% 115% at 50% 15%, #181b44 0%, #0d0f28 48%, #050612 100%)",
  sunset: "radial-gradient(135% 115% at 50% 15%, #2e160a 0%, #1b0c05 48%, #0c0402 100%)",
  aurora: "radial-gradient(135% 115% at 50% 15%, #0c2e28 0%, #061b17 48%, #020d0b 100%)",
  violet: "radial-gradient(135% 115% at 50% 15%, #291142 0%, #170928 48%, #0a0312 100%)",
  crimson: "radial-gradient(135% 115% at 50% 15%, #300c17 0%, #1c060d 48%, #0c0205 100%)",
  mono: "radial-gradient(135% 115% at 50% 15%, #1e1f26 0%, #111216 48%, #08090b 100%)",
  frost: "radial-gradient(135% 115% at 50% 15%, #10273c 0%, #091827 48%, #040c14 100%)",
  lava: "radial-gradient(135% 115% at 50% 15%, #300d0d 0%, #1c0707 48%, #0d0202 100%)",
};

/* Seamless, smooth screen-wide gradient that softly lights up the top-center and dissolves repeats */
export const STOCK_DOODLE_OVERLAY =
  "radial-gradient(120% 90% at 50% 25%, rgba(255,255,255,0.75) 0%, rgba(235,242,255,0.48) 35%, rgba(200,215,240,0.22) 68%, rgba(170,185,215,0.08) 100%)";

export const THEME_DOODLE_GRADIENT_MAP: Record<LiveBackgroundNeatPreset, string> = {
  none: STOCK_DOODLE_OVERLAY,
  neon: STOCK_DOODLE_OVERLAY,
  emerald: STOCK_DOODLE_OVERLAY,
  ocean: STOCK_DOODLE_OVERLAY,
  midnight: STOCK_DOODLE_OVERLAY,
  sunset: STOCK_DOODLE_OVERLAY,
  aurora: STOCK_DOODLE_OVERLAY,
  violet: STOCK_DOODLE_OVERLAY,
  crimson: STOCK_DOODLE_OVERLAY,
  mono: STOCK_DOODLE_OVERLAY,
  frost: STOCK_DOODLE_OVERLAY,
  lava: STOCK_DOODLE_OVERLAY,
};

export const THEME_SOLID_COLOR_MAP: Record<LiveBackgroundNeatPreset, string> = {
  none: "#ffffff",
  neon: "#8b5cf6",
  emerald: "#22c55e",
  ocean: "#0284c7",
  midnight: "#6366f1",
  sunset: "#f97316",
  aurora: "#10b981",
  violet: "#a855f7",
  crimson: "#f43f5e",
  mono: "#6b7280",
  frost: "#38bdf8",
  lava: "#ef4444",
};

export function TelegramDoodleWallpaper({
  presetColors,
  backgroundOverride,
  patternEnabled = true,
  presetId = "none",
  opacity = 0.35,
  className = "",
}: {
  presetColors?: string;
  backgroundOverride?: string;
  patternEnabled?: boolean;
  presetId?: LiveBackgroundNeatPreset;
  opacity?: number;
  className?: string;
}) {
  const currentSvg = THEME_SVG_MAP[presetId] || "/chat-bg-official.svg";
  const backdropGradient = backgroundOverride || THEME_BACKDROP_MAP[presetId] || THEME_BACKDROP_MAP.none;
  const doodleGradient = STOCK_DOODLE_OVERLAY;
  const maskSize = presetId === "none" ? "480px auto" : "240px auto";

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#07080a] ${className}`}>
      {/* 1. Deep atmospheric ambient gradient backdrop matching the color theme */}
      <div
        className="absolute inset-0"
        style={{
          background: backdropGradient,
        }}
      />

      {patternEnabled ? <>
      {/* 2. Soft atmospheric lighting glow that gently breaks pattern uniformity */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 25%, rgba(255,255,255,0.04) 0%, transparent 60%)",
        }}
      />

      {/* 3. Clean, crisp vector pattern layer with non-repeating screen-wide gradient lighting */}
      <div
        className="absolute inset-0"
        style={{
          background: doodleGradient,
          WebkitMaskImage: `url('${currentSvg}')`,
          maskImage: `url('${currentSvg}')`,
          WebkitMaskRepeat: "repeat",
          maskRepeat: "repeat",
          WebkitMaskPosition: "center top",
          maskPosition: "center top",
          WebkitMaskSize: maskSize,
          maskSize: maskSize,
          opacity: 0.38,
        }}
      />

      {/* 4. Soft edge vignette that smoothly dissolves tile boundaries toward the corners */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(ellipse 90% 80% at 50% 40%, transparent 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      </> : null}
    </div>
  );
}
