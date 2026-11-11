import { useLayoutEffect, useRef } from "react";
import type { StoryOverlay } from "@/lib/story-overlay";
import { drawStoryOverlayToCanvas } from "../../helpers";

// Use the same renderer as the editor for identical brush curves and widths.
export function StoryDrawingCanvas({ overlay }: { overlay: StoryOverlay }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const draw = () => {
      // A transformed opening animation must not change the canvas's layout size.
      drawStoryOverlayToCanvas(canvas, overlay, stage.clientWidth, stage.clientHeight);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [overlay]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}
