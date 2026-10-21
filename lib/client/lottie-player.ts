import type { LottiePlayer } from "lottie-web";

let player: Promise<LottiePlayer | null> | undefined;

/** Even the SVG player probes Canvas while its module is evaluated. */
export function loadLottiePlayer(): Promise<LottiePlayer | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return player ??= (async () => {
    try {
      if (!document.createElement("canvas").getContext("2d")) return null;
      return (await import("lottie-web")).default;
    } catch {
      // A blocked renderer or unavailable animation chunk is nonessential UI.
      return null;
    }
  })();
}
