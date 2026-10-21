// Build small animated previews from the messenger's existing emoji assets.
// Run after extending the mapping; source GIFs may be bundled or cached by the emoji API.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const root = process.cwd();
  const mapping = (await fs.readFile(path.join(root, 'lib/client/telegram-emoji-gifs.ts'), 'utf8')).split('export const BUNDLED_STATIC_GIFS')[0];
  const names = [...new Set([...mapping.matchAll(/: "([^"\n]+\.gif)"/g)].map(match => match[1]))];
  const dest = path.join(root, 'public/emoji-picker');
  await fs.mkdir(dest, { recursive: true });
  const manifest = {};
  for (const name of names) {
    let input;
    for (const directory of ['public/gifs', '.cache/emoji-gifs']) {
      const file = path.join(root, directory, name);
      try { await fs.access(file); input = file; break; } catch {}
    }
    if (!input) throw new Error(`Missing source emoji: ${name}`);
    const metadata = await sharp(input, { animated: true }).metadata();
    const { data, info } = await sharp(input, { animated: true }).resize({ width: 64, height: 64, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frameHeight = info.height / (metadata.pages || 1);
    const frameBytes = info.width * frameHeight * info.channels;
    const frames = [], delay = [];
    let accumulated = 0, first = 0;
    for (let frame = 0; frame < (metadata.pages || 1); frame++) {
      accumulated += metadata.delay?.[frame] || 20;
      if (accumulated >= 66 || frame === (metadata.pages || 1) - 1) {
        frames.push(data.subarray(first * frameBytes, (first + 1) * frameBytes));
        delay.push(accumulated);
        first = frame + 1;
        accumulated = 0;
      }
    }
    const output = name.replace(/\.gif$/, '.webp');
    await sharp(Buffer.concat(frames), { raw: { width: info.width, height: frameHeight * frames.length, channels: info.channels, pageHeight: frameHeight } })
      .webp({ quality: 72, effort: 4, delay, loop: 0 }).toFile(path.join(dest, output));
    manifest[name] = { preview: `/emoji-picker/${output}`, durationMs: delay.reduce((sum, ms) => sum + ms, 0) };
  }
  await fs.writeFile(path.join(root, 'lib/client/emoji-animation-assets.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Built ${Object.keys(manifest).length} animated previews`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
