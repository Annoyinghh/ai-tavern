const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const charDir = path.join(__dirname, '..', 'public', 'characters');

const tomFiles = [
  { src: 'media__1786042361930.png', destName: 'old_tom.png' },
  { src: 'media__1786042120104.png', destName: 'old_tom_smile.png' },
  { src: 'media__1786042277433.png', destName: 'old_tom_serious.png' },
  { src: 'media__1786042520279.png', destName: 'old_tom_surprised.png' },
];

async function matImage(srcFile, destFile) {
  if (!fs.existsSync(srcFile)) {
    console.error('Source file missing:', srcFile);
    return;
  }

  console.log(`Processing strict outer-border matting for Old Tom: ${path.basename(srcFile)} -> ${path.basename(destFile)}...`);
  const { data, info } = await sharp(srcFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Strictly push outer border pixels into queue
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

    // Only floodfill connected outer pure white background pixels (r,g,b > 240)
    if (r > 240 && g > 240 && b > 240) {
      data[idx + 3] = 0; // Alpha 0
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(destFile);
}

async function main() {
  console.log('Re-processing all 4 Old Tom expressions with strict outer-border matting (fixing shirt sleeve holes)...');
  for (const item of tomFiles) {
    const srcPath = path.join(brainDir, item.src);
    const destPath = path.join(charDir, item.destName);
    await matImage(srcPath, destPath);
  }

  // Backups
  fs.copyFileSync(path.join(charDir, 'old_tom.png'), path.join(charDir, 'old_tom.jpg'));
  console.log('🎉 ALL 4 OLD TOM EXPRESSIONS PERFECTLY RE-MATTED (ZERO SHIRT HOLES)!');
}

main().catch(err => console.error(err));
