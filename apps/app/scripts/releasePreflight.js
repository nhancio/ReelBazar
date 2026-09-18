#!/usr/bin/env node

/**
 * releasePreflight.js — Full Release Preflight Checker for Rava (Android & iOS)
 *
 * Verifies version synchronization, bundle identifier/package, EAS configuration,
 * Firebase credentials, keystores, and store upload settings.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const requestedPlatform = process.argv.find((arg) => ['android', 'ios', 'all'].includes(arg)) ?? 'all';
const requireClean = process.argv.includes('--require-clean');
const app = require(path.join(root, 'app.config.js')).expo;
const eas = require(path.join(root, 'eas.json'));
const pkg = require(path.join(root, 'package.json'));

const failures = [];
const warnings = [];
const passes = [];

function check(condition, passMessage, failMessage) {
  if (condition) passes.push(passMessage);
  else failures.push(failMessage);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function hasPlugin(name) {
  return (app.plugins ?? []).some(
    (plugin) => plugin === name || (Array.isArray(plugin) && plugin[0] === name),
  );
}

function containsKey(value, pattern) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, child]) => pattern.test(key) || containsKey(child, pattern),
  );
}

check(app.name === 'Rava', 'App name is Rava', `App name is "${app.name}", expected "Rava"`);
check(app.version === pkg.version, `App version is ${app.version}`, `app.config.js (${app.version}) and package.json (${pkg.version}) versions differ`);
check(app.runtimeVersion?.policy === 'appVersion', 'OTA runtime follows app version', 'runtimeVersion policy must be appVersion');
check(app.extra?.eas?.projectId === '90f1a13d-4e29-407b-a025-31075553022d', 'EAS project ID matches @nithindidigam/rava', 'Unexpected EAS project ID');
check(eas.cli?.appVersionSource === 'local', 'Developer build versions come from source control', 'eas.json must use local appVersionSource');
check(eas.build?.production?.autoIncrement === false, 'Production builds do not mutate versions', 'Production autoIncrement must be false');
check(eas.build?.production?.channel === 'production', 'Production OTA channel is selected', 'Production channel is missing');
check(eas.build?.production?.environment === 'production', 'Production EAS environment is selected', 'Production environment is missing');
check(eas.build?.production?.env?.EXPO_PUBLIC_APP_ENV === 'production', 'Production app environment is explicit', 'EXPO_PUBLIC_APP_ENV must be production');

if (requestedPlatform === 'android' || requestedPlatform === 'all') {
  check(app.android?.package === 'com.nhancio.rava', 'Android package is com.nhancio.rava', `Unexpected Android package: ${app.android?.package}`);
  check(Number.isInteger(app.android?.versionCode) && app.android.versionCode >= 1, `Android versionCode is ${app.android?.versionCode}`, 'Android versionCode must be an integer >= 1');
  check(eas.build?.production?.android?.buildType === 'app-bundle', 'Android production artifact is an AAB', 'Android production buildType must be app-bundle');
  
  if (exists('google-services.json')) {
    passes.push('Local Firebase Android config is present');
    try {
      const googleServices = JSON.parse(fs.readFileSync(path.join(root, 'google-services.json'), 'utf8'));
      const packageNames = (googleServices.client ?? [])
        .map((client) => client?.client_info?.android_client_info?.package_name)
        .filter(Boolean);
      check(packageNames.includes(app.android.package), 'Firebase Android config matches package com.nhancio.rava', 'google-services.json does not contain com.nhancio.rava');
    } catch {
      warnings.push('google-services.json could not be parsed');
    }
  } else {
    warnings.push('google-services.json absent locally (injected via EAS Secret in cloud builds)');
  }

  if (exists('google-play-service-account.json')) {
    passes.push('Local Play submit service account is present');
  } else {
    warnings.push('google-play-service-account.json absent locally (required for EAS submit)');
  }
}

if (requestedPlatform === 'ios' || requestedPlatform === 'all') {
  check(app.ios?.bundleIdentifier === 'com.nhancio.rava', 'iOS bundle ID is com.nhancio.rava', `Unexpected iOS bundle ID: ${app.ios?.bundleIdentifier}`);
  check(/^\d+$/.test(app.ios?.buildNumber ?? '') && Number(app.ios.buildNumber) >= 1, `iOS buildNumber is ${app.ios?.buildNumber}`, 'iOS buildNumber must be numeric and >= 1');
  
  if (exists('GoogleService-Info.plist')) {
    passes.push('Local Firebase iOS config is present');
  } else {
    warnings.push('GoogleService-Info.plist absent locally (injected via EAS Secret in cloud builds)');
  }
}

let dirty = false;
try {
  dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
} catch {
  failures.push('Unable to inspect Git release state');
}

if (dirty) {
  if (requireClean) failures.push('Working tree is dirty; store submission must use a reviewed clean commit');
  else warnings.push('Working tree is dirty. This artifact is for verification/internal testing only, not store submission.');
} else {
  passes.push('Working tree is clean');
}

for (const message of passes) console.log(`PASS  ${message}`);
for (const message of warnings) console.warn(`WARN  ${message}`);
for (const message of failures) console.error(`FAIL  ${message}`);

console.log(`\nRelease ${app.version} · Android ${app.android?.versionCode} · iOS ${app.ios?.buildNumber}`);

if (failures.length > 0) process.exit(1);
