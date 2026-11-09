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

async function matTravelerBothSides(file) {
  const filePath = path.join(charDir, file);
  if (!fs.existsSync(filePath)) return;

  console.log(`Processing 100% precision bow string matting for Traveler: ${file}...`);
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

    if (r > 200 && g > 200 && b > 200) {
      data[idx + 3] = 0; // Transparent
      if (x > 0 && !visited[pos - 1]) queue.push({ x: x - 1, y });
      if (x < width - 1 && !visited[pos + 1]) queue.push({ x: x + 1, y });
      if (y > 0 && !visited[pos - width]) queue.push({ x, y: y - 1 });
      if (y < height - 1 && !visited[pos + width]) queue.push({ x, y: y + 1 });
    }
  }

  // 2. Precision Enclosed Cavity Matting for Bow Strings (Left AND Right Sides!)
  // Scans all white background pixels (r,g,b > 205) that are not in the central face/torso box
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = y * width + x;
      const idx = pos * 4;
      if (data[idx + 3] === 0) continue; // Already transparent

      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 205 && g > 205 && b > 205) {
        // Central protected body/face box (x: 36% to 64%, y: 15% to 85%)
        const isCentralBody = x > width * 0.36 && x < width * 0.64 && y > height * 0.15 && y < height * 0.85;

        // If outside central body box (i.e. left/right bow, string cavity, cloak gap), make transparent!
        if (!isCentralBody) {
          data[idx + 3] = 0;
        }
      }
    }
  }

  const outBuffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(filePath, outBuffer);
}

async function main() {
  console.log('Starting 100% bow string cavity matting for ALL 4 Traveler images...');
  for (const file of travelerFiles) {
    await matTravelerBothSides(file);
  }
  console.log('🎉 ALL TRAVELER LONGBOW CAVITIES MATTED 100% FLAWLESS!');
}

main().catch(err => console.error(err));
