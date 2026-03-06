const sharp = require('sharp');
const { readFileSync } = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const logoPath = path.join(root, 'assets', 'RwandaFDA.png');

async function generate() {
  const logo = readFileSync(logoPath);
  const size = 1024;

  const buffer = await sharp(logo)
    .resize(size, size)
    .png()
    .toBuffer();

  await sharp(buffer).toFile(path.join(assetsDir, 'icon.png'));
  await sharp(buffer).toFile(path.join(assetsDir, 'adaptive-icon.png'));

  // Splash: white background with centered logo
  const splashWidth = 1284;
  const splashHeight = 2778;
  const iconSize = 400;

  const iconBuffer = await sharp(logo)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: splashWidth,
      height: splashHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: iconBuffer,
        top: Math.round((splashHeight - iconSize) / 2),
        left: Math.round((splashWidth - iconSize) / 2),
      },
    ])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

  console.log('Generated icon.png, adaptive-icon.png, splash.png (from RwandaFDA.png)');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
