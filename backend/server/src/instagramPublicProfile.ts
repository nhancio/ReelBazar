/**
 * Public Instagram profile metrics via HTML meta tags (og:description).
 * No Meta app token. Uses a crawler User-Agent — Instagram serves follower/post
 * counts in og:description for public profiles. Reel view counts are not in meta;
 * valuation estimates views from followers (viewsEstimated: true).
 *
 * ponytail: crawler-UA HTML only — if IG stops serving og:description, swap to
 * a browser/unlocker scrape. Ceiling: no likes/comments/views from this path.
 */

const PROFILE_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

export type PublicProfile = {
  username: string;
  name?: string;
  biography?: string;
  profilePictureUrl?: string;
  followers: number;
  following: number;
  mediaCount: number;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

function metaContent(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`,
    'i',
  );
  const m = html.match(re);
  const raw = m?.[1] ?? m?.[2];
  return raw ? decodeEntities(raw) : undefined;
}

function parseCount(raw: string): number {
  const n = Number(raw.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Parse og:description shaped like: "1,325 Followers, 503 Following, 59 Posts - … (@user)" */
export function parsePublicProfileHtml(html: string, fallbackUsername: string): PublicProfile | null {
  const desc = metaContent(html, 'og:description') || metaContent(html, 'description');
  if (!desc) return null;
  const m = desc.match(/([\d,]+)\s+Followers,\s*([\d,]+)\s+Following,\s*([\d,]+)\s+Posts/i);
  if (!m) return null;
  const followers = parseCount(m[1]);
  const following = parseCount(m[2]);
  const mediaCount = parseCount(m[3]);
  if (![followers, following, mediaCount].every((n) => Number.isFinite(n))) return null;

  const title = metaContent(html, 'og:title') || '';
  const nameMatch = title.match(/^(.+?)\s*\(/);
  const bioMatch = desc.match(/on Instagram:\s*"([\s\S]*)"\s*$/i);
  const handleFromTitle = title.match(/@([A-Za-z0-9._]+)/)?.[1];

  return {
    username: handleFromTitle || fallbackUsername,
    name: nameMatch?.[1]?.trim() || undefined,
    biography: bioMatch?.[1]?.trim() || undefined,
    profilePictureUrl: metaContent(html, 'og:image'),
    followers,
    following,
    mediaCount,
  };
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile> {
  const handle = username.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) throw new Error('Enter a valid Instagram @handle.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(handle)}/`, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': PROFILE_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (res.status === 404) throw new Error('Account not found, private, or not available.');
    if (!res.ok) throw new Error(`Instagram returned ${res.status}. Try again in a moment.`);
    const html = await res.text();
    const profile = parsePublicProfileHtml(html, handle);
    if (!profile) {
      throw new Error('Could not read that public profile. It may be private, age-gated, or temporarily blocked.');
    }
    return profile;
  } finally {
    clearTimeout(timer);
  }
}
