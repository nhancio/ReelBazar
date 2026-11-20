import assert from 'node:assert/strict';
import test from 'node:test';
import { accountDocId, buildAccountRecord, buildCardRecord, hashIp } from './myaccStore';
import type { CreatorStats, Valuation } from './instagramValuation';

const stats: CreatorStats = {
  username: 'Priya.Fashion',
  igUserId: '17841400008460056',
  name: 'Priya',
  accountType: 'Media_Creator',
  profilePictureUrl: 'https://example.com/p.jpg',
  followers: 248000,
  following: 412,
  mediaCount: 386,
  avgViews: 18500,
  avgLikes: 7200,
  avgComments: 480,
  engagementRate: 0.031,
  sampleSize: 2,
  viewsEstimated: false,
  source: 'instagram_login',
};

const valuation: Valuation = {
  currency: 'INR',
  perReel: 22500,
  perPost: 13500,
  perStory: 7500,
  packageTotal: 43500,
  monthlyPotential: 204000,
  monthlyAssumption: '4 reels · 4 posts · 8 stories a month',
  annualPotential: 2448000,
  saleMultiplier: 1.5,
  accountWorth: 3672000,
  engagementModifier: 0.94,
  estimated: false,
  formula: 'Account worth ≈ (monthly brand-deal potential × 12) × 1.5',
};

test('account doc id prefers IG user id, falls back to sanitised username', () => {
  assert.equal(accountDocId(stats), '17841400008460056');
  assert.equal(accountDocId({ ...stats, igUserId: undefined }), 'u_priya.fashion');
});

test('card record carries full stats, valuation, media sample — and never a token', () => {
  const rec = buildCardRecord({
    stats,
    valuation,
    media: [{ id: 'm1', mediaType: 'VIDEO', productType: 'REELS', timestamp: '2026-11-01T00:00:00Z', like_count: 10, comments_count: 2, views: 5000 }],
    request: { ipHash: hashIp('1.2.3.4'), userAgent: 'test-agent' },
  });
  assert.equal(rec.username, 'priya.fashion');
  assert.equal(rec.source, 'instagram_login');
  assert.equal(rec.stats.followers, 248000);
  assert.equal(rec.valuation.accountWorth, 3672000);
  assert.equal(rec.mediaSample[0]?.views, 5000);
  assert.equal(rec.request.ipHash?.length, 64);
  assert.ok(!JSON.stringify(rec).includes('access_token'));
});

test('account record tracks signup source and flattens last card values', () => {
  const rec = buildAccountRecord(stats, valuation);
  assert.equal(rec.username, 'priya.fashion');
  assert.equal(rec.connectedViaLogin, true);
  assert.equal(rec.lastValuation.accountWorth, 3672000);
  assert.equal(rec.lastStats.engagementRate, 0.031);
});

test('hashIp is stable and does not leak the raw ip', () => {
  assert.equal(hashIp('1.2.3.4'), hashIp('1.2.3.4'));
  assert.ok(!hashIp('1.2.3.4')?.includes('1.2.3.4'));
  assert.equal(hashIp(undefined), undefined);
});
