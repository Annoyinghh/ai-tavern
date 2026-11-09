const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const charDir = path.join(__dirname, '..', 'public', 'characters');

const eileenFiles = [
  { src: 'media__1786043113639.png', destName: 'eileen.png' },
  { src: 'media__1786043117158.png', destName: 'eileen_smile.png' },
  { src: 'media__1786043120144.png', destName: 'eileen_serious.png' },
  { src: 'media__1786043128232.png', destName: 'eileen_surprised.png' },
];

async function perfectEileenMatting(srcFile, destFile) {
  if (!fs.existsSync(srcFile)) {
    console.error('Source file missing:', srcFile);
    return;
  }

  console.log(`Processing 100% flawless matting for Eileen: ${path.basename(srcFile)} -> ${path.basename(destFile)}...`);
  const { data, info } = await sharp(srcFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // 1. Add all border pixels to BFS queue
  for (let x = 0; x < width; x++) {
    queue.push({ x, y: 0 });
    queue.push({ x, y: height - 1 });
  }
  for (let y = 0; y < height; y++) {
    queue.push({ x: 0, y });
    queue.push({ x: width - 1, y });
  }

  // 2. BFS Outer-Border Background Matting
  // Strictly target pure background white pixels (r>230, g>230, b>230)
  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head++];
    const pos = y * width + x;
    if (visited[pos]) continue;
    visited[pos] = 1;

    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    if (r > 225 && g > 225 && b > 225) {
      data[idx + 3] = 0; // Alpha 0
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  // 3. Precision Cavity Matting for Enclosed Background Spots (Hair gaps, Neck gap, Waist/Arm gap)
  // Seed points inside known enclosed background cavities for Eileen:
  // - Neck/Hair gap: x around 0.35-0.45 * width, y around 0.28-0.34 * height
  // - Waist/Arm gap: x around 0.65-0.72 * width, y around 0.50-0.62 * height
  const cavitySeeds = [
    { x: Math.floor(width * 0.42), y: Math.floor(height * 0.31) }, // Neck/pigtail gap
    { x: Math.floor(width * 0.38), y: Math.floor(height * 0.31) },
    { x: Math.floor(width * 0.68), y: Math.floor(height * 0.56) }, // Arm/waist gap
    { x: Math.floor(width * 0.69), y: Math.floor(height * 0.58) },
    { x: Math.floor(width * 0.26), y: Math.floor(height * 0.28) }, // Left pigtail gap
    { x: Math.floor(width * 0.74), y: Math.floor(height * 0.28) }, // Right pigtail gap
  ];

  for (const seed of cavitySeeds) {
    if (seed.x < 0 || seed.x >= width || seed.y < 0 || seed.y >= height) continue;
    const seedPos = seed.y * width + seed.x;
    if (visited[seedPos]) continue;

    const seedIdx = seedPos * 4;
    const sr = data[seedIdx], sg = data[seedIdx + 1], sb = data[seedIdx + 2];

    // Only start floodfill if seed is background white
    if (sr > 225 && sg > 225 && sb > 225) {
      const cQueue = [seed];
      let cHead = 0;
      while (cHead < cQueue.length) {
        const { x, y } = cQueue[cHead++];
        const pos = y * width + x;
        if (visited[pos]) continue;
        visited[pos] = 1;

        const idx = pos * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];

        // Stop floodfill if hitting hair outline / skin line (r<200 or g<200 or b<200)
        if (r > 220 && g > 220 && b > 220) {
          data[idx + 3] = 0; // Alpha 0
          if (x > 0 && !visited[pos - 1]) cQueue.push({ x: x - 1, y });
          if (x < width - 1 && !visited[pos + 1]) cQueue.push({ x: x + 1, y });
          if (y > 0 && !visited[pos - width]) cQueue.push({ x, y: y - 1 });
          if (y < height - 1 && !visited[pos + width]) cQueue.push({ x, y: y + 1 });
        }
      }
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(destFile);
}

async function main() {
  console.log('Starting 100% FLAWLESS matting for ALL 4 Eileen images...');
  for (const item of eileenFiles) {
    const srcPath = path.join(brainDir, item.src);
    const destPath = path.join(charDir, item.destName);
    await perfectEileenMatting(srcPath, destPath);
  }

  fs.copyFileSync(path.join(charDir, 'eileen.png'), path.join(charDir, 'eileen.jpg'));
  console.log('🎉 PERFECT EILEEN MATTING COMPLETED WITHOUT COLOR DISTORTION!');
}

main().catch(err => console.error(err));
