import type { LiveBackgroundNeatPreset } from "./live-background";

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
