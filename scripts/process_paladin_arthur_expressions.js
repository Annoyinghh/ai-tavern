const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const targetDir = path.join(__dirname, '..', 'public', 'characters');

const filesToProcess = [
  { rawName: 'paladin_arthur_smile_raw_1786075912419.png', targetName: 'paladin_arthur_smile.png' },
  { rawName: 'paladin_arthur_serious_raw_1786075926821.png', targetName: 'paladin_arthur_serious.png' },
  { rawName: 'paladin_arthur_surprised_raw_1786075979951.png', targetName: 'paladin_arthur_surprised.png' },
];

async function matAndSaveImage(rawName, targetName) {
  const rawPath = path.join(brainDir, rawName);
  const targetPath = path.join(targetDir, targetName);

  if (!fs.existsSync(rawPath)) {
    console.error('Raw file not found:', rawPath);
    return;
  }

  console.log(`Processing and matting ${rawName} -> ${targetName}...`);
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

  // Outer border matting
  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head++];
    const pos = y * width + x;
    if (visited[pos]) continue;
    visited[pos] = 1;

    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    if (r > 195 && g > 195 && b > 195) {
      data[idx + 3] = 0; // Transparent
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  // Enclosed Cavities (outside main central torso/armor box)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = y * width + x;
      const idx = pos * 4;
      if (data[idx + 3] === 0) continue;

      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 200 && g > 200 && b > 200) {
        const isCentralBody = x > width * 0.38 && x < width * 0.62 && y > height * 0.22 && y < height * 0.78;
        if (!isCentralBody) {
          data[idx + 3] = 0;
        }
      }
    }
  }

  const outBuf = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(targetPath, outBuf);
  console.log(`Saved clean matted PNG to ${targetPath}`);
}

async function main() {
  for (const item of filesToProcess) {
    await matAndSaveImage(item.rawName, item.targetName);
  }
  console.log('🎉 ALL 3 PALADIN ARTHUR EXPRESSIONS MATTED AND SAVED SUCCESSFULLY!');
}

main().catch(err => console.error(err));
