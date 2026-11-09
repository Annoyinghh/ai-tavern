const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const charDir = path.join(__dirname, '..', 'public', 'characters');

const travelerFiles = [
  'traveler.png',
  'traveler_smile.png',
  'traveler_serious.png',
  'traveler_surprised.png',
];

async function matTravelerBow(file) {
  const filePath = path.join(charDir, file);
  if (!fs.existsSync(filePath)) return;

  console.log(`Processing precision longbow cavity matting for Traveler: ${file}...`);
  const buf = fs.readFileSync(filePath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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

  // Outer border matting
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

  // 2. Precision Bow Cavity Seeds (Inside the bow curve & string)
  const seeds = [];
  for (let y = Math.floor(height * 0.08); y < Math.floor(height * 0.88); y += 5) {
    for (let x = Math.floor(width * 0.12); x < Math.floor(width * 0.42); x += 5) {
      seeds.push({ x, y });
    }
  }

  for (const seed of seeds) {
    const seedPos = seed.y * width + seed.x;
    if (visited[seedPos]) continue;

    const seedIdx = seedPos * 4;
    const sr = data[seedIdx], sg = data[seedIdx + 1], sb = data[seedIdx + 2];

    // Only start if background white
    if (sr > 210 && sg > 210 && sb > 210) {
      const cQueue = [seed];
      let cHead = 0;
      while (cHead < cQueue.length) {
        const { x, y } = cQueue[cHead++];
        const pos = y * width + x;
        if (visited[pos]) continue;
        visited[pos] = 1;

        const idx = pos * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];

        // Stop at bow wood / leather / cloak outlines (r<200 or g<200 or b<200)
        if (r > 205 && g > 205 && b > 205) {
          data[idx + 3] = 0; // Transparent
          if (x > 0 && !visited[pos - 1]) cQueue.push({ x: x - 1, y });
          if (x < width - 1 && !visited[pos + 1]) cQueue.push({ x: x + 1, y });
          if (y > 0 && !visited[pos - width]) cQueue.push({ x, y: y - 1 });
          if (y < height - 1 && !visited[pos + width]) cQueue.push({ x, y: y + 1 });
        }
      }
    }
  }

  const outBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(filePath, outBuffer);
}

async function main() {
  console.log('Starting longbow cavity matting for ALL 4 Traveler images...');
  for (const file of travelerFiles) {
    await matTravelerBow(file);
  }
  console.log('🎉 TRAVELER LONGBOW CAVITY MATTING COMPLETED 100% CLEAN!');
}

main().catch(err => console.error(err));
