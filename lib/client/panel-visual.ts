import type { CSSProperties } from "react";

export function getPanelVisualStyle(transparent: boolean): CSSProperties {
  return {
    backgroundColor: transparent ? "rgba(24, 24, 28, 0.92)" : "#1c1c1e",
    borderColor: transparent ? "rgba(255,255,255,0.07)" : "transparent",
    boxShadow: transparent ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
    backdropFilter: transparent ? "blur(8px) saturate(1.05)" : "none",
    WebkitBackdropFilter: transparent ? "blur(8px) saturate(1.05)" : "none",
  };
}

/** Shared material for the chat header, pinned message and floating mini-player. */
export function getChatHeaderVisualStyle(transparent: boolean): CSSProperties {
  return {
    backgroundColor: "rgba(24, 24, 24, 0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.055)",
    backdropFilter: "blur(16px) saturate(1.05)",
    WebkitBackdropFilter: "blur(16px) saturate(1.05)",
    ...getPanelVisualStyle(transparent),
  };
}
