const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const targetPng = path.join(__dirname, '..', 'public', 'characters', 'old_tom.png');
const targetJpg = path.join(__dirname, '..', 'public', 'characters', 'old_tom.jpg');

async function processUserImage() {
  if (!fs.existsSync(targetPng)) {
    console.error('Target file not found:', targetPng);
    return;
  }

  console.log('Processing user provided image for 100% transparent matting...');
  const { data, info } = await sharp(targetPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
    
    // Mat out white, off-white, studio light-grey backgrounds
    if (r > 185 && g > 185 && b > 185) {
      data[idx + 3] = 0;
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(targetPng);
  fs.copyFileSync(targetPng, targetJpg);
  console.log('✅ User provided image processed with 100% transparent alpha channel!');
}

processUserImage().catch(err => console.error(err));
