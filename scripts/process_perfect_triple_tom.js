const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;

const normalSrc = path.join(brainDir, 'media__1786042361930.png');
const smileSrc = path.join(brainDir, 'media__1786042120104.png');
const seriousSrc = path.join(brainDir, 'media__1786042277433.png');
const bgSrc = path.join(brainDir, 'media__1786042058601.jpg');

const charDir = path.join(__dirname, '..', 'public', 'characters');
const scenesDir = path.join(__dirname, '..', 'public', 'scenes');

async function processBackground() {
  if (!fs.existsSync(bgSrc)) return;
  console.log('1. Processing background watermark removal...');

  const image = sharp(bgSrc);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  // Star watermark region: bottom-right barrel corner
  const wmWidth = Math.floor(width * 0.08);
  const wmHeight = Math.floor(height * 0.10);
  const wmLeft = Math.floor(width * 0.88);
  const wmTop = Math.floor(height * 0.78);

  // Clone clean neighbor barrel texture
  const patchLeft = Math.floor(width * 0.92);
  const patchTop = Math.floor(height * 0.86);

  const cleanPatch = await sharp(bgSrc)
    .extract({ left: Math.min(patchLeft, width - wmWidth), top: Math.min(patchTop, height - wmHeight), width: wmWidth, height: wmHeight })
    .blur(1.2)
    .toBuffer();

  const publicBg = path.join(scenesDir, 'tavern_background.jpg');
  await sharp(bgSrc)
    .composite([{ input: cleanPatch, left: wmLeft, top: wmTop, blend: 'over' }])
    .jpeg({ quality: 96 })
    .toFile(publicBg);

  fs.copyFileSync(publicBg, path.join(brainDir, 'clean_tavern_background.jpg'));
  console.log('✅ Background watermark removed seamlessly!');
}

async function matImage(srcFile, destFile) {
  if (!fs.existsSync(srcFile)) {
    console.error('File not found:', srcFile);
    return;
  }
  console.log(`Matting ${path.basename(srcFile)} -> ${path.basename(destFile)}...`);

  const { data, info } = await sharp(srcFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push({ x, y: 0 });
    queue.push({ x, y: height - 1 });
  }
  for (let y = 0; y < height; y++) {
    queue.push({ x: 0, y });
    queue.push({ x: width - 1, y });
  }

  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head++];
    const pos = y * width + x;
    if (visited[pos]) continue;
    visited[pos] = 1;

    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    if (r > 210 && g > 210 && b > 210) {
      data[idx + 3] = 0;
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(destFile);
}

async function main() {
  await processBackground();

  // Mat Normal
  await matImage(normalSrc, path.join(charDir, 'old_tom.png'));
  fs.copyFileSync(path.join(charDir, 'old_tom.png'), path.join(charDir, 'old_tom.jpg'));

  // Mat Smile
  await matImage(smileSrc, path.join(charDir, 'old_tom_smile.png'));

  // Mat Serious
  await matImage(seriousSrc, path.join(charDir, 'old_tom_serious.png'));
  fs.copyFileSync(path.join(charDir, 'old_tom_serious.png'), path.join(charDir, 'old_tom_surprised.png'));

  // Previews
  fs.copyFileSync(path.join(charDir, 'old_tom.png'), path.join(brainDir, 'final_tom_normal.png'));
  fs.copyFileSync(path.join(charDir, 'old_tom_smile.png'), path.join(brainDir, 'final_tom_smile.png'));
  fs.copyFileSync(path.join(charDir, 'old_tom_serious.png'), path.join(brainDir, 'final_tom_serious.png'));

  console.log('🎉 PERFECT TRIPLE EXPRESSION TOM DEPLOYED!');
}

main().catch(err => console.error(err));
