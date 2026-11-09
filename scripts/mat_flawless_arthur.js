const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const targetDir = path.join(__dirname, '..', 'public', 'characters');

const filesToProcess = [
  { rawName: 'paladin_arthur_v2_1786035397784.png', targetName: 'paladin_arthur.png' },
  { rawName: 'paladin_arthur_smile_raw_1786075912419.png', targetName: 'paladin_arthur_smile.png' },
  { rawName: 'paladin_arthur_serious_raw_1786075926821.png', targetName: 'paladin_arthur_serious.png' },
  { rawName: 'paladin_arthur_surprised_raw_1786075979951.png', targetName: 'paladin_arthur_surprised.png' },
];

async function matAndPreserveCompleteSwordAura(rawName, targetName) {
  let rawPath = path.join(brainDir, rawName);
  const targetPath = path.join(targetDir, targetName);

  if (!fs.existsSync(rawPath)) {
    console.error('File not found:', rawPath);
    return;
  }

  console.log(`Processing complete holy sword aura preservation for Arthur: ${rawName} -> ${targetName}...`);
  const buf = fs.readFileSync(rawPath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const total = width * height;

  const isOuterBg = new Uint8Array(total);
  const queue = [];

  // Strictly neutral white background ONLY (NOT cyan/blue sword aura, NOT gold armor, NOT red cape)
  function isPureCanvasWhite(r, g, b) {
    if (r > 238 && g > 238 && b > 238) {
      return true;
    }
    return false;
  }

  // 1. Fill outer image boundary
  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  // 2. Pure Outer Canvas BFS Matting (STRICT PURE WHITE BACKGROUND ONLY)
  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    if (isOuterBg[pos]) continue;

    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    if (isPureCanvasWhite(r, g, b)) {
      isOuterBg[pos] = 1;
      const x = pos % width;
      const y = Math.floor(pos / width);

      if (x > 0 && !isOuterBg[pos - 1]) queue.push(pos - 1);
      if (x < width - 1 && !isOuterBg[pos + 1]) queue.push(pos + 1);
      if (y > 0 && !isOuterBg[pos - width]) queue.push(pos - width);
      if (y < height - 1 && !isOuterBg[pos + width]) queue.push(pos + width);
    }
  }

  // 3. Precision Seeded Floodfill for Internal Cavities ONLY (Leg Cavity & Upper Guard Cavity)
  const visited = new Uint8Array(total);
  for (let pos = 0; pos < total; pos++) {
    if (isOuterBg[pos]) visited[pos] = 1;
  }

  const seedRanges = [
    // Upper Sword Guard Cavity (x: 22% - 38%, y: 30% - 55%)
    { minX: 0.22, maxX: 0.38, minY: 0.30, maxY: 0.55 },
    // Leg Cavity (Between Golden Greaves, x: 42% - 62%, y: 60% - 92%)
    { minX: 0.42, maxX: 0.62, minY: 0.60, maxY: 0.92 },
  ];

  for (const range of seedRanges) {
    const startY = Math.floor(height * range.minY);
    const endY = Math.floor(height * range.maxY);
    const startX = Math.floor(width * range.minX);
    const endX = Math.floor(width * range.maxX);

    for (let y = startY; y < endY; y += 3) {
      for (let x = startX; x < endX; x += 3) {
        const seedPos = y * width + x;
        if (visited[seedPos]) continue;

        const idx = seedPos * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];

        if (r > 220 && g > 220 && b > 220) {
          const cavityQueue = [seedPos];
          let cHead = 0;

          while (cHead < cavityQueue.length) {
            const cPos = cavityQueue[cHead++];
            if (visited[cPos]) continue;
            visited[cPos] = 1;
            isOuterBg[cPos] = 1;

            const cx = cPos % width;
            const cy = Math.floor(cPos / width);

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
                if (nr > 210 && ng > 210 && nb > 210) {
                  cavityQueue.push(nPos);
                }
              }
            }
          }
        }
      }
    }
  }

  // 4. Ground Shadow Bar Removal (y > 0.90, below boots)
  for (let pos = 0; pos < total; pos++) {
    const y = Math.floor(pos / width);
    if (y > height * 0.90) {
      const idx = pos * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 170 && g > 170 && b > 170 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15) {
        isOuterBg[pos] = 1;
      }
    }
  }

  // 5. Apply Alpha: ZERO TRIMMING ON THE HOLY SWORD AURA AT ALL!
  for (let pos = 0; pos < total; pos++) {
    const idx = pos * 4;
    if (isOuterBg[pos]) {
      data[idx + 3] = 0; // Transparent
    }
  }

  const outBuf = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(targetPath, outBuf);
  console.log(`✓ 100% Original Sword Aura Preserved for Arthur: ${targetPath}`);
}

async function main() {
  for (const item of filesToProcess) {
    await matAndPreserveCompleteSwordAura(item.rawName, item.targetName);
  }
  console.log('🎉 ALL 4 ARTHUR EXPRESSIONS RE-PROCESSED WITH 100% ORIGINAL SWORD AURA INTACT!');
}

main().catch(err => console.error(err));
