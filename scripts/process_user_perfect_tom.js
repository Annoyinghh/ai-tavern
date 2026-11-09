const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const userImg = path.join(brainDir, 'media__1786041913071.png');

const charDir = path.join(__dirname, '..', 'public', 'characters');
const destPng = path.join(charDir, 'old_tom.png');
const destJpg = path.join(charDir, 'old_tom.jpg');
const destSmile = path.join(charDir, 'old_tom_smile.png');
const destSerious = path.join(charDir, 'old_tom_serious.png');
const destSurprised = path.join(charDir, 'old_tom_surprised.png');

const brainPreview = path.join(brainDir, 'user_perfect_tom_transparent.png');

async function main() {
  if (!fs.existsSync(userImg)) {
    console.error('User image not found at:', userImg);
    return;
  }

  console.log('Processing user selected masterpiece image for Old Tom...');
  const { data, info } = await sharp(userImg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Edge background detection (floodfill white/off-white studio background)
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
    
    // Pure white or off-white background threshold
    if (r > 220 && g > 220 && b > 220) {
      data[idx + 3] = 0; // Set Alpha to 0 (100% Transparent)
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  // Save transparent PNG
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(destPng);
  
  // Sync across all expression variants
  fs.copyFileSync(destPng, destJpg);
  fs.copyFileSync(destPng, destSmile);
  fs.copyFileSync(destPng, destSerious);
  fs.copyFileSync(destPng, destSurprised);
  fs.copyFileSync(destPng, brainPreview);

  console.log('✅ User chosen masterpiece image matted transparent and deployed to all expression files!');
}

main().catch(err => console.error(err));
