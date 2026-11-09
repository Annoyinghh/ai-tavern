const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const targetDir = path.join(__dirname, '..', 'public', 'characters');

const filesToProcess = [
  { rawName: 'shadow_rogue_normal_raw_1786076489155.png', targetName: 'shadow_rogue.png' },
  { rawName: 'shadow_rogue_smile_raw_1786076500350.png', targetName: 'shadow_rogue_smile.png' },
  { rawName: 'shadow_rogue_serious_raw_1786076511236.png', targetName: 'shadow_rogue_serious.png' },
  { rawName: 'shadow_rogue_surprised_raw_1786076523244.png', targetName: 'shadow_rogue_surprised.png' },
];

async function matAndSaveImage(rawName, targetName) {
  const rawPath = path.join(brainDir, rawName);
  const targetPath = path.join(targetDir, targetName);

  if (!fs.existsSync(rawPath)) {
    console.error('Raw file not found:', rawPath);
    return;
  }

  console.log(`Pure BFS Outer-Border Matting for ${rawName} -> ${targetName}...`);
  const buf = fs.readFileSync(rawPath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Add all border pixels to BFS queue
  for (let x = 0; x < width; x++) {
    queue.push({ x, y: 0 });
    queue.push({ x, y: height - 1 });
  }
  for (let y = 0; y < height; y++) {
    queue.push({ x: 0, y });
    queue.push({ x: width - 1, y });
  }

  // Pure BFS Outer Border Floodfill (STRICTLY CONNECTED TO OUTSIDE BACKGROUND ONLY!)
  // NEVER touches inside faces, skin, clothing, or shadow aura!
  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head++];
    const pos = y * width + x;
    if (visited[pos]) continue;
    visited[pos] = 1;

    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    // Background white pixel threshold
    if (r > 195 && g > 195 && b > 195) {
      data[idx + 3] = 0; // Set Alpha to 0 (Transparent)
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  const outBuf = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(targetPath, outBuf);
  console.log(`✓ Saved clean matted PNG for Shadow Rogue to ${targetPath}`);
}

async function main() {
  for (const item of filesToProcess) {
    await matAndSaveImage(item.rawName, item.targetName);
  }
  console.log('🎉 ALL 4 SHADOW ROGUE (WALTER) EXPRESSIONS MATTED AND SAVED SUCCESSFULLY!');
}

main().catch(err => console.error(err));
