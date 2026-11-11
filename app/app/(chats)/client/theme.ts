"use client";

import { CSSProperties } from "react";
import { type LiveBackgroundNeatPreset } from "@/lib/client/live-background";

export function getMineMessageGradientByPreset(preset: LiveBackgroundNeatPreset): string | null {
  switch (preset) {
    case "none":
      return null;
    case "neon":
      return "linear-gradient(180deg, #5f86f7 0%, #4d6ef0 100%)";
    case "ocean":
      return "linear-gradient(180deg, #3a9fe8 0%, #2f84de 100%)";
    case "sunset":
      return "linear-gradient(180deg, #ff9a67 0%, #f57f7e 100%)";
    case "aurora":
      return "linear-gradient(180deg, #36c5ab 0%, #4a8de8 100%)";
    case "violet":
      return "linear-gradient(180deg, #6f79ef 0%, #5b62dd 100%)";
    case "emerald":
      return "linear-gradient(180deg, #28b47e 0%, #2f9a7f 100%)";
    case "crimson":
      return "linear-gradient(180deg, #e15d78 0%, #c94f71 100%)";
    case "mono":
      return "linear-gradient(180deg, #7d8ca1 0%, #66798f 100%)";
    case "midnight":
      return "linear-gradient(180deg, #4e6fe0 0%, #3559cf 100%)";
    case "frost":
      return "linear-gradient(180deg, #7dc8f7 0%, #8aaef0 100%)";
    case "lava":
      return "linear-gradient(180deg, #ff8f58 0%, #e96a63 100%)";
    default:
      return null;
  }
}

export function getMineMessageSolidSurfaceByPreset(preset: LiveBackgroundNeatPreset): CSSProperties | undefined {
  switch (preset) {
    case "none":
      return undefined;
    case "neon":
      return { backgroundColor: "#5d7eff" };
    case "ocean":
      return { backgroundColor: "#259ee8" };
    case "sunset":
      return { backgroundColor: "#ff7f76" };
    case "aurora":
      return { backgroundColor: "#43c4b6" };
    case "violet":
      return { backgroundColor: "#886cff" };
    case "emerald":
      return { backgroundColor: "#32c97a" };
    case "crimson":
      return { backgroundColor: "#ef5a78" };
    case "mono":
      return { backgroundColor: "#8b99ad" };
    case "midnight":
      return { backgroundColor: "#4c74df" };
    case "frost":
      return { backgroundColor: "#92cfff" };
    case "lava":
      return { backgroundColor: "#ff7d56" };
    default:
      return undefined;
  }
}

export function getComposerSendSurfaceByPreset(preset: LiveBackgroundNeatPreset, themed: boolean): CSSProperties {
  if (preset === "none") {
    return { backgroundColor: "#ffffff" };
  }
  if (!themed) {
    return { backgroundColor: "#3f444b" };
  }
  switch (preset) {
    case "neon":
      return { backgroundImage: "linear-gradient(180deg, #405fd0 0%, #314ab8 100%)" };
    case "ocean":
      return { backgroundImage: "linear-gradient(180deg, #247cba 0%, #1e659f 100%)" };
    case "sunset":
      return { backgroundImage: "linear-gradient(180deg, #c66548 0%, #b24f4f 100%)" };
    case "aurora":
      return { backgroundImage: "linear-gradient(180deg, #238c81 0%, #2f6aa6 100%)" };
    case "violet":
      return { backgroundImage: "linear-gradient(180deg, #535cc5 0%, #454aa8 100%)" };
    case "emerald":
      return { backgroundImage: "linear-gradient(180deg, #1f895e 0%, #23715e 100%)" };
    case "crimson":
      return { backgroundImage: "linear-gradient(180deg, #ad425c 0%, #953951 100%)" };
    case "mono":
      return { backgroundImage: "linear-gradient(180deg, #5f6b7c 0%, #4f5d70 100%)" };
    case "midnight":
      return { backgroundImage: "linear-gradient(180deg, #3a55ad 0%, #2d459c 100%)" };
    case "frost":
      return { backgroundImage: "linear-gradient(180deg, #4f91bd 0%, #5b77b4 100%)" };
    case "lava":
      return { backgroundImage: "linear-gradient(180deg, #c65f3d 0%, #ad4c46 100%)" };
    default:
      return { backgroundColor: "#3d3d3d" };
  }
}

