import { getChatHeaderVisualStyle, getComposerVisualStyle } from "./panel-visual";

export function callOverlayMaterial(glass: boolean) {
  return getComposerVisualStyle(glass);
}

export function callControlSurface(glass: boolean) {
  return `grid shrink-0 place-items-center rounded-full border ${glass ? "border-white/[0.07] bg-[rgba(40,40,44,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[8px] backdrop-saturate-[1.05]" : "border-transparent bg-[#252527] shadow-none backdrop-blur-none"}`;
}
export function callControlStyle(glass: boolean) {
  return `${callControlSurface(glass)} transition-[background-color,color,transform] duration-200 hover:bg-white/20 active:scale-95 active:bg-[var(--ui-accent-solid,#d4d6da)] active:text-[color:var(--ui-accent-contrast,#18181b)] aria-pressed:border-transparent aria-pressed:bg-[var(--ui-accent-solid,#d4d6da)] aria-pressed:text-[color:var(--ui-accent-contrast,#18181b)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-accent-solid,#d4d6da)] disabled:opacity-35`;
}
export function callWindowMaterial(glass: boolean) {
  return { ...getChatHeaderVisualStyle(glass), border: 0,
    backgroundColor: glass ? "rgba(28, 28, 30, 0.86)" : "#1c1c1e",
    backdropFilter: glass ? "blur(24px) saturate(1.1)" : "none",
    WebkitBackdropFilter: glass ? "blur(24px) saturate(1.1)" : "none" };
}
