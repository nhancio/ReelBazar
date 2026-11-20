import { Router } from 'express';
import { createRateLimit } from '../middleware/rateLimit';
import { aggregateMedia, computeValuation } from '../instagramValuation';
import { fetchPublicProfile } from '../instagramPublicProfile';
import { recordMyAccCard, recordMyAccEvent, requestMeta, type MediaSampleItem } from '../myaccStore';

/**
 * Rava /myacc — Instagram valuation.
 *
 *  1. Handle-only (default): public profile HTML meta (og:description) — no Meta
 *     token, no Facebook Page for the end user. Followers/posts only; views estimated.
 *  2. Handle-only (optional upgrade): Business Discovery if META_DISCOVERY_* set.
 *  3. Login (accurate, optional): Facebook Login for Business → Page → IG insights.
 */

// ---- Meta plumbing ----

const FB_GRAPH = 'https://graph.facebook.com/v21.0';
/** Default: Meta app "Rava myacc Connect" (FB Login for Business, user token). */
const DEFAULT_LOGIN_CONFIG_ID = '2159564441320574';

const env = (k: string) => (process.env[k] ?? '').trim();
const loginConfigured = () => Boolean(env('INSTAGRAM_APP_ID') && env('INSTAGRAM_APP_SECRET'));
const discoveryConfigured = () => Boolean(env('META_DISCOVERY_IG_ID') && env('META_DISCOVERY_TOKEN'));
const redirectUri = () => env('INSTAGRAM_REDIRECT_URI') || 'https://rava.one/myacc';
const loginConfigId = () => env('INSTAGRAM_LOGIN_CONFIG_ID') || DEFAULT_LOGIN_CONFIG_ID;