export function getUiAccentTokensByPreset(preset: LiveBackgroundNeatPreset) {
  if (preset === "none") {
    return {
      text: "rgba(244, 244, 245, 0.94)",
      solid: "#f1f2f4",
      contrast: "#111315",
      surface: "rgba(255, 255, 255, 0.12)",
      surfaceStrong: "rgba(255, 255, 255, 0.19)",
      ring: "rgba(255, 255, 255, 0.16)",
      glow: "rgba(255, 255, 255, 0.08)",
    };
  }

  switch (preset) {
    case "ocean":
    case "frost":
      return {
        text: "#a9ddff",
        solid: "#83c8ee",
        contrast: "#07151d",
        surface: "rgba(131, 200, 238, 0.16)",
        surfaceStrong: "rgba(131, 200, 238, 0.26)",
        ring: "rgba(131, 200, 238, 0.30)",
        glow: "rgba(131, 200, 238, 0.14)",
      };
    case "aurora":
    case "emerald":
      return {
        text: "#96efca",
        solid: "#75ddb3",
        contrast: "#071813",
        surface: "rgba(117, 221, 179, 0.15)",
        surfaceStrong: "rgba(117, 221, 179, 0.25)",
        ring: "rgba(117, 221, 179, 0.30)",
        glow: "rgba(117, 221, 179, 0.14)",
      };
    case "sunset":
    case "lava":
      return {
        text: "#ffc4a3",
        solid: "#f5aa83",
        contrast: "#1f1009",
        surface: "rgba(245, 170, 131, 0.15)",
        surfaceStrong: "rgba(245, 170, 131, 0.25)",
        ring: "rgba(245, 170, 131, 0.30)",
        glow: "rgba(245, 170, 131, 0.13)",
      };
    case "crimson":
      return {
        text: "#ffb3c2",
        solid: "#ee8aa3",
        contrast: "#210911",
        surface: "rgba(238, 138, 163, 0.15)",
        surfaceStrong: "rgba(238, 138, 163, 0.25)",
        ring: "rgba(238, 138, 163, 0.30)",
        glow: "rgba(238, 138, 163, 0.13)",
      };
    case "mono":
      return {
        text: "#d6dde7",
        solid: "#c9d0dc",
        contrast: "#11151b",
        surface: "rgba(201, 208, 220, 0.13)",
        surfaceStrong: "rgba(201, 208, 220, 0.22)",
        ring: "rgba(201, 208, 220, 0.26)",
        glow: "rgba(201, 208, 220, 0.10)",
      };
    case "neon":
    case "violet":
    case "midnight":
    default:
      return {
        text: "#b9c8ff",
        solid: "#9fb2ff",
        contrast: "#0b1020",
        surface: "rgba(159, 178, 255, 0.15)",
        surfaceStrong: "rgba(159, 178, 255, 0.25)",
        ring: "rgba(159, 178, 255, 0.30)",
        glow: "rgba(159, 178, 255, 0.13)",
      };
  }
}

export function getMineReactionSurfaceByPreset(preset: LiveBackgroundNeatPreset): CSSProperties | undefined {
  void preset;
  return {
    backgroundColor: "rgba(147, 154, 161, 0.64)",
    borderColor: "rgba(255,255,255,0.26)",
    boxShadow: "0 8px 18px -15px rgba(0,0,0,0.7)",
    backdropFilter: "blur(8px) saturate(1.02)",
    WebkitBackdropFilter: "blur(8px) saturate(1.02)",
  };
}

export function getReplyPreviewSurfaceByPreset(preset: LiveBackgroundNeatPreset): CSSProperties | undefined {
  switch (preset) {
    case "none":
      return undefined;
    case "neon":
      return { backgroundColor: "rgba(96, 120, 255, 0.42)" };
    case "ocean":
      return { backgroundColor: "rgba(39, 176, 244, 0.42)" };
    case "sunset":
      return { backgroundColor: "rgba(255, 138, 76, 0.42)" };
    case "aurora":
      return { backgroundColor: "rgba(61, 214, 208, 0.4)" };
    case "violet":
      return { backgroundColor: "rgba(141, 114, 255, 0.42)" };
    case "emerald":
      return { backgroundColor: "rgba(53, 207, 116, 0.42)" };
    case "crimson":
      return { backgroundColor: "rgba(244, 95, 134, 0.42)" };
    case "mono":
      return { backgroundColor: "rgba(138, 150, 171, 0.42)" };
    case "midnight":
      return { backgroundColor: "rgba(77, 115, 230, 0.4)" };
    case "frost":
      return { backgroundColor: "rgba(126, 216, 255, 0.4)" };
    case "lava":
      return { backgroundColor: "rgba(255, 94, 99, 0.42)" };
    default:
      return undefined;
  }
}

export function getMessageStatusTickColor(preset: LiveBackgroundNeatPreset, read: boolean): string | null {
  if (preset === "none") return null;
  if (!read) return "rgba(228, 228, 231, 0.92)";
  switch (preset) {
    case "neon":
      return "#d6e4ff";
    case "ocean":
      return "#d7f0ff";
    case "sunset":
      return "#ffe2c8";
    case "aurora":
      return "#cbfff7";
    case "violet":
      return "#efe5ff";
    case "emerald":
      return "#dcffe9";
    case "crimson":
      return "#ffe0ea";
    case "mono":
      return "#f5f8ff";
    case "midnight":
      return "#d8e6ff";
    case "frost":
      return "#eef9ff";
    case "lava":
      return "#ffe3a6";
    default:
      return "#e4e4e7";
  }
}

export function getUnreadBadgeStyleByPreset(preset: LiveBackgroundNeatPreset): CSSProperties | undefined {
  const gradient = getMineMessageGradientByPreset(preset);
  if (!gradient) return undefined;
  return {
    backgroundImage: gradient,
    color: "#ffffff",
  };
}
