// Render the supplied TGS once: the lobby uses native WebP playback, not a Lottie runtime.
import fs from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import sharp from "sharp";
const require = createRequire(import.meta.url);
async function main() {
  const data = JSON.parse(gunzipSync(await fs.readFile("public/tgs/videocall.tgs"), { maxOutputLength: 4 * 1024 * 1024 }).toString());
  const size = 160, fps = 24;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>body{margin:0;background:transparent}#icon{width:${size}px;height:${size}px}</style><div id="icon"></div>`);
    await page.addScriptTag({ path: require.resolve("lottie-web/build/player/lottie.min.js") });
    const { images, delay } = await page.evaluate(async ({ data, fps }) => {
      const animation = window.lottie.loadAnimation({ container: document.getElementById("icon"), renderer: "canvas", animationData: data, loop: false, autoplay: false, rendererSettings: { dpr: 1, clearCanvas: true } });
      if (!animation.isLoaded) await new Promise((resolve, reject) => { animation.addEventListener("DOMLoaded", resolve); animation.addEventListener("data_failed", reject); });
      const count = Math.ceil((data.op - data.ip) / data.fr * fps), canvas = document.querySelector("canvas"), images = [];
      for (let index = 0; index < count; index++) { animation.goToAndStop(index * data.fr / fps, true); images.push(canvas.toDataURL("image/png").split(",")[1]); }
      animation.destroy(); return { images, delay: Math.round(1000 / fps) };
    }, { data, fps });
    const frames = await Promise.all(images.map(value => sharp(Buffer.from(value, "base64")).ensureAlpha().raw().toBuffer()));
    await fs.mkdir("public/animations", { recursive: true });
    await sharp(Buffer.concat(frames), { raw: { width: size, height: size * frames.length, pageHeight: size, channels: 4 } }).webp({ quality: 75, alphaQuality: 100, effort: 5, delay: frames.map(() => delay), loop: 0 }).toFile("public/animations/videocall.webp");
    const poster = await sharp(frames[0], { raw: { width: size, height: size, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
    await fs.writeFile("lib/client/videocall-poster.ts", `// Generated from public/tgs/videocall.tgs by scripts/build-videocall-animation.mjs.\nexport const videoCallPoster = "data:image/webp;base64,${poster.toString("base64")}";\n`);
    const metadata = await sharp("public/animations/videocall.webp", { animated: true }).metadata();
    console.log(`Rendered ${metadata.pages} frames; ${Math.round((await fs.stat("public/animations/videocall.webp")).size / 1024)} KB animation, ${poster.length} byte inline first frame.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
