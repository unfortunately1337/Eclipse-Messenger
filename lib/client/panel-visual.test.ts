import { expect, it } from "vitest";
import { normalizeLiveBackgroundSettings } from "./live-background";
import { getPanelVisualStyle } from "./panel-visual";

it("preserves the visual preference independently of the message theme", () => {
  expect(normalizeLiveBackgroundSettings({ neatPreset: "crimson", transparentVisual: false }).transparentVisual).toBe(false);
  expect(normalizeLiveBackgroundSettings({ neatPreset: "none", transparentVisual: true }).transparentVisual).toBe(true);
  expect(normalizeLiveBackgroundSettings({ messageThemeEnabled: false }).transparentVisual).toBe(true);
});
it("uses an opaque grey fill and disables both blur properties when turned off", () => {
  expect(getPanelVisualStyle(false)).toMatchObject({ backgroundColor: "#1c1c1e", backdropFilter: "none", WebkitBackdropFilter: "none" });
  expect(getPanelVisualStyle(true)).toMatchObject({ backgroundColor: "rgba(24, 24, 28, 0.92)", backdropFilter: "blur(8px) saturate(1.05)" });
});
