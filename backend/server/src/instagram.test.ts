import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateMedia, benchmarkEngagement, computeValuation, estimateAvgViews, reelRateInr, SALE_MULTIPLIER } from './instagramValuation';

test('valuation (INR): reel anchors post/story, monthly, and sale-value headline', () => {
  const v = computeValuation({
    username: 'demo',
    followers: 100_000,
    avgViews: 50_000,
    avgLikes: 3_000,
    avgComments: 100,
    engagementRate: 0.031,
    sampleSize: 20,
    viewsEstimated: false,
    source: 'instagram_login',
  });
  assert.equal(v.currency, 'INR');
  // (500 + 10k*1.5 + 40k*1.0) * ~0.94 engagement modifier ≈ ₹52k/reel
  assert.ok(v.perReel >= 40_000 && v.perReel <= 65_000, `perReel=${v.perReel}`);
  assert.ok(Math.abs(v.perPost / v.perReel - 0.6) < 0.1);
  assert.ok(Math.abs(v.perStory / v.perReel - 0.33) < 0.1);
  assert.equal(v.monthlyPotential, 4 * v.perReel + 4 * v.perPost + 8 * v.perStory);
  assert.equal(v.annualPotential, v.monthlyPotential * 12);
  assert.equal(v.saleMultiplier, SALE_MULTIPLIER);
  assert.ok(Math.abs(v.accountWorth - v.annualPotential * SALE_MULTIPLIER) <= 1000);
  assert.equal(v.packageTotal, v.perReel + v.perPost + v.perStory);
});

test('reel slabs are monotonic and engagement raises price', () => {
  assert.ok(reelRateInr(100_000) > reelRateInr(10_000));
  const base = { username: 'x', followers: 10_000, avgLikes: 0, avgComments: 0, sampleSize: 0, source: 'business_discovery' as const };
  const low = computeValuation({ ...base, avgViews: 0, engagementRate: benchmarkEngagement(10_000) / 4, viewsEstimated: true });
  const high = computeValuation({ ...base, avgViews: 0, engagementRate: benchmarkEngagement(10_000) * 2, viewsEstimated: true });
  assert.ok(high.perReel > low.perReel);
  assert.ok(estimateAvgViews(100_000) > 0 && estimateAvgViews(0) === 0);
});

test('aggregateMedia computes engagement and prefers measured views', () => {
  const s = aggregateMedia(
    { username: 'x', followers: 1000, source: 'instagram_login' },
    [
      { like_count: 100, comments_count: 10, views: 5000 },
      { like_count: 60, comments_count: 6, views: 3000 },
    ],
  );
  assert.equal(s.avgViews, 4000);
  assert.equal(s.viewsEstimated, false);
  assert.ok(Math.abs(s.engagementRate - 0.088) < 0.001);
});
