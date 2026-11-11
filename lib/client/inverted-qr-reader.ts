/** Reuse the installed QR decoder for light-on-dark codes without a second camera stream. */
export async function createInvertedQrReader() {
  const [{ ZXingHtml5QrcodeDecoder }, { Html5QrcodeSupportedFormats }] = await Promise.all([
    import("html5-qrcode/esm/zxing-html5-qrcode-decoder"),
    import("html5-qrcode/esm/core"),
  ]);
  const decoder = new ZXingHtml5QrcodeDecoder([Html5QrcodeSupportedFormats.QR_CODE], false, {
    log() {}, warn() {}, logError() {}, logErrors() {},
  });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  const scan = async (source: HTMLVideoElement | HTMLImageElement, rotated = false) => {
    const video = source instanceof HTMLVideoElement;
    const width = video ? source.videoWidth : source.naturalWidth;
    const height = video ? source.videoHeight : source.naturalHeight;
    if (!width || !height) throw new Error("Frame unavailable");
    const scale = Math.min(1, (video ? 960 : 1800) / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale)), targetHeight = Math.max(1, Math.round(height * scale));
    canvas.width = rotated ? targetHeight : targetWidth;
    canvas.height = rotated ? targetWidth : targetHeight;
    context.save();
    if (rotated) { context.translate(canvas.width, 0); context.rotate(Math.PI / 2); }
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    context.restore();
    context.globalCompositeOperation = "difference";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    return (await decoder.decodeAsync(canvas)).text;
  };

  return {
    scanVideo: (video: HTMLVideoElement) => scan(video),
    async scanFile(file: File) {
      const url = URL.createObjectURL(file);
      try {
        const image = new Image(); image.src = url;
        await image.decode();
        try { return await scan(image); }
        catch { return await scan(image, true); }
      } finally { URL.revokeObjectURL(url); }
    },
  };
}
