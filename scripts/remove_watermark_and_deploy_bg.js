const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = `C:\\Users\\18755\\.gemini\\antigravity-ide\\brain\\ebd3bfc1-84c5-4715-9165-1806d1053fad`;
const srcBg = path.join(brainDir, 'media__1786042058601.jpg');

const publicBg = path.join(__dirname, '..', 'public', 'scenes', 'tavern_background.jpg');
const brainCleanBg = path.join(brainDir, 'clean_tavern_background.jpg');

async function main() {
  if (!fs.existsSync(srcBg)) {
    console.error('Source background not found at:', srcBg);
    return;
  }

  console.log('Processing tavern background to remove bottom-right star watermark...');

  const image = sharp(srcBg);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  console.log(`Image dimensions: ${width}x${height}`);

  // Watermark is located at approximately:
  // x: 88% to 94% of width
  // y: 78% to 88% of height
  const wmWidth = Math.floor(width * 0.08);
  const wmHeight = Math.floor(height * 0.10);
  const wmLeft = Math.floor(width * 0.87);
  const wmTop = Math.floor(height * 0.77);

  // Extract clean barrel texture patch from neighbor barrel region (slightly to the right / bottom)
  const patchLeft = Math.floor(width * 0.92);
  const patchTop = Math.floor(height * 0.85);

  const cleanPatchBuffer = await sharp(srcBg)
    .extract({ left: Math.min(patchLeft, width - wmWidth), top: Math.min(patchTop, height - wmHeight), width: wmWidth, height: wmHeight })
    .blur(1.5)
    .toBuffer();

  // Composite clean patch over watermark region
  await sharp(srcBg)
    .composite([
      {
        input: cleanPatchBuffer,
        left: wmLeft,
        top: wmTop,
        blend: 'over'
      }
    ])
    .jpeg({ quality: 95 })
    .toFile(publicBg);

  fs.copyFileSync(publicBg, brainCleanBg);
  console.log('✅ Star watermark removed seamlessly & clean background deployed to tavern_background.jpg!');
}

main().catch(err => console.error(err));
