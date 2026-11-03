/** Width transitions reflow message rows; commit viewport state once they settle. */
export function observeViewportGeometry(element: HTMLElement, update: () => void) {
  let width = element.clientWidth, height = element.clientHeight;
  let frame: number | null = null;
  let settled: ReturnType<typeof setTimeout> | undefined;
  update();
  if (typeof ResizeObserver === "undefined") return () => {};
  const commit = () => { frame = null; update(); };
  const observer = new ResizeObserver(() => {
    const nextWidth = element.clientWidth, nextHeight = element.clientHeight;
    if (width === nextWidth && height === nextHeight) return;
    const heightChanged = height !== nextHeight;
    width = nextWidth; height = nextHeight;
    clearTimeout(settled);
    if (heightChanged) {
      if (frame === null) frame = requestAnimationFrame(commit);
    } else settled = setTimeout(commit, 100);
  });
  observer.observe(element);
  return () => { observer.disconnect(); clearTimeout(settled); if (frame !== null) cancelAnimationFrame(frame); };
}
