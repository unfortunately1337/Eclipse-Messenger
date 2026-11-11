/** Small, bounded paint of the visible bubble. No DOM clones, image downloads,
 * layout changes or full-page screenshots are needed for the dust texture. */
export function paintMessageSnapshot(source: HTMLElement) {
  const original = source.getBoundingClientRect();
  const viewport = source.closest("[data-chat-message-viewport]")?.getBoundingClientRect();
  const left = Math.max(0, original.left, viewport?.left ?? 0);
  const top = Math.max(0, original.top, viewport?.top ?? 0);
  const right = Math.min(innerWidth, original.right, viewport?.right ?? innerWidth);
  const bottom = Math.min(innerHeight, original.bottom, viewport?.bottom ?? innerHeight);
  if (right <= left || bottom <= top) return null;
  const bounds = { left, top, width: right - left, height: bottom - top };
  const scale = Math.min(1.5, 720 / bounds.width, 640 / bounds.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(bounds.width * scale));
  canvas.height = Math.max(1, Math.ceil(bounds.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale); ctx.translate(-left, -top);
  const elements = [source, ...source.querySelectorAll<HTMLElement>("*")].slice(0, 140);
  for (const node of elements) {
    if (!(node instanceof HTMLElement)) continue;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < top || rect.top > bottom) continue;
    const style = getComputedStyle(node);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;
    const colors = style.backgroundImage.match(/rgba?\([^)]*\)|#[\da-f]{3,8}/gi);
    let fill: string | CanvasGradient = style.backgroundColor;
    if (colors && colors.length > 1) {
      const gradient = ctx.createLinearGradient(0, rect.top, 0, rect.bottom);
      colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
      fill = gradient;
    }
    if (fill !== "rgba(0, 0, 0, 0)" && fill !== "transparent") {
      ctx.fillStyle = fill; ctx.beginPath();
      ctx.roundRect(rect.left, rect.top, rect.width, rect.height, Math.min(parseFloat(style.borderRadius) || 0, rect.width / 2, rect.height / 2));
      ctx.fill();
    }
    if (node instanceof HTMLImageElement || node instanceof HTMLVideoElement || node instanceof HTMLCanvasElement) {
      const src = node instanceof HTMLImageElement ? node.currentSrc : node instanceof HTMLVideoElement ? node.currentSrc : "";
      // Cross-origin pictures must never taint a texture or require a new fetch.
      if (src && !src.startsWith("blob:") && !src.startsWith("data:") && new URL(src, location.href).origin !== location.origin) continue;
      try {
        ctx.save(); ctx.beginPath(); ctx.roundRect(rect.left, rect.top, rect.width, rect.height, parseFloat(style.borderRadius) || 0); ctx.clip();
        const width = node instanceof HTMLImageElement ? node.naturalWidth : node instanceof HTMLVideoElement ? node.videoWidth : node.width;
        const height = node instanceof HTMLImageElement ? node.naturalHeight : node instanceof HTMLVideoElement ? node.videoHeight : node.height;
        if (width && height) {
          const fit = style.objectFit === "cover" ? Math.max(rect.width / width, rect.height / height) : Math.min(rect.width / width, rect.height / height);
          const w = width * fit, h = height * fit;
          ctx.drawImage(node, rect.left + (rect.width - w) / 2, rect.top + (rect.height - h) / 2, w, h);
        }
      } catch { /* A frame may have been released during navigation. */ }
      finally { ctx.restore(); }
    }
  }
  // Text is painted in its measured line boxes, including time and filename.
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
  let node: Node | null, remaining = 1400, nodes = 0;
  const range = document.createRange();
  while ((node = walker.nextNode()) && remaining > 0 && nodes++ < 80) {
    const parent = node.parentElement;
    if (!parent || parent.closest("svg,script,style,[aria-hidden=true]")) continue;
    let text = (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, remaining);
    if (!text) continue;
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).slice(0, 12);
    if (!rects.length) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === "hidden" || style.opacity === "0") continue;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.textBaseline = "top"; ctx.fillStyle = style.color;
    for (let i = 0; i < rects.length && text; i++) {
      const rect = rects[i];
      let length = text.length;
      if (i < rects.length - 1) {
        let low = 1, high = text.length;
        while (low < high) { const mid = Math.ceil((low + high) / 2); if (ctx.measureText(text.slice(0, mid)).width <= rect.width + 1) low = mid; else high = mid - 1; }
        length = low;
        const space = text.lastIndexOf(" ", length); if (space > length * 0.65) length = space;
      }
      if (rect.bottom >= top && rect.top <= bottom) ctx.fillText(text.slice(0, length), rect.left, rect.top, rect.width);
      remaining -= length; text = text.slice(length).trimStart();
    }
  }
  range.detach();
  return { canvas, bounds };
}
