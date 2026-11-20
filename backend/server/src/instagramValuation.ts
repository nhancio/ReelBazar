/**
 * Pure Instagram valuation math for /myacc (no I/O, unit-tested).
 * Prices use India creator-rate benchmarks in INR.
 * Headline worth = annual brand-deal potential x SALE_MULTIPLIER (one-off sale estimate).
 */

export interface CreatorStats {
  username: string;
  /** Meta IG user id (login path); absent for Business Discovery lookups. */
  igUserId?: string;
  name?: string;
  accountType?: string;
  profilePictureUrl?: string;
  biography?: string;
  website?: string;
  followers: number;
  following?: number;
  mediaCount?: number;
  /** Average views across sampled reels/videos; estimated from followers when Meta gives none. */
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  /** (avgLikes + avgComments) / followers, 0..1 */
  engagementRate: number;
  sampleSize: number;
  viewsEstimated: boolean;
  source: 'instagram_login' | 'business_discovery' | 'public_profile';
}

export interface Valuation {
  currency: 'INR';
  perReel: number;
  perPost: number;
  perStory: number;
  /** 1 reel + 1 post + 1 story */
  packageTotal: number;
  monthlyPotential: number;
  monthlyAssumption: string;
  annualPotential: number;
  /** Account-sale multiplier applied to annual brand-deal potential. */
  saleMultiplier: number;
  /** Headline "account worth": annualPotential x saleMultiplier (one-off sale estimate). */
  accountWorth: number;
  engagementModifier: number;
  estimated: boolean;
  formula: string;
}

/** Creator accounts are platform-dependent and illiquid, so they trade well below
 *  SaaS/business multiples: 1.5x one year of brand-deal earning potential. */
export const SALE_MULTIPLIER = 1.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Typical reel views as a share of followers (fitted to India/global calculator benchmarks). */
export function estimateAvgViews(followers: number): number {
  if (followers <= 0) return 0;
  const ratio =
    followers < 10_000 ? 0.18 : followers < 50_000 ? 0.1 : followers < 250_000 ? 0.07 : followers < 1_000_000 ? 0.055 : 0.04;
  return Math.round(followers * ratio);
}

/** Engagement rate a healthy account at this size usually has. */
export function benchmarkEngagement(followers: number): number {
  if (followers >= 1_000_000) return 0.015;
  if (followers >= 250_000) return 0.02;
  if (followers >= 50_000) return 0.035;
  if (followers >= 10_000) return 0.05;
  return 0.08;
}

const roundInr = (v: number) =>
  v >= 100_000 ? Math.round(v / 1000) * 1000 : v >= 10_000 ? Math.round(v / 500) * 500 : v >= 1000 ? Math.round(v / 100) * 100 : Math.max(50, Math.round(v / 50) * 50);

/**
 * India per-view slabs for a reel (fitted to Indian creator rate cards):
 * ₹1.50/view for the first 10k views, ₹1.00/view up to 100k, ₹0.60/view after,
 * plus a ₹500 production base. Effective CPM lands near ₹1,100–1,500.
 */
export function reelRateInr(avgViews: number): number {
  const slab = Math.min(avgViews, 10_000) * 1.5 + Math.min(Math.max(avgViews - 10_000, 0), 90_000) * 1.0 + Math.max(avgViews - 100_000, 0) * 0.6;
  return 500 + slab;
}

/**
 * Reel price is engagement-adjusted (vs accounts of the same size, capped
 * 0.5x–1.6x). Post = 0.6x reel, story = 0.33x reel — the ratios Indian rate
 * calculators consistently use. Headline worth = annual brand-deal potential
 * (monthly at 4 reels + 4 posts + 8 stories) x SALE_MULTIPLIER.
 */
export function computeValuation(stats: CreatorStats): Valuation {
  const avgViews = stats.avgViews > 0 ? stats.avgViews : estimateAvgViews(stats.followers);
  const benchmark = benchmarkEngagement(stats.followers);
  const engagementModifier = stats.engagementRate > 0 ? clamp(Math.sqrt(stats.engagementRate / benchmark), 0.5, 1.6) : 1;
  const perReel = roundInr(reelRateInr(avgViews) * engagementModifier);
  const perPost = roundInr(perReel * 0.6);
  const perStory = roundInr(perReel * 0.33);
  const monthlyPotential = 4 * perReel + 4 * perPost + 8 * perStory;
  const annualPotential = monthlyPotential * 12;
  return {
    currency: 'INR',
    perReel,
    perPost,
    perStory,
    packageTotal: perReel + perPost + perStory,
    monthlyPotential,
    monthlyAssumption: '4 reels · 4 posts · 8 stories a month',
    annualPotential,
    saleMultiplier: SALE_MULTIPLIER,
    accountWorth: roundInr(annualPotential * SALE_MULTIPLIER),
    engagementModifier: Math.round(engagementModifier * 100) / 100,
    estimated: stats.viewsEstimated,
    formula: `Account worth ≈ (monthly brand-deal potential × 12) × ${SALE_MULTIPLIER}`,
  };
}

export function aggregateMedia(
  base: Omit<CreatorStats, 'avgLikes' | 'avgComments' | 'engagementRate' | 'sampleSize' | 'avgViews' | 'viewsEstimated'> & { avgViews?: number },
  media: Array<{ like_count?: number; comments_count?: number; views?: number }>,
): CreatorStats {
  const n = media.length || 1;
  const avgLikes = media.reduce((s, m) => s + (m.like_count ?? 0), 0) / n;
  const avgComments = media.reduce((s, m) => s + (m.comments_count ?? 0), 0) / n;
  const viewed = media.filter((m) => typeof m.views === 'number' && (m.views as number) > 0);
  const measuredAvgViews = viewed.length ? viewed.reduce((s, m) => s + (m.views as number), 0) / viewed.length : 0;
  const viewsEstimated = measuredAvgViews === 0;
  return {
    ...base,
    avgViews: Math.round(measuredAvgViews || base.avgViews || estimateAvgViews(base.followers)),
    avgLikes: Math.round(avgLikes),
    avgComments: Math.round(avgComments),
    engagementRate: base.followers > 0 ? (avgLikes + avgComments) / base.followers : 0,
    sampleSize: media.length,
    viewsEstimated,
  };
}
