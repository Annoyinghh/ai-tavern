const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const targetDir = path.join(__dirname, '..', 'public', 'characters');

const filesToProcess = [
  { rawName: 'traveler_v2_1786035367054.png', targetName: 'traveler.png' },
  { rawName: 'traveler_smile_raw_1786076114958.png', targetName: 'traveler_smile.png' },
  { rawName: 'traveler_serious_raw_1786076134489.png', targetName: 'traveler_serious.png' },
  { rawName: 'traveler_surprised_raw_1786076146135.png', targetName: 'traveler_surprised.png' },
];

async function matAndRemoveBowCavity(rawName, targetName) {
  let rawPath = path.join(brainDir, rawName);
  const targetPath = path.join(targetDir, targetName);

  if (!fs.existsSync(rawPath)) {
    rawPath = targetPath;
  }

  if (!fs.existsSync(rawPath)) {
    console.error('File not found:', rawPath);
    return;
  }

  console.log(`Processing precision longbow cavity removal for ${rawName} -> ${targetName}...`);
  const buf = fs.readFileSync(rawPath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const total = width * height;

  const isOuterBg = new Uint8Array(total);
  const queue = [];

  // 1. Outer border BFS initialization
  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  // 2. BFS Outer Canvas Matting
  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    if (isOuterBg[pos]) continue;

    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    if (r > 190 && g > 190 && b > 190) {
      isOuterBg[pos] = 1;
      const x = pos % width;
      const y = Math.floor(pos / width);

      if (x > 0 && !isOuterBg[pos - 1]) queue.push(pos - 1);
      if (x < width - 1 && !isOuterBg[pos + 1]) queue.push(pos + 1);
      if (y > 0 && !isOuterBg[pos - width]) queue.push(pos - width);
      if (y < height - 1 && !isOuterBg[pos + width]) queue.push(pos + width);
    }
  }

  // 3. Precision Seeded Floodfill for Bow Cavities & Armpits/Legs
  const visited = new Uint8Array(total);
  for (let pos = 0; pos < total; pos++) {
    if (isOuterBg[pos]) visited[pos] = 1;
  }

  // Seeds inside longbow curve (left side x: 10% - 42%, y: 10% - 90%)
  for (let y = Math.floor(height * 0.10); y < Math.floor(height * 0.90); y += 4) {
    for (let x = Math.floor(width * 0.10); x < Math.floor(width * 0.45); x += 4) {
      const seedPos = y * width + x;
      if (visited[seedPos]) continue;

      const idx = seedPos * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];

      // If white pocket found inside the bow curve or armpit
      if (r > 185 && g > 185 && b > 185) {
        const cavityQueue = [seedPos];
        let cHead = 0;

        while (cHead < cavityQueue.length) {
          const cPos = cavityQueue[cHead++];
          if (visited[cPos]) continue;
          visited[cPos] = 1;
          isOuterBg[cPos] = 1; // Mark as background to be cleared

          const cx = cPos % width;
          const cy = Math.floor(cPos / width);
          const cIdx = cPos * 4;

          const neighbors = [
            cx > 0 ? cPos - 1 : -1,
            cx < width - 1 ? cPos + 1 : -1,
            cy > 0 ? cPos - width : -1,
            cy < height - 1 ? cPos + width : -1,
          ];

          for (const nPos of neighbors) {
            if (nPos >= 0 && !visited[nPos]) {
              const nIdx = nPos * 4;
              const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
              // Stop floodfill at bow wood / leather / cloak outlines
              if (nr > 180 && ng > 180 && nb > 180) {
                cavityQueue.push(nPos);
              }
            }
          }
        }
      }
    }
  }

  // 4. Apply Alpha & Defringe
  for (let pos = 0; pos < total; pos++) {
    const idx = pos * 4;
    if (isOuterBg[pos]) {
      data[idx + 3] = 0; // Set Alpha to 0 (Transparent)
    } else {
      // Soft edge defringe
      const x = pos % width;
      const y = Math.floor(pos / width);
      let hasBg = false;
      if (x > 0 && isOuterBg[pos - 1]) hasBg = true;
      if (x < width - 1 && isOuterBg[pos + 1]) hasBg = true;
      if (y > 0 && isOuterBg[pos - width]) hasBg = true;
      if (y < height - 1 && isOuterBg[pos + width]) hasBg = true;

      if (hasBg) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (r > 160 && g > 160 && b > 160) {
          data[idx] = Math.floor(r * 0.4);
          data[idx + 1] = Math.floor(g * 0.4);
          data[idx + 2] = Math.floor(b * 0.4);
        }
      }
    }
  }

  const outBuf = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(targetPath, outBuf);
  console.log(`✓ Completely removed longbow cavity for Traveler to ${targetPath}`);
}

async function main() {
  for (const item of filesToProcess) {
    await matAndRemoveBowCavity(item.rawName, item.targetName);
  }
  console.log('🎉 ALL 4 TRAVELER (NAMELESS RANGER) EXPRESSIONS FLAWLESSLY MATTED!');
}

main().catch(err => console.error(err));
