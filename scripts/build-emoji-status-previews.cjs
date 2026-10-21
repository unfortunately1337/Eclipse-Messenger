// Pre-render custom emoji so the picker never runs dozens of Lottie players.
// Run with Chrome installed, or set CHROME_PATH to a Chromium executable.
const fs = require('node:fs/promises');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright-core');
const sharp = require('sharp');
sharp.cache({ files: 0 });
process.chdir(path.resolve(__dirname, '..'));
const SIZE = 96;
const FPS = 12;
// Repair previews from older sharp builds that applied a scalar delay only to
// the first frame. ANMF's 24-bit duration starts 12 bytes into its frame header.
function normalizeTiming(bytes, durationMs) {
  const offsets = [];
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + length > bytes.length) throw new Error('Invalid WebP chunk');
    if (bytes.toString('ascii', offset, offset + 4) === 'ANMF' && length >= 16) offsets.push(offset + 20);
    offset += 8 + length + (length % 2);
  }
  const total = offsets.reduce((sum, offset) => sum + bytes.readUIntLE(offset, 3), 0);
  if (!offsets.length || Math.abs(total - durationMs) < Math.max(100, durationMs * .1)) return false;
  const delay = Math.max(20, Math.round(durationMs / offsets.length));
  for (const offset of offsets) bytes.writeUIntLE(delay, offset, 3);
  return true;
}
async function main() {
  const catalog = JSON.parse(await fs.readFile('lib/emoji-status-catalog.json', 'utf8'));
  const browser = await chromium.launch(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, headless: true }
    : { channel: 'chrome', headless: true });
  let next = 0, done = 0;
  const invalid = new Set();
  try {
    await Promise.all(Array.from({ length: 2 }, async () => {
      const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
      await page.setContent(`<style>html,body{margin:0;background:transparent}#icon{width:${SIZE}px;height:${SIZE}px}</style><div id="icon"></div>`);
      await page.addScriptTag({ path: require.resolve('lottie-web/build/player/lottie.min.js') });
      while (next < catalog.length) {
        const entry = catalog[next++];
        const preview = entry.animation.replace(/\.tgs$/, '.picker-hq-v1.webp');
        const thumbnail = entry.animation.replace(/\.tgs$/, '.still-hq-v1.webp');
        try {
          const existing = await sharp('public' + preview, { animated: true }).metadata();
          if (existing.width === SIZE && existing.height && existing.height % SIZE === 0) {
            if ((existing.pages || 1) > 1) {
              const source = JSON.parse(gunzipSync(await fs.readFile('public' + entry.animation), { maxOutputLength: 4 * 1024 * 1024 }).toString());
              const bytes = await fs.readFile('public' + preview);
              if (normalizeTiming(bytes, (source.op - source.ip) / source.fr * 1000)) await fs.writeFile('public' + preview, bytes);
            }
            await fs.access('public' + thumbnail);
            entry.preview = preview; entry.thumbnail = thumbnail; done++; continue;
          }
        } catch {}
        try {
          const bytes = await fs.readFile('public' + entry.animation);
          const data = JSON.parse(gunzipSync(bytes, { maxOutputLength: 4 * 1024 * 1024 }).toString());
          const result = await page.evaluate(async ({ data, fps }) => {
            window.currentAnimation?.destroy();
            window.currentAnimation = null;
            const animation = window.lottie.loadAnimation({ container: document.getElementById('icon'), renderer: 'canvas', animationData: data, loop: false, autoplay: false, rendererSettings: { dpr: 1, clearCanvas: true } });
            window.currentAnimation = animation;
            await new Promise((resolve, reject) => {
              if (animation.isLoaded) { resolve(); return; }
              const timeout = setTimeout(() => reject(new Error('Lottie load timeout')), 5000);
              animation.addEventListener('DOMLoaded', () => { clearTimeout(timeout); resolve(); });
              animation.addEventListener('data_failed', () => { clearTimeout(timeout); reject(new Error('Invalid Lottie')); });
            });
            const duration = (data.op - data.ip) / data.fr;
            const count = Math.max(2, Math.min(72, Math.ceil(duration * fps)));
            const delay = Math.max(20, Math.round(duration * 1000 / count));
            const canvas = document.querySelector('canvas');
            const frames = [];
            for (let frame = 0; frame < count; frame++) {
              animation.goToAndStop(frame * (data.op - data.ip) / count, true);
              frames.push(canvas.toDataURL('image/png').split(',')[1]);
            }
            return { frames, delay };
          }, { data, fps: FPS });
          const frames = await Promise.all(result.frames.map(frame => sharp(Buffer.from(frame, 'base64')).ensureAlpha().raw().toBuffer()));
          await sharp(Buffer.concat(frames), { raw: { width: SIZE, height: SIZE * frames.length, pageHeight: SIZE, channels: 4 } })
            .webp({ quality: 86, alphaQuality: 100, effort: 3, delay: frames.map(() => result.delay), loop: 0 }).toFile('public' + preview);
          const poster = Math.floor(frames.length / 3);
          await sharp(frames[poster], { raw: { width: SIZE, height: SIZE, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toFile('public' + thumbnail);
          entry.thumbnail = thumbnail;
          entry.preview = preview;
          done++;
          if (done % 25 === 0) console.log(`Built ${done}/${catalog.length} lightweight animations`);
        } catch (error) {
          if (/unable to open|permission|ENOSPC|EBUSY/i.test(error.message)) throw error;
          invalid.add(entry.id);
          console.warn('Excluded unsupported animation:', entry.animation, error.message.split('\n')[0]);
        }
      }
      await page.close();
    }));
    await fs.writeFile('lib/emoji-status-catalog.json', JSON.stringify(catalog.filter(entry => !invalid.has(entry.id)), null, 2) + '\n');
    console.log(`Ready: ${done} animated previews; ${invalid.size} invalid animations excluded`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
