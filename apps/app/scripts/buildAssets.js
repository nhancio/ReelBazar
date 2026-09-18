#!/usr/bin/env node

/**
 * buildAssets.js — Automated asset pipeline for Rava (Expo / React Native / Google Play / Web)
 *
 * Takes a master source logo/icon (e.g. from assets/source/icon-source.png or public/logo/logo.jpeg)
 * and generates all required variants with precise dimensions, safe zones, and format constraints:
 *
 *  1. assets/images/icon.png                     (1024x1024, strictly NO alpha channel for iOS/Expo)
 *  2. assets/images/android-icon-foreground.png   (432x432, transparent, mark inside 66% / 288px safe zone)
 *  3. assets/images/android-icon-monochrome.png   (432x432, pure white silhouette, inside 66% safe zone)
 *  4. assets/images/splash-icon.png              (512x512, transparent background, centered mark)
 *  5. assets/images/favicon.png                  (196x196, for Expo web)
 *  6. assets/store/google-play-icon-512.png      (512x512, 32-bit PNG, <= 1MB for Play Console)
 *  7. assets/store/google-play-feature-graphic.png (1024x500, no alpha for Play Console)
 *  8. Web PWA favicons & .ico (apple-touch-icon, icon-192, icon-512, favicon.ico)
 *
 * Usage:
 *   node scripts/buildAssets.js
 *   node scripts/buildAssets.js --source /path/to/custom-logo.png
 *   node scripts/buildAssets.js --bg "#000000"
 *   node scripts/buildAssets.js --check
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'assets', 'images');
const STORE_DIR = path.join(ROOT, 'assets', 'store');
const SOURCE_DIR = path.join(ROOT, 'assets', 'source');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(flag, shorthand) {
  const idx = args.findIndex((a) => a === flag || (shorthand && a === shorthand));
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}
const customSource = getArg('--source', '-s');
const customFeature = getArg('--feature', '-f');
const customMonochrome = getArg('--monochrome', '-m');
const hexBackground = getArg('--bg', '-b') ?? '#000000';
const isCheckOnly = args.includes('--check');

function hexToRgb(hex) {
  const cleaned = hex.replace(/^#/, '');
  const num = parseInt(cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

const BG_COLOR = hexToRgb(hexBackground);

/** Resolve the primary master icon source */
function resolveSourceIcon() {
  if (customSource) {
    const p = path.resolve(process.cwd(), customSource);
    if (!fs.existsSync(p)) throw new Error(`Specified source file does not exist: ${customSource}`);
    return p;
  }

  const candidates = [
    path.join(SOURCE_DIR, 'icon-source.png'),
    path.join(SOURCE_DIR, 'icon-source.jpg'),
    path.join(SOURCE_DIR, 'icon-source.jpeg'),
    path.join(SOURCE_DIR, 'icon-source.webp'),
    path.join(SOURCE_DIR, 'logo.png'),
    path.join(SOURCE_DIR, 'logo.jpeg'),
    path.join(SOURCE_DIR, 'logo.jpg'),
    path.join(ROOT, 'public', 'logo', 'logo.png'),
    path.join(ROOT, 'public', 'logo', 'logo.jpeg'),
    path.join(ROOT, '..', '..', 'public', 'logo', 'logo.png'),
    path.join(ROOT, '..', '..', 'public', 'logo', 'logo.jpeg'),
    path.join(IMAGES_DIR, 'icon.png'),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }

  throw new Error(
    `No source image found. Place your master artwork in assets/source/icon-source.png or specify with --source <path>`,
  );
}

