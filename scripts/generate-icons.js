#!/usr/bin/env node
/*
 * Generates the full PWA icon set from frontend/public/logo.png.
 * Run from repo root:  node scripts/generate-icons.js
 *
 * Requires sharp (installed as devDependency in frontend/).
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const sharp = require(path.join(repoRoot, 'frontend', 'node_modules', 'sharp'));

const SRC = path.join(repoRoot, 'frontend', 'public', 'logo.png');
const OUT_DIR = path.join(repoRoot, 'frontend', 'public', 'icons');

const BG = { r: 8, g: 8, b: 8 };
const TRANSPARENT = { r: 8, g: 8, b: 8, alpha: 0 };
const SOLID_BG = { ...BG, alpha: 1 };

async function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

async function makePlain(size, filename) {
  const out = path.join(OUT_DIR, filename);
  await sharp(SRC)
    .resize(size, size, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: TRANSPARENT,
    })
    .png()
    .toFile(out);
  return out;
}

async function makeMaskable() {
  const out = path.join(OUT_DIR, 'pwa-maskable-512.png');
  const inner = await sharp(SRC)
    .resize(410, 410, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: SOLID_BG,
    },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(out);
  return out;
}

async function makeAppleTouch() {
  const out = path.join(OUT_DIR, 'apple-touch-icon.png');
  const inner = await sharp(SRC)
    .resize(180, 180, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: SOLID_BG,
    },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(out);
  return out;
}

async function reportSize(filePath) {
  const stat = fs.statSync(filePath);
  const meta = await sharp(filePath).metadata();
  const kb = (stat.size / 1024).toFixed(1);
  return `  ${path.basename(filePath).padEnd(24)} ${meta.width}x${meta.height}  ${kb} KB`;
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('Source logo not found:', SRC);
    process.exit(1);
  }

  await ensureOutDir();

  const generated = [];
  generated.push(await makePlain(192, 'pwa-192.png'));
  generated.push(await makePlain(512, 'pwa-512.png'));
  generated.push(await makeMaskable());
  generated.push(await makeAppleTouch());
  generated.push(await makePlain(32, 'favicon-32.png'));
  generated.push(await makePlain(16, 'favicon-16.png'));

  console.log('Generated icons:');
  for (const f of generated) {
    console.log(await reportSize(f));
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
