/** Collapse a burst of SDK events into one render; never delay media itself. */
export function createCallRenderScheduler(render: () => void, request = requestAnimationFrame, cancel = cancelAnimationFrame) {
  let frame: number | null = null;
  let disposed = false;
  return {
    update() {
      if (disposed || frame !== null) return;
      frame = request(() => { frame = null; if (!disposed) render(); });
    },
    dispose() { disposed = true; if (frame !== null) cancel(frame); frame = null; },
  };
}
