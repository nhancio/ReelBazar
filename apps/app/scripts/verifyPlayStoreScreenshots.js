#!/usr/bin/env node

/**
 * verifyPlayStoreScreenshots.js — Validates Google Play Phone Screenshot evidence
 *
 * Requirements for Google Play:
 *  - 2 to 8 phone screenshots (minimum 4-5 recommended).
 *  - Format: PNG or JPEG.
 *  - Aspect ratio: 9:16 portrait or 16:9 landscape.
 *  - Dimensions: Between 320px and 3840px per side.
 *  - No alpha channel (opaque images).
 *  - Must be captured from a real signed candidate, not mockups.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const screenshotDir = path.join(root, 'assets', 'store', 'screenshots', 'android-phone');
const manifestPath = path.join(screenshotDir, 'manifest.json');

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}

function isPortraitNineBySixteen(meta) {
  if (!meta.width || !meta.height || meta.height <= meta.width) return false;
  return Math.abs(meta.width / meta.height - 9 / 16) <= 0.02;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Rava — Google Play Screenshot Validation                   ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  if (!fs.existsSync(manifestPath)) {
    console.log(`! No screenshot manifest found at ${path.relative(root, manifestPath)}.`);
    console.log('  When ready, capture 5-8 phone screenshots on a real device and create manifest.json.');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = Array.isArray(manifest.files) ? manifest.files : [];

  if (files.length < 2 || files.length > 8) {
    fail(`Play Store requires 2–8 screenshots; manifest lists ${files.length}.`);
  }

  for (const entry of files) {
    const filePath = path.join(screenshotDir, entry.file || entry);
    if (!fs.existsSync(filePath)) {
      fail(`Missing screenshot file: ${path.relative(root, filePath)}`);
      continue;
    }
    const meta = await sharp(filePath).metadata();
    if (!['png', 'jpeg'].includes(meta.format)) {
      fail(`${entry.file}: Must be PNG or JPEG.`);
    }
    if (meta.hasAlpha) {
      fail(`${entry.file}: Must NOT have transparency; Play listing screenshots must be opaque.`);
    }
    if (!isPortraitNineBySixteen(meta)) {
      fail(`${entry.file}: Must be 9:16 portrait; found ${meta.width}x${meta.height}.`);
    }
    if ((meta.width ?? 0) < 320 || (meta.height ?? 0) < 320) {
      fail(`${entry.file}: Dimensions below Google Play minimum 320px.`);
    }
    console.log(`  ✓ Validated ${entry.file || entry} (${meta.width}x${meta.height}, ${meta.format})`);
  }

  if (!process.exitCode) {
    console.log(`\n✓ Validated ${files.length} Play Store screenshot(s) successfully.`);
  }
}

main().catch((err) => fail(err.stack || err.message));
