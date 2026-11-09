const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const charDir = path.join(__dirname, '..', 'public', 'characters');

const presetChars = [
  'traveler.png', 'traveler_smile.png', 'traveler_serious.png', 'traveler_surprised.png',
  'selene.png', 'selene_smile.png', 'selene_serious.png', 'selene_surprised.png',
  'shadow_rogue.png', 'shadow_rogue_smile.png', 'shadow_rogue_serious.png', 'shadow_rogue_surprised.png',
  'paladin_arthur.png', 'paladin_arthur_smile.png', 'paladin_arthur_serious.png', 'paladin_arthur_surprised.png',
];

async function matPresetPng(file) {
  const filePath = path.join(charDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn('File missing:', filePath);
    return;
  }

  console.log(`Matting background white for preset character: ${file}...`);
  const buf = fs.readFileSync(filePath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Add all border pixels
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

    // White background threshold (r,g,b > 220)
    if (r > 220 && g > 220 && b > 220) {
      data[idx + 3] = 0; // Transparent Alpha
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  const outBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(filePath, outBuffer);
}

async function main() {
  console.log('Starting background matting for ALL 16 preset character images...');
  for (const file of presetChars) {
    await matPresetPng(file);
  }
  console.log('🎉 ALL PRESET CHARACTER ASSETS MATTED TO 100% TRANSPARENT PNG!');
}

main().catch(err => console.error(err));
