function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radii: number | number[]) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radii);
    return;
  }
  const [tl, tr, br, bl] = typeof radii === "number" ? [radii, radii, radii, radii] : radii;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y); ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br); ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y); ctx.closePath();
}

export async function drawQrCode(canvas: HTMLCanvasElement, url: string, options: { dark?: boolean } = {}) {
  const QRCode = await import("qrcode");
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const size = 900, margin = 4, unit = Math.floor(size / (qr.modules.size + margin * 2));
  // Keep the module grid on whole pixels so rounding cannot blur timing patterns.
  const inset = Math.floor((size - (qr.modules.size + margin * 2) * unit) / 2);
  const foreground = options.dark ? "#ffffff" : "#08090a";
  const background = options.dark ? "#202124" : "#ffffff";
  canvas.width = canvas.height = size;
  ctx.fillStyle = background; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = foreground;
  const finder = (row: number, col: number) => (row < 7 && col < 7) || (row < 7 && col >= qr.modules.size - 7) || (row >= qr.modules.size - 7 && col < 7);
  const dark = (row: number, col: number) => row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && qr.modules.get(row, col);
  for (let row = 0; row < qr.modules.size; row++) for (let col = 0; col < qr.modules.size; col++) {
    if (!qr.modules.get(row, col) || finder(row, col)) continue;
    const x = inset + (col + margin) * unit, y = inset + (row + margin) * unit;
    // Round only exposed corners. Neighbouring modules form continuous shapes,
    // rather than a grid of independently rounded squares with visible seams.
    const top = dark(row - 1, col), right = dark(row, col + 1), bottom = dark(row + 1, col), left = dark(row, col - 1);
    const radius = unit * .46;
    ctx.beginPath(); roundedRect(ctx, x, y, unit + .35, unit + .35, [
      !top && !left ? radius : 0, !top && !right ? radius : 0,
      !bottom && !right ? radius : 0, !bottom && !left ? radius : 0,
    ]); ctx.fill();
  }
  for (const [col, row] of [[0, 0], [qr.modules.size - 7, 0], [0, qr.modules.size - 7]]) {
    const x = inset + (col + margin) * unit, y = inset + (row + margin) * unit;
    for (const [offset, width, radius, color] of [[0, 7, 1.9, foreground], [1, 5, 1.1, background], [2, 3, .65, foreground]] as const) {
      ctx.fillStyle = color; ctx.beginPath(); roundedRect(ctx, x + offset * unit, y + offset * unit, width * unit, width * unit, radius * unit); ctx.fill();
    }
  }
}
