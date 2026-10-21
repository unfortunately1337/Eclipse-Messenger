/** Follow a changing message height without restarting the motion. */
export function createChatBottomScroll(viewport: HTMLElement, onFinish: () => void) {
  return createChatTargetScroll(viewport, () => viewport.scrollHeight - viewport.clientHeight, onFinish);
}

/** A moving target also lets reply/pin navigation follow virtualized row measurements. */
export function createChatTargetScroll(viewport: HTMLElement, getTarget: () => number, onFinish: () => void) {
  let frame = 0;
  let previousTime = performance.now();
  let velocity = 0;
  let position = viewport.scrollTop;
  let cancelled = false;

  const tick = (time: number) => {
    if (cancelled) return;
    const dt = Math.min(32, Math.max(1, time - previousTime)) / 1000;
    previousTime = time;
    const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const target = Math.min(maximum, Math.max(0, getTarget()));
    // Keep subpixel progress even when the browser rounds scrollTop to pixels.
    if (Math.abs(viewport.scrollTop - position) > 1) {
      position = viewport.scrollTop;
      velocity = 0;
    }
    const offset = position - target;
    // A critically damped spring starts gently and preserves its velocity when
    // another message or a media measurement changes the destination.
    const frequency = 16;
    const decay = Math.exp(-frequency * dt);
    const impulse = velocity + frequency * offset;
    const nextOffset = (offset + impulse * dt) * decay;
    velocity = (velocity - frequency * impulse * dt) * decay;
    position = Math.min(maximum, Math.max(0, target + nextOffset));
    viewport.scrollTop = position;
    if (Math.abs(target - position) <= 0.5 && Math.abs(velocity) < 8) {
      viewport.scrollTop = target;
      onFinish();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return {
    viewport,
    cancel() {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
  };
}
