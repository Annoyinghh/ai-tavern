const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const srcSurprised = path.join(brainDir, 'media__1786042520279.png');
const destSurprised = path.join(__dirname, '..', 'public', 'characters', 'old_tom_surprised.png');

async function main() {
  if (!fs.existsSync(srcSurprised)) {
    console.error('Surprised image not found at:', srcSurprised);
    return;
  }

  console.log('Processing Surprised Old Tom for 100% transparent matting...');
  const { data, info } = await sharp(srcSurprised).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
      data[idx + 3] = 0; // Alpha 0
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(destSurprised);
  fs.copyFileSync(destSurprised, path.join(brainDir, 'final_tom_surprised.png'));
  console.log('✅ Surprised Old Tom matted 100% transparent & saved to old_tom_surprised.png!');
}

main().catch(err => console.error(err));
