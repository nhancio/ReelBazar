import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePublicProfileHtml } from './instagramPublicProfile';

test('parsePublicProfileHtml reads og:description follower counts', () => {
  const html = `
<meta property="og:title" content="Didigam Nithin (&#064;didigam.nithin) &#x2022; Instagram photos and videos" />
<meta property="og:description" content="1,325 Followers, 503 Following, 59 Posts - See Instagram photos and videos from Didigam Nithin (&#064;didigam.nithin)" />
<meta property="og:image" content="https://example.com/p.jpg" />
<meta name="description" content="1,325 Followers, 503 Following, 59 Posts - Didigam Nithin (&#064;didigam.nithin) on Instagram: &quot;IITK'22 | AI&quot;" />
`;
  const p = parsePublicProfileHtml(html, 'didigam.nithin');
  assert.ok(p);
  assert.equal(p!.username, 'didigam.nithin');
  assert.equal(p!.name, 'Didigam Nithin');
  assert.equal(p!.followers, 1325);
  assert.equal(p!.following, 503);
  assert.equal(p!.mediaCount, 59);
  assert.equal(p!.profilePictureUrl, 'https://example.com/p.jpg');
  assert.equal(p!.biography, "IITK'22 | AI");
});

test('parsePublicProfileHtml returns null without counts', () => {
  assert.equal(parsePublicProfileHtml('<html><title>Instagram</title></html>', 'x'), null);
});