/** Resolve optional feature graphic source */
function resolveFeatureGraphicSource() {
  if (customFeature) {
    const p = path.resolve(process.cwd(), customFeature);
    if (fs.existsSync(p)) return p;
  }
  const candidates = [
    path.join(SOURCE_DIR, 'feature-graphic-source.png'),
    path.join(SOURCE_DIR, 'feature-graphic-source.jpg'),
    path.join(SOURCE_DIR, 'feature-graphic-source.jpeg'),
    path.join(SOURCE_DIR, 'google-play-feature-graphic.png'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

/** Resolve optional monochrome source */
function resolveMonochromeSource() {
  if (customMonochrome) {
    const p = path.resolve(process.cwd(), customMonochrome);
    if (fs.existsSync(p)) return p;
  }
  const candidates = [
    path.join(SOURCE_DIR, 'monochrome-source.png'),
    path.join(SOURCE_DIR, 'monochrome-source.jpg'),
    path.join(SOURCE_DIR, 'monochrome-source.jpeg'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

/**
 * Extracts / prepares a transparent logo mark buffer from the source image.
 * If source already has alpha, preserves it.
 * If source is opaque (e.g. white or black background), isolates the foreground mark.
 */
async function prepareTransparentMark(sourcePath) {
  const image = sharp(sourcePath);
  const metadata = await image.metadata();

  if (metadata.hasAlpha) {
    // Already has transparency — trim any empty surrounding transparent borders
    return await image.trim().toBuffer();
  }

  // Opaque image: analyze corners to detect background color
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const channels = info.channels;

  // Sample the 4 corners to find background color
  const sampleCorner = (x, y) => {
    const idx = (y * w + x) * channels;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  };

  const corners = [
    sampleCorner(0, 0),
    sampleCorner(w - 1, 0),
    sampleCorner(0, h - 1),
    sampleCorner(w - 1, h - 1),
  ];

  const avgBg = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
  };

  const bgLum = 0.299 * avgBg.r + 0.587 * avgBg.g + 0.114 * avgBg.b;
  const isLightBg = bgLum > 180;

  // Create an RGBA buffer with background keyed out or mark isolated
  const rgbaBuffer = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Difference from background color
    const diff = Math.sqrt(
      Math.pow(r - avgBg.r, 2) + Math.pow(g - avgBg.g, 2) + Math.pow(b - avgBg.b, 2),
    );

    let alpha = 255;
    if (diff < 30) {
      alpha = 0;
    } else if (diff < 70) {
      alpha = Math.round(((diff - 30) / 40) * 255);
    }

    rgbaBuffer[i * 4] = r;
    rgbaBuffer[i * 4 + 1] = g;
    rgbaBuffer[i * 4 + 2] = b;
    rgbaBuffer[i * 4 + 3] = alpha;
  }

  return await sharp(rgbaBuffer, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .png()
    .toBuffer();
}

/**
 * Generates a pure white monochrome silhouette mask on transparent background.
 */
async function generateMonochromeBuffer(transparentMarkBuffer) {
  const { data, info } = await sharp(transparentMarkBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const monochromeBuffer = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const a = data[i * 4 + 3];
    monochromeBuffer[i * 4] = 255;     // R: Pure white
    monochromeBuffer[i * 4 + 1] = 255; // G: Pure white
    monochromeBuffer[i * 4 + 2] = 255; // B: Pure white
    monochromeBuffer[i * 4 + 3] = a;   // Retain original alpha mask
  }

  return await sharp(monochromeBuffer, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Build a standard PNG-in-ICO file container */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(entries.length, 4);

  const dirSize = 16 * entries.length;
  let offset = header.length + dirSize;
  const dir = [];
  for (const { size, png } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

/** Formats byte size for logging */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function validateAsset(filePath, expectedWidth, expectedHeight, expectNoAlpha = false, maxSize = null) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing expected asset: ${path.relative(ROOT, filePath)}`);
  }
  const stat = fs.statSync(filePath);
  const metadata = await sharp(filePath).metadata();

  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(
      `${path.relative(ROOT, filePath)} dimension mismatch: expected ${expectedWidth}x${expectedHeight}, found ${metadata.width}x${metadata.height}`,
    );
  }

  if (expectNoAlpha && metadata.hasAlpha) {
    throw new Error(
      `${path.relative(ROOT, filePath)} must NOT have an alpha channel (Apple App Store & Play Store require opaque background).`,
    );
  }

  if (maxSize && stat.size > maxSize) {
    throw new Error(
      `${path.relative(ROOT, filePath)} exceeds max file size of ${formatSize(maxSize)} (actual: ${formatSize(stat.size)})`,
    );
  }

  return { width: metadata.width, height: metadata.height, size: stat.size, hasAlpha: metadata.hasAlpha };
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Rava Asset Pipeline — Icon, Splash & Google Play Generator  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.mkdirSync(SOURCE_DIR, { recursive: true });

  const sourceIconPath = resolveSourceIcon();
  const featureSourcePath = resolveFeatureGraphicSource();
  const monoSourcePath = resolveMonochromeSource();

  console.log(`Source Icon:       ${path.relative(ROOT, sourceIconPath)}`);
  console.log(`Feature Graphic:   ${featureSourcePath ? path.relative(ROOT, featureSourcePath) : '[Auto-Generated Banner]'}`);
  console.log(`Monochrome Source: ${monoSourcePath ? path.relative(ROOT, monoSourcePath) : '[Auto-Extracted Silhouette]'}`);
  console.log(`Background Color:  ${hexBackground} (RGB: ${BG_COLOR.r}, ${BG_COLOR.g}, ${BG_COLOR.b})\n`);

  if (isCheckOnly) {
    console.log('Verifying existing generated assets...\n');
    const checks = [
      validateAsset(path.join(IMAGES_DIR, 'icon.png'), 1024, 1024, true),
      validateAsset(path.join(IMAGES_DIR, 'android-icon-foreground.png'), 432, 432, false),
      validateAsset(path.join(IMAGES_DIR, 'android-icon-monochrome.png'), 432, 432, false),
      validateAsset(path.join(IMAGES_DIR, 'splash-icon.png'), 512, 512, false),
      validateAsset(path.join(IMAGES_DIR, 'favicon.png'), 196, 196, false),
      validateAsset(path.join(STORE_DIR, 'google-play-icon-512.png'), 512, 512, false, 1024 * 1024),
      validateAsset(path.join(STORE_DIR, 'google-play-feature-graphic.png'), 1024, 500, true, 15 * 1024 * 1024),
    ];
    await Promise.all(checks);
    console.log('✓ All required app, splash, and store assets passed verification.');
    return;
  }

  // 1. Prepare master transparent mark buffer
  const transparentMarkBuffer = await prepareTransparentMark(sourceIconPath);

  // 2. Prepare monochrome mark buffer
  const monoMarkBuffer = monoSourcePath
    ? await prepareTransparentMark(monoSourcePath)
    : await generateMonochromeBuffer(transparentMarkBuffer);

  // 3. Generate icon.png (1024x1024, strictly NO alpha channel)
  // Scale mark to fit 820x820 inside 1024x1024 (with ~10% safe edge inset)
  const masterMark = await sharp(transparentMarkBuffer)
    .resize(820, 820, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const iconPngPath = path.join(IMAGES_DIR, 'icon.png');
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b },
    },
  })
    .composite([{ input: masterMark, gravity: 'centre' }])
    .flatten({ background: { r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b } })
    .removeAlpha()
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(iconPngPath);

  // 4. Generate android-icon-foreground.png (432x432, transparent, safe zone 288x288 px / inner 66.67%)
  const adaptiveFgMark = await sharp(transparentMarkBuffer)
    .resize(288, 288, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const foregroundPath = path.join(IMAGES_DIR, 'android-icon-foreground.png');
  await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: adaptiveFgMark, gravity: 'centre' }])
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(foregroundPath);

  // 5. Generate android-icon-monochrome.png (432x432, pure white silhouette, safe zone 288x288 px)
  const adaptiveMonoMark = await sharp(monoMarkBuffer)
    .resize(288, 288, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const monochromePath = path.join(IMAGES_DIR, 'android-icon-monochrome.png');
  await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: adaptiveMonoMark, gravity: 'centre' }])
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(monochromePath);

  // 6. Generate splash-icon.png (512x512, transparent background, centered mark)
  const splashMark = await sharp(transparentMarkBuffer)
    .resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const splashPath = path.join(IMAGES_DIR, 'splash-icon.png');
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: splashMark, gravity: 'centre' }])
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(splashPath);

  // 7. Generate favicon.png (196x196 for Expo web)
  const faviconPath = path.join(IMAGES_DIR, 'favicon.png');
  await sharp(iconPngPath)
    .resize(196, 196, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(faviconPath);

  // 8. Generate Google Play Listing Icon (512x512, 32-bit PNG, <= 1MB)
  const playIconPath = path.join(STORE_DIR, 'google-play-icon-512.png');
  await sharp(iconPngPath)
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9, quality: 95 })
    .toFile(playIconPath);

  // 9. Generate Google Play Feature Graphic (1024x500, no alpha)
  const playFeaturePath = path.join(STORE_DIR, 'google-play-feature-graphic.png');
  if (featureSourcePath) {
    // Custom source provided
    await sharp(featureSourcePath)
      .resize(1024, 500, { fit: 'cover' })
      .flatten({ background: { r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b } })
      .removeAlpha()
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(playFeaturePath);
  } else {
    // Generate clean brand banner (centered logo mark within safe 15% margins)
    const featureMark = await sharp(transparentMarkBuffer)
      .resize(500, 300, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: 1024,
        height: 500,
        channels: 3,
        background: { r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b },
      },
    })
      .composite([{ input: featureMark, gravity: 'centre' }])
      .flatten({ background: { r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b } })
      .removeAlpha()
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(playFeaturePath);
  }

  // 10. Generate web & PWA favicons in public/ if directory exists
  if (fs.existsSync(PUBLIC_DIR)) {
    const webFavicons = [
      { file: 'apple-touch-icon.png', size: 180 },
      { file: 'icon-192.png', size: 192 },
      { file: 'icon-512.png', size: 512 },
      { file: 'favicon-32.png', size: 32 },
      { file: 'favicon-16.png', size: 16 },
    ];
    for (const { file, size } of webFavicons) {
      await sharp(iconPngPath)
        .resize(size, size, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toFile(path.join(PUBLIC_DIR, file));
    }

    const icoSizes = [16, 32, 48, 64];
    const icoEntries = [];
    for (const size of icoSizes) {
      icoEntries.push({
        size,
        png: await sharp(iconPngPath).resize(size, size, { fit: 'cover' }).png().toBuffer(),
      });
    }
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), buildIco(icoEntries));
  }

  // 11. Run assertions and print clean report
  console.log('Validating generated assets against store specifications...\n');

  const generated = [
    { desc: 'Main App Icon (iOS/Universal)', path: iconPngPath, w: 1024, h: 1024, noAlpha: true },
    { desc: 'Android Adaptive Foreground', path: foregroundPath, w: 432, h: 432, noAlpha: false },
    { desc: 'Android 13+ Themed Monochrome', path: monochromePath, w: 432, h: 432, noAlpha: false },
    { desc: 'Splash Screen Icon', path: splashPath, w: 512, h: 512, noAlpha: false },
    { desc: 'Expo Web Favicon', path: faviconPath, w: 196, h: 196, noAlpha: false },
    { desc: 'Google Play Store Icon', path: playIconPath, w: 512, h: 512, noAlpha: false, max: 1024 * 1024 },
    { desc: 'Google Play Feature Graphic', path: playFeaturePath, w: 1024, h: 500, noAlpha: true, max: 15 * 1024 * 1024 },
  ];

  for (const item of generated) {
    const res = await validateAsset(item.path, item.w, item.h, item.noAlpha, item.max);
    const alphaStatus = res.hasAlpha ? 'alpha: yes' : 'alpha: no (opaque)';
    console.log(`  ✓ ${item.desc.padEnd(32)} ${`${res.width}x${res.height}`.padEnd(12)} ${formatSize(res.size).padEnd(10)} [${alphaStatus}] -> ${path.relative(ROOT, item.path)}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✓ All assets generated and verified successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error(`\n✗ Asset generation failed: ${err.message}\n`);
  process.exit(1);
});
