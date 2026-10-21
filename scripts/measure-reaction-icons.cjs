// Match animated emoji's visible artwork to the existing 24px static glyphs.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
async function main() {
  const file = path.resolve(__dirname, '../lib/client/emoji-animation-assets.json');
  const assets = JSON.parse(fs.readFileSync(file, 'utf8'));
  let measured = 0;
  for (const asset of Object.values(assets)) {
    const image = path.resolve(__dirname, '../public' + asset.preview);
    if (!fs.existsSync(image)) continue;
    const metadata = await sharp(image).metadata();
    const { data, info } = await sharp(image, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const height = metadata.pageHeight || metadata.height;
    const pages = metadata.pages || 1;
    const samples = [...new Set([0, Math.floor(pages / 3), Math.floor(pages * 2 / 3), pages - 1])];
    const fractions = [];
    for (const page of samples) {
      let left = info.width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < info.width; x++) {
        if (data[((page * height + y) * info.width + x) * 4 + 3] > 32) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (right >= left) fractions.push(Math.max(right - left + 1, bottom - top + 1) / Math.max(info.width, height));
    }
    fractions.sort((a, b) => a - b);
    const fraction = fractions[Math.floor(fractions.length / 2)] || 1;
    asset.reactionScale = Math.round(Math.min(1.6, Math.max(1, 0.94 / fraction)) * 100) / 100;
    measured++;
  }
  fs.writeFileSync(file, JSON.stringify(assets, null, 2) + '\n');
  console.log(`Measured ${measured} local reaction animations`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