async function graphJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = data.error as { message?: string } | undefined;
      throw new Error(err?.message || `Meta API error (${res.status})`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

type IgResolved = {
  igUserId: string;
  /** Prefer Page token when present; falls back to user token. */
  accessToken: string;
};

/** Resolve the tester's IG Business/Creator account linked to a Page they can manage. */
async function resolveIgAccount(userToken: string): Promise<IgResolved> {
  const accounts = await graphJson(
    `${FB_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`,
  );
  const pages = (accounts.data as Array<Record<string, unknown>> | undefined) ?? [];
  for (const page of pages) {
    const ig = page.instagram_business_account as { id?: string } | undefined;
    const pageToken = str(page.access_token) ?? userToken;
    if (ig?.id) return { igUserId: ig.id, accessToken: pageToken };
  }
  throw new Error(
    'No Instagram Business/Creator account linked to a Facebook Page we can access. Link @handle to a Page in Meta Business Suite, then try Connect again.',
  );
}

export const instagramRouter = Router();
const lookupLimit = createRateLimit({ keyPrefix: 'ig-lookup', windowMs: 15 * 60 * 1000, max: 30, message: 'Too many lookups. Try again later.' });
const authLimit = createRateLimit({ keyPrefix: 'ig-auth', windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts. Try again later.' });

instagramRouter.get('/config', (_req, res) => {
  res.json({
    loginConfigured: loginConfigured(),
    /** Always true: @handle lookup uses public Instagram HTML (no discovery keys). */
    handleLookupConfigured: true,
    discoveryConfigured: discoveryConfigured(),
    loginConfigId: loginConfigured() ? loginConfigId() : undefined,
  });
});

instagramRouter.get('/auth/url', (_req, res) => {
  if (!loginConfigured()) {
    return res.status(503).json({ code: 'META_NOT_CONFIGURED', error: 'Instagram login is not configured yet. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET on the server.' });
  }
  // Facebook Login for Business — config_id replaces scope list.
  const url =
    `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(env('INSTAGRAM_APP_ID'))}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    `&config_id=${encodeURIComponent(loginConfigId())}` +
    `&response_type=code`;
  res.json({ url });
});

/** Exchange the OAuth code, then build the card from the user's own account + media insights. */
instagramRouter.post('/auth/exchange', authLimit, async (req, res) => {
  if (!loginConfigured()) {
    return res.status(503).json({ code: 'META_NOT_CONFIGURED', error: 'Instagram login is not configured yet.' });
  }
  const code = typeof req.body?.code === 'string' ? req.body.code.replace(/#_$/, '') : '';
  if (!code) return res.status(400).json({ error: 'Missing code.' });
  try {
    const tokenQs = new URLSearchParams({
      client_id: env('INSTAGRAM_APP_ID'),
      client_secret: env('INSTAGRAM_APP_SECRET'),
      redirect_uri: redirectUri(),
      code,
    });
    const tokenRes = await graphJson(`${FB_GRAPH}/oauth/access_token?${tokenQs}`);
    // Token is used once to build + record the card and never stored (see myaccStore).
    const userToken = str(tokenRes.access_token) ?? '';
    if (!userToken) throw new Error('Meta did not return an access token.');

    const { igUserId, accessToken } = await resolveIgAccount(userToken);
    const me = await graphJson(
      `${FB_GRAPH}/${igUserId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${encodeURIComponent(accessToken)}`,
    );
    const mediaRes = await graphJson(
      `${FB_GRAPH}/${igUserId}/media?fields=id,media_type,media_product_type,like_count,comments_count,timestamp&limit=25&access_token=${encodeURIComponent(accessToken)}`,
    );
    const media = ((mediaRes.data as Array<Record<string, unknown>>) ?? []).map((m) => ({
      like_count: num(m.like_count),
      comments_count: num(m.comments_count),
      productType: str(m.media_product_type),
      mediaType: str(m.media_type),
      timestamp: str(m.timestamp),
      id: str(m.id),
    }));
    // Views only exist via per-media insights; fetch for the first 12 reels/videos, tolerate failures.
    const withViews = await Promise.all(
      media.map(async (m, i) => {
        if (i >= 12 || !m.id || (m.productType !== 'REELS' && m.productType !== 'FEED')) return { ...m, views: undefined };
        try {
          const ins = await graphJson(`${FB_GRAPH}/${m.id}/insights?metric=views&access_token=${encodeURIComponent(accessToken)}`);
          const first = ((ins.data as Array<{ values?: Array<{ value?: number }> }>) ?? [])[0];
          return { ...m, views: first?.values?.[0]?.value };
        } catch {
          return { ...m, views: undefined };
        }
      }),
    );
    const stats = aggregateMedia(
      {
        username: str(me.username) ?? '',
        igUserId,
        name: str(me.name),
        profilePictureUrl: str(me.profile_picture_url),
        followers: num(me.followers_count),
        following: num(me.follows_count),
        mediaCount: num(me.media_count),
        source: 'instagram_login',
      },
      withViews,
    );
    // Extra account-level insights (views/reach/engagement/follower trend) — stored
    // on the card when Meta returns them; <100-follower accounts get nothing back.
    let accountInsights: unknown;
    try {
      accountInsights = await graphJson(
        `${FB_GRAPH}/${igUserId}/insights?metric=views,reach,accounts_engaged,follower_count&period=day&metric_type=total_value&access_token=${encodeURIComponent(accessToken)}`,
      );
    } catch {
      accountInsights = undefined;
    }
    const valuation = computeValuation(stats);
    const mediaSample: MediaSampleItem[] = withViews.map((m) => ({
      id: m.id,
      mediaType: m.mediaType,
      productType: m.productType,
      timestamp: m.timestamp,
      like_count: m.like_count,
      comments_count: m.comments_count,
      views: m.views,
    }));
    await recordMyAccCard({ stats, valuation, media: mediaSample, accountInsights, request: requestMeta(req) });
    res.json({ stats, valuation });
  } catch (e) {
    await recordMyAccEvent({ type: 'login_failed', error: e instanceof Error ? e.message : 'Meta request failed.', request: requestMeta(req) });
    res.status(502).json({ error: e instanceof Error ? e.message : 'Meta request failed.' });
  }
});

/** Handle-only card: public profile scrape first; Business Discovery if configured and public fails. */
instagramRouter.get('/lookup', lookupLimit, async (req, res) => {
  const username = (typeof req.query.username === 'string' ? req.query.username : '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return res.status(400).json({ error: 'Enter a valid Instagram @handle.' });

  try {
    const profile = await fetchPublicProfile(username);
    const stats = aggregateMedia(
      {
        username: profile.username,
        name: profile.name,
        biography: profile.biography,
        profilePictureUrl: profile.profilePictureUrl,
        followers: profile.followers,
        following: profile.following,
        mediaCount: profile.mediaCount,
        source: 'public_profile',
      },
      [],
    );
    const valuation = computeValuation(stats);
    await recordMyAccCard({ stats, valuation, media: [], request: requestMeta(req) });
    return res.json({ stats, valuation });
  } catch (publicErr) {
    if (!discoveryConfigured()) {
      const msg = publicErr instanceof Error ? publicErr.message : 'Could not read that public profile.';
      await recordMyAccEvent({ type: 'lookup_failed', username, source: 'public_profile', error: msg, request: requestMeta(req) });
      return res.status(502).json({ error: msg });
    }
  }

  try {
    const fields = `business_discovery.username(${username}){username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,media.limit(25){id,media_type,media_product_type,timestamp,like_count,comments_count}}`;
    const data = await graphJson(
      `${FB_GRAPH}/${env('META_DISCOVERY_IG_ID')}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(env('META_DISCOVERY_TOKEN'))}`,
    );
    const bd = data.business_discovery as Record<string, unknown> | undefined;
    if (!bd) {
      await recordMyAccEvent({ type: 'lookup_failed', username, source: 'business_discovery', error: 'Account not found, private, or not a Business/Creator account.', request: requestMeta(req) });
      return res.status(404).json({ error: 'Account not found, private, or not a Business/Creator account.' });
    }
    const media = (((bd.media as { data?: Array<Record<string, unknown>> } | undefined)?.data) ?? []).map((m) => ({
      like_count: num(m.like_count),
      comments_count: num(m.comments_count),
      id: str(m.id),
      mediaType: str(m.media_type),
      productType: str(m.media_product_type),
      timestamp: str(m.timestamp),
    }));
    const stats = aggregateMedia(
      {
        username: str(bd.username) ?? username,
        name: str(bd.name),
        biography: str(bd.biography),
        website: str(bd.website),
        profilePictureUrl: str(bd.profile_picture_url),
        followers: num(bd.followers_count),
        following: num(bd.follows_count),
        mediaCount: num(bd.media_count),
        source: 'business_discovery',
      },
      media,
    );
    const valuation = computeValuation(stats);
    const mediaSample: MediaSampleItem[] = media.map((m) => ({
      id: m.id,
      mediaType: m.mediaType,
      productType: m.productType,
      timestamp: m.timestamp,
      like_count: m.like_count,
      comments_count: m.comments_count,
    }));
    await recordMyAccCard({ stats, valuation, media: mediaSample, request: requestMeta(req) });
    res.json({ stats, valuation });
  } catch (e) {
    await recordMyAccEvent({ type: 'lookup_failed', username, source: 'business_discovery', error: e instanceof Error ? e.message : 'Meta request failed.', request: requestMeta(req) });
    res.status(502).json({ error: e instanceof Error ? e.message : 'Meta request failed.' });
  }
});

/** Client funnel events from the card (share / download). Fire-and-forget from the UI. */
instagramRouter.post('/event', lookupLimit, async (req, res) => {
  const type = req.body?.type === 'share' || req.body?.type === 'download' ? req.body.type : null;
  const username = typeof req.body?.username === 'string' ? req.body.username : undefined;
  if (!type) return res.status(400).json({ error: 'Unknown event.' });
  await recordMyAccEvent({ type, username, request: requestMeta(req) });
  res.status(204).end();
});
