#!/usr/bin/env node

/**
 * playStorePreflight.js — Static Google Play Release Preflight Checker for Rava
 *
 * Verifies that:
 *  1. All required store assets exist with correct dimensions and alpha restrictions.
 *  2. app.config.js has valid package name, versionCode, runtimeVersion, and permissions.
 *  3. eas.json has submit.production.android with serviceAccountKeyPath and track configured.
 *  4. google-play-service-account.json is present (warns if missing locally).
 *  5. google-services.json is present (warns if missing locally).
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const appConfig = require(path.join(root, 'app.config.js')).expo;
const easConfig = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));

const requiredAssets = [
  { path: 'assets/images/icon.png', w: 1024, h: 1024, noAlpha: true, desc: 'Master App Icon' },
  { path: 'assets/images/android-icon-foreground.png', w: 432, h: 432, noAlpha: false, desc: 'Adaptive Foreground' },
  { path: 'assets/images/android-icon-monochrome.png', w: 432, h: 432, noAlpha: false, desc: 'Monochrome Themed Icon' },
  { path: 'assets/images/splash-icon.png', w: 512, h: 512, noAlpha: false, desc: 'Splash Screen Icon' },
  { path: 'assets/images/favicon.png', w: 196, h: 196, noAlpha: false, desc: 'Expo Web Favicon' },
  { path: 'assets/store/google-play-icon-512.png', w: 512, h: 512, noAlpha: false, desc: 'Google Play Listing Icon' },
  { path: 'assets/store/google-play-feature-graphic.png', w: 1024, h: 500, noAlpha: true, desc: 'Google Play Feature Graphic' },
];

let failed = false;
let warned = false;

function pass(message) {
  console.log(`  ✓ ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`  ✗ ${message}`);
}

function warn(message) {
  warned = true;
  console.warn(`  ! ${message}`);
}

function assert(condition, passMsg, failMsg) {
  if (condition) pass(passMsg);
  else fail(failMsg || passMsg);
}

function gitIsDirty() {
  try {
    return (
      execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().length > 0
    );
  } catch {
    return false;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Rava — Google Play Store Static Preflight Check            ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('[1/4] App & EAS Configuration:');
  const android = appConfig.android ?? {};
  const production = easConfig.build?.production ?? {};
  const submitAndroid = easConfig.submit?.production?.android ?? {};

  assert(appConfig.name === 'Rava', 'App name is "Rava".');
  assert(android.package === 'com.nhancio.rava', 'Android package is "com.nhancio.rava".');
  assert(Number.isInteger(android.versionCode) && android.versionCode >= 1, `Explicit Android versionCode is defined (${android.versionCode}).`);
  assert(appConfig.runtimeVersion?.policy === 'appVersion', 'OTA runtimeVersion is tied to "appVersion".');
  assert(easConfig.cli?.appVersionSource === 'local', 'eas.json appVersionSource is "local".');
  assert(production.autoIncrement === false, 'Production autoIncrement is false (prevents version drift).');
  assert(production.android?.buildType === 'app-bundle', 'Production buildType is "app-bundle" (.aab).');
  assert(production.channel === 'production', 'Production EAS Update channel is "production".');
  assert(submitAndroid.track === 'internal', 'EAS submit track is "internal".');
  assert(
    submitAndroid.serviceAccountKeyPath === './google-play-service-account.json',
    'EAS submit serviceAccountKeyPath is configured.',
  );

  console.log('\n[2/4] Store & App Assets:');
  for (const asset of requiredAssets) {
    const fullPath = path.join(root, asset.path);
    if (!fs.existsSync(fullPath)) {
      fail(`${asset.desc} missing: ${asset.path} (run 'npm run assets:generate')`);
      continue;
    }
    const meta = await sharp(fullPath).metadata();
    if (meta.width !== asset.w || meta.height !== asset.h) {
      fail(`${asset.desc} dimension mismatch: expected ${asset.w}x${asset.h}, found ${meta.width}x${meta.height}`);
      continue;
    }
    if (asset.noAlpha && meta.hasAlpha) {
      fail(`${asset.desc} (${asset.path}) must NOT have an alpha channel for store submission.`);
      continue;
    }
    pass(`${asset.desc} verified: ${meta.width}x${meta.height}px (${asset.path})`);
  }

  console.log('\n[3/4] Permissions & Plugins:');
  const explicitPermissions = new Set(android.permissions ?? []);
  const blockedPermissions = new Set(android.blockedPermissions ?? []);
  assert(explicitPermissions.has('android.permission.CAMERA'), 'CAMERA permission is explicitly declared.');
  assert(explicitPermissions.has('android.permission.RECORD_AUDIO'), 'RECORD_AUDIO permission is explicitly declared.');
  assert(blockedPermissions.has('android.permission.READ_CALENDAR'), 'Unused READ_CALENDAR is blocked from manifest merges.');
  assert(blockedPermissions.has('android.permission.WRITE_CALENDAR'), 'Unused WRITE_CALENDAR is blocked from manifest merges.');

  console.log('\n[4/4] Credentials & Environment:');
  const saPath = path.join(root, 'google-play-service-account.json');
  if (fs.existsSync(saPath)) {
    pass('google-play-service-account.json is present locally (gitignored).');
  } else {
    warn('google-play-service-account.json is absent locally; required for automated EAS submit.');
  }

  const gsPath = path.join(root, 'google-services.json');
  if (fs.existsSync(gsPath)) {
    pass('google-services.json is present locally (gitignored).');
  } else {
    warn('google-services.json is absent locally (will be injected by EAS secret in cloud builds).');
  }

  if (gitIsDirty()) {
    warn('Working tree has uncommitted changes; release builds should be from a clean commit.');
  } else {
    pass('Working tree is clean.');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failed) {
    console.error('✗ Preflight failed. Please resolve the errors above.');
    process.exit(1);
  } else if (warned) {
    console.log('✓ Preflight passed with external action warnings.');
  } else {
    console.log('✓ All Google Play preflight checks passed cleanly!');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  fail(err.stack || err.message);
  process.exit(1);
});
