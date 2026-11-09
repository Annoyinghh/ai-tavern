const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const targetDir = path.join(__dirname, '..', 'public', 'characters');

const filesToProcess = [
  { rawName: 'shadow_rogue_normal_raw_1786076489155.png', targetName: 'shadow_rogue.png' },
  { rawName: 'shadow_rogue_smile_raw_1786076500350.png', targetName: 'shadow_rogue_smile.png' },
  { rawName: 'shadow_rogue_serious_raw_1786076511236.png', targetName: 'shadow_rogue_serious.png' },
  { rawName: 'shadow_rogue_surprised_raw_1786076523244.png', targetName: 'shadow_rogue_surprised.png' },
];

async function matAndDefringeWalter(rawName, targetName) {
  const rawPath = path.join(brainDir, rawName);
  const targetPath = path.join(targetDir, targetName);

  if (!fs.existsSync(rawPath)) {
    console.error('Raw file not found:', rawPath);
    return;
  }

  console.log(`Processing flawless matting & white halo removal for ${rawName} -> ${targetName}...`);
  const buf = fs.readFileSync(rawPath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const total = width * height;

  const isOuterBg = new Uint8Array(total);
  const queue = [];

  // 1. Fill image borders to start BFS
  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  // 2. BFS Outer Background Detection
  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    if (isOuterBg[pos]) continue;

    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    // Background threshold (white/light gray)
    if (r > 140 && g > 140 && b > 140) {
      isOuterBg[pos] = 1;
      const x = pos % width;
      const y = Math.floor(pos / width);

      if (x > 0 && !isOuterBg[pos - 1]) queue.push(pos - 1);
      if (x < width - 1 && !isOuterBg[pos + 1]) queue.push(pos + 1);
      if (y > 0 && !isOuterBg[pos - width]) queue.push(pos - width);
      if (y < height - 1 && !isOuterBg[pos + width]) queue.push(pos + width);
    }
  }

  // 3. Detect Cavities (Interior White Islands) surrounded by white
  const isCavityBg = new Uint8Array(total);
  for (let pos = 0; pos < total; pos++) {
    if (isOuterBg[pos]) continue;
    const idx = pos * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    // Bright white interior background pockets
    if (r > 215 && g > 215 && b > 215) {
      isCavityBg[pos] = 1;
    }
  }

  // 4. Alpha Feathering & White Fringe Eradication
  for (let pos = 0; pos < total; pos++) {
    const idx = pos * 4;

    if (isOuterBg[pos] || isCavityBg[pos]) {
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const minVal = Math.min(r, g, b);

      if (minVal > 225) {
        // Completely transparent for pure white
        data[idx + 3] = 0;
      } else if (minVal > 140) {
        // Smooth alpha feather for edge transition
        const factor = (225 - minVal) / (225 - 140);
        data[idx + 3] = Math.floor(255 * Math.pow(factor, 1.5));

        // Darken RGB white spill to match Walter's dark shadow aura
        data[idx] = Math.floor(data[idx] * 0.25);
        data[idx + 1] = Math.floor(data[idx + 1] * 0.25);
        data[idx + 2] = Math.floor(data[idx + 2] * 0.35);
      }
    } else {
      // For edge pixels bordering background, clean up any white matte halo!
      const x = pos % width;
      const y = Math.floor(pos / width);

      let hasBgNeighbor = false;
      if (x > 0 && isOuterBg[pos - 1]) hasBgNeighbor = true;
      if (x < width - 1 && isOuterBg[pos + 1]) hasBgNeighbor = true;
      if (y > 0 && isOuterBg[pos - width]) hasBgNeighbor = true;
      if (y < height - 1 && isOuterBg[pos + width]) hasBgNeighbor = true;

      if (hasBgNeighbor) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (r > 150 && g > 150 && b > 150) {
          // Darken white fringe to blend into dark shadow aura
          data[idx] = Math.floor(r * 0.3);
          data[idx + 1] = Math.floor(g * 0.3);
          data[idx + 2] = Math.floor(b * 0.4);
        }
      }
    }
  }

  const outBuf = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(targetPath, outBuf);
  console.log(`✓ Flawlessly matted and defringed Walter saved to ${targetPath}`);
}

async function main() {
  for (const item of filesToProcess) {
    await matAndDefringeWalter(item.rawName, item.targetName);
  }
  console.log('🎉 ALL 4 WALTER (SHADOW ROGUE) EXPRESSIONS FLAWLESSLY MATTED AND DEFRINGED!');
}

main().catch(err => console.error(err));
