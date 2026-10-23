#!/usr/bin/env node

/**
 * syncAndroidVersionFromPlay.js — Sync Android versionCode from Google Play Console
 *
 * Reads the highest versionCode accepted by Google Play Console via the
 * Google Play Developer API (Android Publisher v3), then updates app.config.js
 * to max(local, playMax + 1).
 *
 * Usage:
 *   node scripts/syncAndroidVersionFromPlay.js           # Query & auto-bump
 *   node scripts/syncAndroidVersionFromPlay.js --check   # Check only (fail if local is not ahead)
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageName = 'com.nhancio.rava';
const keyPath = path.join(root, 'google-play-service-account.json');
const configPath = path.join(root, 'app.config.js');
const checkOnly = process.argv.includes('--check');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readLocalVersionCode() {
  const app = require(configPath).expo;
  const code = app?.android?.versionCode;
  if (!Number.isInteger(code) || code < 1) fail('app.config.js android.versionCode is missing.');
  return code;
}

function writeLocalVersionCode(next) {
  const source = fs.readFileSync(configPath, 'utf8');
  if (!/versionCode:\s*\d+/.test(source)) fail('Could not find versionCode in app.config.js.');
  fs.writeFileSync(configPath, source.replace(/versionCode:\s*\d+/, `versionCode: ${next}`));
}

function serviceAccountJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');
  const unsigned = `${header}.${claim}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  return `${unsigned}.${signature.toString('base64url')}`;
}

async function playAccessToken(sa) {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: serviceAccountJwt(sa),
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json();
  if (!response.ok || typeof json.access_token !== 'string') {
    fail('Play Developer API auth failed. Check google-play-service-account.json and API access.');
  }
  return json.access_token;
}

async function playJson(accessToken, pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    if (response.status === 404 && pathname.startsWith(`/applications/${packageName}/edits`)) {
      return { __notFound: true };
    }
    fail(`Play API ${method} ${pathname} failed (${response.status}).`);
  }
  return json;
}

function collectVersionCodes(tracks) {
  const codes = [];
  for (const track of tracks ?? []) {
    for (const release of track.releases ?? []) {
      for (const raw of release.versionCodes ?? []) {
        const code = Number(raw);
        if (Number.isInteger(code)) codes.push(code);
      }
    }
  }
  return codes;
}

async function highestPlayVersionCode(accessToken) {
  const edit = await playJson(accessToken, `/applications/${packageName}/edits`, {
    method: 'POST',
    body: {},
  });
  if (edit.__notFound) {
    return 0;
  }
  const editId = edit.id;
  if (typeof editId !== 'string' || editId.length === 0) fail('Play Console did not return an edit id.');
  try {
    const listed = await playJson(accessToken, `/applications/${packageName}/edits/${editId}/tracks`);
    const codes = collectVersionCodes(listed.tracks);
    return codes.length > 0 ? Math.max(...codes) : 0;
  } finally {
    await playJson(accessToken, `/applications/${packageName}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
  }
}

async function main() {
  if (!fs.existsSync(keyPath)) {
    fail('Missing google-play-service-account.json locally.');
  }
  const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  if (typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') {
    fail('google-play-service-account.json is not a valid Google Play service account key.');
  }

  const local = readLocalVersionCode();
  const token = await playAccessToken(sa);
  const playMax = await highestPlayVersionCode(token);
  const next = Math.max(local, playMax + 1);

  console.log(`Play Console highest versionCode: ${playMax || 'none'}`);
  console.log(`Checked-in versionCode:           ${local}`);

  if (checkOnly) {
    if (local <= playMax) {
      fail(`versionCode ${local} is already on Play Console. Next unused code is ${playMax + 1}.`);
    }
    console.log(`✓ Play submit may use versionCode ${local}.`);
    return;
  }

  if (next === local) {
    console.log(`✓ versionCode ${local} is already ahead of Play Console.`);
    return;
  }

  writeLocalVersionCode(next);
  console.log(`✓ Updated app.config.js versionCode ${local} → ${next} (Play ${playMax} + 1).`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Play version sync failed.');
});
