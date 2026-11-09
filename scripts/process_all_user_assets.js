const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;

const bgSrc = path.join(brainDir, 'media__1786042058601.jpg');
const smileSrc = path.join(brainDir, 'media__1786042120104.png');

const publicBg = path.join(__dirname, '..', 'public', 'scenes', 'tavern_background.jpg');
const publicSmile = path.join(__dirname, '..', 'public', 'characters', 'old_tom_smile.png');

const brainCleanBg = path.join(brainDir, 'clean_tavern_background.jpg');
const brainCleanSmile = path.join(brainDir, 'transparent_old_tom_smile.png');

async function processBackground() {
  if (!fs.existsSync(bgSrc)) return;
  console.log('1. Processing tavern background to remove bottom-right star watermark...');

  const image = sharp(bgSrc);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  // Star watermark region: bottom-right barrel corner
  const wmWidth = Math.floor(width * 0.08);
  const wmHeight = Math.floor(height * 0.10);
  const wmLeft = Math.floor(width * 0.88);
  const wmTop = Math.floor(height * 0.78);

  // Extract clean barrel texture patch from neighbor barrel region
  const patchLeft = Math.floor(width * 0.92);
  const patchTop = Math.floor(height * 0.86);

  const cleanPatch = await sharp(bgSrc)
    .extract({ left: Math.min(patchLeft, width - wmWidth), top: Math.min(patchTop, height - wmHeight), width: wmWidth, height: wmHeight })
    .blur(1.2)
    .toBuffer();

  await sharp(bgSrc)
    .composite([{ input: cleanPatch, left: wmLeft, top: wmTop, blend: 'over' }])
    .jpeg({ quality: 96 })
    .toFile(publicBg);

  fs.copyFileSync(publicBg, brainCleanBg);
  console.log('✅ 1. Watermark removed & clean background saved to tavern_background.jpg!');
}

async function processSmileTom() {
  if (!fs.existsSync(smileSrc)) return;
  console.log('2. Processing Laughing Old Tom for transparent background matting...');

  const { data, info } = await sharp(smileSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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

    if (r > 215 && g > 215 && b > 215) {
      data[idx + 3] = 0; // Alpha 0
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(publicSmile);
  fs.copyFileSync(publicSmile, brainCleanSmile);
  console.log('✅ 2. Laughing Old Tom matted 100% transparent & saved to old_tom_smile.png!');
}

async function main() {
  await processBackground();
  await processSmileTom();
}

main().catch(err => console.error(err));
