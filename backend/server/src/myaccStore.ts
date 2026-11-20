import { createHash } from 'node:crypto';
import { admin, db } from './utils/firebase';
import type { CreatorStats, Valuation } from './instagramValuation';

/**
 * Firestore persistence for rava.one/myacc — deliberately separate from the
 * app's collections (users/reels/orders/... are never touched):
 *
 *   myacc_accounts/{igUserId|u_username}  one doc per Instagram account seen:
 *                                         profile, first/last seen, whether
 *                                         they connected via Instagram Login
 *                                         ("signed up"), last stats + valuation.
 *   myacc_cards/{autoId}                  every card ever generated: full stats,
 *                                         full valuation, the media sample the
 *                                         numbers came from, account insights
 *                                         (login path), request meta.
 *   myacc_events/{autoId}                 funnel + failures: lookup/login
 *                                         success & failure, share, download.
 *
 * Access tokens and OAuth codes are NEVER written here. Writes are best-effort:
 * a Firestore hiccup must never break the card the user asked for.
 */

export interface MediaSampleItem {
  id?: string;
  mediaType?: string;
  productType?: string;
  timestamp?: string;
  like_count: number;
  comments_count: number;
  views?: number;
}

export interface MyAccRequestMeta {
  ipHash?: string;
  userAgent?: string;
}

const FieldValue = admin.firestore.FieldValue;

export const hashIp = (ip?: string) =>
  ip ? createHash('sha256').update(ip).digest('hex') : undefined;

export const requestMeta = (req: { ip?: string; headers: Record<string, unknown> }): MyAccRequestMeta => ({
  ipHash: hashIp(req.ip),
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : undefined,
});

/** Stable doc id: Meta's IG user id when we have it, else the lowercased handle. */
export function accountDocId(stats: CreatorStats): string {
  if (stats.igUserId) return stats.igUserId;
  return `u_${stats.username.toLowerCase().replace(/[^a-z0-9._]/g, '_')}`;
}

export function buildCardRecord(input: {
  stats: CreatorStats;
  valuation: Valuation;
  media?: MediaSampleItem[];
  accountInsights?: unknown;
  request?: MyAccRequestMeta;
}) {
  const { stats, valuation } = input;
  return {
    accountRef: accountDocId(stats),
    username: stats.username.toLowerCase(),
    source: stats.source,
    stats: { ...stats },
    valuation: { ...valuation },
    mediaSample: input.media ?? [],
    ...(input.accountInsights !== undefined ? { accountInsights: input.accountInsights } : {}),
    request: input.request ?? {},
  };
}

export function buildAccountRecord(stats: CreatorStats, valuation: Valuation) {
  return {
    username: stats.username.toLowerCase(),
    ...(stats.igUserId ? { igUserId: stats.igUserId } : {}),
    profile: {
      name: stats.name ?? null,
      accountType: stats.accountType ?? null,
      profilePictureUrl: stats.profilePictureUrl ?? null,
      biography: stats.biography ?? null,
      website: stats.website ?? null,
      followers: stats.followers,
      following: stats.following ?? null,
      mediaCount: stats.mediaCount ?? null,
    },
    connectedViaLogin: stats.source === 'instagram_login',
    lastSource: stats.source,
    lastStats: { ...stats },
    lastValuation: { ...valuation },
  };
}

async function write(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error('[myacc] firestore write failed', e);
  }
}

/** Upsert the account + append the card. Call before responding; never throws. */
export async function recordMyAccCard(input: {
  stats: CreatorStats;
  valuation: Valuation;
  media?: MediaSampleItem[];
  accountInsights?: unknown;
  request?: MyAccRequestMeta;
}): Promise<void> {
  const card = buildCardRecord(input);
  const account = buildAccountRecord(input.stats, input.valuation);
  await write(async () => {
    const firestore = db();
    const accountRef = firestore.collection('myacc_accounts').doc(card.accountRef);
    const existing = await accountRef.get();
    await accountRef.set(
      {
        ...account,
        firstSeenAt: existing.exists ? existing.data()?.firstSeenAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
        lastCardAt: FieldValue.serverTimestamp(),
        cardCount: FieldValue.increment(1),
      },
      { merge: true },
    );
    await firestore.collection('myacc_cards').add({ ...card, createdAt: FieldValue.serverTimestamp() });
    await firestore.collection('myacc_events').add({
      type: 'card_created',
      username: card.username,
      source: card.source,
      request: card.request,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function recordMyAccEvent(input: {
  type: 'lookup_failed' | 'login_failed' | 'share' | 'download';
  username?: string;
  source?: string;
  error?: string;
  request?: MyAccRequestMeta;
}): Promise<void> {
  await write(() =>
    db()
      .collection('myacc_events')
      .add({
        type: input.type,
        ...(input.username ? { username: input.username.toLowerCase() } : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(input.error ? { error: input.error.slice(0, 500) } : {}),
        request: input.request ?? {},
        createdAt: FieldValue.serverTimestamp(),
      }),
  );
}
