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

async function matEileenCavities(srcFile, destFile) {
  if (!fs.existsSync(srcFile)) {
    console.error('Source file missing:', srcFile);
    return;
  }

  console.log(`Processing precision cavity matting ONLY for Eileen: ${path.basename(srcFile)} -> ${path.basename(destFile)}...`);
  const { data, info } = await sharp(srcFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // 1. BFS Outer Border Floodfill (r,g,b > 220)
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
      data[idx + 3] = 0; // Transparent
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  // 2. Precision Enclosed Cavity Matting for Eileen (Hair gaps, Arm/Waist gaps)
  // Protected zones:
  // - Face & Eyes & Mouth: x: [0.35 * width, 0.65 * width], y: [0.15 * height, 0.30 * height]
  // - Chest Shirt & Corset & Beer Mugs & Apron: x: [0.25 * width, 0.75 * width], y: [0.32 * height, 0.98 * height]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = y * width + x;
      const idx = pos * 4;

      // Skip already transparent pixels
      if (data[idx + 3] === 0) continue;

      const r = data[idx], g = data[idx + 1], b = data[idx + 2];

      // Check if pixel is pure background white (r,g,b > 240)
      if (r > 240 && g > 240 && b > 240) {
        // Protected Zone 1: Face Box (mouth, eyes, teeth)
        const inFace = x > width * 0.38 && x < width * 0.62 && y > height * 0.16 && y < height * 0.28;
        // Protected Zone 2: White Shirt & Apron & Beer Foam (center chest/body)
        const inBodyCenter = x > width * 0.30 && x < width * 0.70 && y > height * 0.32 && y < height * 0.98;

        // If NOT in protected face/body center, it is an enclosed background cavity (pigtails, arm gaps)!
        if (!inFace && !inBodyCenter) {
          data[idx + 3] = 0; // Alpha 0
        }
      }
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(destFile);
}

async function main() {
  console.log('Starting precision cavity matting for ALL 4 Eileen images...');
  for (const item of eileenFiles) {
    const srcPath = path.join(brainDir, item.src);
    const destPath = path.join(charDir, item.destName);
    await matEileenCavities(srcPath, destPath);
  }

  fs.copyFileSync(path.join(charDir, 'eileen.png'), path.join(charDir, 'eileen.jpg'));
  console.log('🎉 ALL EILEEN HAIR & ARM CAVITIES MATTED SUCCESSFULLY!');
}

main().catch(err => console.error(err));
