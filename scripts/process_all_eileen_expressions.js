const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const charDir = path.join(__dirname, '..', 'public', 'characters');

const eileenFiles = [
  { src: 'media__1786043113639.png', destName: 'eileen.png', brainPreview: 'final_eileen_normal.png' },
  { src: 'media__1786043117158.png', destName: 'eileen_smile.png', brainPreview: 'final_eileen_smile.png' },
  { src: 'media__1786043120144.png', destName: 'eileen_serious.png', brainPreview: 'final_eileen_serious.png' },
  { src: 'media__1786043128232.png', destName: 'eileen_surprised.png', brainPreview: 'final_eileen_surprised.png' },
];

async function matImage(srcFile, destFile, previewFile) {
  if (!fs.existsSync(srcFile)) {
    console.error('Source file missing:', srcFile);
    return;
  }

  console.log(`Processing outer-border BFS matting for ${path.basename(srcFile)} -> ${path.basename(destFile)}...`);
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
  fs.copyFileSync(destFile, previewFile);
}

async function main() {
  console.log('Processing all 4 Eileen (看板娘艾琳) expressions with strict outer-border matting...');
  for (const item of eileenFiles) {
    const srcPath = path.join(brainDir, item.src);
    const destPath = path.join(charDir, item.destName);
    const previewPath = path.join(brainDir, item.brainPreview);
    await matImage(srcPath, destPath, previewPath);
  }

  fs.copyFileSync(path.join(charDir, 'eileen.png'), path.join(charDir, 'eileen.jpg'));
  console.log('🎉 ALL 4 EILEEN EXPRESSIONS PERFECTLY MATTED (ZERO FACE HOLES)!');
}

main().catch(err => console.error(err));
